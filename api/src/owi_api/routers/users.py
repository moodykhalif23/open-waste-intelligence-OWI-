import uuid
from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from owi_api.audit import client_ip, record_audit
from owi_api.db import get_session
from owi_api.models.enums import UserRole
from owi_api.models.observation import Observation
from owi_api.models.operations import CollectionEvent
from owi_api.models.registry import User
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims, hash_password

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=5, max_length=30)
    role: UserRole
    # Collectors authenticate via issued device tokens, not passwords.
    password: str | None = Field(default=None, min_length=8)


class UserOut(BaseModel):
    id: uuid.UUID
    name: str
    phone: str | None
    role: UserRole


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    body: UserCreate,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> UserOut:
    if session.scalar(select(User).where(User.phone == body.phone)):
        raise HTTPException(status_code=409, detail="phone already registered")

    user = User(
        org_id=requester.org_id,
        name=body.name,
        phone=body.phone,
        role=body.role,
        password_hash=hash_password(body.password) if body.password else None,
    )
    session.add(user)
    session.flush()
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="user.create",
        entity="user",
        entity_id=user.id,
        ip=client_ip(request),
        detail={"role": body.role.value},
    )
    session.commit()
    return UserOut(id=user.id, name=user.name, phone=user.phone, role=user.role)


@router.post("/{user_id}/revoke-tokens", status_code=204)
def revoke_tokens(
    user_id: uuid.UUID,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> None:
    """Lost/stolen phone: invalidates every token the user holds, immediately."""
    user = session.get(User, user_id)
    if user is None or user.org_id != requester.org_id:
        raise HTTPException(status_code=404, detail="user not found")
    user.token_version += 1
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="user.revoke_tokens",
        entity="user",
        entity_id=user.id,
        ip=client_ip(request),
    )
    session.commit()


@router.get("/{user_id}/export")
def export_user(
    user_id: uuid.UUID,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
) -> dict[str, object]:
    """DSAR access/portability: everything the platform holds about one person."""
    user = session.get(User, user_id)
    if user is None or user.org_id != requester.org_id:
        raise HTTPException(status_code=404, detail="user not found")
    observations = session.execute(
        select(
            Observation.id,
            Observation.captured_at,
            func.ST_Y(Observation.location),
            func.ST_X(Observation.location),
            Observation.human_fill_tap,
        ).where(Observation.collector_id == user.id, Observation.org_id == requester.org_id)
    ).all()
    collections = session.execute(
        select(CollectionEvent.id, CollectionEvent.bin_id, CollectionEvent.occurred_at).where(
            CollectionEvent.collector_id == user.id, CollectionEvent.org_id == requester.org_id
        )
    ).all()
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="user.export",
        entity="user",
        entity_id=user.id,
        ip=client_ip(request),
    )
    session.commit()
    return {
        "user": {
            "id": str(user.id),
            "name": user.name,
            "phone": user.phone,
            "role": user.role.value,
            "created_at": user.created_at.isoformat(),
        },
        "observations": [
            {
                "id": str(oid),
                "captured_at": captured.isoformat(),
                "lat": lat,
                "lng": lng,
                "fill_tap": fill.value if fill else None,
            }
            for oid, captured, lat, lng, fill in observations
        ],
        "collections": [
            {"id": str(cid), "bin_id": str(bid), "occurred_at": occurred.isoformat()}
            for cid, bid, occurred in collections
        ],
    }


@router.delete("/{user_id}", status_code=204)
def erase_user(
    user_id: uuid.UUID,
    request: Request,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
) -> None:
    """DSAR erasure: PII gone, tokens dead, contributions de-attributed; aggregates stay."""
    if user_id == requester.user_id:
        raise HTTPException(status_code=400, detail="cannot erase your own account")
    user = session.get(User, user_id)
    if user is None or user.org_id != requester.org_id or user.deleted_at is not None:
        raise HTTPException(status_code=404, detail="user not found")

    session.execute(
        update(Observation)
        .where(Observation.collector_id == user.id, Observation.org_id == requester.org_id)
        .values(collector_id=None)
    )
    session.execute(
        update(CollectionEvent)
        .where(CollectionEvent.collector_id == user.id, CollectionEvent.org_id == requester.org_id)
        .values(collector_id=None)
    )
    user.name = "erased user"
    user.phone = None
    user.password_hash = None
    user.token_version += 1
    user.deleted_at = datetime.now(UTC)
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="user.erase",
        entity="user",
        entity_id=user.id,
        ip=client_ip(request),
    )
    session.commit()


@router.get("", response_model=list[UserOut])
def list_users(
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> list[UserOut]:
    users = session.scalars(
        select(User).where(User.org_id == requester.org_id, User.deleted_at.is_(None))
    )
    return [UserOut(id=u.id, name=u.name, phone=u.phone, role=u.role) for u in users]
