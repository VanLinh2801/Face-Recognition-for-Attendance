"""Persistence unit of work implementation."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.application.interfaces.unit_of_work import UnitOfWork


class SqlAlchemyUnitOfWork(UnitOfWork):
    """SQLAlchemy-backed transactional unit of work."""

    def __init__(self, session: Session) -> None:
        self.session = session

    def __enter__(self) -> "SqlAlchemyUnitOfWork":
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if exc_type is not None:
            self.rollback()

    def commit(self) -> None:
        self.session.commit()

    def rollback(self) -> None:
        self.session.rollback()
