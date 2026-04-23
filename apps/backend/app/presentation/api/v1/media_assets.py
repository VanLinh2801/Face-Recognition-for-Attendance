"""Media asset API endpoints."""

from datetime import datetime

from fastapi import APIRouter
from fastapi import Depends, Query

from app.application.use_cases.media_assets import ListMediaAssetsQuery, ListMediaAssetsUseCase
from app.core.dependencies import get_list_media_assets_use_case
from app.domain.shared.enums import MediaAssetType
from app.presentation.schemas.media_assets import MediaAssetItemResponse, MediaAssetListResponse

router = APIRouter(prefix="/media-assets", tags=["media-assets"])


@router.get("", response_model=MediaAssetListResponse)
def list_media_assets(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    asset_type: MediaAssetType | None = Query(default=None),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    use_case: ListMediaAssetsUseCase = Depends(get_list_media_assets_use_case),
) -> MediaAssetListResponse:
    result = use_case.execute(
        ListMediaAssetsQuery(
            page=page,
            page_size=page_size,
            asset_type=asset_type,
            created_from=from_at,
            created_to=to_at,
        )
    )
    return MediaAssetListResponse(
        items=[MediaAssetItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )
