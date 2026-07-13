import uuid
from datetime import UTC, datetime, timedelta

from geoalchemy2 import Geography
from sqlalchemy import cast, func, select
from sqlalchemy.orm import Session

from owi_api.analytics.cleanliness import cleanliness_index
from owi_api.analytics.dumping import HALF_LIFE_DAYS
from owi_api.models.cleanliness import CleanlinessDaily
from owi_api.models.dumping import DumpingSite
from owi_api.models.enums import DumpingStatus, FillBand, OverflowRisk
from owi_api.models.observation import Observation
from owi_api.models.operations import BinHealthDaily, CollectionEvent
from owi_api.models.registry import Bin, Site

WINDOW_DAYS = 30
OVERFLOW_BANDS = {FillBand.HIGH, FillBand.OVERFLOWING}
DUMPING_RADIUS_M = 1000
DUMPING_PENALTY_PER_SITE = 25.0


def compute_site_values(
    session: Session, site_id: uuid.UUID, now: datetime
) -> tuple[dict[str, float], int]:
    start = now - timedelta(days=WINDOW_DAYS)
    bins = list(session.scalars(select(Bin.id).where(Bin.site_id == site_id)))
    if not bins:
        return {}, 0

    obs_count = (
        session.scalar(
            select(func.count())
            .select_from(Observation)
            .where(Observation.bin_id.in_(bins), Observation.captured_at >= start)
        )
        or 0
    )

    values: dict[str, float] = {}

    taps = list(
        session.scalars(
            select(Observation.human_fill_tap).where(
                Observation.bin_id.in_(bins),
                Observation.captured_at >= start,
                Observation.human_fill_tap.is_not(None),
            )
        )
    )
    if taps:
        overflow_rate = sum(1 for t in taps if t in OVERFLOW_BANDS) / len(taps)
        values["overflow"] = 100 * (1 - overflow_rate)

    latest_risk = {
        bid: risk
        for bid, risk in session.execute(
            select(BinHealthDaily.bin_id, BinHealthDaily.overflow_risk)
            .where(BinHealthDaily.bin_id.in_(bins))
            .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
            .distinct(BinHealthDaily.bin_id)
        )
    }
    high_bins = [b for b, r in latest_risk.items() if r is OverflowRisk.HIGH]
    if latest_risk:
        collected = (
            session.scalar(
                select(func.count(func.distinct(CollectionEvent.bin_id))).where(
                    CollectionEvent.bin_id.in_(high_bins or [uuid.UUID(int=0)]),
                    CollectionEvent.occurred_at >= start,
                )
            )
            or 0
        )
        values["reliability"] = 100.0 if not high_bins else 100 * collected / len(high_bins)

    centroid = session.execute(
        select(
            func.ST_Y(func.ST_Centroid(func.ST_Collect(Bin.location))),
            func.ST_X(func.ST_Centroid(func.ST_Collect(Bin.location))),
        ).where(Bin.id.in_(bins))
    ).one()
    point = f"SRID=4326;POINT({centroid[1]} {centroid[0]})"
    nearby = session.scalars(
        select(DumpingSite).where(
            DumpingSite.deleted_at.is_(None),
            DumpingSite.status != DumpingStatus.CLEANED,
            func.ST_DWithin(
                cast(DumpingSite.location, Geography), cast(point, Geography), DUMPING_RADIUS_M
            ),
        )
    ).all()
    penalty = 0.0
    for ds in nearby:
        days = (now - ds.last_seen).total_seconds() / 86400
        penalty += DUMPING_PENALTY_PER_SITE * 0.5 ** (max(0.0, days) / HALF_LIFE_DAYS)
    values["dumping"] = max(0.0, 100 - penalty)

    return values, int(obs_count)


def refresh_cleanliness(session: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    sites = session.scalars(select(Site).where(Site.deleted_at.is_(None))).all()
    updated = 0
    for site in sites:
        values, obs = compute_site_values(session, site.id, now)
        result = cleanliness_index(values, obs)
        row = session.scalar(
            select(CleanlinessDaily).where(
                CleanlinessDaily.site_id == site.id, CleanlinessDaily.date == now.date()
            )
        )
        if row is None:
            row = CleanlinessDaily(org_id=site.org_id, site_id=site.id, date=now.date())
            session.add(row)
        row.score = result.score
        row.components = {c.name: c.value for c in result.components}
        updated += 1
    session.commit()
    return updated
