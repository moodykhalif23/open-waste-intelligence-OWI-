"""Auth: password hash, per-user token revocation, unique phone."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(200)))
    op.add_column(
        "users", sa.Column("token_version", sa.Integer, nullable=False, server_default="0")
    )
    op.create_unique_constraint("uq_users_phone", "users", ["phone"])


def downgrade() -> None:
    op.drop_constraint("uq_users_phone", "users")
    op.drop_column("users", "token_version")
    op.drop_column("users", "password_hash")
