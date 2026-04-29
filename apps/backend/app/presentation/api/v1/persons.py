"""Persons API endpoints."""

from datetime import datetime
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends, Query, Response, status

from app.application.use_cases.persons import (
    BulkDeletePersonsUseCase,
    CreatePersonCommand,
    CreatePersonUseCase,
    DeletePersonUseCase,
    GetPersonUseCase,
    ListPersonsQuery,
    ListPersonsUseCase,
    UpdatePersonCommand,
    UpdatePersonUseCase,
)
from app.core.dependencies import (
    get_admin_user,
    get_bulk_delete_persons_use_case,
    get_create_person_use_case,
    get_delete_person_use_case,
    get_get_person_use_case,
    get_list_persons_use_case,
    get_unit_of_work,
    get_update_person_use_case,
)
from app.domain.shared.enums import PersonStatus
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.presentation.schemas.persons import (
    BulkDeletePersonsRequest,
    BulkDeletePersonsResponse,
    CreatePersonRequest,
    PersonItemResponse,
    PersonListResponse,
    UpdatePersonRequest,
)

router = APIRouter(prefix="/persons", tags=["persons"], dependencies=[Depends(get_admin_user)])


@router.get("", response_model=PersonListResponse)
def list_persons(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: PersonStatus | None = Query(default=None),
    from_at: datetime | None = Query(default=None),
    to_at: datetime | None = Query(default=None),
    use_case: ListPersonsUseCase = Depends(get_list_persons_use_case),
) -> PersonListResponse:
    result = use_case.execute(
        ListPersonsQuery(
            page=page,
            page_size=page_size,
            status=status,
            created_from=from_at,
            created_to=to_at,
        )
    )
    return PersonListResponse(
        items=[PersonItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.post("", response_model=PersonItemResponse, status_code=status.HTTP_201_CREATED)
def create_person(
    request: CreatePersonRequest,
    use_case: CreatePersonUseCase = Depends(get_create_person_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> PersonItemResponse:
    person = use_case.execute(
        CreatePersonCommand(
            employee_code=request.employee_code,
            full_name=request.full_name,
            department_id=request.department_id,
            title=request.title,
            email=request.email,
            phone=request.phone,
            joined_at=request.joined_at,
            notes=request.notes,
        )
    )
    uow.commit()
    return PersonItemResponse.model_validate(person, from_attributes=True)


@router.get("/{person_id}", response_model=PersonItemResponse)
def get_person(
    person_id: UUID,
    use_case: GetPersonUseCase = Depends(get_get_person_use_case),
) -> PersonItemResponse:
    return PersonItemResponse.model_validate(use_case.execute(person_id), from_attributes=True)


@router.patch("/{person_id}", response_model=PersonItemResponse)
def update_person(
    person_id: UUID,
    request: UpdatePersonRequest,
    use_case: UpdatePersonUseCase = Depends(get_update_person_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> PersonItemResponse:
    person = use_case.execute(
        UpdatePersonCommand(
            person_id=person_id,
            full_name=request.full_name,
            department_id=request.department_id,
            title=request.title,
            email=request.email,
            phone=request.phone,
            status=request.status,
            joined_at=request.joined_at,
            notes=request.notes,
        )
    )
    uow.commit()
    return PersonItemResponse.model_validate(person, from_attributes=True)


@router.delete("/{person_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_person(
    person_id: UUID,
    use_case: DeletePersonUseCase = Depends(get_delete_person_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> Response:
    use_case.execute(person_id)
    uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/bulk-delete", response_model=BulkDeletePersonsResponse)
def bulk_delete_persons(
    request: BulkDeletePersonsRequest,
    use_case: BulkDeletePersonsUseCase = Depends(get_bulk_delete_persons_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> BulkDeletePersonsResponse:
    deleted_count = use_case.execute(request.person_ids)
    uow.commit()
    return BulkDeletePersonsResponse(deleted_count=deleted_count)
