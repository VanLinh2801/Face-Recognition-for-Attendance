"""Read repository implementations for frontend-facing queries."""

from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.face_registration_repository import FaceRegistrationRepository
from app.application.interfaces.repositories.media_asset_repository import MediaAssetRepository
from app.application.interfaces.repositories.person_repository import PersonRepository
from app.application.interfaces.repositories.recognition_event_repository import RecognitionEventRepository
from app.application.interfaces.repositories.spoof_alert_event_repository import SpoofAlertEventRepository
from app.application.interfaces.repositories.unknown_event_repository import UnknownEventRepository
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.media_assets.entities import MediaAsset
from app.domain.persons.entities import Person
from app.domain.recognition_events.entities import RecognitionEvent
from app.domain.shared.enums import (
    MediaAssetType,
    PersonStatus,
    RegistrationStatus,
    StorageProvider,
    SpoofReviewStatus,
    UnknownEventReviewStatus,
)
from app.domain.spoof_alert_events.entities import SpoofAlertEvent
from app.domain.unknown_events.entities import UnknownEvent
from app.infrastructure.persistence.models.face_registration_model import FaceRegistrationModel
from app.infrastructure.persistence.models.media_asset_model import MediaAssetModel
from app.infrastructure.persistence.models.person_model import PersonModel
from app.infrastructure.persistence.models.recognition_event_model import RecognitionEventModel
from app.infrastructure.persistence.models.spoof_alert_event_model import SpoofAlertEventModel
from app.infrastructure.persistence.models.unknown_event_model import UnknownEventModel


