"""Face registration repository abstraction."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol
from uuid import UUID

from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import RegistrationStatus


class FaceRegistrationRepository(Protocol):
    def create_registration(
        self,
        *,
        person_id: UUID,
        source_media_asset_id: UUID,
        validation_notes: str | None = None,
    ) -> PersonFaceRegistration: ...

    def list_registrations_by_person(
        self,
        person_id: UUID,
        *,
        page: int,
        page_size: int,
    ) -> tuple[list[PersonFaceRegistration], int]: ...

    def get_registration(self, registration_id: UUID) -> PersonFaceRegistration | None: ...

    def deactivate_registration(self, registration_id: UUID) -> bool: ...

    def update_registration_processing_result(
        self,
        registration_id: UUID,
        *,
        status: RegistrationStatus,
        validation_notes: str | None = None,
        embedding_model: str | None = None,
        embedding_version: str | None = None,
        face_image_media_asset_id: UUID | None = None,
    ) -> PersonFaceRegistration | None: ...

    def list_registrations_completed_since(
        self,
        *,
        since_timestamp: datetime,
        limit: int,
    ) -> list[PersonFaceRegistration]: ...
