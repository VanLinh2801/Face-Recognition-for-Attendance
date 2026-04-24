from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.application.use_cases.auth import (
    GetCurrentUserUseCase,
    LoginCommand,
    LoginUseCase,
    LogoutUseCase,
    RefreshAccessTokenUseCase,
    RefreshCommand,
)
from app.core.config import Settings
from app.core.exceptions import ValidationError
from app.core.security import hash_password
from app.domain.auth.entities import RefreshTokenRecord, User


class _UserRepo:
    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self.user = User(
            id=uuid4(),
            username="admin",
            password_hash=hash_password("secret", 4),
            is_active=True,
            last_login_at=None,
            created_at=now,
            updated_at=now,
        )

    def get_by_username(self, username: str):
        return self.user if username == self.user.username else None

    def get_by_id(self, user_id):
        return self.user if user_id == self.user.id else None

    def create_user(self, *, username: str, password_hash: str, is_active: bool = True):
        _ = username, password_hash, is_active
        return self.user

    def update_last_login(self, user_id, last_login_at):
        _ = user_id
        self.user = replace(self.user, last_login_at=last_login_at)

    def count_users(self):
        return 1


class _RefreshRepo:
    def __init__(self) -> None:
        self.items: dict[str, RefreshTokenRecord] = {}

    def create(self, *, user_id, token_hash: str, expires_at):
        item = RefreshTokenRecord(
            id=uuid4(),
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            revoked_at=None,
            created_at=datetime.now(timezone.utc),
            last_used_at=None,
        )
        self.items[token_hash] = item
        return item

    def get_by_hash(self, token_hash: str):
        return self.items.get(token_hash)

    def revoke(self, token_hash: str, revoked_at):
        item = self.items.get(token_hash)
        if item is None:
            return False
        self.items[token_hash] = replace(item, revoked_at=revoked_at)
        return True

    def touch_last_used(self, token_hash: str, used_at):
        item = self.items.get(token_hash)
        if item is not None:
            self.items[token_hash] = replace(item, last_used_at=used_at)


def _settings() -> Settings:
    return Settings(
        JWT_SECRET_KEY="secret",
        JWT_ISSUER="issuer",
        JWT_AUDIENCE="aud",
        JWT_ACCESS_EXPIRES_SECONDS=60,
        JWT_REFRESH_EXPIRES_SECONDS=3600,
        ENABLE_EVENT_CONSUMER=False,
    )


def test_login_refresh_logout_flow() -> None:
    user_repo = _UserRepo()
    refresh_repo = _RefreshRepo()
    login = LoginUseCase(user_repository=user_repo, refresh_token_repository=refresh_repo, settings=_settings())
    refresh = RefreshAccessTokenUseCase(user_repository=user_repo, refresh_token_repository=refresh_repo, settings=_settings())
    logout = LogoutUseCase(refresh_repo)

    login_result = login.execute(LoginCommand(username="admin", password="secret"))
    assert login_result.access_token
    refreshed = refresh.execute(RefreshCommand(refresh_token=login_result.refresh_token))
    assert refreshed.access_token
    logout.execute(login_result.refresh_token)
    with pytest.raises(ValidationError):
        refresh.execute(RefreshCommand(refresh_token=login_result.refresh_token))


def test_get_current_user_with_access_token() -> None:
    user_repo = _UserRepo()
    refresh_repo = _RefreshRepo()
    settings = _settings()
    login = LoginUseCase(user_repository=user_repo, refresh_token_repository=refresh_repo, settings=settings)
    current_user = GetCurrentUserUseCase(user_repo, settings)
    token = login.execute(LoginCommand(username="admin", password="secret")).access_token
    user = current_user.execute(token)
    assert user.username == "admin"


def test_refresh_expired_token_rejected() -> None:
    user_repo = _UserRepo()
    refresh_repo = _RefreshRepo()
    settings = _settings()
    refresh_repo.create(
        user_id=user_repo.user.id,
        token_hash="expired-hash",
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
    )
    refresh = RefreshAccessTokenUseCase(user_repository=user_repo, refresh_token_repository=refresh_repo, settings=settings)
    from app.core.security import hash_refresh_token

    with pytest.raises(ValidationError):
        refresh.execute(RefreshCommand(refresh_token="not-matching"))
    # Inject matching hash case
    refresh_repo.items[hash_refresh_token("expired")] = refresh_repo.items.pop("expired-hash")
    with pytest.raises(ValidationError):
        refresh.execute(RefreshCommand(refresh_token="expired"))
