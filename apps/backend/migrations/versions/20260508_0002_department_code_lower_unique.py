"""Add case-insensitive unique index for department code."""

from __future__ import annotations

from alembic import op


revision = "20260508_0002"
down_revision = "20260419_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE UNIQUE INDEX ix_departments_code_lower_unique ON departments (lower(code))")


def downgrade() -> None:
    op.drop_index("ix_departments_code_lower_unique", table_name="departments")
