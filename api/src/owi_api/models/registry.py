import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow
from owi_api.models.enums import UserRole


class Organization(Base):
    """Tenant root — the only table without org_id."""

    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class User(OwiRow, Base):
    __tablename__ = "users"

    name: Mapped[str] = mapped_column(String(200))
    phone: Mapped[str | None] = mapped_column(String(30), unique=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, name="user_role"))
    password_hash: Mapped[str | None] = mapped_column(String(200))
    # Bumping this invalidates every token the user holds (lost/stolen phone).
    token_version: Mapped[int] = mapped_column(server_default="0")


class Site(OwiRow, Base):
    __tablename__ = "sites"

    name: Mapped[str] = mapped_column(String(200))
    site_type: Mapped[str] = mapped_column(String(50))
    ward: Mapped[str | None] = mapped_column(String(100))


class Bin(OwiRow, Base):
    __tablename__ = "bins"

    site_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("sites.id"))
    qr_code: Mapped[str] = mapped_column(String(64), unique=True)
    location: Mapped[object] = mapped_column(Geometry("POINT", srid=4326))
    volume_liters: Mapped[int]
    bin_type: Mapped[str] = mapped_column(String(50))
    reference_photo_ref: Mapped[str | None] = mapped_column(String(300))
