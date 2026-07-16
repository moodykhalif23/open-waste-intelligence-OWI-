from sqlalchemy import Float, Integer, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow

RETENTION_DEFAULT_MONTHS = 24


class OrgSettings(OwiRow, Base):
    """Per-org knobs that must not be deployment-global; one row per organization."""

    __tablename__ = "org_settings"
    __table_args__ = (UniqueConstraint("org_id", name="uq_org_settings_org"),)

    image_retention_months: Mapped[int] = mapped_column(Integer, default=RETENTION_DEFAULT_MONTHS)
    # None = fall back to the deployment-wide default in Settings.
    fuel_price_kes_per_l: Mapped[float | None] = mapped_column(Float)
    waste_density_kg_per_l: Mapped[float | None] = mapped_column(Float)
    # E.164 phones that receive the daily overflow digest; None/[] = digest off.
    notify_phones: Mapped[list[str] | None] = mapped_column(JSONB)
