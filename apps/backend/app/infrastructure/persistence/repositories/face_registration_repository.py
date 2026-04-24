"""SQLAlchemy face registration repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.face_registration_repository import FaceRegistrationRepository
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import RegistrationStatus
from app.infrastructure.persistence.models.face_registration_model import FaceRegistrationModel
from app.infrastructure.persistence.repositories.mappers import to_registration


class SqlAlchemyFaceRegistrationRepository(FaceRegistrationRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_registration(
        self,
        *,
        person_id: UUID,
        source_media_asset_id: UUID,
        validation_notes: str | None = None,
    ) -> PersonFaceRegistration:
        now = datetime.now(timezone.utc)
        item = FaceRegistrationModel(
            person_id=person_id,
            source_media_asset_id=source_media_asset_id,
            face_image_media_asset_id=None,
            registration_status=RegistrationStatus.PENDING,
            validation_notes=validation_notes,
            embedding_model=None,
            embedding_version=None,
            is_active=True,
            indexed_at=None,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return to_registration(item)

    def list_registrations_by_person(
        self,
        person_id: UUID,
        *,
        page: int,
        page_size: int,
    ) -> tuple[list[PersonFaceRegistration], int]:
        stmt = select(FaceRegistrationModel).where(FaceRegistrationModel.person_id == person_id)
        count_stmt = select(func.count()).select_from(FaceRegistrationModel).where(FaceRegistrationModel.person_id == person_id)
        stmt = stmt.order_by(FaceRegistrationModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()
        return ([to_registration(item) for item in items], total)

    def get_registration(self, registration_id: UUID) -> PersonFaceRegistration | None:
        item = self._session.get(FaceRegistrationModel, registration_id)
        if item is None:
            return None
        return to_registration(item)

    def deactivate_registration(self, registration_id: UUID) -> bool:
        item = self._session.get(FaceRegistrationModel, registration_id)
        if item is None:
            return False
        item.is_active = False
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return True

    def update_registration_processing_result(
        self,
        registration_id: UUID,
        *,
        status: RegistrationStatus,
        validation_notes: str | None = None,
        embedding_model: str | None = None,
        embedding_version: str | None = None,
        face_image_media_asset_id: UUID | None = None,
    ) -> PersonFaceRegistration | None:
        item = self._session.get(FaceRegistrationModel, registration_id)
        if item is None:
            return None
        item.registration_status = status
        item.validation_notes = validation_notes
        item.embedding_model = embedding_model
        item.embedding_version = embedding_version
        item.face_image_media_asset_id = face_image_media_asset_id
        item.indexed_at = datetime.now(timezone.utc) if status == RegistrationStatus.INDEXED else item.indexed_at
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return to_registration(item)
