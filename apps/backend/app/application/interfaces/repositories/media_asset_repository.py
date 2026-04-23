"""Media asset repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import MediaAssetType


class MediaAssetRepository(Protocol):
    """Read abstraction for media assets."""

    def list_media_assets(
        self,
        *,
        page: int,
        page_size: int,
        asset_type: MediaAssetType | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[MediaAsset], int]: ...

    def create_media_asset(
        self,
        *,
        storage_provider: str,
        bucket_name: str,
        object_key: str,
        original_filename: str,
        mime_type: str,
        file_size: int,
        checksum: str | None,
        asset_type: str,
        uploaded_by_person_id: UUID | None = None,
    ) -> MediaAsset: ...

    def get_media_asset(self, media_asset_id: UUID) -> MediaAsset | None: ...
