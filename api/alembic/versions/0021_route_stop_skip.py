"""Let a route stop be skipped, with a short reason, instead of collected."""

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("route_stops", sa.Column("skipped_at", sa.DateTime(timezone=True)))
    op.add_column("route_stops", sa.Column("skip_reason", sa.String(120)))
    op.create_check_constraint(
        "ck_route_stop_single_outcome",
        "route_stops",
        "NOT (collected AND skipped_at IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_route_stop_single_outcome", "route_stops", type_="check")
    op.drop_column("route_stops", "skip_reason")
    op.drop_column("route_stops", "skipped_at")
