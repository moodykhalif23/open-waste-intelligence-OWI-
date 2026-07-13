"""Material prices, recycling partners, and collected-weight estimate."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


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
    op.add_column(
        "collection_events",
        sa.Column("estimated_weight_kg", sa.Float, nullable=False, server_default="0"),
    )
    op.create_table(
        "material_prices",
        *_owi_columns(),
        sa.Column("material", sa.String(30), nullable=False),
        sa.Column("kes_per_kg", sa.Float, nullable=False),
        sa.Column("effective_date", sa.Date, nullable=False),
        sa.Column("source", sa.String(200)),
    )
    op.create_table(
        "recycling_partners",
        *_owi_columns(),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("materials_accepted", postgresql.JSONB, nullable=False, server_default="[]"),
        sa.Column("min_kg_per_month", sa.Float, nullable=False, server_default="0"),
        sa.Column("indicative_price_kes_per_kg", sa.Float),
        sa.Column("contact", sa.String(200)),
    )


def downgrade() -> None:
    op.drop_table("recycling_partners")
    op.drop_table("material_prices")
    op.drop_column("collection_events", "estimated_weight_kg")
