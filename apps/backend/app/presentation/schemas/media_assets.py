"""Media asset transport schemas."""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

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
