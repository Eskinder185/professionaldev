"""Alembic environment. Schema changes are migrations; nobody edits the database by hand."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import text

from app.config import get_settings
from app.db import SCHEMA, make_engine
from app.models import Base

config = context.config
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_online() -> None:
    engine = make_engine(get_settings())
    with engine.connect() as connection:
        # The version table lives in our schema, so the schema must exist before Alembic writes to it.
        connection.execute(text(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            version_table_schema=SCHEMA,
            include_schemas=False,
        )
        with context.begin_transaction():
            context.run_migrations()
    engine.dispose()


if context.is_offline_mode():
    raise SystemExit("Offline mode is not supported; run against a database.")
run_migrations_online()
