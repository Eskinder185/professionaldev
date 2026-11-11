"""Baseline: the schema in sql/001_init.sql.

The SQL file is the single source of truth for the baseline, so `psql -f sql/001_init.sql` and
`alembic upgrade head` produce the same database. Later changes are ordinary migrations.

Revision ID: 0001_baseline
Revises:
"""

from pathlib import Path

from alembic import op

from app.db import execute_script

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).resolve().parents[2] / "sql" / "001_init.sql"


def upgrade() -> None:
    execute_script(op.get_bind(), SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    # Destructive by design: the baseline owns the whole schema. Take a backup first.
    op.execute("DROP SCHEMA IF EXISTS careeros CASCADE")
