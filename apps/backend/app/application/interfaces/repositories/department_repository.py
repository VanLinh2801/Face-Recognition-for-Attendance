"""Department repository abstraction."""

from __future__ import annotations

from typing import Protocol
from uuid import UUID

from app.domain.departments.entities import Department


class DepartmentRepository(Protocol):
    """Read/write abstraction for department aggregates."""

    def list_departments(
        self,
        *,
        page: int,
        page_size: int,
        is_active: bool | None = None,
    ) -> tuple[list[Department], int]: ...

    def get_department(self, department_id: UUID) -> Department | None: ...

    def get_department_by_code(self, *, code: str) -> Department | None: ...

    def create_department(
        self,
        *,
        code: str,
        name: str,
        parent_id: UUID | None,
        is_active: bool,
    ) -> Department: ...

    def update_department(
        self,
        department_id: UUID,
        *,
        code: str | None = None,
        name: str | None = None,
        parent_id: UUID | None = None,
        is_active: bool | None = None,
    ) -> Department | None: ...

    def deactivate_department(self, department_id: UUID) -> bool: ...
