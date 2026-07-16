"""Per-org settings + retention stamp for aggregate-then-delete of operational images."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "org_settings",
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
        sa.Column("image_retention_months", sa.Integer, nullable=False, server_default="24"),
        sa.UniqueConstraint("org_id", name="uq_org_settings_org"),
    )
    op.add_column("observations", sa.Column("image_deleted_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("observations", "image_deleted_at")
    op.drop_table("org_settings")
