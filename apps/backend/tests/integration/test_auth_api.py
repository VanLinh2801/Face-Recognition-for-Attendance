from __future__ import annotations

import importlib
from dataclasses import replace
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.application.use_cases.auth import (
    GetCurrentUserUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshAccessTokenUseCase,
)
from app.core import dependencies
from app.core.config import Settings
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


def _build_auth_services():
    user_repo = _UserRepo()
    refresh_repo = _RefreshRepo()
    settings = Settings(
        JWT_SECRET_KEY="secret",
        JWT_ISSUER="issuer",
        JWT_AUDIENCE="aud",
        JWT_ACCESS_EXPIRES_SECONDS=60,
        JWT_REFRESH_EXPIRES_SECONDS=3600,
        ENABLE_EVENT_CONSUMER=False,
    )
    return (
        LoginUseCase(user_repository=user_repo, refresh_token_repository=refresh_repo, settings=settings),
        RefreshAccessTokenUseCase(user_repository=user_repo, refresh_token_repository=refresh_repo, settings=settings),
        LogoutUseCase(refresh_repo),
        GetCurrentUserUseCase(user_repo, settings),
    )


def test_auth_token_lifecycle_and_ws_connect(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.setenv("JWT_SECRET_KEY", "secret")
    monkeypatch.setenv("JWT_ISSUER", "issuer")
    monkeypatch.setenv("JWT_AUDIENCE", "aud")
    monkeypatch.setenv("AUTH_SEED_ADMIN_USERNAME", "admin")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)
    login_uc, refresh_uc, logout_uc, me_uc = _build_auth_services()
    app_main.app.dependency_overrides[dependencies.get_login_use_case] = lambda: login_uc
    app_main.app.dependency_overrides[dependencies.get_refresh_access_token_use_case] = lambda: refresh_uc
    app_main.app.dependency_overrides[dependencies.get_logout_use_case] = lambda: logout_uc
    app_main.app.dependency_overrides[dependencies.get_current_user_use_case] = lambda: me_uc

    with TestClient(app_main.app) as client:
        login_resp = client.post("/api/v1/auth/login", json={"username": "admin", "password": "secret"})
        assert login_resp.status_code == 200
        tokens = login_resp.json()
        access_token = tokens["access_token"]
        refresh_token = tokens["refresh_token"]

        me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {access_token}"})
        assert me_resp.status_code == 200
        assert me_resp.json()["username"] == "admin"

        refresh_resp = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert refresh_resp.status_code == 200
        new_access_token = refresh_resp.json()["access_token"]
        assert new_access_token

        with client.websocket_connect(f"/api/ws/v1/realtime?token={new_access_token}&channels=events.business") as _ws:
            pass

        logout_resp = client.post(
            "/api/v1/auth/logout",
            json={"refresh_token": refresh_token},
            headers={"Authorization": f"Bearer {access_token}"},
        )
        assert logout_resp.status_code == 200
        refresh_again = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
        assert refresh_again.status_code == 422
