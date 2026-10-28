"""Store measured route outcomes without retaining GPS points."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("routes", sa.Column("started_at", sa.DateTime(timezone=True)))
    op.add_column(
        "routes",
        sa.Column("started_by_user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
    )
    op.add_column("routes", sa.Column("completed_at", sa.DateTime(timezone=True)))
    op.add_column("routes", sa.Column("actual_distance_km", sa.Float))
    op.add_column("routes", sa.Column("actual_fuel_l", sa.Float))
    op.add_column("routes", sa.Column("actual_weight_kg", sa.Float))
    op.add_column(
        "collection_events",
        sa.Column("route_stop_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("route_stops.id")),
    )


def downgrade() -> None:
    op.drop_column("collection_events", "route_stop_id")
    op.drop_column("routes", "actual_weight_kg")
    op.drop_column("routes", "actual_fuel_l")
    op.drop_column("routes", "actual_distance_km")
    op.drop_column("routes", "completed_at")
    op.drop_column("routes", "started_by_user_id")
    op.drop_column("routes", "started_at")
