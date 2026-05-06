"""SQLAlchemy person repository."""

from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.person_repository import PersonRepository
from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus
from app.infrastructure.persistence.models.person_model import PersonModel
from app.infrastructure.persistence.repositories.mappers import to_person


class SqlAlchemyPersonRepository(PersonRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_persons(
        self,
        *,
        page: int,
        page_size: int,
        status: PersonStatus | None = None,
        created_from: datetime | None = None,
        created_to: datetime | None = None,
    ) -> tuple[list[Person], int]:
        stmt = select(PersonModel)
        count_stmt = select(func.count()).select_from(PersonModel)

        if status is None:
            stmt = stmt.where(PersonModel.status != PersonStatus.INACTIVE)
            count_stmt = count_stmt.where(PersonModel.status != PersonStatus.INACTIVE)
        else:
            stmt = stmt.where(PersonModel.status == status)
            count_stmt = count_stmt.where(PersonModel.status == status)
        if created_from is not None:
            stmt = stmt.where(PersonModel.created_at >= created_from)
            count_stmt = count_stmt.where(PersonModel.created_at >= created_from)
        if created_to is not None:
            stmt = stmt.where(PersonModel.created_at <= created_to)
            count_stmt = count_stmt.where(PersonModel.created_at <= created_to)

        stmt = stmt.order_by(PersonModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()

        return ([to_person(item) for item in items], total)

    def get_person(self, person_id: UUID) -> Person | None:
        item = self._session.get(PersonModel, person_id)
        if item is None:
            return None
        return to_person(item)

    def get_person_by_employee_code(self, employee_code: str) -> Person | None:
        stmt = select(PersonModel).where(PersonModel.employee_code == employee_code)
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return None
        return to_person(item)

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
    ) -> Person:
        now = datetime.now(timezone.utc)
        item = PersonModel(
            id=uuid4(),
            employee_code=employee_code,
            full_name=full_name,
            department_id=department_id,
            title=title,
            email=email,
            phone=phone,
            status=PersonStatus.ACTIVE,
            joined_at=joined_at,
            notes=notes,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return to_person(item)

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
    ) -> Person | None:
        item = self._session.get(PersonModel, person_id)
        if item is None:
            return None

        if full_name is not None:
            item.full_name = full_name
        if title is not None:
            item.title = title
        if email is not None:
            item.email = email
        if phone is not None:
            item.phone = phone
        if status is not None:
            item.status = status
        if joined_at is not None:
            item.joined_at = joined_at
        if notes is not None:
            item.notes = notes
        if department_id is not None:
            item.department_id = department_id
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return to_person(item)

    def soft_delete_person(self, person_id: UUID) -> bool:
        item = self._session.get(PersonModel, person_id)
        if item is None:
            return False
        item.status = PersonStatus.INACTIVE
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return True

    def bulk_soft_delete_persons(self, person_ids: list[UUID]) -> int:
        if not person_ids:
            return 0
        stmt = select(PersonModel).where(PersonModel.id.in_(person_ids))
        items = self._session.execute(stmt).scalars().all()
        now = datetime.now(timezone.utc)
        for item in items:
            item.status = PersonStatus.INACTIVE
            item.updated_at = now
        self._session.flush()
        return len(items)
