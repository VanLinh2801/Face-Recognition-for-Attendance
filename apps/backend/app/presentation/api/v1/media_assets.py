"""Media asset API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends, File, Form, Query, UploadFile

from app.application.use_cases.media_assets import (
    CleanupMediaAssetsCommand,
    CleanupMediaAssetsUseCase,
    GetMediaAssetPresignedUrlQuery,
    GetMediaAssetPresignedUrlUseCase,
    ListMediaAssetsQuery,
    ListMediaAssetsUseCase,
    UploadMediaAssetCommand,
    UploadMediaAssetUseCase,
)
from app.core.dependencies import (
    get_admin_user,
    get_cleanup_media_assets_use_case,
    get_list_media_assets_use_case,
    get_media_asset_presigned_url_use_case,
    get_upload_media_asset_use_case,
    get_unit_of_work,
)
from app.domain.shared.enums import MediaAssetType
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.presentation.schemas.media_assets import (
    CleanupMediaAssetsRequest,
    CleanupMediaAssetsResponse,
    MediaAssetItemResponse,
    MediaAssetListResponse,
    MediaAssetPresignedUrlResponse,
)

router = APIRouter(prefix="/media-assets", tags=["media-assets"], dependencies=[Depends(get_admin_user)])
internal_router = APIRouter(
    prefix="/internal/media-assets",
    tags=["internal-media-assets"],
    dependencies=[Depends(get_admin_user)],
)


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


@router.get("/{asset_id}/presigned-url", response_model=MediaAssetPresignedUrlResponse)
def get_media_asset_presigned_url(
    asset_id: UUID,
    expires_in: int = Query(default=3600, ge=1, le=86400),
    use_case: GetMediaAssetPresignedUrlUseCase = Depends(get_media_asset_presigned_url_use_case),
) -> MediaAssetPresignedUrlResponse:
    result = use_case.execute(GetMediaAssetPresignedUrlQuery(asset_id=asset_id, expires_in=expires_in))
    return MediaAssetPresignedUrlResponse(asset_id=result.asset_id, url=result.url, expires_in=result.expires_in)


@router.post("/upload", response_model=MediaAssetItemResponse)
async def upload_media_asset(
    file: UploadFile = File(...),
    asset_type: MediaAssetType = Form(default=MediaAssetType.REGISTRATION_FACE),
    uploaded_by_person_id: UUID | None = Form(default=None),
    use_case: UploadMediaAssetUseCase = Depends(get_upload_media_asset_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> MediaAssetItemResponse:
    file_size = _get_upload_file_size(file)
    media_asset = use_case.execute(
        UploadMediaAssetCommand(
            file_data=file.file,
            filename=file.filename or "upload",
            mime_type=file.content_type or "application/octet-stream",
            file_size=file_size,
            asset_type=asset_type,
            uploaded_by_person_id=uploaded_by_person_id,
        )
    )
    uow.commit()
    return MediaAssetItemResponse.model_validate(media_asset, from_attributes=True)


@internal_router.post("/cleanup", response_model=CleanupMediaAssetsResponse)
def cleanup_media_assets(
    request: CleanupMediaAssetsRequest,
    use_case: CleanupMediaAssetsUseCase = Depends(get_cleanup_media_assets_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> CleanupMediaAssetsResponse:
    result = use_case.execute(CleanupMediaAssetsCommand(max_batch_size=request.max_batch_size))
    uow.commit()
    return CleanupMediaAssetsResponse(
        deleted_total=result.deleted_total,
        deleted_by_asset_type=result.deleted_by_asset_type,
    )


def _get_upload_file_size(file: UploadFile) -> int:
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    return size
