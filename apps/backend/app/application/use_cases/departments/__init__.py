"""Department use cases."""

from __future__ import annotations

from dataclasses import dataclass
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.department_repository import DepartmentRepository
from app.application.interfaces.repositories.person_repository import PersonRepository
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.departments.entities import Department
from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus


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
    parent_id_provided: bool = False
    is_active: bool | None = None


@dataclass(slots=True, kw_only=True)
class ListDepartmentPersonsQuery:
    department_id: UUID
    include_descendants: bool = True
    page: int = 1
    page_size: int = 20
    status: PersonStatus | None = None


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
        code = _normalize_required_text(command.code, "code")
        name = _normalize_required_text(command.name, "name")
        self._validate_parent(parent_id=command.parent_id)

        existing = self._repository.get_department_by_code(code=code)
        if existing is not None:
            raise ValidationError("department code already exists", details={"code": code})
        return self._repository.create_department(
            code=code,
            name=name,
            parent_id=command.parent_id,
            is_active=command.is_active,
        )

    def _validate_parent(self, *, parent_id: UUID | None) -> None:
        if parent_id is None:
            return
        if self._repository.get_department(parent_id) is None:
            raise ValidationError("parent department not found", details={"parent_id": str(parent_id)})


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
        current = self._repository.get_department(command.department_id)
        if current is None:
            raise NotFoundError("Department not found")

        code = _normalize_optional_text(command.code, "code")
        name = _normalize_optional_text(command.name, "name")
        if code is not None:
            existing = self._repository.get_department_by_code(code=code)
            if existing is not None and existing.id != command.department_id:
                raise ValidationError("department code already exists", details={"code": code})

        if command.parent_id_provided:
            self._validate_parent_change(department_id=command.department_id, parent_id=command.parent_id)

        updated = self._repository.update_department(
            command.department_id,
            code=code,
            name=name,
            parent_id=command.parent_id,
            parent_id_provided=command.parent_id_provided,
            is_active=command.is_active,
        )
        if updated is None:
            raise NotFoundError("Department not found")
        return updated

    def _validate_parent_change(self, *, department_id: UUID, parent_id: UUID | None) -> None:
        if parent_id is None:
            return
        if parent_id == department_id:
            raise ValidationError("department cannot be parent of itself", details={"parent_id": str(parent_id)})
        if self._repository.get_department(parent_id) is None:
            raise ValidationError("parent department not found", details={"parent_id": str(parent_id)})
        descendant_ids = self._repository.list_department_descendant_ids(department_id)
        if parent_id in descendant_ids:
            raise ValidationError("parent department cannot be a descendant", details={"parent_id": str(parent_id)})


class DeleteDepartmentUseCase:
    def __init__(self, repository: DepartmentRepository) -> None:
        self._repository = repository

    def execute(self, department_id: UUID) -> None:
        ok = self._repository.deactivate_department(department_id)
        if not ok:
            raise NotFoundError("Department not found")


class ListDepartmentPersonsUseCase:
    def __init__(self, department_repository: DepartmentRepository, person_repository: PersonRepository) -> None:
        self._department_repository = department_repository
        self._person_repository = person_repository

    def execute(self, query: ListDepartmentPersonsQuery) -> PageResult[Person]:
        if self._department_repository.get_department(query.department_id) is None:
            raise NotFoundError("Department not found")

        page_query = PageQuery(page=query.page, page_size=query.page_size)
        department_ids = {query.department_id}
        if query.include_descendants:
            department_ids.update(self._department_repository.list_department_descendant_ids(query.department_id))

        items, total = self._person_repository.list_persons_by_department_ids(
            page=page_query.page,
            page_size=page_query.page_size,
            department_ids=department_ids,
            status=query.status,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


def _normalize_required_text(value: str, field: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValidationError(f"{field} cannot be empty", details={field: value})
    return normalized


def _normalize_optional_text(value: str | None, field: str) -> str | None:
    if value is None:
        return None
    return _normalize_required_text(value, field)
