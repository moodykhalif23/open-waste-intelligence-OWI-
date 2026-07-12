"""Track deletion of quarantined pre-blur originals."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("observations", sa.Column("quarantine_deleted_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("observations", "quarantine_deleted_at")
