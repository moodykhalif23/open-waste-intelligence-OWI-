"""Volunteer events for grant-ready CBO reporting."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

event_type = postgresql.ENUM(
    "cleanup", "education", "sorting", name="event_type", create_type=False
)


def upgrade() -> None:
    event_type.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "volunteer_events",
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
        sa.Column("occurred_on", sa.Date, nullable=False),
        sa.Column("event_type", event_type, nullable=False),
        sa.Column("area", sa.String(200), nullable=False),
        sa.Column("site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id")),
        sa.Column("organizer", sa.String(200), nullable=False),
        sa.Column("participant_count", sa.Integer, nullable=False),
        sa.Column("hours_total", sa.Float, nullable=False),
        sa.Column("materials_kg", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("notes", sa.String(1000)),
    )


def downgrade() -> None:
    op.drop_table("volunteer_events")
    event_type.drop(op.get_bind(), checkfirst=True)