def _to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _to_person(model: PersonModel) -> Person:
    return Person(
        id=model.id,
        employee_code=model.employee_code,
        full_name=model.full_name,
        department_id=model.department_id,
        title=model.title,
        email=model.email,
        phone=model.phone,
        status=model.status,
        joined_at=model.joined_at,
        notes=model.notes,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _to_registration(model: FaceRegistrationModel) -> PersonFaceRegistration:
    return PersonFaceRegistration(
        id=model.id,
        person_id=model.person_id,
        source_media_asset_id=model.source_media_asset_id,
        face_image_media_asset_id=model.face_image_media_asset_id,
        registration_status=model.registration_status,
        validation_notes=model.validation_notes,
        embedding_model=model.embedding_model,
        embedding_version=model.embedding_version,
        is_active=model.is_active,
        indexed_at=model.indexed_at,
        created_at=model.created_at,
        updated_at=model.updated_at,
    )


def _to_media_asset(model: MediaAssetModel) -> MediaAsset:
    return MediaAsset(
        id=model.id,
        storage_provider=model.storage_provider,
        bucket_name=model.bucket_name,
        object_key=model.object_key,
        original_filename=model.original_filename,
        mime_type=model.mime_type,
        file_size=model.file_size,
        checksum=model.checksum,
        asset_type=model.asset_type,
        uploaded_by_person_id=model.uploaded_by_person_id,
        created_at=model.created_at,
    )


class SqlAlchemyPersonRepository(PersonRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_persons(
        self,
        *,
        page: int,
        page_size: int,
        status: PersonStatus | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[Person], int]:
        stmt = select(PersonModel)
        count_stmt = select(func.count()).select_from(PersonModel)

        if status is None:
            stmt = stmt.where(PersonModel.status != PersonStatus.INACTIVE)
            count_stmt = count_stmt.where(PersonModel.status != PersonStatus.INACTIVE)
        else:
            stmt = stmt.where(PersonModel.status == status)
            count_stmt = count_stmt.where(PersonModel.status == status)
        if created_from is not None:
            stmt = stmt.where(PersonModel.created_at >= created_from)
            count_stmt = count_stmt.where(PersonModel.created_at >= created_from)
        if created_to is not None:
            stmt = stmt.where(PersonModel.created_at <= created_to)
            count_stmt = count_stmt.where(PersonModel.created_at <= created_to)

        stmt = stmt.order_by(PersonModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return ([_to_person(item) for item in items], total)

    def get_person(self, person_id: UUID) -> Person | None:
        item = self._session.get(PersonModel, person_id)
        if item is None:
            return None
        return _to_person(item)

    def get_person_by_employee_code(self, employee_code: str) -> Person | None:
        stmt = select(PersonModel).where(PersonModel.employee_code == employee_code)
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return None
        return _to_person(item)

    def create_person(
        self,
        *,
        employee_code: str,
        full_name: str,
        department_id: UUID | None,
        title: str | None,
        email: str | None,
        phone: str | None,
        joined_at: date | None,
        notes: str | None,
    ) -> Person:
        now = datetime.now(timezone.utc)
        item = PersonModel(
            employee_code=employee_code,
            full_name=full_name,
            department_id=department_id,
            title=title,
            email=email,
            phone=phone,
            status=PersonStatus.ACTIVE,
            joined_at=joined_at,
            notes=notes,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return _to_person(item)

    def update_person(
        self,
        person_id: UUID,
        *,
        full_name: str | None = None,
        department_id: UUID | None = None,
        title: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        status: PersonStatus | None = None,
        joined_at: date | None = None,
        notes: str | None = None,
    ) -> Person | None:
        item = self._session.get(PersonModel, person_id)
        if item is None:
            return None

        if full_name is not None:
            item.full_name = full_name
        if title is not None:
            item.title = title
        if email is not None:
            item.email = email
        if phone is not None:
            item.phone = phone
        if status is not None:
            item.status = status
        if joined_at is not None:
            item.joined_at = joined_at
        if notes is not None:
            item.notes = notes
        if department_id is not None:
            item.department_id = department_id
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return _to_person(item)

    def soft_delete_person(self, person_id: UUID) -> bool:
        item = self._session.get(PersonModel, person_id)
        if item is None:
            return False
        item.status = PersonStatus.INACTIVE
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return True

    def bulk_soft_delete_persons(self, person_ids: list[UUID]) -> int:
        if not person_ids:
            return 0
        stmt = select(PersonModel).where(PersonModel.id.in_(person_ids))
        items = self._session.execute(stmt).scalars().all()
        now = datetime.now(timezone.utc)
        for item in items:
            item.status = PersonStatus.INACTIVE
            item.updated_at = now
        self._session.flush()
        return len(items)


class SqlAlchemyRecognitionEventRepository(RecognitionEventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_recognition_events(
        self,
        *,
        page: int,
        page_size: int,
        recognized_from: datetime | None = None,
        recognized_to: datetime | None = None,
    ) -> tuple[list[RecognitionEvent], int]:
        stmt = select(RecognitionEventModel)
        count_stmt = select(func.count()).select_from(RecognitionEventModel)

        if recognized_from is not None:
            stmt = stmt.where(RecognitionEventModel.recognized_at >= recognized_from)
            count_stmt = count_stmt.where(RecognitionEventModel.recognized_at >= recognized_from)
        if recognized_to is not None:
            stmt = stmt.where(RecognitionEventModel.recognized_at <= recognized_to)
            count_stmt = count_stmt.where(RecognitionEventModel.recognized_at <= recognized_to)

        stmt = stmt.order_by(RecognitionEventModel.recognized_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return (
            [
                RecognitionEvent(
                    id=item.id,
                    person_id=item.person_id,
                    face_registration_id=item.face_registration_id,
                    snapshot_media_asset_id=item.snapshot_media_asset_id,
                    recognized_at=item.recognized_at,
                    event_direction=item.event_direction,
                    match_score=_to_float(item.match_score),
                    spoof_score=_to_float(item.spoof_score),
                    event_source=item.event_source,
                    raw_payload=item.raw_payload,
                    is_valid=item.is_valid,
                    invalid_reason=item.invalid_reason,
                    created_at=item.created_at,
                )
                for item in items
            ],
            total,
        )


class SqlAlchemyUnknownEventRepository(UnknownEventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_unknown_events(
        self,
        *,
        page: int,
        page_size: int,
        detected_from: datetime | None = None,
        detected_to: datetime | None = None,
        review_status: UnknownEventReviewStatus | None = None,
    ) -> tuple[list[UnknownEvent], int]:
        stmt = select(UnknownEventModel)
        count_stmt = select(func.count()).select_from(UnknownEventModel)

        if detected_from is not None:
            stmt = stmt.where(UnknownEventModel.detected_at >= detected_from)
            count_stmt = count_stmt.where(UnknownEventModel.detected_at >= detected_from)
        if detected_to is not None:
            stmt = stmt.where(UnknownEventModel.detected_at <= detected_to)
            count_stmt = count_stmt.where(UnknownEventModel.detected_at <= detected_to)
        if review_status is not None:
            stmt = stmt.where(UnknownEventModel.review_status == review_status)
            count_stmt = count_stmt.where(UnknownEventModel.review_status == review_status)

        stmt = stmt.order_by(UnknownEventModel.detected_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return (
            [
                UnknownEvent(
                    id=item.id,
                    snapshot_media_asset_id=item.snapshot_media_asset_id,
                    detected_at=item.detected_at,
                    event_direction=item.event_direction,
                    match_score=_to_float(item.match_score),
                    spoof_score=_to_float(item.spoof_score),
                    event_source=item.event_source,
                    raw_payload=item.raw_payload,
                    review_status=item.review_status,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in items
            ],
            total,
        )


class SqlAlchemySpoofAlertEventRepository(SpoofAlertEventRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_spoof_alert_events(
        self,
        *,
        page: int,
        page_size: int,
        detected_from: datetime | None = None,
        detected_to: datetime | None = None,
        review_status: SpoofReviewStatus | None = None,
    ) -> tuple[list[SpoofAlertEvent], int]:
        stmt = select(SpoofAlertEventModel)
        count_stmt = select(func.count()).select_from(SpoofAlertEventModel)

        if detected_from is not None:
            stmt = stmt.where(SpoofAlertEventModel.detected_at >= detected_from)
            count_stmt = count_stmt.where(SpoofAlertEventModel.detected_at >= detected_from)
        if detected_to is not None:
            stmt = stmt.where(SpoofAlertEventModel.detected_at <= detected_to)
            count_stmt = count_stmt.where(SpoofAlertEventModel.detected_at <= detected_to)
        if review_status is not None:
            stmt = stmt.where(SpoofAlertEventModel.review_status == review_status)
            count_stmt = count_stmt.where(SpoofAlertEventModel.review_status == review_status)

        stmt = stmt.order_by(SpoofAlertEventModel.detected_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return (
            [
                SpoofAlertEvent(
                    id=item.id,
                    person_id=item.person_id,
                    snapshot_media_asset_id=item.snapshot_media_asset_id,
                    detected_at=item.detected_at,
                    spoof_score=float(item.spoof_score),
                    event_source=item.event_source,
                    raw_payload=item.raw_payload,
                    severity=item.severity,
                    review_status=item.review_status,
                    notes=item.notes,
                    created_at=item.created_at,
                    updated_at=item.updated_at,
                )
                for item in items
            ],
            total,
        )


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

        return ([_to_media_asset(item) for item in items], total)

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
        return _to_media_asset(item)

    def get_media_asset(self, media_asset_id: UUID) -> MediaAsset | None:
        item = self._session.get(MediaAssetModel, media_asset_id)
        if item is None:
            return None
        return _to_media_asset(item)


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
        return _to_registration(item)

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
        return ([_to_registration(item) for item in items], total)

    def get_registration(self, registration_id: UUID) -> PersonFaceRegistration | None:
        item = self._session.get(FaceRegistrationModel, registration_id)
        if item is None:
            return None
        return _to_registration(item)

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
        return _to_registration(item)
