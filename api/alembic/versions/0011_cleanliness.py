"""Daily cleanliness-index snapshots per area."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cleanliness_daily",
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
        sa.Column(
            "site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False
        ),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("score", sa.Float),
        sa.Column("components", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.UniqueConstraint("site_id", "date", name="uq_cleanliness_day"),
    )


def downgrade() -> None:
    op.drop_table("cleanliness_daily")
