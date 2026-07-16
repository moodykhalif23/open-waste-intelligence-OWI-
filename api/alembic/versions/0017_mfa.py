"""TOTP MFA: per-user secret, activation flag, one-time recovery code hashes."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("mfa_secret", sa.String(64)))
    op.add_column(
        "users", sa.Column("mfa_enabled", sa.Boolean, nullable=False, server_default=sa.false())
    )
    op.add_column("users", sa.Column("mfa_recovery", postgresql.JSONB))


def downgrade() -> None:
    op.drop_column("users", "mfa_recovery")
    op.drop_column("users", "mfa_enabled")
    op.drop_column("users", "mfa_secret")
