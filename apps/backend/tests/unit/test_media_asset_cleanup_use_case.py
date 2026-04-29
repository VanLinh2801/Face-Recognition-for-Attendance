from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.application.use_cases.media_assets import CleanupMediaAssetsCommand, CleanupMediaAssetsUseCase
from app.core.config import Settings
from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import MediaAssetType, StorageProvider


def _asset(*, asset_type: MediaAssetType, created_at: datetime) -> MediaAsset:
    return MediaAsset(
        id=uuid4(),
        storage_provider=StorageProvider.MINIO,
        bucket_name="attendance",
        object_key=f"{asset_type.value}/{uuid4()}.jpg",
        original_filename="file.jpg",
        mime_type="image/jpeg",
        file_size=10,
        checksum=None,
        asset_type=asset_type,
        uploaded_by_person_id=None,
        created_at=created_at,
    )


class _FakeMediaAssetRepo:
    def __init__(self, expired_assets: dict[MediaAssetType, list[MediaAsset]]) -> None:
        self.expired_assets = expired_assets
        self.deleted_ids: list = []

    def list_expired_assets(self, *, asset_type, older_than, limit):
        _ = older_than, limit
        return list(self.expired_assets.get(asset_type, []))

    def delete_media_asset(self, *, media_asset_id):
        self.deleted_ids.append(media_asset_id)
        return True


class _FakeStorageGateway:
    def __init__(self) -> None:
        self.deleted: list[tuple[str, str]] = []

    def delete_object(self, *, bucket_name: str, object_key: str) -> None:
        self.deleted.append((bucket_name, object_key))


def test_cleanup_media_assets_use_case_deletes_only_target_asset_types() -> None:
    now = datetime.now(timezone.utc)
    recognition = _asset(asset_type=MediaAssetType.RECOGNITION_SNAPSHOT, created_at=now - timedelta(days=40))
    unknown = _asset(asset_type=MediaAssetType.UNKNOWN_SNAPSHOT, created_at=now - timedelta(days=35))
    spoof = _asset(asset_type=MediaAssetType.SPOOF_SNAPSHOT, created_at=now - timedelta(days=50))

    repo = _FakeMediaAssetRepo(
        {
            MediaAssetType.RECOGNITION_SNAPSHOT: [recognition],
            MediaAssetType.UNKNOWN_SNAPSHOT: [unknown],
            MediaAssetType.SPOOF_SNAPSHOT: [spoof],
        }
    )
    storage = _FakeStorageGateway()
    settings = Settings(
        ENABLE_EVENT_CONSUMER=False,
        MEDIA_RETENTION_DAYS_RECOGNITION=30,
        MEDIA_RETENTION_DAYS_UNKNOWN=30,
        MEDIA_RETENTION_DAYS_SPOOF=30,
    )

    use_case = CleanupMediaAssetsUseCase(repository=repo, storage_gateway=storage, settings=settings)
    result = use_case.execute(CleanupMediaAssetsCommand(max_batch_size=100))

    assert result.deleted_total == 3
    assert result.deleted_by_asset_type["recognition_snapshot"] == 1
    assert result.deleted_by_asset_type["unknown_snapshot"] == 1
    assert result.deleted_by_asset_type["spoof_snapshot"] == 1
    assert len(storage.deleted) == 3
    assert len(repo.deleted_ids) == 3
