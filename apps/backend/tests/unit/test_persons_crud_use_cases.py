from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.application.use_cases.persons import (
    BulkDeletePersonsUseCase,
    CreatePersonCommand,
    CreatePersonUseCase,
    DeletePersonUseCase,
    UpdatePersonCommand,
    UpdatePersonUseCase,
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

    def get_person_by_email(self, email: str, *, exclude_person_id=None):
        for person in self._store.values():
            if person.email == email and person.id != exclude_person_id:
                return person
        return None

    def get_person_by_phone(self, phone: str, *, exclude_person_id=None):
        for person in self._store.values():
            if person.phone == phone and person.id != exclude_person_id:
                return person
        return None

    def get_person(self, person_id):
        return self._store.get(str(person_id))

    def create_person(self, **kwargs):
        person = Person(
            id=uuid4(),
            employee_code=kwargs["employee_code"],
            full_name=kwargs["full_name"],
            department_id=kwargs["department_id"],
            title=kwargs["title"],
            email=kwargs["email"],
            phone=kwargs["phone"],
            status=kwargs.get("status") or PersonStatus.ACTIVE,
            joined_at=kwargs["joined_at"],
            notes=kwargs["notes"],
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        self._store[str(person.id)] = person
        return person

    def update_person(self, person_id, **kwargs):
        person = self.get_person(person_id)
        if person is None:
            return None
        for key, value in kwargs.items():
            if value is not None:
                setattr(person, key, value)
        person.updated_at = datetime.now(timezone.utc)
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


def test_create_person_use_case_raises_on_duplicate_email():
    repo = FakePersonRepository()
    use_case = CreatePersonUseCase(repo)
    use_case.execute(
        CreatePersonCommand(
            employee_code="E001",
            full_name="A",
            department_id=None,
            title=None,
            email="person@example.com",
            phone=None,
            joined_at=None,
            notes=None,
        )
    )

    with pytest.raises(ValidationError):
        use_case.execute(
            CreatePersonCommand(
                employee_code="E002",
                full_name="B",
                department_id=None,
                title=None,
                email="person@example.com",
                phone=None,
                joined_at=None,
                notes=None,
            )
        )


def test_create_person_use_case_raises_on_duplicate_phone():
    repo = FakePersonRepository()
    use_case = CreatePersonUseCase(repo)
    use_case.execute(
        CreatePersonCommand(
            employee_code="E001",
            full_name="A",
            department_id=None,
            title=None,
            email=None,
            phone="0900000000",
            joined_at=None,
            notes=None,
        )
    )

    with pytest.raises(ValidationError):
        use_case.execute(
            CreatePersonCommand(
                employee_code="E002",
                full_name="B",
                department_id=None,
                title=None,
                email=None,
                phone="0900000000",
                joined_at=None,
                notes=None,
            )
        )


def test_update_person_use_case_raises_on_duplicate_email_or_phone():
    repo = FakePersonRepository()
    create_use_case = CreatePersonUseCase(repo)
    first = create_use_case.execute(
        CreatePersonCommand(
            employee_code="E001",
            full_name="A",
            department_id=None,
            title=None,
            email="a@example.com",
            phone="0900000001",
            joined_at=None,
            notes=None,
        )
    )
    second = create_use_case.execute(
        CreatePersonCommand(
            employee_code="E002",
            full_name="B",
            department_id=None,
            title=None,
            email="b@example.com",
            phone="0900000002",
            joined_at=None,
            notes=None,
        )
    )
    update_use_case = UpdatePersonUseCase(repo)

    with pytest.raises(ValidationError):
        update_use_case.execute(UpdatePersonCommand(person_id=second.id, email=first.email))
    with pytest.raises(ValidationError):
        update_use_case.execute(UpdatePersonCommand(person_id=second.id, phone=first.phone))


def test_update_person_use_case_allows_current_email_and_phone():
    repo = FakePersonRepository()
    person = CreatePersonUseCase(repo).execute(
        CreatePersonCommand(
            employee_code="E001",
            full_name="A",
            department_id=None,
            title=None,
            email="a@example.com",
            phone="0900000001",
            joined_at=None,
            notes=None,
        )
    )

    updated = UpdatePersonUseCase(repo).execute(
        UpdatePersonCommand(person_id=person.id, email=person.email, phone=person.phone, full_name="Updated")
    )

    assert updated.full_name == "Updated"


def test_delete_person_use_case_raises_for_missing_person():
    repo = FakePersonRepository()
    use_case = DeletePersonUseCase(repo)
    with pytest.raises(NotFoundError):
        use_case.execute(uuid4())


def test_create_person_use_case_accepts_optional_status():
    repo = FakePersonRepository()
    use_case = CreatePersonUseCase(repo)
    cmd = CreatePersonCommand(
        employee_code="E007",
        full_name="Status User",
        department_id=None,
        title=None,
        email=None,
        phone=None,
        status=PersonStatus.RESIGNED,
        joined_at=None,
        notes=None,
    )

    person = use_case.execute(cmd)

    assert person.status == PersonStatus.RESIGNED


def test_bulk_delete_persons_use_case_requires_non_empty_ids():
    repo = FakePersonRepository()
    use_case = BulkDeletePersonsUseCase(repo)
    with pytest.raises(ValidationError):
        use_case.execute([])
