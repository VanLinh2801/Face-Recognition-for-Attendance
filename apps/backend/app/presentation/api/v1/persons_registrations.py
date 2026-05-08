"""Person registration API endpoints."""

from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256
import re
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status

from app.application.interfaces.storage_gateway import ObjectStorageGateway
from app.application.use_cases.face_registrations import (
    CompleteFaceRegistrationUseCase,
    CreateFaceRegistrationUseCase,
    CreateRegistrationCommand,
    DeleteFaceRegistrationUseCase,
    GetFaceRegistrationUseCase,
    ListFaceRegistrationsUseCase,
    ListRegistrationsQuery,
    RegistrationCompletedCommand,
)
from app.core.dependencies import (
    get_admin_user,
    get_complete_face_registration_use_case,
    get_create_face_registration_use_case,
    get_delete_face_registration_use_case,
    get_get_face_registration_use_case,
    get_object_storage_gateway,
    get_realtime_event_bus,
    get_list_face_registrations_use_case,
    get_pipeline_event_publisher,
    get_unit_of_work,
)
from app.core.config import Settings
from app.core.dependencies import get_container
from app.domain.shared.enums import RegistrationStatus
from app.bootstrap.container import Container
from app.infrastructure.integrations.pipeline_client import PipelineEventPublisher
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.application.dtos.realtime import RealtimeChannel, RealtimeEnvelope
from app.application.interfaces.realtime_event_bus import RealtimeEventBus
from app.presentation.schemas.persons import (
    CreatePersonRegistrationRequest,
    CreatePersonRegistrationResponse,
    PersonRegistrationItemResponse,
    PersonRegistrationListResponse,
    RegistrationEventCompletedRequest,
)

router = APIRouter(prefix="/persons", tags=["persons-registrations"], dependencies=[Depends(get_admin_user)])
internal_router = APIRouter(
    prefix="/internal/registrations/events",
    tags=["internal-registrations"],
    dependencies=[Depends(get_admin_user)],
)

ALLOWED_REGISTRATION_IMAGE_TYPES = {"image/jpeg", "image/png"}


def _safe_filename(filename: str | None) -> str:
    cleaned = re.sub(r"[^\w.\-]+", "_", filename or "face.jpg").strip("._")
    return cleaned or "face.jpg"


def _build_registration_object_key(*, person_id: UUID, filename: str) -> str:
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    return f"registrations/raw/{person_id}/{timestamp}-{uuid4().hex}-{_safe_filename(filename)}"


async def _create_registration_and_publish(
    *,
    person_id: UUID,
    requested_by_person_id: UUID,
    source_media_asset: dict,
    notes: str | None,
    use_case: CreateFaceRegistrationUseCase,
    publisher: PipelineEventPublisher,
    uow: SqlAlchemyUnitOfWork,
) -> CreatePersonRegistrationResponse:
    registration, source_media_asset_ref = use_case.execute(
        CreateRegistrationCommand(
            person_id=person_id,
            requested_by_person_id=requested_by_person_id,
            source_media_asset=source_media_asset,
            notes=notes,
        )
    )
    uow.commit()

    publish_result = await publisher.publish_registration_requested(
        person_id=registration.person_id,
        registration_id=registration.id,
        requested_by_person_id=requested_by_person_id,
        source_media_asset=source_media_asset_ref,
        notes=notes,
    )
    await publisher.close()
    return CreatePersonRegistrationResponse(
        registration=PersonRegistrationItemResponse.model_validate(registration, from_attributes=True),
        stream_id=publish_result["stream_id"],
        message_id=publish_result["message_id"],
        correlation_id=publish_result["correlation_id"],
    )


