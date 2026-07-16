"""Collection method on vehicles — trucks, tricycles, bikes, handcarts, on-foot crews."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

collection_method = postgresql.ENUM(
    "truck",
    "tricycle",
    "motorbike",
    "bicycle",
    "handcart",
    "on_foot",
    name="collection_method",
    create_type=False,
)


def upgrade() -> None:
    collection_method.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "trucks",
        sa.Column("method", collection_method, nullable=False, server_default="truck"),
    )


def downgrade() -> None:
    op.drop_column("trucks", "method")
    collection_method.drop(op.get_bind(), checkfirst=True)
