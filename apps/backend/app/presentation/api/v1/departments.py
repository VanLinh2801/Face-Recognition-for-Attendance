"""Departments API endpoints."""

from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.application.use_cases.departments import (
    CreateDepartmentCommand,
    CreateDepartmentUseCase,
    DeleteDepartmentUseCase,
    GetDepartmentUseCase,
    ListDepartmentPersonsQuery,
    ListDepartmentPersonsUseCase,
    ListDepartmentsQuery,
    ListDepartmentsUseCase,
    UpdateDepartmentCommand,
    UpdateDepartmentUseCase,
)
from app.core.dependencies import (
    get_admin_user,
    get_create_department_use_case,
    get_delete_department_use_case,
    get_get_department_use_case,
    get_list_department_persons_use_case,
    get_list_departments_use_case,
    get_update_department_use_case,
    get_unit_of_work,
)
from app.domain.auth.entities import User
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.presentation.schemas.departments import (
    CreateDepartmentRequest,
    DepartmentItemResponse,
    DepartmentListResponse,
    UpdateDepartmentRequest,
)
from app.domain.shared.enums import PersonStatus
from app.presentation.schemas.persons import PersonItemResponse, PersonListResponse

router = APIRouter(prefix="/departments", tags=["departments"])


@router.get("", response_model=DepartmentListResponse)
def list_departments(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_active: bool | None = Query(default=None),
    _admin: User = Depends(get_admin_user),
    use_case: ListDepartmentsUseCase = Depends(get_list_departments_use_case),
) -> DepartmentListResponse:
    result = use_case.execute(ListDepartmentsQuery(page=page, page_size=page_size, is_active=is_active))
    return DepartmentListResponse(
        items=[DepartmentItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.post("", response_model=DepartmentItemResponse, status_code=status.HTTP_201_CREATED)
def create_department(
    request: CreateDepartmentRequest,
    _admin: User = Depends(get_admin_user),
    use_case: CreateDepartmentUseCase = Depends(get_create_department_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> DepartmentItemResponse:
    department = use_case.execute(
        CreateDepartmentCommand(
            code=request.code,
            name=request.name,
            parent_id=request.parent_id,
            is_active=request.is_active,
        )
    )
    uow.commit()
    return DepartmentItemResponse.model_validate(department, from_attributes=True)


@router.get("/{department_id}", response_model=DepartmentItemResponse)
def get_department(
    department_id: UUID,
    _admin: User = Depends(get_admin_user),
    use_case: GetDepartmentUseCase = Depends(get_get_department_use_case),
) -> DepartmentItemResponse:
    return DepartmentItemResponse.model_validate(use_case.execute(department_id), from_attributes=True)


@router.get("/{department_id}/persons", response_model=PersonListResponse)
def list_department_persons(
    department_id: UUID,
    include_descendants: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: PersonStatus | None = Query(default=None),
    _admin: User = Depends(get_admin_user),
    use_case: ListDepartmentPersonsUseCase = Depends(get_list_department_persons_use_case),
) -> PersonListResponse:
    result = use_case.execute(
        ListDepartmentPersonsQuery(
            department_id=department_id,
            include_descendants=include_descendants,
            page=page,
            page_size=page_size,
            status=status,
        )
    )
    return PersonListResponse(
        items=[PersonItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.patch("/{department_id}", response_model=DepartmentItemResponse)
def update_department(
    department_id: UUID,
    request: UpdateDepartmentRequest,
    _admin: User = Depends(get_admin_user),
    use_case: UpdateDepartmentUseCase = Depends(get_update_department_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> DepartmentItemResponse:
    department = use_case.execute(
        UpdateDepartmentCommand(
            department_id=department_id,
            code=request.code,
            name=request.name,
            parent_id=request.parent_id,
            parent_id_provided="parent_id" in request.model_fields_set,
            is_active=request.is_active,
        )
    )
    uow.commit()
    return DepartmentItemResponse.model_validate(department, from_attributes=True)


@router.delete("/{department_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_department(
    department_id: UUID,
    _admin: User = Depends(get_admin_user),
    use_case: DeleteDepartmentUseCase = Depends(get_delete_department_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> Response:
    use_case.execute(department_id)
    uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
