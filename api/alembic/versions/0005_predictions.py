"""ML model registry and predictions with review status."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

prediction_task = postgresql.ENUM(
    "detect", "classify", "fill", "dumping", name="prediction_task", create_type=False
)
review_status = postgresql.ENUM(
    "unreviewed", "confirmed", "corrected", name="review_status", create_type=False
)


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
    prediction_task.create(op.get_bind(), checkfirst=True)
    review_status.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "ml_models",
        *_owi_columns(),
        sa.Column("task", prediction_task, nullable=False),
        sa.Column("version", sa.String(50), nullable=False),
        sa.Column("git_commit", sa.String(40)),
        sa.Column("dataset_hash", sa.String(64)),
        sa.Column("metrics", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("active", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("org_id", "task", "version", name="uq_model_version"),
    )
    op.create_table(
        "predictions",
        *_owi_columns(),
        sa.Column(
            "observation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("observations.id"),
            nullable=False,
        ),
        sa.Column(
            "model_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("ml_models.id"), nullable=False
        ),
        sa.Column("task", prediction_task, nullable=False),
        sa.Column("payload", postgresql.JSONB, nullable=False),
        sa.Column("review_status", review_status, nullable=False, server_default="unreviewed"),
        sa.Column("corrected_payload", postgresql.JSONB),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
    )
    op.create_index("ix_predictions_review", "predictions", ["org_id", "review_status"])


def downgrade() -> None:
    op.drop_table("predictions")
    op.drop_table("ml_models")
    review_status.drop(op.get_bind(), checkfirst=True)
    prediction_task.drop(op.get_bind(), checkfirst=True)
