from __future__ import annotations

import importlib
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.auth.entities import User
from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import MediaAssetType, StorageProvider


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


class _UseCaseGetMediaAssetPresignedUrl:
    def execute(self, query):
        return type(
            "R",
            (),
            {
                "asset_id": query.asset_id,
                "url": "http://minio.local/presigned/object.jpg",
                "expires_in": query.expires_in,
            },
        )()


class _UseCaseUploadMediaAsset:
    last_command = None

    def execute(self, command):
        self.__class__.last_command = command
        return MediaAsset(
            id=uuid4(),
            storage_provider=StorageProvider.MINIO,
            bucket_name="attendance",
            object_key="registrations/raw/upload.jpg",
            original_filename=command.filename,
            mime_type=command.mime_type,
            file_size=command.file_size,
            checksum=None,
            asset_type=command.asset_type,
            uploaded_by_person_id=command.uploaded_by_person_id,
            created_at=datetime.now(timezone.utc),
        )


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
    app_main.app.dependency_overrides[dependencies.get_media_asset_presigned_url_use_case] = (
        lambda: _UseCaseGetMediaAssetPresignedUrl()
    )
    app_main.app.dependency_overrides[dependencies.get_upload_media_asset_use_case] = lambda: _UseCaseUploadMediaAsset()
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUoW()

    with TestClient(app_main.app) as client:
        response = client.post("/api/v1/internal/media-assets/cleanup", json={"max_batch_size": 500})
        assert response.status_code == 200
        payload = response.json()
        assert payload["deleted_total"] == 2
        assert payload["deleted_by_asset_type"]["recognition_snapshot"] == 1

        asset_id = str(uuid4())
        preview_response = client.get(f"/api/v1/media-assets/{asset_id}/presigned-url?expires_in=1800")
        assert preview_response.status_code == 200
        preview_payload = preview_response.json()
        assert preview_payload["asset_id"] == asset_id
        assert preview_payload["expires_in"] == 1800
        assert preview_payload["url"].startswith("http")

        upload_response = client.post(
            "/api/v1/media-assets/upload",
            files={"file": ("face.jpg", b"image-bytes", "image/jpeg")},
            data={"asset_type": MediaAssetType.REGISTRATION_FACE.value},
        )
        assert upload_response.status_code == 200
        upload_payload = upload_response.json()
        assert upload_payload["original_filename"] == "face.jpg"
        assert upload_payload["file_size"] == len(b"image-bytes")
        assert upload_payload["asset_type"] == MediaAssetType.REGISTRATION_FACE.value
        assert _UseCaseUploadMediaAsset.last_command.mime_type == "image/jpeg"
