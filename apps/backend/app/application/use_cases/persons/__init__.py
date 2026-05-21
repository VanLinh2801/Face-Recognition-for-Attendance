"""Person use cases."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from app.application.dtos.pagination import PageQuery, PageResult
from app.application.interfaces.repositories.face_registration_repository import FaceRegistrationRepository
from app.application.interfaces.repositories.person_repository import PersonRepository
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus


@dataclass(slots=True, kw_only=True)
class ListPersonsQuery:
    page: int = 1
    page_size: int = 20
    department_id: UUID | None = None
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
    status: PersonStatus | None = None
    joined_at: date | None = None
    notes: str | None = None


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
        _ensure_status_is_not_inactive(query.status)
        page_query = PageQuery(page=query.page, page_size=query.page_size)
        items, total = self._repository.list_persons(
            page=page_query.page,
            page_size=page_query.page_size,
            department_id=query.department_id,
            status=query.status,
            created_from=query.created_from,
            created_to=query.created_to,
        )
        return PageResult(items=items, total=total, page=page_query.page, page_size=page_query.page_size)


class CreatePersonUseCase:
    def __init__(self, repository: PersonRepository) -> None:
        self._repository = repository

    def execute(self, command: CreatePersonCommand) -> Person:
        _ensure_status_is_not_inactive(command.status)
        existing = self._repository.get_person_by_employee_code(command.employee_code)
        if existing is not None:
            raise ValidationError("employee_code already exists", details={"employee_code": command.employee_code})
        self._validate_unique_contact(email=command.email, phone=command.phone)
        return self._repository.create_person(
            employee_code=command.employee_code,
            full_name=command.full_name,
            department_id=command.department_id,
            title=command.title,
            email=command.email,
            phone=command.phone,
            status=command.status,
            joined_at=command.joined_at,
            notes=command.notes,
        )

    def _validate_unique_contact(self, *, email: str | None, phone: str | None) -> None:
        if email:
            existing = self._repository.get_person_by_email(email)
            if existing is not None:
                raise ValidationError("email already exists", details={"email": email})
        if phone:
            existing = self._repository.get_person_by_phone(phone)
            if existing is not None:
                raise ValidationError("phone already exists", details={"phone": phone})


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
        _ensure_status_is_not_inactive(command.status)
        current = self._repository.get_person(command.person_id)
        if current is None:
            raise NotFoundError("Person not found")
        self._validate_unique_contact(
            person_id=command.person_id,
            email=command.email,
            phone=command.phone,
        )
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

    def _validate_unique_contact(self, *, person_id: UUID, email: str | None, phone: str | None) -> None:
        if email:
            existing = self._repository.get_person_by_email(email, exclude_person_id=person_id)
            if existing is not None:
                raise ValidationError("email already exists", details={"email": email})
        if phone:
            existing = self._repository.get_person_by_phone(phone, exclude_person_id=person_id)
            if existing is not None:
                raise ValidationError("phone already exists", details={"phone": phone})


class DeletePersonUseCase:
    def __init__(
        self,
        repository: PersonRepository,
        registration_repository: FaceRegistrationRepository | None = None,
    ) -> None:
        self._repository = repository
        self._registration_repository = registration_repository

    def execute(self, person_id: UUID) -> None:
        if not self._repository.soft_delete_person(person_id):
            raise NotFoundError("Person not found")
        if self._registration_repository is not None:
            self._registration_repository.deactivate_registrations_by_person(person_id)


class BulkDeletePersonsUseCase:
    def __init__(
        self,
        repository: PersonRepository,
        registration_repository: FaceRegistrationRepository | None = None,
    ) -> None:
        self._repository = repository
        self._registration_repository = registration_repository

    def execute(self, person_ids: list[UUID]) -> int:
        if not person_ids:
            raise ValidationError("person_ids cannot be empty")
        deleted_count = self._repository.bulk_soft_delete_persons(person_ids)
        if self._registration_repository is not None:
            for person_id in person_ids:
                self._registration_repository.deactivate_registrations_by_person(person_id)
        return deleted_count


def _ensure_status_is_not_inactive(status: PersonStatus | None) -> None:
    if status == PersonStatus.INACTIVE:
        raise ValidationError("inactive status is reserved for deleted persons", details={"status": status.value})
