import uuid
from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.analytics.refresh import refresh_bin
from owi_api.db import get_session
from owi_api.models.enums import OverflowRisk, UserRole
from owi_api.models.operations import BinHealthDaily, CollectionEvent
from owi_api.models.registry import Bin, Site
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims
from owi_api.weights import estimate_collection_weight

router = APIRouter(prefix="/api/v1", tags=["operations"])

FIELD_ROLES = (UserRole.COLLECTOR, UserRole.COORDINATOR, UserRole.ADMIN)
STAFF = (*FIELD_ROLES, UserRole.VIEWER)


class CollectionIn(BaseModel):
    bin_id: uuid.UUID
    occurred_at: datetime | None = None


class CollectionOut(BaseModel):
    id: uuid.UUID
    bin_id: uuid.UUID
    occurred_at: datetime


class BinHealthOut(BaseModel):
    bin_id: uuid.UUID
    qr_code: str
    site_name: str
    date: date
    fill_pct: float
    fill_velocity_pct_per_day: float | None
    days_to_full: float | None
    days_since_collection: float | None
    overflow_risk: OverflowRisk
    recommendation: str


@router.post("/collections", response_model=CollectionOut, status_code=201)
def record_collection(
    body: CollectionIn,
    claims: Annotated[TokenClaims, require_roles(*FIELD_ROLES)],
    session: Annotated[Session, Depends(get_session)],
) -> CollectionOut:
    bin_ = session.get(Bin, body.bin_id)
    if bin_ is None or bin_.org_id != claims.org_id or bin_.deleted_at is not None:
        raise HTTPException(status_code=404, detail="bin not found")

    event = CollectionEvent(
        org_id=claims.org_id,
        bin_id=body.bin_id,
        occurred_at=body.occurred_at or datetime.now(UTC),
        collector_id=claims.user_id if claims.role is UserRole.COLLECTOR else None,
        estimated_weight_kg=estimate_collection_weight(session, body.bin_id),
    )
    session.add(event)
    session.commit()
    # A collection changes today's recommendation immediately, not at the next cron tick.
    refresh_bin(session, body.bin_id)
    return CollectionOut(id=event.id, bin_id=event.bin_id, occurred_at=event.occurred_at)


@router.get("/bins/health", response_model=list[BinHealthOut])
def bin_health(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> list[BinHealthOut]:
    latest = (
        select(BinHealthDaily)
        .where(BinHealthDaily.org_id == claims.org_id)
        .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
        .distinct(BinHealthDaily.bin_id)
        .subquery()
    )
    rows = session.execute(
        select(latest, Bin.qr_code, Site.name)
        .join(Bin, Bin.id == latest.c.bin_id)
        .join(Site, Site.id == Bin.site_id)
    ).all()

    results = [
        BinHealthOut(
            bin_id=row.bin_id,
            qr_code=row.qr_code,
            site_name=row.name,
            date=row.date,
            fill_pct=row.fill_pct,
            fill_velocity_pct_per_day=row.fill_velocity_pct_per_day,
            days_to_full=row.days_to_full,
            days_since_collection=row.days_since_collection,
            overflow_risk=OverflowRisk(row.overflow_risk),
            recommendation=row.recommendation,
        )
        for row in rows
    ]
    risk_rank = {OverflowRisk.HIGH: 0, OverflowRisk.MEDIUM: 1, OverflowRisk.LOW: 2}
    results.sort(key=lambda r: (risk_rank[r.overflow_risk], -r.fill_pct))
    return results
