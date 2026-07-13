"""Trucks, routes, and route stops for collection route optimization."""

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

route_status = postgresql.ENUM("planned", "active", "done", name="route_status", create_type=False)


def _owi_columns() -> list[sa.Column]:
    return [
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "org_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("organizations.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    ]


def upgrade() -> None:
    route_status.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "trucks",
        *_owi_columns(),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("capacity_kg", sa.Float, nullable=False),
        sa.Column("fuel_l_per_100km", sa.Float, nullable=False, server_default="25"),
        sa.Column("depot", geoalchemy2.Geometry("POINT", srid=4326), nullable=False),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.true()),
    )
    op.create_table(
        "routes",
        *_owi_columns(),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column(
            "truck_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("trucks.id"), nullable=False
        ),
        sa.Column("status", route_status, nullable=False, server_default="planned"),
        sa.Column("planned_km", sa.Float, nullable=False),
        sa.Column("planned_fuel_l", sa.Float, nullable=False),
        sa.Column("demand_kg", sa.Float, nullable=False),
        sa.Column("bins_served", sa.Integer, nullable=False),
    )
    op.create_table(
        "route_stops",
        *_owi_columns(),
        sa.Column(
            "route_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("routes.id"), nullable=False
        ),
        sa.Column(
            "bin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bins.id"), nullable=False
        ),
        sa.Column("seq", sa.Integer, nullable=False),
        sa.Column("collected", sa.Boolean, nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_table("route_stops")
    op.drop_table("routes")
    op.drop_table("trucks")
    route_status.drop(op.get_bind(), checkfirst=True)
