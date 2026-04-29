from __future__ import annotations

import importlib
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.departments.entities import Department
from app.domain.auth.entities import User


class _FakeUoW:
    def commit(self):
        return None


def _build_admin_user() -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=uuid4(),
        username="admin",
        password_hash="x",
        is_active=True,
        last_login_at=now,
        created_at=now,
        updated_at=now,
    )


def _build_department(*, department_id=None) -> Department:
    now = datetime.now(timezone.utc)
    return Department(
        id=department_id or uuid4(),
        code="D001",
        name="Sales",
        parent_id=None,
        is_active=True,
        created_at=now,
        updated_at=now,
    )


class _UseCaseListDepartments:
    def execute(self, query):
        items = [_build_department()]
        return type("R", (), {"items": items, "total": 1, "page": query.page, "page_size": query.page_size})()


class _UseCaseCreateDepartment:
    def execute(self, _cmd):
        return _build_department()


class _UseCaseGetDepartment:
    def execute(self, _did):
        return _build_department()


class _UseCaseUpdateDepartment:
    def execute(self, _cmd):
        return _build_department(department_id=_cmd.department_id)


class _UseCaseDeleteDepartment:
    def execute(self, _did):
        return None


def test_departments_module_endpoints(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.delenv("AUTH_SEED_ADMIN_USERNAME", raising=False)
    monkeypatch.delenv("AUTH_SEED_ADMIN_PASSWORD", raising=False)

    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)

    app_main.app.dependency_overrides[dependencies.get_admin_user] = lambda: _build_admin_user()
    app_main.app.dependency_overrides[dependencies.get_list_departments_use_case] = lambda: _UseCaseListDepartments()
    app_main.app.dependency_overrides[dependencies.get_create_department_use_case] = lambda: _UseCaseCreateDepartment()
    app_main.app.dependency_overrides[dependencies.get_get_department_use_case] = lambda: _UseCaseGetDepartment()
    app_main.app.dependency_overrides[dependencies.get_update_department_use_case] = lambda: _UseCaseUpdateDepartment()
    app_main.app.dependency_overrides[dependencies.get_delete_department_use_case] = lambda: _UseCaseDeleteDepartment()
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUoW()

    department_id = str(uuid4())

    with TestClient(app_main.app) as client:
        assert client.get("/api/v1/departments").status_code == 200
        assert client.post(
            "/api/v1/departments",
            json={"code": "D001", "name": "Sales", "parent_id": None, "is_active": True},
        ).status_code == 201
        assert client.get(f"/api/v1/departments/{department_id}").status_code == 200
        assert client.patch(
            f"/api/v1/departments/{department_id}",
            json={"name": "Sales Updated"},
        ).status_code == 200
        assert client.delete(f"/api/v1/departments/{department_id}").status_code == 204

