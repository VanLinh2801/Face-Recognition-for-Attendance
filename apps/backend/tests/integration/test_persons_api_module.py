import importlib
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.persons.entities import Person
from app.domain.shared.enums import PersonStatus, RegistrationStatus


class _FakeUow:
    def commit(self):
        return None


class _FakePublisher:
    async def publish_registration_requested(self, **kwargs):
        _ = kwargs
        return {"stream_id": "1-0", "message_id": str(uuid4()), "correlation_id": str(uuid4())}

    async def close(self):
        return None


def _build_person():
    now = datetime.now(timezone.utc)
    return Person(
        id=uuid4(),
        employee_code="E100",
        full_name="Mock User",
        department_id=None,
        title=None,
        email=None,
        phone=None,
        status=PersonStatus.ACTIVE,
        joined_at=None,
        notes=None,
        created_at=now,
        updated_at=now,
    )


def _build_registration(person_id):
    now = datetime.now(timezone.utc)
    return PersonFaceRegistration(
        id=uuid4(),
        person_id=person_id,
        source_media_asset_id=uuid4(),
        face_image_media_asset_id=None,
        registration_status=RegistrationStatus.PENDING,
        validation_notes=None,
        embedding_model=None,
        embedding_version=None,
        is_active=True,
        indexed_at=None,
        created_at=now,
        updated_at=now,
    )


class _UseCaseCreatePerson:
    def execute(self, _cmd):
        return _build_person()


class _UseCaseGetPerson:
    def execute(self, _pid):
        return _build_person()


class _UseCaseUpdatePerson:
    def execute(self, _cmd):
        return _build_person()


class _UseCaseDeletePerson:
    def execute(self, _pid):
        return None


class _UseCaseBulkDelete:
    def execute(self, _ids):
        return 2


class _UseCaseCreateRegistration:
    def execute(self, cmd):
        reg = _build_registration(cmd.person_id)
        return reg, {
            "media_asset_id": str(uuid4()),
            "storage_provider": "minio",
            "bucket_name": "attendance",
            "object_key": "uploads/1.jpg",
            "original_filename": "1.jpg",
            "mime_type": "image/jpeg",
            "file_size": 10,
            "checksum": None,
            "asset_type": "registration_face",
        }


class _UseCaseListRegistrations:
    def execute(self, query):
        reg = _build_registration(query.person_id)
        return type("R", (), {"items": [reg], "total": 1, "page": 1, "page_size": 20})()


class _UseCaseGetRegistration:
    def execute(self, _rid):
        return _build_registration(uuid4())


class _UseCaseDeleteRegistration:
    def execute(self, _rid):
        return None


class _UseCaseCompleteRegistration:
    def execute(self, _cmd):
        return _build_registration(uuid4())


def test_persons_module_endpoints(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    import app.main as app_main

    importlib.reload(app_main)

    app_main.app.dependency_overrides[dependencies.get_create_person_use_case] = lambda: _UseCaseCreatePerson()
    app_main.app.dependency_overrides[dependencies.get_get_person_use_case] = lambda: _UseCaseGetPerson()
    app_main.app.dependency_overrides[dependencies.get_update_person_use_case] = lambda: _UseCaseUpdatePerson()
    app_main.app.dependency_overrides[dependencies.get_delete_person_use_case] = lambda: _UseCaseDeletePerson()
    app_main.app.dependency_overrides[dependencies.get_bulk_delete_persons_use_case] = lambda: _UseCaseBulkDelete()
    app_main.app.dependency_overrides[dependencies.get_create_face_registration_use_case] = lambda: _UseCaseCreateRegistration()
    app_main.app.dependency_overrides[dependencies.get_list_face_registrations_use_case] = lambda: _UseCaseListRegistrations()
    app_main.app.dependency_overrides[dependencies.get_get_face_registration_use_case] = lambda: _UseCaseGetRegistration()
    app_main.app.dependency_overrides[dependencies.get_delete_face_registration_use_case] = lambda: _UseCaseDeleteRegistration()
    app_main.app.dependency_overrides[dependencies.get_complete_face_registration_use_case] = lambda: _UseCaseCompleteRegistration()
    app_main.app.dependency_overrides[dependencies.get_pipeline_event_publisher] = lambda: _FakePublisher()
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUow()

    person_id = str(uuid4())
    registration_id = str(uuid4())

    with TestClient(app_main.app) as client:
        assert client.post("/api/v1/persons", json={"employee_code": "E100", "full_name": "Mock"}).status_code == 201
        assert client.get(f"/api/v1/persons/{person_id}").status_code == 200
        assert client.patch(f"/api/v1/persons/{person_id}", json={"full_name": "Updated"}).status_code == 200
        assert client.delete(f"/api/v1/persons/{person_id}").status_code == 204
        assert client.post("/api/v1/persons/bulk-delete", json={"person_ids": [person_id]}).status_code == 200

        create_reg = client.post(
            f"/api/v1/persons/{person_id}/registrations",
            json={
                "requested_by_person_id": person_id,
                "source_media_asset": {
                    "storage_provider": "minio",
                    "bucket_name": "attendance",
                    "object_key": "uploads/1.jpg",
                    "original_filename": "1.jpg",
                    "mime_type": "image/jpeg",
                    "file_size": 10,
                    "asset_type": "registration_face",
                },
            },
        )
        assert create_reg.status_code == 201
        assert client.get(f"/api/v1/persons/{person_id}/registrations").status_code == 200
        assert client.get(f"/api/v1/persons/{person_id}/registrations/{registration_id}").status_code == 200
        assert client.delete(f"/api/v1/persons/{person_id}/registrations/{registration_id}").status_code == 204

        completed = client.post(
            "/api/v1/internal/registrations/events/completed",
            json={
                "message_id": str(uuid4()),
                "correlation_id": str(uuid4()),
                "occurred_at": datetime.now(timezone.utc).isoformat(),
                "payload": {"registration_id": registration_id, "status": "indexed"},
            },
        )
        assert completed.status_code == 200
