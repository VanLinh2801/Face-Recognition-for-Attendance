"""Mapping helpers between ORM models and domain entities."""

from __future__ import annotations

from decimal import Decimal

from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.media_assets.entities import MediaAsset
from app.domain.persons.entities import Person
from app.infrastructure.persistence.models.face_registration_model import FaceRegistrationModel
from app.infrastructure.persistence.models.media_asset_model import MediaAssetModel
from app.infrastructure.persistence.models.person_model import PersonModel


def to_float(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def to_person(model: PersonModel) -> Person:
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


def to_registration(model: FaceRegistrationModel) -> PersonFaceRegistration:
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


def to_media_asset(model: MediaAssetModel) -> MediaAsset:
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
