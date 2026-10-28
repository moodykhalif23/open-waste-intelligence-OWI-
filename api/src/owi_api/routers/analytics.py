import uuid
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import extract, func, literal_column, select
from sqlalchemy.orm import Session

from owi_api.analytics import overview
from owi_api.analytics.composition import composition, effective_material
from owi_api.db import get_session
from owi_api.models.enums import FillBand, PredictionTask, UserRole
from owi_api.models.observation import Observation
from owi_api.models.prediction import Prediction
from owi_api.models.registry import Bin, Site
from owi_api.routers.auth import require_roles
from owi_api.security import TokenClaims

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])

STAFF = (UserRole.ADMIN, UserRole.COORDINATOR, UserRole.VIEWER)


def _materials(
    session: Session,
    org_id: uuid.UUID,
    start: datetime,
    end: datetime,
    site_id: uuid.UUID | None,
) -> list[str]:
    query = (
        select(
            Prediction.observation_id,
            Prediction.payload,
            Prediction.corrected_payload,
            Prediction.review_status,
        )
        .join(Observation, Observation.id == Prediction.observation_id)
        .where(
            Prediction.org_id == org_id,
            Prediction.task == PredictionTask.CLASSIFY,
            Prediction.deleted_at.is_(None),
            Observation.captured_at >= start,
            Observation.captured_at < end,
        )
        .order_by(Prediction.observation_id, Prediction.created_at.desc())
    )
    if site_id is not None:
        bins = select(Bin.id).where(Bin.site_id == site_id)
        query = query.where(Observation.bin_id.in_(bins))

    seen: set[uuid.UUID] = set()
    materials: list[str] = []
    for observation_id, payload, corrected, status in session.execute(query):
        if observation_id in seen:
            continue  # ordered newest-first, so the first row per observation is the latest
        seen.add(observation_id)
        material = effective_material(payload, corrected, status)
        if material is not None:
            materials.append(material)
    return materials


class MaterialShareOut(BaseModel):
    material: str
    count: int
    share_pct: float
    delta_pct: float | None


class CompositionOut(BaseModel):
    window_days: int
    total: int
    sufficient: bool
    materials: list[MaterialShareOut]


@router.get("/composition", response_model=CompositionOut)
def get_composition(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    days: Annotated[int, Query(gt=0, le=365)] = 7,
    site_id: uuid.UUID | None = None,
) -> CompositionOut:
    now = datetime.now(UTC)
    window = timedelta(days=days)
    current = _materials(session, claims.org_id, now - window, now, site_id)
    previous = _materials(session, claims.org_id, now - 2 * window, now - window, site_id)
    rows, sufficient = composition(current, previous)
    return CompositionOut(
        window_days=days,
        total=len(current),
        sufficient=sufficient,
        materials=[
            MaterialShareOut(
                material=r.material, count=r.count, share_pct=r.share_pct, delta_pct=r.delta_pct
            )
            for r in rows
        ],
    )


class DayReportsOut(BaseModel):
    date: date
    reports: int
    overflowing: int


class FillMixOut(BaseModel):
    empty: int
    low: int
    half: int
    high: int
    overflowing: int


class LatestReportOut(BaseModel):
    id: uuid.UUID
    captured_at: datetime
    qr_code: str | None
    site_name: str | None
    fill_tap: FillBand | None


class OverviewOut(BaseModel):
    window_days: int
    bins_registered: int
    bins_reported: int
    reports: int
    reports_prev: int
    overflowing: int
    per_day: list[DayReportsOut]
    fill_mix: FillMixOut
    heatmap: list[list[int]]
    latest: list[LatestReportOut]


LATEST_REPORTS = 6


@router.get("/overview", response_model=OverviewOut)
def get_overview(
    claims: Annotated[TokenClaims, require_roles(*STAFF)],
    session: Annotated[Session, Depends(get_session)],
    days: Annotated[int, Query(gt=0, le=365)] = 7,
) -> OverviewOut:
    span = overview.window(datetime.now(UTC), days)
    local = func.timezone(literal_column(f"'{overview.LOCAL_TZ_NAME}'"), Observation.captured_at)
    live = (Observation.org_id == claims.org_id, Observation.deleted_at.is_(None))
    in_window = (*live, Observation.captured_at >= span.start, Observation.captured_at < span.end)
    current = Observation.captured_at >= span.start
    overflowing = Observation.human_fill_tap == FillBand.OVERFLOWING

    bins_registered = session.scalar(
        select(func.count())
        .select_from(Bin)
        .where(Bin.org_id == claims.org_id, Bin.deleted_at.is_(None))
    )
    reports, reports_prev, bins_reported, overflow_count = session.execute(
        select(
            func.count().filter(current),
            func.count().filter(~current),
            func.count(func.distinct(Observation.bin_id)).filter(current),
            func.count().filter(current, overflowing),
        ).where(
            *live,
            Observation.captured_at >= span.prev_start,
            Observation.captured_at < span.end,
        )
    ).one()

    local_day = func.date(local)
    by_day = {
        day: (int(n), int(over))
        for day, n, over in session.execute(
            select(local_day, func.count(), func.count().filter(overflowing))
            .where(*in_window)
            .group_by(local_day)
        )
    }
    mix = {
        band: int(n)
        for band, n in session.execute(
            select(Observation.human_fill_tap, func.count())
            .where(*in_window)
            .group_by(Observation.human_fill_tap)
        )
    }
    weekday, hour = extract("isodow", local), extract("hour", local)
    cells = [
        (int(d), int(h), int(n))
        for d, h, n in session.execute(
            select(weekday, hour, func.count()).where(*in_window).group_by(weekday, hour)
        )
    ]
    latest = session.execute(
        select(
            Observation.id,
            Observation.captured_at,
            Bin.qr_code,
            Site.name,
            Observation.human_fill_tap,
        )
        .outerjoin(Bin, Bin.id == Observation.bin_id)
        .outerjoin(Site, Site.id == Bin.site_id)
        .where(*live)
        .order_by(Observation.captured_at.desc(), Observation.id)
        .limit(LATEST_REPORTS)
    ).all()

    return OverviewOut(
        window_days=days,
        bins_registered=bins_registered or 0,
        bins_reported=bins_reported or 0,
        reports=reports or 0,
        reports_prev=reports_prev or 0,
        overflowing=overflow_count or 0,
        per_day=[
            DayReportsOut(date=d.date, reports=d.reports, overflowing=d.overflowing)
            for d in overview.per_day(span.first_day, days, by_day)
        ],
        fill_mix=FillMixOut(**overview.fill_mix(mix)),
        heatmap=overview.heatmap(cells),
        latest=[
            LatestReportOut(
                id=obs_id, captured_at=captured, qr_code=qr, site_name=site, fill_tap=tap
            )
            for obs_id, captured, qr, site, tap in latest
        ],
    )
