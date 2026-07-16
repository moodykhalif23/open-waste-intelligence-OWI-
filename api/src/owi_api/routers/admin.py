import csv
import io
import uuid
import zipfile
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request, Response
from geoalchemy2 import Geometry
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.analytics.cleanliness_refresh import refresh_cleanliness
from owi_api.analytics.refresh import refresh_bin_health
from owi_api.audit import client_ip, record_audit
from owi_api.config import settings
from owi_api.db import get_session
from owi_api.ingestion.storage import ObjectStore, get_store
from owi_api.maintenance import purge_expired_images, purge_expired_quarantine
from owi_api.models import (
    Bin,
    BinHealthDaily,
    CleanlinessDaily,
    CollectionEvent,
    DumpingCandidate,
    DumpingEvent,
    DumpingIntervention,
    DumpingSite,
    MaterialPrice,
    MLModel,
    Observation,
    Prediction,
    RecyclingPartner,
    Route,
    RouteStop,
    Site,
    Truck,
    User,
    VolunteerEvent,
)
from owi_api.models.audit import AuditLog
from owi_api.models.enums import UserRole
from owi_api.models.org_settings import OrgSettings
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


class OrgSettingsOut(BaseModel):
    image_retention_months: int


class OrgSettingsIn(BaseModel):
    image_retention_months: int = Field(ge=1, le=120)


def _org_settings(session: Session, org_id: uuid.UUID) -> OrgSettings:
    row = session.scalar(select(OrgSettings).where(OrgSettings.org_id == org_id))
    if row is None:
        row = OrgSettings(org_id=org_id)
        session.add(row)
        session.flush()
    return row


@router.get("/settings", response_model=OrgSettingsOut)
def get_org_settings(
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
) -> OrgSettingsOut:
    row = _org_settings(session, requester.org_id)
    session.commit()
    return OrgSettingsOut(image_retention_months=row.image_retention_months)


@router.patch("/settings", response_model=OrgSettingsOut)
def update_org_settings(
    body: OrgSettingsIn,
    request: Request,
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
) -> OrgSettingsOut:
    row = _org_settings(session, requester.org_id)
    row.image_retention_months = body.image_retention_months
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="org_settings.update",
        entity="org_settings",
        entity_id=row.id,
        ip=client_ip(request),
        detail={"image_retention_months": body.image_retention_months},
    )
    session.commit()
    return OrgSettingsOut(image_retention_months=row.image_retention_months)


@router.post("/images/purge")
def purge_images(
    request: Request,
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
    store: Annotated[ObjectStore, Depends(get_object_store)],
) -> dict[str, int]:
    """Retention run on demand — the scheduler also does this hourly."""
    purged = purge_expired_images(session, store)
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="images.retention_purge",
        entity="observation",
        ip=client_ip(request),
        detail={"purged": purged},
    )
    session.commit()
    return {"purged": purged}


# Every org-scoped table an operator owns on exit. Images live in the object
# store under images/{org_id}/ and are copied separately .
EXPORT_MODELS = [
    Site,
    Bin,
    Observation,
    CollectionEvent,
    BinHealthDaily,
    Truck,
    Route,
    RouteStop,
    MLModel,
    Prediction,
    VolunteerEvent,
    MaterialPrice,
    RecyclingPartner,
    DumpingSite,
    DumpingCandidate,
    DumpingEvent,
    DumpingIntervention,
    CleanlinessDaily,
    User,
    AuditLog,
]
_EXCLUDED_COLUMNS = {"password_hash"}


def _table_csv(session: Session, model: type, org_id: uuid.UUID) -> str:
    table = model.__table__  # type: ignore[attr-defined]
    plain = [c for c in table.columns if not isinstance(c.type, Geometry)]
    plain = [c for c in plain if c.name not in _EXCLUDED_COLUMNS]
    geom = [c for c in table.columns if isinstance(c.type, Geometry)]
    selected = list(plain)
    fields = [c.name for c in plain]
    for g in geom:
        selected.extend([func.ST_Y(g).label(f"{g.name}_lat"), func.ST_X(g).label(f"{g.name}_lng")])
        fields.extend([f"{g.name}_lat", f"{g.name}_lng"])
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(fields)
    for row in session.execute(select(*selected).where(table.c.org_id == org_id)):
        writer.writerow(["" if v is None else str(v) for v in row])
    return buffer.getvalue()


@router.get("/export")
def org_export(
    request: Request,
    requester: Annotated[TokenClaims, require_roles(UserRole.ADMIN)],
    session: Annotated[Session, Depends(get_session)],
) -> Response:
    """Org-exit portability: one zip, one CSV per table, all rows this org owns."""
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w", zipfile.ZIP_DEFLATED) as archive:
        for model in EXPORT_MODELS:
            name = model.__tablename__
            archive.writestr(f"{name}.csv", _table_csv(session, model, requester.org_id))
    record_audit(
        session,
        org_id=requester.org_id,
        actor_user_id=requester.user_id,
        action="org.export",
        entity="organization",
        entity_id=requester.org_id,
        ip=client_ip(request),
    )
    session.commit()
    return Response(
        content=payload.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": 'attachment; filename="owi-org-export.zip"'},
    )


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
