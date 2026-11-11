"""Engine and session factory. The schema itself comes from sql/001_init.sql or Alembic, never create_all."""

from collections.abc import Iterator

from sqlalchemy import Connection, Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import Settings

SCHEMA = "careeros"


def make_engine(settings: Settings) -> Engine:
    return create_engine(
        settings.database_url,
        pool_size=settings.pool_size,
        max_overflow=settings.pool_max_overflow,
        pool_recycle=settings.pool_recycle_seconds,
        pool_pre_ping=True,
        pool_timeout=10,
        # Resolve unqualified names in our own schema first; the models are schema-qualified anyway.
        # Fail fast when the database is down so /health answers in seconds instead of hanging.
        connect_args={"connect_timeout": 3, "options": f"-c search_path={SCHEMA},public -c timezone=UTC"},
    )


def make_session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


def session_dependency(factory: sessionmaker[Session]):
    """FastAPI dependency: one session per request, always closed, rolled back on error."""

    def get_session() -> Iterator[Session]:
        session = factory()
        try:
            yield session
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

    return get_session


def execute_script(conn: Connection, sql: str) -> None:
    """Run a multi-statement SQL file inside the connection's current transaction.

    SQLAlchemy would hand psycopg an (empty) parameter list, which makes psycopg treat the '%' in
    RAISE messages as placeholders. Going to the driver without parameters uses the simple query
    protocol, which accepts many statements and leaves '%' alone.
    """
    raw = conn.connection.driver_connection
    raw.execute(sql)  # type: ignore[union-attr]
