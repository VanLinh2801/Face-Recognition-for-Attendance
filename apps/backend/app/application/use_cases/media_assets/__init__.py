"""Media asset query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
import re
from typing import BinaryIO
from uuid import UUID
from uuid import uuid4

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.storage_gateway import ObjectStorageGateway
from app.application.interfaces.repositories.media_asset_repository import MediaAssetRepository
from app.core.config import Settings
from app.core.exceptions import NotFoundError, ValidationError
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


class GetMediaAssetUseCase:
    def __init__(self, repository: MediaAssetRepository) -> None:
        self._repository = repository

    def execute(self, asset_id: UUID) -> MediaAsset:
        media_asset = self._repository.get_media_asset(asset_id)
        if media_asset is None:
            raise NotFoundError("Media asset not found")
        return media_asset


@dataclass(slots=True, kw_only=True)
class UploadMediaAssetCommand:
    file_data: BinaryIO
    filename: str
    mime_type: str
    file_size: int
    asset_type: MediaAssetType = MediaAssetType.REGISTRATION_FACE
    uploaded_by_person_id: UUID | None = None


class UploadMediaAssetUseCase:
    _allowed_mime_types = {"image/jpeg", "image/png"}

    def __init__(
        self,
        repository: MediaAssetRepository,
        storage_gateway: ObjectStorageGateway,
        settings: Settings,
    ) -> None:
        self._repository = repository
        self._storage_gateway = storage_gateway
        self._settings = settings

    def execute(self, command: UploadMediaAssetCommand) -> MediaAsset:
        if command.mime_type not in self._allowed_mime_types:
            raise ValidationError("unsupported media type", details={"mime_type": command.mime_type})
        if command.file_size <= 0:
            raise ValidationError("file cannot be empty", details={"file_size": str(command.file_size)})
        if command.file_size > self._settings.media_upload_max_bytes:
            raise ValidationError(
                "file is too large",
                details={"max_bytes": str(self._settings.media_upload_max_bytes)},
            )

        bucket_name = self._settings.minio_bucket
        object_key = f"registrations/raw/{uuid4()}-{_safe_filename(command.filename)}"
        command.file_data.seek(0)
        self._storage_gateway.put_object(
            bucket_name=bucket_name,
            object_key=object_key,
            data=command.file_data,
            length=command.file_size,
            content_type=command.mime_type,
        )

        try:
            return self._repository.create_media_asset(
                storage_provider="minio",
                bucket_name=bucket_name,
                object_key=object_key,
                original_filename=command.filename,
                mime_type=command.mime_type,
                file_size=command.file_size,
                checksum=None,
                asset_type=command.asset_type.value,
                uploaded_by_person_id=command.uploaded_by_person_id,
            )
        except Exception:
            self._storage_gateway.delete_object(bucket_name=bucket_name, object_key=object_key)
            raise


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


@dataclass(slots=True, kw_only=True)
class GetMediaAssetPresignedUrlQuery:
    asset_id: UUID
    expires_in: int = 3600


@dataclass(slots=True, kw_only=True)
class MediaAssetPresignedUrlResult:
    asset_id: UUID
    url: str
    expires_in: int


class GetMediaAssetPresignedUrlUseCase:
    def __init__(self, repository: MediaAssetRepository, storage_gateway: ObjectStorageGateway) -> None:
        self._repository = repository
        self._storage_gateway = storage_gateway

    def execute(self, query: GetMediaAssetPresignedUrlQuery) -> MediaAssetPresignedUrlResult:
        media_asset = self._repository.get_media_asset(query.asset_id)
        if media_asset is None:
            raise NotFoundError("Media asset not found")

        expires_delta = timedelta(seconds=query.expires_in)
        url = self._storage_gateway.presigned_get_object_url(
            bucket_name=media_asset.bucket_name,
            object_key=media_asset.object_key,
            expires_in=expires_delta,
        )
        return MediaAssetPresignedUrlResult(
            asset_id=media_asset.id,
            url=url,
            expires_in=query.expires_in,
        )


def _safe_filename(filename: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", filename.strip()).strip(".-")
    return normalized or "upload"
