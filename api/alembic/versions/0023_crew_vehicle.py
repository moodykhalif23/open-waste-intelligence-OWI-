"""Crew membership: a collector belongs to at most one vehicle."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "vehicle_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("trucks.id", ondelete="SET NULL"),
        ),
    )
    op.create_index("ix_users_vehicle_id", "users", ["vehicle_id"])


def downgrade() -> None:
    op.drop_index("ix_users_vehicle_id", table_name="users")
    op.drop_column("users", "vehicle_id")
