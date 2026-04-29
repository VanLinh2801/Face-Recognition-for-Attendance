"""Media asset transport schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.shared.enums import MediaAssetType, StorageProvider
from app.presentation.schemas.common import PaginatedResponse


class MediaAssetItemResponse(BaseModel):
    id: UUID
    storage_provider: StorageProvider
    bucket_name: str
    object_key: str
    original_filename: str
    mime_type: str
    file_size: int
    checksum: str | None
    asset_type: MediaAssetType
    uploaded_by_person_id: UUID | None
    created_at: datetime


class MediaAssetListResponse(PaginatedResponse):
    items: list[MediaAssetItemResponse]


class CleanupMediaAssetsRequest(BaseModel):
    max_batch_size: int = Field(default=500, ge=1, le=5000)


class CleanupMediaAssetsResponse(BaseModel):
    deleted_total: int
    deleted_by_asset_type: dict[str, int]
