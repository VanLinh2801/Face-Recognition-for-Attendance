"""Media asset query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.storage_gateway import ObjectStorageGateway
from app.application.interfaces.repositories.media_asset_repository import MediaAssetRepository
from app.core.config import Settings
from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import MediaAssetType


@dataclass(slots=True, kw_only=True)
class ListMediaAssetsQuery:
    page: int = 1
    page_size: int = 20
    asset_type: MediaAssetType | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None


class ListMediaAssetsUseCase:
    def __init__(self, repository: MediaAssetRepository) -> None:
        self._repository = repository

    def execute(self, query: ListMediaAssetsQuery) -> PageResult[MediaAsset]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_media_assets(
            page=page_query.page,
            page_size=page_query.page_size,
            asset_type=query.asset_type,
            created_from=query.created_from,
            created_to=query.created_to,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


@dataclass(slots=True, kw_only=True)
class CleanupMediaAssetsCommand:
    max_batch_size: int = 500


@dataclass(slots=True, kw_only=True)
class CleanupMediaAssetsResult:
    deleted_total: int
    deleted_by_asset_type: dict[str, int]


class CleanupMediaAssetsUseCase:
    def __init__(
        self,
        repository: MediaAssetRepository,
        storage_gateway: ObjectStorageGateway,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._storage_gateway = storage_gateway
        self._settings = settings

    def execute(self, command: CleanupMediaAssetsCommand) -> CleanupMediaAssetsResult:
        deleted_by_asset_type: dict[str, int] = {}

        retention_map = {
            MediaAssetType.RECOGNITION_SNAPSHOT: self._settings.media_retention_days_recognition,
            MediaAssetType.UNKNOWN_SNAPSHOT: self._settings.media_retention_days_unknown,
            MediaAssetType.SPOOF_SNAPSHOT: self._settings.media_retention_days_spoof,
        }

        for asset_type, retention_days in retention_map.items():
            older_than = datetime.now(timezone.utc) - timedelta(days=retention_days)
            expired_assets = self._repository.list_expired_assets(
                asset_type=asset_type,
                older_than=older_than,
                limit=command.max_batch_size,
            )

            deleted_count = 0
            for item in expired_assets:
                self._storage_gateway.delete_object(
                    bucket_name=item.bucket_name,
                    object_key=item.object_key,
                )
                if self._repository.delete_media_asset(media_asset_id=item.id):
                    deleted_count += 1

            deleted_by_asset_type[asset_type.value] = deleted_count

        return CleanupMediaAssetsResult(
            deleted_total=sum(deleted_by_asset_type.values()),
            deleted_by_asset_type=deleted_by_asset_type,
        )
