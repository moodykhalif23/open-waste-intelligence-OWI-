import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow
from owi_api.models.enums import EventType, db_enum


class VolunteerEvent(OwiRow, Base):
    """Community work record — aggregate-first: counts and hours, no PII required."""

    __tablename__ = "volunteer_events"

    occurred_on: Mapped[date] = mapped_column(Date)
    event_type: Mapped[EventType] = mapped_column(db_enum(EventType, "event_type"))
    area: Mapped[str] = mapped_column(String(200))
    site_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"))
    organizer: Mapped[str] = mapped_column(String(200))
    participant_count: Mapped[int] = mapped_column(Integer)
    hours_total: Mapped[float] = mapped_column(Float)
    materials_kg: Mapped[dict[str, float]] = mapped_column(JSONB, default=dict)
    notes: Mapped[str | None] = mapped_column(String(1000))
