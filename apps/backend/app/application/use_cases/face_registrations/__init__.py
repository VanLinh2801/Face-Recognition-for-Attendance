"""Face registration use cases."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.face_registration_repository import FaceRegistrationRepository
from app.application.interfaces.repositories.media_asset_repository import MediaAssetRepository
from app.application.interfaces.repositories.person_repository import PersonRepository
from app.core.exceptions import NotFoundError
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import RegistrationStatus


@dataclass(slots=True, kw_only=True)
class CreateRegistrationCommand:
    person_id: UUID
    requested_by_person_id: UUID
    source_media_asset: dict
    notes: str | None = None


@dataclass(slots=True, kw_only=True)
class ListRegistrationsQuery:
    person_id: UUID
    page: int = 1
    page_size: int = 20


@dataclass(slots=True, kw_only=True)
class RegistrationCompletedCommand:
    registration_id: UUID
    status: RegistrationStatus
    validation_notes: str | None = None
    embedding_model: str | None = None
    embedding_version: str | None = None
    face_image_media_asset: dict | None = None


class CreateFaceRegistrationUseCase:
    def __init__(
        self,
        person_repository: PersonRepository,
        registration_repository: FaceRegistrationRepository,
        media_asset_repository: MediaAssetRepository,
    ) -> None:
        self._person_repository = person_repository
        self._registration_repository = registration_repository
        self._media_asset_repository = media_asset_repository

    def execute(self, command: CreateRegistrationCommand) -> tuple[PersonFaceRegistration, dict]:
        person = self._person_repository.get_person(command.person_id)
        if person is None:
            raise NotFoundError("Person not found")

        source_media = self._media_asset_repository.create_media_asset(
            storage_provider=command.source_media_asset["storage_provider"],
            bucket_name=command.source_media_asset["bucket_name"],
            object_key=command.source_media_asset["object_key"],
            original_filename=command.source_media_asset["original_filename"],
            mime_type=command.source_media_asset["mime_type"],
            file_size=command.source_media_asset["file_size"],
            checksum=command.source_media_asset.get("checksum"),
            asset_type=command.source_media_asset["asset_type"],
            uploaded_by_person_id=command.requested_by_person_id,
        )

        registration = self._registration_repository.create_registration(
            person_id=command.person_id,
            source_media_asset_id=source_media.id,
            validation_notes=command.notes,
        )

        return registration, {
            "media_asset_id": str(source_media.id),
            "storage_provider": source_media.storage_provider.value,
            "bucket_name": source_media.bucket_name,
            "object_key": source_media.object_key,
            "original_filename": source_media.original_filename,
            "mime_type": source_media.mime_type,
            "file_size": source_media.file_size,
            "checksum": source_media.checksum,
            "asset_type": source_media.asset_type.value,
        }


class ListFaceRegistrationsUseCase:
    def __init__(self, repository: FaceRegistrationRepository) -> None:
        self._repository = repository

    def execute(self, query: ListRegistrationsQuery) -> PageResult[PersonFaceRegistration]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_registrations_by_person(
            query.person_id,
            page=page_query.page,
            page_size=page_query.page_size,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


class GetFaceRegistrationUseCase:
    def __init__(self, repository: FaceRegistrationRepository) -> None:
        self._repository = repository

    def execute(self, registration_id: UUID) -> PersonFaceRegistration:
        registration = self._repository.get_registration(registration_id)
        if registration is None:
            raise NotFoundError("Registration not found")
        return registration


class DeleteFaceRegistrationUseCase:
    def __init__(self, repository: FaceRegistrationRepository) -> None:
        self._repository = repository

    def execute(self, registration_id: UUID) -> None:
        if not self._repository.deactivate_registration(registration_id):
            raise NotFoundError("Registration not found")


class CompleteFaceRegistrationUseCase:
    def __init__(
        self,
        registration_repository: FaceRegistrationRepository,
        media_asset_repository: MediaAssetRepository,
    ) -> None:
        self._registration_repository = registration_repository
        self._media_asset_repository = media_asset_repository

    def execute(self, command: RegistrationCompletedCommand) -> PersonFaceRegistration:
        face_media_asset_id: UUID | None = None
        media_ref = command.face_image_media_asset
        if media_ref is not None:
            created_asset = self._media_asset_repository.create_media_asset(
                storage_provider=media_ref["storage_provider"],
                bucket_name=media_ref["bucket_name"],
                object_key=media_ref["object_key"],
                original_filename=media_ref["original_filename"],
                mime_type=media_ref["mime_type"],
                file_size=media_ref["file_size"],
                checksum=media_ref.get("checksum"),
                asset_type=media_ref["asset_type"],
            )
            face_media_asset_id = created_asset.id

        registration = self._registration_repository.update_registration_processing_result(
            command.registration_id,
            status=command.status,
            validation_notes=command.validation_notes,
            embedding_model=command.embedding_model,
            embedding_version=command.embedding_version,
            face_image_media_asset_id=face_media_asset_id,
        )
        if registration is None:
            raise NotFoundError("Registration not found")
        return registration
