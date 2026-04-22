"""Application composition root."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings
from app.core.db import create_db_engine, create_session_factory
from app.infrastructure.persistence.session import SessionProvider
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork


@dataclass(slots=True)
class Container:
    """Application dependency container."""

    settings: Settings
    engine: Engine
    session_factory: sessionmaker[Session]
    session_provider: SessionProvider

    def create_uow(self, session: Session) -> SqlAlchemyUnitOfWork:
        return SqlAlchemyUnitOfWork(session)


def build_container(settings: Settings | None = None) -> Container:
    """Build runtime container with configured infrastructure dependencies."""
    runtime_settings = settings or get_settings()
    engine = create_db_engine(runtime_settings)
    session_factory = create_session_factory(engine)
    session_provider = SessionProvider(session_factory)
    return Container(
        settings=runtime_settings,
        engine=engine,
        session_factory=session_factory,
        session_provider=session_provider,
    )
