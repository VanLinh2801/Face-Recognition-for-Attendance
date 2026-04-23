from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.application.use_cases.persons import (
    BulkDeletePersonsUseCase,
    CreatePersonCommand,
    CreatePersonUseCase,
    DeletePersonUseCase,
)
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus


class FakePersonRepository:
    def __init__(self):
        self._store = {}

    def get_person_by_employee_code(self, employee_code: str):
        for person in self._store.values():
            if person.employee_code == employee_code:
                return person
        return None

    def create_person(self, **kwargs):
        person = Person(
            id=uuid4(),
            employee_code=kwargs["employee_code"],
            full_name=kwargs["full_name"],
            department_id=kwargs["department_id"],
            title=kwargs["title"],
            email=kwargs["email"],
            phone=kwargs["phone"],
            status=PersonStatus.ACTIVE,
            joined_at=kwargs["joined_at"],
            notes=kwargs["notes"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self._store[str(person.id)] = person
        return person

    def soft_delete_person(self, person_id):
        key = str(person_id)
        if key not in self._store:
            return False
        person = self._store[key]
        person.status = PersonStatus.INACTIVE
        return True

    def bulk_soft_delete_persons(self, person_ids):
        count = 0
        for person_id in person_ids:
            if self.soft_delete_person(person_id):
                count += 1
        return count


def test_create_person_use_case_raises_on_duplicate_employee_code():
    repo = FakePersonRepository()
    use_case = CreatePersonUseCase(repo)
    cmd = CreatePersonCommand(
        employee_code="E001",
        full_name="A",
        department_id=None,
        title=None,
        email=None,
        phone=None,
        joined_at=None,
        notes=None,
    )
    use_case.execute(cmd)

    with pytest.raises(ValidationError):
        use_case.execute(cmd)


def test_delete_person_use_case_raises_for_missing_person():
    repo = FakePersonRepository()
    use_case = DeletePersonUseCase(repo)
    with pytest.raises(NotFoundError):
        use_case.execute(uuid4())


def test_bulk_delete_persons_use_case_requires_non_empty_ids():
    repo = FakePersonRepository()
    use_case = BulkDeletePersonsUseCase(repo)
    with pytest.raises(ValidationError):
        use_case.execute([])
