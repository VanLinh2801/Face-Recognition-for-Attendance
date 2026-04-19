"""Person domain entities."""

from dataclasses import dataclass
from datetime import date, datetime
from uuid import UUID

from app.domain.shared.enums import PersonStatus


@dataclass(slots=True, kw_only=True)
class Person:
    id: UUID
    employee_code: str
    full_name: str
    department_id: UUID | None
    title: str | None
    email: str | None
    phone: str | None
    status: PersonStatus
    joined_at: date | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
