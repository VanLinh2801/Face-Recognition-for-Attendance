"""SQLAlchemy department repository."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.application.interfaces.repositories.department_repository import DepartmentRepository
from app.domain.departments.entities import Department
from app.infrastructure.persistence.models.department_model import DepartmentModel
from app.infrastructure.persistence.repositories.mappers import to_department


class SqlAlchemyDepartmentRepository(DepartmentRepository):
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_departments(
        self,
        *,
        page: int,
        page_size: int,
        is_active: bool | None = None,
    ) -> tuple[list[Department], int]:
        stmt = select(DepartmentModel)
        count_stmt = select(func.count()).select_from(DepartmentModel)

        if is_active is not None:
            stmt = stmt.where(DepartmentModel.is_active == is_active)
            count_stmt = count_stmt.where(DepartmentModel.is_active == is_active)

        stmt = stmt.order_by(DepartmentModel.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        items = self._session.execute(stmt).scalars().all()
        total = self._session.execute(count_stmt).scalar_one()
        return ([to_department(item) for item in items], total)

    def get_department(self, department_id: UUID) -> Department | None:
        item = self._session.get(DepartmentModel, department_id)
        if item is None:
            return None
        return to_department(item)

    def get_department_by_code(self, *, code: str) -> Department | None:
        stmt = select(DepartmentModel).where(func.lower(DepartmentModel.code) == code.lower())
        item = self._session.execute(stmt).scalar_one_or_none()
        if item is None:
            return None
        return to_department(item)

    def list_department_descendant_ids(self, department_id: UUID) -> set[UUID]:
        rows = self._session.execute(select(DepartmentModel.id, DepartmentModel.parent_id)).all()
        children_by_parent: dict[UUID, list[UUID]] = {}
        for row in rows:
            if row.parent_id is None:
                continue
            children_by_parent.setdefault(row.parent_id, []).append(row.id)

        descendants: set[UUID] = set()
        pending = list(children_by_parent.get(department_id, []))
        while pending:
            current_id = pending.pop()
            if current_id in descendants:
                continue
            descendants.add(current_id)
            pending.extend(children_by_parent.get(current_id, []))
        return descendants

    def create_department(
        self,
        *,
        code: str,
        name: str,
        parent_id: UUID | None,
        is_active: bool,
    ) -> Department:
        now = datetime.now(timezone.utc)
        item = DepartmentModel(
            id=uuid4(),
            code=code,
            name=name,
            parent_id=parent_id,
            is_active=is_active,
            created_at=now,
            updated_at=now,
        )
        self._session.add(item)
        self._session.flush()
        return to_department(item)

    def update_department(
        self,
        department_id: UUID,
        *,
        code: str | None = None,
        name: str | None = None,
        parent_id: UUID | None = None,
        parent_id_provided: bool = False,
        is_active: bool | None = None,
    ) -> Department | None:
        item = self._session.get(DepartmentModel, department_id)
        if item is None:
            return None

        if code is not None:
            item.code = code
        if name is not None:
            item.name = name
        if parent_id_provided:
            item.parent_id = parent_id
        if is_active is not None:
            item.is_active = is_active

        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return to_department(item)

    def deactivate_department(self, department_id: UUID) -> bool:
        item = self._session.get(DepartmentModel, department_id)
        if item is None:
            return False
        item.is_active = False
        item.updated_at = datetime.now(timezone.utc)
        self._session.flush()
        return True
