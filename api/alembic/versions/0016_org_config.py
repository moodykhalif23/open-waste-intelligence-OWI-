"""Per-org operational knobs: fuel price and waste density override deployment defaults."""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("org_settings", sa.Column("fuel_price_kes_per_l", sa.Float))
    op.add_column("org_settings", sa.Column("waste_density_kg_per_l", sa.Float))


def downgrade() -> None:
    op.drop_column("org_settings", "waste_density_kg_per_l")
    op.drop_column("org_settings", "fuel_price_kes_per_l")
