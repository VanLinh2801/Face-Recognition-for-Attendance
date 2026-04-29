"""SQLAlchemy media asset repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.media_asset_repository import MediaAssetRepository
from app.domain.media_assets.entities import MediaAsset
from app.domain.shared.enums import MediaAssetType, StorageProvider
from app.infrastructure.persistence.models.media_asset_model import MediaAssetModel
from app.infrastructure.persistence.repositories.mappers import to_media_asset


class SqlAlchemyMediaAssetRepository(MediaAssetRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_media_assets(
        self,
        *,
        page: int,
        page_size: int,
        asset_type: MediaAssetType | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[MediaAsset], int]:
        stmt = select(MediaAssetModel)
        count_stmt = select(func.count()).select_from(MediaAssetModel)

        if asset_type is not None:
            stmt = stmt.where(MediaAssetModel.asset_type == asset_type)
            count_stmt = count_stmt.where(MediaAssetModel.asset_type == asset_type)
        if created_from is not None:
            stmt = stmt.where(MediaAssetModel.created_at >= created_from)
            count_stmt = count_stmt.where(MediaAssetModel.created_at >= created_from)
        if created_to is not None:
            stmt = stmt.where(MediaAssetModel.created_at <= created_to)
            count_stmt = count_stmt.where(MediaAssetModel.created_at <= created_to)

        stmt = stmt.order_by(MediaAssetModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return ([to_media_asset(item) for item in items], total)

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
    ) -> MediaAsset:
        item = MediaAssetModel(
            storage_provider=StorageProvider(storage_provider),
            bucket_name=bucket_name,
            object_key=object_key,
            original_filename=original_filename,
            mime_type=mime_type,
            file_size=file_size,
            checksum=checksum,
            asset_type=MediaAssetType(asset_type),
            uploaded_by_person_id=uploaded_by_person_id,
            created_at=datetime.now(timezone.utc),
        )
        self._session.add(item)
        self._session.flush()
        return to_media_asset(item)

    def get_media_asset(self, media_asset_id: UUID) -> MediaAsset | None:
        item = self._session.get(MediaAssetModel, media_asset_id)
        if item is None:
            return None
        return to_media_asset(item)

    def list_expired_assets(
        self,
        *,
        asset_type: MediaAssetType,
        older_than: datetime,
        limit: int,
    ) -> list[MediaAsset]:
        stmt = (
            select(MediaAssetModel)
            .where(MediaAssetModel.asset_type == asset_type)
            .where(MediaAssetModel.created_at < older_than)
            .order_by(MediaAssetModel.created_at.asc())
            .limit(limit)
        )
        items = self._session.execute(stmt).scalars().all()
        return [to_media_asset(item) for item in items]

    def delete_media_asset(self, *, media_asset_id: UUID) -> bool:
        item = self._session.get(MediaAssetModel, media_asset_id)
        if item is None:
            return False
        self._session.delete(item)
        self._session.flush()
        return True
