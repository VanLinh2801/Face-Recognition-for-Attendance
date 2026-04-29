from __future__ import annotations

import importlib
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.auth.entities import User


def _build_user(username: str) -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=uuid4(),
        username=username,
        password_hash="x",
        is_active=True,
        last_login_at=now,
        created_at=now,
        updated_at=now,
    )


def test_guarded_v1_endpoint_rejects_missing_token(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)

    with TestClient(app_main.app) as client:
        response = client.get("/api/v1/persons")
        assert response.status_code in (401, 422)


def test_guarded_catchup_rejects_non_admin_user(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)

    class _FakeCurrentUserUseCase:
        def execute(self, _access_token: str) -> User:
            return _build_user("viewer")

    app_main.app.dependency_overrides[dependencies.get_current_user_use_case] = lambda: _FakeCurrentUserUseCase()

    with TestClient(app_main.app) as client:
        response = client.get(
            "/api/ws/v1/realtime/catchup",
            params={"channel": "events.business", "since_timestamp": "2026-04-24T00:59:00Z", "limit": 10},
            headers={"Authorization": "Bearer non-admin-token"},
        )
        assert response.status_code in (401, 422)
