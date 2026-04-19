"""Face registration domain entities."""

from dataclasses import dataclass
from datetime import datetime
from uuid import UUID

from app.domain.shared.enums import RegistrationStatus


@dataclass(slots=True, kw_only=True)
class PersonFaceRegistration:
    id: UUID
    person_id: UUID
    source_media_asset_id: UUID
    face_image_media_asset_id: UUID | None
    registration_status: RegistrationStatus
    validation_notes: str | None
    embedding_model: str | None
    embedding_version: str | None
    is_active: bool
    indexed_at: datetime | None
    created_at: datetime
    updated_at: datetime
