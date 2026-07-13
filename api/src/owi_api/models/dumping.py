import uuid
from datetime import date, datetime

from geoalchemy2 import Geometry
from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow
from owi_api.models.enums import DumpingReview, DumpingStatus, InterventionKind, db_enum


class DumpingCandidate(OwiRow, Base):
    """A reviewed non-bin observation — the human's decision, so candidates never auto-record."""

    __tablename__ = "dumping_candidates"

    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("observations.id"), unique=True
    )
    review: Mapped[DumpingReview] = mapped_column(db_enum(DumpingReview, "dumping_review"))
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    dumping_site_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dumping_sites.id")
    )


class DumpingSite(OwiRow, Base):
    """Human-confirmed location that accumulates waste — a place, never a person."""

    __tablename__ = "dumping_sites"

    location: Mapped[object] = mapped_column(Geometry("POINT", srid=4326))
    area: Mapped[str | None] = mapped_column(String(100))
    first_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    event_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[DumpingStatus] = mapped_column(db_enum(DumpingStatus, "dumping_status"))


class DumpingEvent(OwiRow, Base):
    __tablename__ = "dumping_events"

    dumping_site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dumping_sites.id")
    )
    observation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("observations.id")
    )
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class DumpingIntervention(OwiRow, Base):
    __tablename__ = "dumping_interventions"

    dumping_site_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("dumping_sites.id")
    )
    kind: Mapped[InterventionKind] = mapped_column(db_enum(InterventionKind, "intervention_kind"))
    performed_on: Mapped[date] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(String(500))
