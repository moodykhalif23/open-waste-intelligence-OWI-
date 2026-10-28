"""Indexes for the per-bin, per-route and latest-per-bin reads that scan whole tables."""

from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None

INDEXES = [
    ("ix_observations_bin_captured", "observations", ["bin_id", "captured_at"]),
    ("ix_observations_org_captured", "observations", ["org_id", "captured_at"]),
    ("ix_collection_events_bin_occurred", "collection_events", ["bin_id", "occurred_at"]),
    ("ix_predictions_observation", "predictions", ["observation_id"]),
    ("ix_route_stops_route_seq", "route_stops", ["route_id", "seq"]),
    ("ix_routes_org_date", "routes", ["org_id", "date"]),
    ("ix_bins_site", "bins", ["site_id"]),
    ("ix_dumping_events_site", "dumping_events", ["dumping_site_id", "occurred_at"]),
]


def upgrade() -> None:
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns)
    op.create_index(
        "ix_bin_health_org_bin_date",
        "bin_health_daily",
        ["org_id", "bin_id", "date"],
        postgresql_ops={"date": "DESC"},
    )


def downgrade() -> None:
    op.drop_index("ix_bin_health_org_bin_date", table_name="bin_health_daily")
    for name, table, _columns in reversed(INDEXES):
        op.drop_index(name, table_name=table)
