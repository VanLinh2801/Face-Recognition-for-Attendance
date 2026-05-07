from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.application.use_cases.media_assets import GetMediaAssetPresignedUrlQuery, GetMediaAssetPresignedUrlUseCase
from app.core.exceptions import NotFoundError
from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import MediaAssetType, StorageProvider


class _FakeMediaAssetRepository:
    def __init__(self, media_asset: MediaAsset | None) -> None:
        self._media_asset = media_asset

    def get_media_asset(self, _media_asset_id):
        return self._media_asset


class _FakeStorageGateway:
    def __init__(self) -> None:
        self.last_request: tuple[str, str, timedelta] | None = None

    def presigned_get_object_url(self, *, bucket_name: str, object_key: str, expires_in: timedelta) -> str:
        self.last_request = (bucket_name, object_key, expires_in)
        return "http://minio.local/presigned-url"


def _asset() -> MediaAsset:
    return MediaAsset(
        id=uuid4(),
        storage_provider=StorageProvider.MINIO,
        bucket_name="attendance",
        object_key="registrations/raw/person-1.jpg",
        original_filename="person-1.jpg",
        mime_type="image/jpeg",
        file_size=10,
        checksum=None,
        asset_type=MediaAssetType.REGISTRATION_FACE,
        uploaded_by_person_id=None,
        created_at=datetime.now(timezone.utc),
    )


def test_get_media_asset_presigned_url_returns_url() -> None:
    media_asset = _asset()
    repository = _FakeMediaAssetRepository(media_asset)
    storage_gateway = _FakeStorageGateway()
    use_case = GetMediaAssetPresignedUrlUseCase(repository=repository, storage_gateway=storage_gateway)

    result = use_case.execute(GetMediaAssetPresignedUrlQuery(asset_id=media_asset.id, expires_in=3600))

    assert result.asset_id == media_asset.id
    assert result.url == "http://minio.local/presigned-url"
    assert result.expires_in == 3600
    assert storage_gateway.last_request == ("attendance", "registrations/raw/person-1.jpg", timedelta(seconds=3600))


def test_get_media_asset_presigned_url_raises_when_not_found() -> None:
    repository = _FakeMediaAssetRepository(None)
    storage_gateway = _FakeStorageGateway()
    use_case = GetMediaAssetPresignedUrlUseCase(repository=repository, storage_gateway=storage_gateway)

    with pytest.raises(NotFoundError):
        use_case.execute(GetMediaAssetPresignedUrlQuery(asset_id=uuid4(), expires_in=60))
