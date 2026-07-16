import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.analytics.cleanliness_refresh import refresh_cleanliness
from owi_api.analytics.refresh import refresh_bin_health
from owi_api.audit import client_ip, record_audit
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.ingestion.storage import ObjectStore, get_store
from owi_api.maintenance import purge_expired_quarantine
from owi_api.models.audit import AuditLog
from owi_api.models.enums import UserRole
from owi_api.models.registry import User
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


def get_object_store() -> ObjectStore:
    return get_store(settings)


@router.post("/analytics/refresh")
def run_analytics_refresh(
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN, UserRole.COORDINATOR)],
    session: Annotated[Session, Depends(get_session)],
) -> dict[str, int]:
    return {
        "bins": refresh_bin_health(session),
        "cleanliness_areas": refresh_cleanliness(session),
    }


@router.post("/quarantine/purge")
def purge_quarantine(
    request: Request,
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
    store: Annotated[ObjectStore, Depends(get_object_store)],
) -> dict[str, int]:
    purged = purge_expired_quarantine(session, store, settings.quarantine_retention_hours)
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="quarantine.purge",
        entity="observation",
        ip=client_ip(request),
        detail={"purged": purged},
    )
    session.commit()
    return {"purged": purged}


class AuditOut(BaseModel):
    id: uuid.UUID
    created_at: datetime
    actor_name: str | None
    action: str
    entity: str
    entity_id: uuid.UUID | None
    ip: str | None
    detail: dict[str, object]


@router.get("/audit", response_model=list[AuditOut])
def list_audit(
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
    action: str | None = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[AuditOut]:
    query = (
        select(AuditLog, User.name)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .where(AuditLog.org_id == requester.org_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if action:
        query = query.where(AuditLog.action == action)
    return [
        AuditOut(
            id=row.id,
            created_at=row.created_at,
            actor_name=name,
            action=row.action,
            entity=row.entity,
            entity_id=row.entity_id,
            ip=row.ip,
            detail=row.detail,
        )
        for row, name in session.execute(query).all()
    ]
