"""Department use cases."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.department_repository import DepartmentRepository
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.departments.entities import Department


@dataclass(slots=True, kw_only=True)
class ListDepartmentsQuery:
    page: int = 1
    page_size: int = 20
    is_active: bool | None = None


@dataclass(slots=True, kw_only=True)
class CreateDepartmentCommand:
    code: str
    name: str
    parent_id: UUID | None
    is_active: bool = True


@dataclass(slots=True, kw_only=True)
class UpdateDepartmentCommand:
    department_id: UUID
    code: str | None = None
    name: str | None = None
    parent_id: UUID | None = None
    is_active: bool | None = None


class ListDepartmentsUseCase:
    def __init__(self, repository: DepartmentRepository) -> None:
        self._repository = repository

    def execute(self, query: ListDepartmentsQuery) -> PageResult[Department]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_departments(
            page=page_query.page,
            page_size=page_query.page_size,
            is_active=query.is_active,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


class CreateDepartmentUseCase:
    def __init__(self, repository: DepartmentRepository) -> None:
        self._repository = repository

    def execute(self, command: CreateDepartmentCommand) -> Department:
        existing = self._repository.get_department_by_code(code=command.code)
        if existing is not None:
            raise ValidationError("department code already exists", details={"code": command.code})
        return self._repository.create_department(
            code=command.code,
            name=command.name,
            parent_id=command.parent_id,
            is_active=command.is_active,
        )


class GetDepartmentUseCase:
    def __init__(self, repository: DepartmentRepository) -> None:
        self._repository = repository

    def execute(self, department_id: UUID) -> Department:
        item = self._repository.get_department(department_id)
        if item is None:
            raise NotFoundError("Department not found")
        return item


class UpdateDepartmentUseCase:
    def __init__(self, repository: DepartmentRepository) -> None:
        self._repository = repository

    def execute(self, command: UpdateDepartmentCommand) -> Department:
        if command.code is not None:
            existing = self._repository.get_department_by_code(code=command.code)
            if existing is not None and existing.id != command.department_id:
                raise ValidationError("department code already exists", details={"code": command.code})

        updated = self._repository.update_department(
            command.department_id,
            code=command.code,
            name=command.name,
            parent_id=command.parent_id,
            is_active=command.is_active,
        )
        if updated is None:
            raise NotFoundError("Department not found")
        return updated


class DeleteDepartmentUseCase:
    def __init__(self, repository: DepartmentRepository) -> None:
        self._repository = repository

    def execute(self, department_id: UUID) -> None:
        ok = self._repository.deactivate_department(department_id)
        if not ok:
            raise NotFoundError("Department not found")
