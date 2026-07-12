"""Initial schema: organizations, users, sites, bins, observations."""

import geoalchemy2
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

# create_type=False: types are created once explicitly in upgrade(); without it
# create_table would try to CREATE TYPE again and fail.
user_role = postgresql.ENUM(
    "admin", "coordinator", "collector", "viewer", "api_consumer",
    name="user_role", create_type=False,
)
fill_band = postgresql.ENUM(
    "empty", "low", "half", "high", "overflowing", name="fill_band", create_type=False
)
location_source = postgresql.ENUM("gps", "bin_registry", name="location_source", create_type=False)
privacy_status = postgresql.ENUM(
    "clean", "blurred", "quarantined", name="privacy_status", create_type=False
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
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    for enum in (user_role, fill_band, location_source, privacy_status):
        enum.create(op.get_bind(), checkfirst=True)

    op.create_table(
        "organizations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True)),
    )
    op.create_table(
        "users",
        *_owi_columns(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("phone", sa.String(30)),
        sa.Column("role", user_role, nullable=False),
    )
    op.create_table(
        "sites",
        *_owi_columns(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("site_type", sa.String(50), nullable=False),
        sa.Column("ward", sa.String(100)),
    )
    op.create_table(
        "bins",
        *_owi_columns(),
        sa.Column(
            "site_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("sites.id"), nullable=False
        ),
        sa.Column("qr_code", sa.String(64), nullable=False, unique=True),
        sa.Column("location", geoalchemy2.Geometry("POINT", srid=4326), nullable=False),
        sa.Column("volume_liters", sa.Integer, nullable=False),
        sa.Column("bin_type", sa.String(50), nullable=False),
        sa.Column("reference_photo_ref", sa.String(300)),
    )
    op.create_table(
        "observations",
        *_owi_columns(),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("synced_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", geoalchemy2.Geometry("POINT", srid=4326), nullable=False),
        sa.Column("location_source", location_source, nullable=False),
        sa.Column("bin_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("bins.id")),
        sa.Column("collector_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id")),
        sa.Column("image_ref", sa.String(300), nullable=False),
        sa.Column("image_sha256", sa.String(64), nullable=False),
        sa.Column("image_quality_flags", postgresql.JSONB, nullable=False, server_default="{}"),
        sa.Column("human_fill_tap", fill_band),
        sa.Column("privacy_status", privacy_status, nullable=False),
        sa.UniqueConstraint("org_id", "image_sha256", name="uq_observation_image"),
    )


def downgrade() -> None:
    for table in ("observations", "bins", "sites", "users", "organizations"):
        op.drop_table(table)
    for enum in (privacy_status, location_source, fill_band, user_role):
        enum.drop(op.get_bind(), checkfirst=True)
