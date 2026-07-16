import uuid
from datetime import date

from geoalchemy2 import Geometry
from sqlalchemy import Boolean, Date, Float, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from owi_api.models.base import Base, OwiRow
from owi_api.models.enums import CollectionMethod, RouteStatus, db_enum


class Truck(OwiRow, Base):
    """A collection vehicle/crew of any method — truck, cart, bike, or on foot."""

    __tablename__ = "trucks"

    name: Mapped[str] = mapped_column(String(100))
    method: Mapped[CollectionMethod] = mapped_column(
        db_enum(CollectionMethod, "collection_method"), default=CollectionMethod.TRUCK
    )
    capacity_kg: Mapped[float] = mapped_column(Float)
    # Litres per 100 km — turns planned distance into a fuel/cost estimate; 0 for manual methods.
    fuel_l_per_100km: Mapped[float] = mapped_column(Float, default=25.0)
    depot: Mapped[object] = mapped_column(Geometry("POINT", srid=4326))
    active: Mapped[bool] = mapped_column(Boolean, default=True)


class Route(OwiRow, Base):
    __tablename__ = "routes"

    date: Mapped[date] = mapped_column(Date)
    truck_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trucks.id"))
    status: Mapped[RouteStatus] = mapped_column(
        db_enum(RouteStatus, "route_status"), default=RouteStatus.PLANNED
    )
    planned_km: Mapped[float] = mapped_column(Float)
    planned_fuel_l: Mapped[float] = mapped_column(Float)
    demand_kg: Mapped[float] = mapped_column(Float)
    bins_served: Mapped[int] = mapped_column(Integer)


class RouteStop(OwiRow, Base):
    __tablename__ = "route_stops"

    route_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("routes.id"))
    bin_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("bins.id"))
    seq: Mapped[int] = mapped_column(Integer)
    collected: Mapped[bool] = mapped_column(Boolean, default=False)
