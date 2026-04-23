"""Person use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.person_repository import PersonRepository
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus


@dataclass(slots=True, kw_only=True)
class ListPersonsQuery:
    page: int = 1
    page_size: int = 20
    status: PersonStatus | None = None
    created_from: datetime | None = None
    created_to: datetime | None = None


@dataclass(slots=True, kw_only=True)
class CreatePersonCommand:
    employee_code: str
    full_name: str
    department_id: UUID | None
    title: str | None
    email: str | None
    phone: str | None
    joined_at: date | None
    notes: str | None


@dataclass(slots=True, kw_only=True)
class UpdatePersonCommand:
    person_id: UUID
    full_name: str | None = None
    department_id: UUID | None = None
    title: str | None = None
    email: str | None = None
    phone: str | None = None
    status: PersonStatus | None = None
    joined_at: date | None = None
    notes: str | None = None


class ListPersonsUseCase:
    def __init__(self, repository: PersonRepository) -> None:
        self._repository = repository

    def execute(self, query: ListPersonsQuery) -> PageResult[Person]:
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_persons(
            page=page_query.page,
            page_size=page_query.page_size,
            status=query.status,
            created_from=query.created_from,
            created_to=query.created_to,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


class CreatePersonUseCase:
    def __init__(self, repository: PersonRepository) -> None:
        self._repository = repository

    def execute(self, command: CreatePersonCommand) -> Person:
        existing = self._repository.get_person_by_employee_code(command.employee_code)
        if existing is not None:
            raise ValidationError("employee_code already exists", details={"employee_code": command.employee_code})
        return self._repository.create_person(
            employee_code=command.employee_code,
            full_name=command.full_name,
            department_id=command.department_id,
            title=command.title,
            email=command.email,
            phone=command.phone,
            joined_at=command.joined_at,
            notes=command.notes,
        )


class GetPersonUseCase:
    def __init__(self, repository: PersonRepository) -> None:
        self._repository = repository

    def execute(self, person_id: UUID) -> Person:
        person = self._repository.get_person(person_id)
        if person is None:
            raise NotFoundError("Person not found")
        return person


class UpdatePersonUseCase:
    def __init__(self, repository: PersonRepository) -> None:
        self._repository = repository

    def execute(self, command: UpdatePersonCommand) -> Person:
        person = self._repository.update_person(
            command.person_id,
            full_name=command.full_name,
            department_id=command.department_id,
            title=command.title,
            email=command.email,
            phone=command.phone,
            status=command.status,
            joined_at=command.joined_at,
            notes=command.notes,
        )
        if person is None:
            raise NotFoundError("Person not found")
        return person


class DeletePersonUseCase:
    def __init__(self, repository: PersonRepository) -> None:
        self._repository = repository

    def execute(self, person_id: UUID) -> None:
        if not self._repository.soft_delete_person(person_id):
            raise NotFoundError("Person not found")


class BulkDeletePersonsUseCase:
    def __init__(self, repository: PersonRepository) -> None:
        self._repository = repository

    def execute(self, person_ids: list[UUID]) -> int:
        if not person_ids:
            raise ValidationError("person_ids cannot be empty")
        return self._repository.bulk_soft_delete_persons(person_ids)
