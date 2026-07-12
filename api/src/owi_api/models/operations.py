import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow
from owi_api.models.enums import OverflowRisk, db_enum


class CollectionEvent(OwiRow, Base):
    __tablename__ = "collection_events"

    bin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bins.id"))
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    collector_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    post_observation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("observations.id")
    )


class BinHealthDaily(OwiRow, Base):
    """Recomputed analytics — every number here must be reproducible from observations."""

    __tablename__ = "bin_health_daily"
    __table_args__ = (UniqueConstraint("bin_id", "date", name="uq_bin_health_day"),)

    bin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bins.id"))
    date: Mapped[date] = mapped_column(Date)
    fill_pct: Mapped[float] = mapped_column(Float)
    fill_velocity_pct_per_day: Mapped[float | None] = mapped_column(Float)
    days_to_full: Mapped[float | None] = mapped_column(Float)
    days_since_collection: Mapped[float | None] = mapped_column(Float)
    overflow_risk: Mapped[OverflowRisk] = mapped_column(db_enum(OverflowRisk, "overflow_risk"))
    recommendation: Mapped[str] = mapped_column(String(30))
