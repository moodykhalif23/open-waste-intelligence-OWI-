import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Enum, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow
from owi_api.models.enums import FillBand, LocationSource, PrivacyStatus


class Observation(OwiRow, Base):
    """The atomic record: one photo event (docs/05-data-model.md)."""

    __tablename__ = "observations"
    # Content-hash dedupe: offline sync retries must never create duplicate records (R8).
    __table_args__ = (UniqueConstraint("org_id", "image_sha256", name="uq_observation_image"),)

    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    synced_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[object] = mapped_column(Geometry("POINT", srid=4326))
    location_source: Mapped[LocationSource] = mapped_column(
        Enum(LocationSource, name="location_source")
    )
    bin_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("bins.id"))
    collector_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id")
    )
    image_ref: Mapped[str] = mapped_column(String(300))
    image_sha256: Mapped[str] = mapped_column(String(64))
    image_quality_flags: Mapped[dict[str, object]] = mapped_column(JSONB, default=dict)
    human_fill_tap: Mapped[FillBand | None] = mapped_column(Enum(FillBand, name="fill_band"))
    privacy_status: Mapped[PrivacyStatus] = mapped_column(Enum(PrivacyStatus, name="privacy_status"))
