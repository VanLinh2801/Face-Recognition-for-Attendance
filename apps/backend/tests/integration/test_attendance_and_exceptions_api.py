import importlib
from datetime import date, datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.attendance_exceptions.entities import AttendanceException
from app.domain.shared.enums import AttendanceExceptionType, EventDirection


class _FakeUow:
    def commit(self):
        return None


class _FakeAttendanceEvent:
    def __init__(self):
        self.id = uuid4()
        self.person_id = uuid4()
        self.person_full_name = "Tester"
        self.recognized_at = datetime.now(timezone.utc)
        self.event_direction = EventDirection.ENTRY
        self.match_score = 0.91
        self.spoof_score = 0.02
        self.event_source = "ai_service"
        self.is_valid = True


class _FakeSummary:
    def __init__(self):
        self.work_date = date.today()
        self.total_events = 5
        self.unique_persons = 2
        self.total_entries = 3
        self.total_exits = 2


class _FakeAttendanceListUseCase:
    def execute(self, _query):
        return type("R", (), {"items": [_FakeAttendanceEvent()], "total": 1, "page": 1, "page_size": 20})()


class _FakeAttendanceGetUseCase:
    def execute(self, _event_id):
        return _FakeAttendanceEvent()


class _FakeAttendanceHistoryUseCase:
    def execute(self, _query):
        return type("R", (), {"items": [_FakeAttendanceEvent()], "total": 1, "page": 1, "page_size": 20})()


class _FakeAttendanceSummaryUseCase:
    def execute(self, _work_date):
        return _FakeSummary()


class _FakeAttendanceExceptionUseCases:
    def _item(self):
        now = datetime.now(timezone.utc)
        return AttendanceException(
            id=uuid4(),
            person_id=uuid4(),
            exception_type=AttendanceExceptionType.BUSINESS_TRIP,
            start_at=now,
            end_at=now,
            work_date=now.date(),
            reason="Trip",
            notes=None,
            created_by_person_id=uuid4(),
            is_deleted=False,
            deleted_at=None,
            deleted_by_person_id=None,
            created_at=now,
            updated_at=now,
        )

    def create(self, _cmd):
        return self._item()

    def list(self, _query):
        return type("R", (), {"items": [self._item()], "total": 1, "page": 1, "page_size": 20})()

    def get(self, _id):
        return self._item()

    def update(self, _cmd):
        return self._item()

    def delete(self, _id, deleted_by_person_id=None):
        _ = deleted_by_person_id
        return None

    def bulk_delete(self, _ids, deleted_by_person_id=None):
        _ = deleted_by_person_id
        return 1


def test_attendance_and_exceptions_api(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    import app.main as app_main

    importlib.reload(app_main)

    attendance_ex = _FakeAttendanceExceptionUseCases()

    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUow()
    app_main.app.dependency_overrides[dependencies.get_list_attendance_events_use_case] = lambda: _FakeAttendanceListUseCase()
    app_main.app.dependency_overrides[dependencies.get_get_attendance_event_use_case] = lambda: _FakeAttendanceGetUseCase()
    app_main.app.dependency_overrides[dependencies.get_list_person_attendance_history_use_case] = lambda: _FakeAttendanceHistoryUseCase()
    app_main.app.dependency_overrides[dependencies.get_get_attendance_daily_summary_use_case] = lambda: _FakeAttendanceSummaryUseCase()
    app_main.app.dependency_overrides[dependencies.get_create_attendance_exception_use_case] = lambda: type(
        "UC", (), {"execute": attendance_ex.create}
    )()
    app_main.app.dependency_overrides[dependencies.get_list_attendance_exceptions_use_case] = lambda: type(
        "UC", (), {"execute": attendance_ex.list}
    )()
    app_main.app.dependency_overrides[dependencies.get_get_attendance_exception_use_case] = lambda: type(
        "UC", (), {"execute": attendance_ex.get}
    )()
    app_main.app.dependency_overrides[dependencies.get_update_attendance_exception_use_case] = lambda: type(
        "UC", (), {"execute": attendance_ex.update}
    )()
    app_main.app.dependency_overrides[dependencies.get_delete_attendance_exception_use_case] = lambda: type(
        "UC", (), {"execute": attendance_ex.delete}
    )()
    app_main.app.dependency_overrides[dependencies.get_bulk_delete_attendance_exceptions_use_case] = lambda: type(
        "UC", (), {"execute": attendance_ex.bulk_delete}
    )()

    with TestClient(app_main.app) as client:
        assert client.get("/api/v1/attendance/events").status_code == 200
        assert client.get(f"/api/v1/attendance/events/{uuid4()}").status_code == 200
        assert client.get(f"/api/v1/attendance/persons/{uuid4()}/history").status_code == 200
        assert client.get(f"/api/v1/attendance/summary/daily?work_date={date.today().isoformat()}").status_code == 200

        create_resp = client.post(
            "/api/v1/attendance-exceptions",
            json={
                "person_id": str(uuid4()),
                "exception_type": "business_trip",
                "start_at": datetime.now(timezone.utc).isoformat(),
                "end_at": datetime.now(timezone.utc).isoformat(),
                "work_date": date.today().isoformat(),
                "reason": "Trip",
                "created_by_person_id": str(uuid4()),
            },
        )
        assert create_resp.status_code == 201
        assert client.get("/api/v1/attendance-exceptions").status_code == 200
        eid = str(uuid4())
        assert client.get(f"/api/v1/attendance-exceptions/{eid}").status_code == 200
        assert client.patch(f"/api/v1/attendance-exceptions/{eid}", json={"reason": "Updated"}).status_code == 200
        assert client.delete(f"/api/v1/attendance-exceptions/{eid}").status_code == 204
        bulk = client.post(
            "/api/v1/attendance-exceptions/bulk-delete",
            json={"exception_ids": [str(uuid4())]},
        )
        assert bulk.status_code == 200
