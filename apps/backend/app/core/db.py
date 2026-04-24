"""Database access helpers and session factory."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings


def create_db_engine(settings: Settings) -> Engine:
    """Create SQLAlchemy engine for the application runtime."""
    return create_engine(
        settings.sqlalchemy_database_url,
        pool_pre_ping=True,
        future=True,
    )


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Create session factory used by API and background tasks."""
    return sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db_session(session_factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    """Yield a database session for request/background scope."""
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def ping_database(engine: Engine) -> bool:
    """Run lightweight DB health probe."""
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
