"""Person registration API endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

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
    get_complete_face_registration_use_case,
    get_create_face_registration_use_case,
    get_delete_face_registration_use_case,
    get_get_face_registration_use_case,
    get_list_face_registrations_use_case,
    get_pipeline_event_publisher,
    get_unit_of_work,
)
from app.domain.shared.enums import RegistrationStatus
from app.infrastructure.integrations.pipeline_client import PipelineEventPublisher
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.presentation.schemas.persons import (
    CreatePersonRegistrationRequest,
    CreatePersonRegistrationResponse,
    PersonRegistrationItemResponse,
    PersonRegistrationListResponse,
    RegistrationEventCompletedRequest,
)

router = APIRouter(prefix="/persons", tags=["persons-registrations"])
internal_router = APIRouter(prefix="/internal/registrations/events", tags=["internal-registrations"])


@router.post("/{person_id}/registrations", response_model=CreatePersonRegistrationResponse, status_code=status.HTTP_201_CREATED)
async def create_person_registration(
    person_id: UUID,
    request: CreatePersonRegistrationRequest,
    use_case: CreateFaceRegistrationUseCase = Depends(get_create_face_registration_use_case),
    publisher: PipelineEventPublisher = Depends(get_pipeline_event_publisher),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> CreatePersonRegistrationResponse:
    registration, source_media_asset = use_case.execute(
        CreateRegistrationCommand(
            person_id=person_id,
            requested_by_person_id=request.requested_by_person_id,
            source_media_asset=request.source_media_asset.model_dump(),
            notes=request.notes,
        )
    )
    uow.commit()

    publish_result = await publisher.publish_registration_requested(
        person_id=registration.person_id,
        registration_id=registration.id,
        requested_by_person_id=request.requested_by_person_id,
        source_media_asset=source_media_asset,
        notes=request.notes,
    )
    await publisher.close()
    return CreatePersonRegistrationResponse(
        registration=PersonRegistrationItemResponse.model_validate(registration, from_attributes=True),
        stream_id=publish_result["stream_id"],
        message_id=publish_result["message_id"],
        correlation_id=publish_result["correlation_id"],
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
def registration_processing_completed(
    request: RegistrationEventCompletedRequest,
    use_case: CompleteFaceRegistrationUseCase = Depends(get_complete_face_registration_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
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
    return PersonRegistrationItemResponse.model_validate(registration, from_attributes=True)
