import uuid
from datetime import date

from sqlalchemy import Date, Float, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow


class CleanlinessDaily(OwiRow, Base):
    """Daily per-area score snapshot — recomputed nightly so trends have real history."""

    __tablename__ = "cleanliness_daily"
    __table_args__ = (UniqueConstraint("site_id", "date", name="uq_cleanliness_day"),)

    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"))
    date: Mapped[date] = mapped_column(Date)
    score: Mapped[float | None] = mapped_column(Float)
    components: Mapped[dict[str, float]] = mapped_column(JSONB, default=dict)
