from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow


class Notification(OwiRow, Base):
    """Delivery log — every outbound message, whatever the provider said."""

    __tablename__ = "notifications"

    kind: Mapped[str] = mapped_column(String(30))
    channel: Mapped[str] = mapped_column(String(20))
    recipient: Mapped[str] = mapped_column(String(50))
    body: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(20))
    provider: Mapped[str] = mapped_column(String(30))
    error: Mapped[str | None] = mapped_column(String(300))
