from datetime import date

from sqlalchemy import Date, Float, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow


class MaterialPrice(OwiRow, Base):
    """KES/kg per material with an effective date, so historical value revalues correctly."""

    __tablename__ = "material_prices"

    material: Mapped[str] = mapped_column(String(30))
    kes_per_kg: Mapped[float] = mapped_column(Float)
    effective_date: Mapped[date] = mapped_column(Date)
    source: Mapped[str | None] = mapped_column(String(200))


class RecyclingPartner(OwiRow, Base):
    __tablename__ = "recycling_partners"

    name: Mapped[str] = mapped_column(String(200))
    materials_accepted: Mapped[list[str]] = mapped_column(JSONB, default=list)
    min_kg_per_month: Mapped[float] = mapped_column(Float, default=0.0)
    indicative_price_kes_per_kg: Mapped[float | None] = mapped_column(Float)
    contact: Mapped[str | None] = mapped_column(String(200))
