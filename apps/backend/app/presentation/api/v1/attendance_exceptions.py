"""Attendance exception API endpoints."""

from __future__ import annotations

from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status

from app.application.use_cases.attendance_exceptions import (
    BulkDeleteAttendanceExceptionsUseCase,
    CreateAttendanceExceptionCommand,
    CreateAttendanceExceptionUseCase,
    DeleteAttendanceExceptionUseCase,
    GetAttendanceExceptionUseCase,
    ListAttendanceExceptionsQuery,
    ListAttendanceExceptionsUseCase,
    UpdateAttendanceExceptionCommand,
    UpdateAttendanceExceptionUseCase,
)
from app.core.dependencies import (
    get_bulk_delete_attendance_exceptions_use_case,
    get_create_attendance_exception_use_case,
    get_delete_attendance_exception_use_case,
    get_get_attendance_exception_use_case,
    get_list_attendance_exceptions_use_case,
    get_unit_of_work,
    get_update_attendance_exception_use_case,
)
from app.domain.shared.enums import AttendanceExceptionType
from app.infrastructure.persistence.unit_of_work import SqlAlchemyUnitOfWork
from app.presentation.schemas.attendance_exceptions import (
    AttendanceExceptionItemResponse,
    AttendanceExceptionListResponse,
    BulkDeleteAttendanceExceptionsRequest,
    BulkDeleteAttendanceExceptionsResponse,
    CreateAttendanceExceptionRequest,
    UpdateAttendanceExceptionRequest,
)

router = APIRouter(prefix="/attendance-exceptions", tags=["attendance-exceptions"])


@router.post("", response_model=AttendanceExceptionItemResponse, status_code=status.HTTP_201_CREATED)
def create_attendance_exception(
    request: CreateAttendanceExceptionRequest,
    use_case: CreateAttendanceExceptionUseCase = Depends(get_create_attendance_exception_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> AttendanceExceptionItemResponse:
    item = use_case.execute(
        CreateAttendanceExceptionCommand(
            person_id=request.person_id,
            exception_type=request.exception_type,
            start_at=request.start_at,
            end_at=request.end_at,
            work_date=request.work_date,
            reason=request.reason,
            notes=request.notes,
            created_by_person_id=request.created_by_person_id,
        )
    )
    uow.commit()
    return AttendanceExceptionItemResponse.model_validate(item, from_attributes=True)


@router.get("", response_model=AttendanceExceptionListResponse)
def list_attendance_exceptions(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    person_id: UUID | None = Query(default=None),
    exception_type: AttendanceExceptionType | None = Query(default=None),
    work_date_from: date | None = Query(default=None),
    work_date_to: date | None = Query(default=None),
    use_case: ListAttendanceExceptionsUseCase = Depends(get_list_attendance_exceptions_use_case),
) -> AttendanceExceptionListResponse:
    result = use_case.execute(
        ListAttendanceExceptionsQuery(
            page=page,
            page_size=page_size,
            person_id=person_id,
            exception_type=exception_type,
            work_date_from=work_date_from,
            work_date_to=work_date_to,
        )
    )
    return AttendanceExceptionListResponse(
        items=[AttendanceExceptionItemResponse.model_validate(item, from_attributes=True) for item in result.items],
        total=result.total,
        page=result.page,
        page_size=result.page_size,
    )


@router.get("/{exception_id}", response_model=AttendanceExceptionItemResponse)
def get_attendance_exception(
    exception_id: UUID,
    use_case: GetAttendanceExceptionUseCase = Depends(get_get_attendance_exception_use_case),
) -> AttendanceExceptionItemResponse:
    return AttendanceExceptionItemResponse.model_validate(use_case.execute(exception_id), from_attributes=True)


@router.patch("/{exception_id}", response_model=AttendanceExceptionItemResponse)
def update_attendance_exception(
    exception_id: UUID,
    request: UpdateAttendanceExceptionRequest,
    use_case: UpdateAttendanceExceptionUseCase = Depends(get_update_attendance_exception_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> AttendanceExceptionItemResponse:
    item = use_case.execute(
        UpdateAttendanceExceptionCommand(
            exception_id=exception_id,
            exception_type=request.exception_type,
            start_at=request.start_at,
            end_at=request.end_at,
            work_date=request.work_date,
            reason=request.reason,
            notes=request.notes,
        )
    )
    uow.commit()
    return AttendanceExceptionItemResponse.model_validate(item, from_attributes=True)


@router.delete("/{exception_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance_exception(
    exception_id: UUID,
    deleted_by_person_id: UUID | None = Query(default=None),
    use_case: DeleteAttendanceExceptionUseCase = Depends(get_delete_attendance_exception_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> Response:
    use_case.execute(exception_id, deleted_by_person_id=deleted_by_person_id)
    uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/bulk-delete", response_model=BulkDeleteAttendanceExceptionsResponse)
def bulk_delete_attendance_exceptions(
    request: BulkDeleteAttendanceExceptionsRequest,
    use_case: BulkDeleteAttendanceExceptionsUseCase = Depends(get_bulk_delete_attendance_exceptions_use_case),
    uow: SqlAlchemyUnitOfWork = Depends(get_unit_of_work),
) -> BulkDeleteAttendanceExceptionsResponse:
    deleted_count = use_case.execute(
        request.exception_ids,
        deleted_by_person_id=request.deleted_by_person_id,
    )
    uow.commit()
    return BulkDeleteAttendanceExceptionsResponse(deleted_count=deleted_count)
