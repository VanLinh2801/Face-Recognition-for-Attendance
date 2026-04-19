"""Media asset domain entities."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.shared.enums import MediaAssetType, StorageProvider


@dataclass(slots=True, kw_only=True)
class MediaAsset:
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
