"""Dependency wiring helpers for the API layer."""

from __future__ import annotations

from collections.abc import Generator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.bootstrap.container import Container
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork


def get_container(request: Request) -> Container:
    return request.app.state.container


def get_db_session(container: Container = Depends(get_container)) -> Generator[Session, None, None]:
    yield from container.session_provider.get_session()


def get_unit_of_work(
    session: Session = Depends(get_db_session),
    container: Container = Depends(get_container),
) -> SqlAlchemyUnitOfWork:
    return container.create_uow(session)
