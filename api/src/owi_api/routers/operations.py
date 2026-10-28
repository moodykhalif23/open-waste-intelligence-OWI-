import uuid
from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from owi_api.analytics.coverage import recommend_ward_assessment
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
    collected: bool


class WardCoverageOut(BaseModel):
    ward: str
    site_count: int
    bin_count: int
    assessed_bin_count: int
    high_risk_bin_count: int
    medium_risk_bin_count: int
    sites_without_bins: int
    priority: Literal["assess", "monitor", "insufficient_data"]
    reason: Literal[
        "registered_sites_without_bins",
        "repeated_capacity_pressure",
        "too_few_assessed_bins",
        "no_priority_signal",
    ]
    health_data_date: date | None


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
    limit: Annotated[int | None, Query(gt=0)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
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
            collected=row.fill_pct == 0 and row.days_since_collection is not None,
        )
        for row in rows
    ]
    risk_rank = {OverflowRisk.HIGH: 0, OverflowRisk.MEDIUM: 1, OverflowRisk.LOW: 2}
    results.sort(key=lambda r: (risk_rank[r.overflow_risk], -r.fill_pct, str(r.bin_id)))
    return results[offset : None if limit is None else offset + limit]


@router.get("/bins/coverage", response_model=list[WardCoverageOut])
def ward_coverage(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
) -> list[WardCoverageOut]:
    latest = (
        select(
            BinHealthDaily.bin_id,
            BinHealthDaily.date,
            BinHealthDaily.overflow_risk,
        )
        .where(
            BinHealthDaily.org_id == claims.org_id,
            BinHealthDaily.deleted_at.is_(None),
        )
        .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
        .distinct(BinHealthDaily.bin_id)
        .subquery()
    )
    rows = session.execute(
        select(
            Site.ward,
            func.count(func.distinct(Site.id)),
            func.count(func.distinct(Bin.id)),
            func.count(func.distinct(latest.c.bin_id)),
            func.count(func.distinct(case((latest.c.overflow_risk == OverflowRisk.HIGH, Bin.id)))),
            func.count(
                func.distinct(case((latest.c.overflow_risk == OverflowRisk.MEDIUM, Bin.id)))
            ),
            func.count(func.distinct(case((Bin.id.is_(None), Site.id)))),
            func.max(latest.c.date),
        )
        .select_from(Site)
        .outerjoin(
            Bin,
            (Bin.site_id == Site.id) & Bin.deleted_at.is_(None),
        )
        .outerjoin(latest, latest.c.bin_id == Bin.id)
        .where(
            Site.org_id == claims.org_id,
            Site.deleted_at.is_(None),
            Site.ward.is_not(None),
        )
        .group_by(Site.ward)
        .order_by(Site.ward)
    ).all()

    recommendations = []
    for row in rows:
        (
            ward,
            site_count,
            bin_count,
            assessed_bin_count,
            high_risk_bin_count,
            medium_risk_bin_count,
            sites_without_bins,
            health_data_date,
        ) = row
        assert ward is not None
        recommendations.append(
            recommend_ward_assessment(
                ward=ward,
                site_count=site_count,
                bin_count=bin_count,
                assessed_bin_count=assessed_bin_count,
                high_risk_bin_count=high_risk_bin_count,
                medium_risk_bin_count=medium_risk_bin_count,
                sites_without_bins=sites_without_bins,
                health_data_date=health_data_date,
            )
        )
    return [
        WardCoverageOut(
            ward=item.ward,
            site_count=item.site_count,
            bin_count=item.bin_count,
            assessed_bin_count=item.assessed_bin_count,
            high_risk_bin_count=item.high_risk_bin_count,
            medium_risk_bin_count=item.medium_risk_bin_count,
            sites_without_bins=item.sites_without_bins,
            priority=item.priority,
            reason=item.reason,
            health_data_date=item.health_data_date,
        )
        for item in recommendations
    ]
