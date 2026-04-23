"""Person transport schemas."""

from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.domain.shared.enums import PersonStatus, RegistrationStatus
from app.presentation.schemas.common import PaginatedResponse


class PersonItemResponse(BaseModel):
    id: UUID
    employee_code: str
    full_name: str
    department_id: UUID | None
    title: str | None
    email: str | None
    phone: str | None
    status: PersonStatus
    joined_at: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class PersonListResponse(PaginatedResponse):
    items: list[PersonItemResponse]


class CreatePersonRequest(BaseModel):
    employee_code: str = Field(min_length=1, max_length=50)
    full_name: str = Field(min_length=1, max_length=255)
    department_id: UUID | None = None
    title: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    joined_at: date | None = None
    notes: str | None = None


class UpdatePersonRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    department_id: UUID | None = None
    title: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=50)
    status: PersonStatus | None = None
    joined_at: date | None = None
    notes: str | None = None


class BulkDeletePersonsRequest(BaseModel):
    person_ids: list[UUID] = Field(min_length=1)


class MediaAssetRefPayload(BaseModel):
    storage_provider: str = "minio"
    bucket_name: str
    object_key: str
    original_filename: str
    mime_type: str
    file_size: int = Field(ge=0)
    checksum: str | None = None
    asset_type: str = "registration_face"


class CreatePersonRegistrationRequest(BaseModel):
    requested_by_person_id: UUID
    source_media_asset: MediaAssetRefPayload
    notes: str | None = None


class PersonRegistrationItemResponse(BaseModel):
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

    model_config = ConfigDict(from_attributes=True)


class PersonRegistrationListResponse(PaginatedResponse):
    items: list[PersonRegistrationItemResponse]


class CreatePersonRegistrationResponse(BaseModel):
    registration: PersonRegistrationItemResponse
    stream_id: str
    message_id: str
    correlation_id: str


class BulkDeletePersonsResponse(BaseModel):
    deleted_count: int


class RegistrationEventCompletedRequest(BaseModel):
    message_id: UUID
    correlation_id: UUID
    event_name: str = "registration_processing.completed"
    event_version: str = "1.0.0"
    producer: str = "ai_service"
    occurred_at: datetime
    payload: dict
