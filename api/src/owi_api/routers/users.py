import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.db import get_session
from owi_api.models.enums import UserRole
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
    session.commit()
    return UserOut(id=user.id, name=user.name, phone=user.phone, role=user.role)


@router.post("/{user_id}/revoke-tokens", status_code=204)
def revoke_tokens(
    user_id: uuid.UUID,
    session: Annotated[Session, Depends(get_session)],
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
) -> None:
    """Lost/stolen phone: invalidates every token the user holds, immediately."""
    user = session.get(User, user_id)
    if user is None or user.org_id != requester.org_id:
        raise HTTPException(status_code=404, detail="user not found")
    user.token_version += 1
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
