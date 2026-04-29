from __future__ import annotations

import importlib
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.auth.entities import User


class _FakeUoW:
    def commit(self):
        return None


def _build_admin_user() -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=uuid4(),
        username="admin",
        password_hash="x",
        is_active=True,
        last_login_at=now,
        created_at=now,
        updated_at=now,
    )


class _UseCaseCleanupMediaAssets:
    def execute(self, _cmd):
        return type(
            "R",
            (),
            {
                "deleted_total": 2,
                "deleted_by_asset_type": {
                    "recognition_snapshot": 1,
                    "unknown_snapshot": 1,
                    "spoof_snapshot": 0,
                },
            },
        )()


def test_media_asset_cleanup_endpoint(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.delenv("AUTH_SEED_ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("AUTH_SEED_ADMIN_PASSWORD", raising=False)

    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)

    app_main.app.dependency_overrides[dependencies.get_admin_user] = lambda: _build_admin_user()
    app_main.app.dependency_overrides[dependencies.get_cleanup_media_assets_use_case] = lambda: _UseCaseCleanupMediaAssets()
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUoW()

    with TestClient(app_main.app) as client:
        response = client.post("/api/v1/internal/media-assets/cleanup", json={"max_batch_size": 500})
        assert response.status_code == 200
        payload = response.json()
        assert payload["deleted_total"] == 2
        assert payload["deleted_by_asset_type"]["recognition_snapshot"] == 1
