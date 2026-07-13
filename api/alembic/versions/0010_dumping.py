"""Illegal-dumping sites, events, candidates, and interventions."""

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

dumping_status = postgresql.ENUM(
    "active", "cleaned", "recurring", name="dumping_status", create_type=False
)
dumping_review = postgresql.ENUM(
    "confirmed", "rejected", "duplicate", name="dumping_review", create_type=False
)
intervention_kind = postgresql.ENUM(
    "bin_added", "signage", "cleanup", "engagement", name="intervention_kind", create_type=False
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
    for enum in (dumping_status, dumping_review, intervention_kind):
        enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "dumping_sites",
        *_owi_columns(),
        sa.Column("location", geoalchemy2.Geometry("POINT", srid=4326), nullable=False),
        sa.Column("area", sa.String(100)),
        sa.Column("first_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen", sa.DateTime(timezone=True), nullable=False),
        sa.Column("event_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("status", dumping_status, nullable=False),
    )
    op.create_table(
        "dumping_candidates",
        *_owi_columns(),
        sa.Column(
            "observation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("observations.id"),
            nullable=False,
            unique=True,
        ),
        sa.Column("review", dumping_review, nullable=False),
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column(
            "dumping_site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("dumping_sites.id")
        ),
    )
    op.create_table(
        "dumping_events",
        *_owi_columns(),
        sa.Column(
            "dumping_site_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("dumping_sites.id"),
            nullable=False,
        ),
        sa.Column(
            "observation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("observations.id"),
            nullable=False,
        ),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "dumping_interventions",
        *_owi_columns(),
        sa.Column(
            "dumping_site_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("dumping_sites.id"),
            nullable=False,
        ),
        sa.Column("kind", intervention_kind, nullable=False),
        sa.Column("performed_on", sa.Date, nullable=False),
        sa.Column("notes", sa.String(500)),
    )


def downgrade() -> None:
    op.drop_table("dumping_interventions")
    op.drop_table("dumping_events")
    op.drop_table("dumping_candidates")
    op.drop_table("dumping_sites")
    for enum in (intervention_kind, dumping_review, dumping_status):
        enum.drop(op.get_bind(), checkfirst=True)
