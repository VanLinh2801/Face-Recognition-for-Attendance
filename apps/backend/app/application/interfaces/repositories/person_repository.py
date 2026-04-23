"""Person repository abstraction."""

from __future__ import annotations

from datetime import date, datetime
from typing import Protocol
from uuid import UUID

from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus


class PersonRepository(Protocol):
    """Read/write abstraction for person aggregates."""

    def list_persons(
        self,
        *,
        page: int,
        page_size: int,
        status: PersonStatus | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[Person], int]: ...

    def get_person(self, person_id: UUID) -> Person | None: ...

    def get_person_by_employee_code(self, employee_code: str) -> Person | None: ...

    def create_person(
        self,
        *,
        employee_code: str,
        full_name: str,
        department_id: UUID | None,
        title: str | None,
        email: str | None,
        phone: str | None,
        joined_at: date | None,
        notes: str | None,
    ) -> Person: ...

    def update_person(
        self,
        person_id: UUID,
        *,
        full_name: str | None = None,
        department_id: UUID | None = None,
        title: str | None = None,
        email: str | None = None,
        phone: str | None = None,
        status: PersonStatus | None = None,
        joined_at: date | None = None,
        notes: str | None = None,
    ) -> Person | None: ...

    def soft_delete_person(self, person_id: UUID) -> bool: ...

    def bulk_soft_delete_persons(self, person_ids: list[UUID]) -> int: ...
