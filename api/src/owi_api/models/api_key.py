import uuid
from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow


class ApiKey(OwiRow, Base):
    """Open Data API consumer credential — identifies and rate-limits, never grants raw data."""

    __tablename__ = "api_keys"

    label: Mapped[str] = mapped_column(String(120))
    # The secret is shown once and stored only as a hash; the prefix is the lookup handle.
    key_prefix: Mapped[str] = mapped_column(String(16), unique=True, index=True)
    key_hash: Mapped[str] = mapped_column(String(200))
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
