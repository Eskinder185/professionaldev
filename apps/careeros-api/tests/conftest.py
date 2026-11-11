"""Test setup: a disposable PostgreSQL database named *_test, rebuilt from sql/001_init.sql.

Point CAREEROS_TEST_DATABASE_URL at an empty database whose name ends in "_test", for example:
  postgresql+psycopg://careeros:careeros_test@127.0.0.1:55432/careeros_test
The schema in that database is DROPPED and recreated. Nothing else is touched.
"""

from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.db import execute_script

TEST_URL = os.environ.get("CAREEROS_TEST_DATABASE_URL", "")
TEST_TOKEN = "test-token-0123456789abcdef"

# app.main builds an app at import time, so the environment must be in place first.
os.environ.setdefault("CAREEROS_DATABASE_URL", TEST_URL or "postgresql+psycopg://x:x@127.0.0.1:1/unused_test")
os.environ.setdefault("CAREEROS_API_TOKEN", TEST_TOKEN)

SQL = (Path(__file__).resolve().parent.parent / "sql" / "001_init.sql").read_text(encoding="utf-8")


def _guard() -> None:
    if not TEST_URL:
        pytest.skip("Set CAREEROS_TEST_DATABASE_URL to a disposable *_test database to run database tests.", allow_module_level=False)
    name = make_url(TEST_URL).database or ""
    if not name.endswith("_test"):
        raise RuntimeError(f"Refusing to rebuild '{name}': the test database name must end in _test.")


@pytest.fixture(scope="session")
def engine():
    _guard()
    eng = create_engine(TEST_URL, pool_pre_ping=True)
    with eng.begin() as conn:
        conn.exec_driver_sql("DROP SCHEMA IF EXISTS careeros CASCADE")
        execute_script(conn, SQL)
    yield eng
    eng.dispose()


TABLES = (
    "interview_turns, interview_sessions, portfolio_item_skills, portfolio_item_roles, role_profiles, portfolio_items, "
    "job_requirements, profile_skills, profiles, skills, ats_unmatched_entries, application_status_events, "
    "ats_application_links, sync_run_accounts, sync_runs, ats_accounts, applications, companies"
)


@pytest.fixture()
def db(engine) -> Iterator:
    """A connection to a clean database for each test (TRUNCATE is not blocked by the append-only trigger)."""
    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE careeros.{TABLES.replace(', ', ', careeros.')} RESTART IDENTITY CASCADE"))
    # Autocommit: statements are visible to the separate connections the constraint tests use.
    with engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
        yield conn


@pytest.fixture()
def settings():
    from app.config import Settings

    _guard()
    return Settings(database_url=TEST_URL, api_token=TEST_TOKEN)  # type: ignore[arg-type]


@pytest.fixture()
def client(engine, settings):
    from fastapi.testclient import TestClient

    from app.main import create_app

    with engine.begin() as conn:
        conn.execute(text(f"TRUNCATE careeros.{TABLES.replace(', ', ', careeros.')} RESTART IDENTITY CASCADE"))
    with TestClient(create_app(settings)) as c:
        yield c


AUTH = {"Authorization": f"Bearer {TEST_TOKEN}"}
