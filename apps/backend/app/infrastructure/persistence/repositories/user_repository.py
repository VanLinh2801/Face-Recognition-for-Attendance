"""SQLAlchemy user repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.user_repository import UserRepository
from app.domain.auth.entities import User
from app.infrastructure.persistence.models.user_model import UserModel


def _to_domain(item: UserModel) -> User:
    return User(
        id=item.id,
        username=item.username,
        password_hash=item.password_hash,
        is_active=item.is_active,
        last_login_at=item.last_login_at,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


class SqlAlchemyUserRepository(UserRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_username(self, username: str) -> User | None:
        stmt = select(UserModel).where(UserModel.username == username)
        item = self._session.execute(stmt).scalar_one_or_none()
        return _to_domain(item) if item else None

    def get_by_id(self, user_id: UUID) -> User | None:
        stmt = select(UserModel).where(UserModel.id == user_id)
        item = self._session.execute(stmt).scalar_one_or_none()
        return _to_domain(item) if item else None

    def create_user(self, *, username: str, password_hash: str, is_active: bool = True) -> User:
        now = datetime.now(timezone.utc)
        item = UserModel(
            username=username,
            password_hash=password_hash,
            is_active=is_active,
            last_login_at=None,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return _to_domain(item)

    def update_last_login(self, user_id: UUID, last_login_at: datetime) -> None:
        item = self._session.get(UserModel, user_id)
        if item is None:
            return
        item.last_login_at = last_login_at
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()

    def count_users(self) -> int:
        stmt = select(func.count()).select_from(UserModel)
        return self._session.execute(stmt).scalar_one()
