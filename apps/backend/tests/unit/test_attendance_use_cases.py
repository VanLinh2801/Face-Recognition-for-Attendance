from dataclasses import dataclass
from datetime import date, datetime, timezone
from uuid import uuid4

from app.application.use_cases.attendance import (
    GetAttendanceDailySummaryUseCase,
    GetAttendanceEventUseCase,
    ListAttendanceEventsQuery,
    ListAttendanceEventsUseCase,
)


@dataclass
class _FakeAttendanceEvent:
    id: str
    person_id: str
    person_full_name: str
    recognized_at: datetime
    event_direction: str
    match_score: float | None
    spoof_score: float | None
    event_source: str
    is_valid: bool


@dataclass
class _FakeSummary:
    work_date: date
    total_events: int
    unique_persons: int
    total_entries: int
    total_exits: int


class _FakeAttendanceRepository:
    def list_attendance_events(self, **kwargs):
        _ = kwargs
        item = _FakeAttendanceEvent(
            id=str(uuid4()),
            person_id=str(uuid4()),
            person_full_name="A",
            recognized_at=datetime.now(timezone.utc),
            event_direction="entry",
            match_score=0.9,
            spoof_score=0.1,
            event_source="ai",
            is_valid=True,
        )
        return [item], 1

    def get_attendance_event(self, event_id):
        _ = event_id
        return _FakeAttendanceEvent(
            id=str(uuid4()),
            person_id=str(uuid4()),
            person_full_name="A",
            recognized_at=datetime.now(timezone.utc),
            event_direction="entry",
            match_score=0.9,
            spoof_score=0.1,
            event_source="ai",
            is_valid=True,
        )

    def list_person_attendance_history(self, person_id, **kwargs):
        _ = person_id, kwargs
        return self.list_attendance_events()

    def get_daily_summary(self, work_date):
        return _FakeSummary(work_date=work_date, total_events=10, unique_persons=3, total_entries=6, total_exits=4)


def test_list_attendance_events_use_case():
    use_case = ListAttendanceEventsUseCase(_FakeAttendanceRepository())
    result = use_case.execute(ListAttendanceEventsQuery(page=1, page_size=20))
    assert result.total == 1
    assert len(result.items) == 1


def test_get_attendance_daily_summary_use_case():
    work_date = date.today()
    use_case = GetAttendanceDailySummaryUseCase(_FakeAttendanceRepository())
    summary = use_case.execute(work_date)
    assert summary.work_date == work_date
    assert summary.total_events == 10


def test_get_attendance_event_use_case():
    use_case = GetAttendanceEventUseCase(_FakeAttendanceRepository())
    item = use_case.execute(uuid4())
    assert item.is_valid is True
