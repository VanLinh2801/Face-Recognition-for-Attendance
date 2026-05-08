"""Add active-person unique indexes for contact fields."""

from __future__ import annotations

from alembic import op


revision = "20260508_0003"
down_revision = "20260508_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE UNIQUE INDEX ix_persons_email_active_unique "
        "ON persons (email) "
        "WHERE email IS NOT NULL AND status != 'inactive'"
    )
    op.execute(
        "CREATE UNIQUE INDEX ix_persons_phone_active_unique "
        "ON persons (phone) "
        "WHERE phone IS NOT NULL AND status != 'inactive'"
    )


def downgrade() -> None:
    op.drop_index("ix_persons_phone_active_unique", table_name="persons")
    op.drop_index("ix_persons_email_active_unique", table_name="persons")
