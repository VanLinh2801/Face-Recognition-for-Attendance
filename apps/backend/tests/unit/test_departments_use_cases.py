from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from app.application.use_cases.departments import (
    CreateDepartmentCommand,
    CreateDepartmentUseCase,
    DeleteDepartmentUseCase,
    ListDepartmentPersonsQuery,
    ListDepartmentPersonsUseCase,
    UpdateDepartmentCommand,
    UpdateDepartmentUseCase,
)
from app.core.exceptions import NotFoundError, ValidationError
from app.domain.departments.entities import Department
from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus


class FakeDepartmentRepository:
    def __init__(self) -> None:
        self._store: dict[UUID, Department] = {}
        self.last_update_kwargs: dict | None = None

    def list_departments(self, *, page, page_size, is_active=None):
        items = list(self._store.values())
        if is_active is not None:
            items = [item for item in items if item.is_active == is_active]
        return (items[(page - 1) * page_size : page * page_size], len(items))

    def get_department(self, department_id):
        return self._store.get(department_id)

    def get_department_by_code(self, *, code):
        for department in self._store.values():
            if department.code.lower() == code.lower():
                return department
        return None

    def list_department_descendant_ids(self, department_id):
        descendants = set()

        def visit(parent_id):
            for department in self._store.values():
                if department.parent_id == parent_id:
                    descendants.add(department.id)
                    visit(department.id)

        visit(department_id)
        return descendants

    def create_department(self, *, code, name, parent_id, is_active):
        department = _department(code=code, name=name, parent_id=parent_id, is_active=is_active)
        self._store[department.id] = department
        return department

    def update_department(self, department_id, **kwargs):
        self.last_update_kwargs = kwargs
        department = self._store.get(department_id)
        if department is None:
            return None
        if kwargs.get("code") is not None:
            department.code = kwargs["code"]
        if kwargs.get("name") is not None:
            department.name = kwargs["name"]
        if kwargs.get("parent_id_provided"):
            department.parent_id = kwargs["parent_id"]
        if kwargs.get("is_active") is not None:
            department.is_active = kwargs["is_active"]
        return department

    def deactivate_department(self, department_id):
        department = self._store.get(department_id)
        if department is None:
            return False
        department.is_active = False
        return True


class FakePersonRepository:
    def __init__(self, persons: list[Person]) -> None:
        self._persons = persons
        self.last_department_ids: set[UUID] | None = None

    def list_persons_by_department_ids(self, *, page, page_size, department_ids, status=None):
        self.last_department_ids = department_ids
        items = [person for person in self._persons if person.department_id in department_ids]
        if status is None:
            items = [person for person in items if person.status != PersonStatus.INACTIVE]
        else:
            items = [person for person in items if person.status == status]
        return (items[(page - 1) * page_size : page * page_size], len(items))


def test_create_department_rejects_duplicate_code_case_insensitive() -> None:
    repo = FakeDepartmentRepository()
    use_case = CreateDepartmentUseCase(repo)
    use_case.execute(CreateDepartmentCommand(code="ENG", name="Engineering", parent_id=None, is_active=True))

    with pytest.raises(ValidationError):
        use_case.execute(CreateDepartmentCommand(code=" eng ", name="Engineering 2", parent_id=None, is_active=True))


def test_update_department_parent_id_semantics() -> None:
    repo = FakeDepartmentRepository()
    parent = repo.create_department(code="ROOT", name="Root", parent_id=None, is_active=True)
    child = repo.create_department(code="CHILD", name="Child", parent_id=parent.id, is_active=True)
    use_case = UpdateDepartmentUseCase(repo)

    unchanged = use_case.execute(UpdateDepartmentCommand(department_id=child.id, name="Child Updated"))
    assert unchanged.parent_id == parent.id
    assert repo.last_update_kwargs is not None
    assert repo.last_update_kwargs["parent_id_provided"] is False

    cleared = use_case.execute(UpdateDepartmentCommand(department_id=child.id, parent_id=None, parent_id_provided=True))
    assert cleared.parent_id is None
    assert repo.last_update_kwargs is not None
    assert repo.last_update_kwargs["parent_id_provided"] is True


def test_update_department_rejects_invalid_parent_relationships() -> None:
    repo = FakeDepartmentRepository()
    root = repo.create_department(code="ROOT", name="Root", parent_id=None, is_active=True)
    child = repo.create_department(code="CHILD", name="Child", parent_id=root.id, is_active=True)
    use_case = UpdateDepartmentUseCase(repo)

    with pytest.raises(ValidationError):
        use_case.execute(UpdateDepartmentCommand(department_id=root.id, parent_id=root.id, parent_id_provided=True))
    with pytest.raises(ValidationError):
        use_case.execute(UpdateDepartmentCommand(department_id=root.id, parent_id=child.id, parent_id_provided=True))
    with pytest.raises(ValidationError):
        use_case.execute(UpdateDepartmentCommand(department_id=root.id, parent_id=uuid4(), parent_id_provided=True))


def test_delete_department_deactivates_only_target() -> None:
    repo = FakeDepartmentRepository()
    department = repo.create_department(code="ENG", name="Engineering", parent_id=None, is_active=True)

    DeleteDepartmentUseCase(repo).execute(department.id)

    assert department.is_active is False
    with pytest.raises(NotFoundError):
        DeleteDepartmentUseCase(repo).execute(uuid4())


def test_list_department_persons_can_include_descendants() -> None:
    department_repo = FakeDepartmentRepository()
    root = department_repo.create_department(code="ROOT", name="Root", parent_id=None, is_active=True)
    child = department_repo.create_department(code="CHILD", name="Child", parent_id=root.id, is_active=True)
    person_repo = FakePersonRepository([_person(department_id=root.id), _person(department_id=child.id)])
    use_case = ListDepartmentPersonsUseCase(department_repo, person_repo)

    result = use_case.execute(ListDepartmentPersonsQuery(department_id=root.id, include_descendants=True))

    assert result.total == 2
    assert person_repo.last_department_ids == {root.id, child.id}


def _department(*, code: str, name: str, parent_id: UUID | None, is_active: bool) -> Department:
    now = datetime.now(timezone.utc)
    return Department(
        id=uuid4(),
        code=code,
        name=name,
        parent_id=parent_id,
        is_active=is_active,
        created_at=now,
        updated_at=now,
    )


def _person(*, department_id: UUID) -> Person:
    now = datetime.now(timezone.utc)
    return Person(
        id=uuid4(),
        employee_code=str(uuid4()),
        full_name="Person",
        department_id=department_id,
        title=None,
        email=None,
        phone=None,
        status=PersonStatus.ACTIVE,
        joined_at=None,
        notes=None,
        created_at=now,
        updated_at=now,
    )
