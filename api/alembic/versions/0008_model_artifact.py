"""Store the ONNX artifact key and class labels on ml_models."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ml_models", sa.Column("artifact_ref", sa.String(300)))
    op.add_column(
        "ml_models",
        sa.Column("labels", postgresql.JSONB, nullable=False, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("ml_models", "labels")
    op.drop_column("ml_models", "artifact_ref")