@router.post("/{person_id}/registrations", response_model=CreatePersonRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def create_person_registration(
    person_id: UUID,
    request: CreatePersonRegistrationRequest,
    use_case: CreateFaceRegistrationUseCase = Depends(get_create_face_registration_use_case),
    publisher: PipelineEventPublisher = Depends(get_pipeline_event_publisher),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> CreatePersonRegistrationResponse:
    return await _create_registration_and_publish(
        person_id=person_id,
        requested_by_person_id=request.requested_by_person_id,
        source_media_asset=request.source_media_asset.model_dump(),
        notes=request.notes,
        use_case=use_case,
        publisher=publisher,
        uow=uow,
    )


@router.post(
    "/{person_id}/registrations/upload",
    response_model=CreatePersonRegistrationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_person_registration_image(
    person_id: UUID,
    file: UploadFile = File(...),
    requested_by_person_id: UUID = Form(...),
    notes: str | None = Form(default=None),
    bucket_name: str | None = Form(default=None),
    use_case: CreateFaceRegistrationUseCase = Depends(get_create_face_registration_use_case),
    publisher: PipelineEventPublisher = Depends(get_pipeline_event_publisher),
    storage_gateway: ObjectStorageGateway = Depends(get_object_storage_gateway),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
    container: Container = Depends(get_container),
) -> CreatePersonRegistrationResponse:
    settings: Settings = container.settings
    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_REGISTRATION_IMAGE_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported image type: {content_type}",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Registration image is empty")
    if len(content) > settings.registration_upload_max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Registration image is too large",
        )

    target_bucket = (bucket_name or settings.minio_bucket).strip()
    if not target_bucket:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Bucket name is required")

    object_key = _build_registration_object_key(person_id=person_id, filename=file.filename or "face.jpg")
    storage_gateway.upload_bytes(
        bucket_name=target_bucket,
        object_key=object_key,
        content=content,
        content_type=content_type,
    )

    source_media_asset = {
        "storage_provider": "minio",
        "bucket_name": target_bucket,
        "object_key": object_key,
        "original_filename": file.filename or "face.jpg",
        "mime_type": content_type,
        "file_size": len(content),
        "checksum": sha256(content).hexdigest(),
        "asset_type": "registration_face",
    }
    return await _create_registration_and_publish(
        person_id=person_id,
        requested_by_person_id=requested_by_person_id,
        source_media_asset=source_media_asset,
        notes=notes,
        use_case=use_case,
        publisher=publisher,
        uow=uow,
    )


@router.get("/{person_id}/registrations", response_model=PersonRegistrationListResponse)
def list_person_registrations(
    person_id: UUID,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    use_case: ListFaceRegistrationsUseCase = Depends(get_list_face_registrations_use_case),
) -> PersonRegistrationListResponse:
    result = use_case.execute(ListRegistrationsQuery(person_id=person_id, page=page, page_size=page_size))
    return PersonRegistrationListResponse(
        items=[PersonRegistrationItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.get("/{person_id}/registrations/{registration_id}", response_model=PersonRegistrationItemResponse)
def get_person_registration(
    person_id: UUID,
    registration_id: UUID,
    use_case: GetFaceRegistrationUseCase = Depends(get_get_face_registration_use_case),
) -> PersonRegistrationItemResponse:
    _ = person_id
    registration = use_case.execute(registration_id)
    return PersonRegistrationItemResponse.model_validate(registration, from_attributes=True)


@router.delete("/{person_id}/registrations/{registration_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person_registration(
    person_id: UUID,
    registration_id: UUID,
    use_case: DeleteFaceRegistrationUseCase = Depends(get_delete_face_registration_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> Response:
    _ = person_id
    use_case.execute(registration_id)
    uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@internal_router.post("/completed", response_model=PersonRegistrationItemResponse)
async def registration_processing_completed(
    request: RegistrationEventCompletedRequest,
    use_case: CompleteFaceRegistrationUseCase = Depends(get_complete_face_registration_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
    realtime_event_bus: RealtimeEventBus = Depends(get_realtime_event_bus),
) -> PersonRegistrationItemResponse:
    payload = request.payload
    registration = use_case.execute(
        RegistrationCompletedCommand(
            registration_id=UUID(payload["registration_id"]),
            status=RegistrationStatus(payload["status"]),
            validation_notes=payload.get("validation_notes"),
            embedding_model=payload.get("embedding_model"),
            embedding_version=payload.get("embedding_version"),
            face_image_media_asset=payload.get("face_image_media_asset"),
        )
    )
    uow.commit()

    registration_item = PersonRegistrationItemResponse.model_validate(registration, from_attributes=True)

    # Publish completed event after the DB transaction is committed.
    websocket_payload = registration_item.model_dump(mode="json")
    envelope = RealtimeEnvelope(
        channel=RealtimeChannel.EVENTS_BUSINESS,
        event_type=request.event_name,
        occurred_at=request.occurred_at,
        correlation_id=str(request.correlation_id) if request.correlation_id is not None else None,
        dedupe_key=str(registration.id),
        payload=websocket_payload,
        metadata={"message_id": str(request.message_id), "producer": request.producer, "source": "internal-completed-endpoint"},
    )
    await realtime_event_bus.publish(envelope)

    return registration_item
