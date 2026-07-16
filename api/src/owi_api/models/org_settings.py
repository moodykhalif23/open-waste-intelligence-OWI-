from sqlalchemy import Integer, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow

RETENTION_DEFAULT_MONTHS = 24


class OrgSettings(OwiRow, Base):
    """Per-org knobs that must not be deployment-global; one row per organization."""

    __tablename__ = "org_settings"
    __table_args__ = (UniqueConstraint("org_id", name="uq_org_settings_org"),)

    image_retention_months: Mapped[int] = mapped_column(Integer, default=RETENTION_DEFAULT_MONTHS)
