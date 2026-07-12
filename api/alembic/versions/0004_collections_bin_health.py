"""Collection events and daily bin health analytics."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

overflow_risk = postgresql.ENUM("low", "medium", "high", name="overflow_risk", create_type=False)


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
    overflow_risk.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "collection_events",
        *_owi_columns(),
        sa.Column(
            "bin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bins.id"), nullable=False
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("collector_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column(
            "post_observation_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("observations.id")
        ),
    )
    op.create_table(
        "bin_health_daily",
        *_owi_columns(),
        sa.Column(
            "bin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bins.id"), nullable=False
        ),
        sa.Column("date", sa.Date, nullable=False),
        sa.Column("fill_pct", sa.Float, nullable=False),
        sa.Column("fill_velocity_pct_per_day", sa.Float),
        sa.Column("days_to_full", sa.Float),
        sa.Column("days_since_collection", sa.Float),
        sa.Column("overflow_risk", overflow_risk, nullable=False),
        sa.Column("recommendation", sa.String(30), nullable=False),
        sa.UniqueConstraint("bin_id", "date", name="uq_bin_health_day"),
    )


def downgrade() -> None:
    op.drop_table("bin_health_daily")
    op.drop_table("collection_events")
    overflow_risk.drop(op.get_bind(), checkfirst=True)
