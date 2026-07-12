import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from owi_api.analytics.bin_health import BAND_PCT, compute_health
from owi_api.models.observation import Observation
from owi_api.models.operations import BinHealthDaily, CollectionEvent
from owi_api.models.registry import Bin

LOOKBACK_DAYS = 21
MAX_OBSERVATIONS = 10


def refresh_bin_health(session: Session, now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    bins = session.scalars(select(Bin).where(Bin.deleted_at.is_(None))).all()
    updated = 0
    for bin_ in bins:
        if _refresh_one(session, bin_, now):
            updated += 1
    session.commit()
    return updated


def refresh_bin(session: Session, bin_id: uuid.UUID, now: datetime | None = None) -> None:
    bin_ = session.get(Bin, bin_id)
    if bin_ is not None:
        _refresh_one(session, bin_, now or datetime.now(UTC))
        session.commit()


def _refresh_one(session: Session, bin_: Bin, now: datetime) -> bool:
    last_collection = session.scalar(
        select(CollectionEvent.occurred_at)
        .where(CollectionEvent.bin_id == bin_.id, CollectionEvent.deleted_at.is_(None))
        .order_by(CollectionEvent.occurred_at.desc())
        .limit(1)
    )

    observations = session.execute(
        select(Observation.captured_at, Observation.human_fill_tap)
        .where(
            Observation.bin_id == bin_.id,
            Observation.deleted_at.is_(None),
            Observation.human_fill_tap.is_not(None),
            Observation.captured_at >= now - timedelta(days=LOOKBACK_DAYS),
            # A collection resets the bin; older fill readings describe a different load.
            *([Observation.captured_at > last_collection] if last_collection else []),
        )
        .order_by(Observation.captured_at.desc())
        .limit(MAX_OBSERVATIONS)
    ).all()

    series = [(captured_at, BAND_PCT[tap]) for captured_at, tap in observations]
    health = compute_health(series, last_collection, now)
    if health is None:
        return False

    row = session.scalar(
        select(BinHealthDaily).where(
            BinHealthDaily.bin_id == bin_.id, BinHealthDaily.date == now.date()
        )
    )
    if row is None:
        row = BinHealthDaily(org_id=bin_.org_id, bin_id=bin_.id, date=now.date())
        session.add(row)
    row.fill_pct = health.fill_pct
    row.fill_velocity_pct_per_day = health.velocity_pct_per_day
    row.days_to_full = health.days_to_full
    row.days_since_collection = health.days_since_collection
    row.overflow_risk = health.risk
    row.recommendation = health.recommendation
    return True
