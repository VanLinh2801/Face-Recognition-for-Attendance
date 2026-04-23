"""Media asset query use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.media_asset_repository import MediaAssetRepository
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
