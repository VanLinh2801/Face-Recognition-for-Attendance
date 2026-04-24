"""Database session provider utilities."""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy.orm import Session, sessionmaker


class SessionProvider:
    """Provide request-scoped SQLAlchemy sessions."""

    def __init__(self, session_factory: sessionmaker[Session]) -> None:
        self._session_factory = session_factory

    def get_session(self) -> Generator[Session, None, None]:
        session = self._session_factory()
        try:
            yield session
        finally:
            session.close()
