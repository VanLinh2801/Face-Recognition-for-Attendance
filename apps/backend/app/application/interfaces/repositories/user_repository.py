"""User repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.auth.entities import User


class UserRepository(Protocol):
    def get_by_username(self, username: str) -> User | None: ...

    def get_by_id(self, user_id: UUID) -> User | None: ...

    def create_user(self, *, username: str, password_hash: str, is_active: bool = True) -> User: ...

    def update_last_login(self, user_id: UUID, last_login_at: datetime) -> None: ...

    def count_users(self) -> int: ...
