from datetime import datetime, timezone
from uuid import uuid4

from app.application.use_cases.persons import ListPersonsQuery, ListPersonsUseCase
from app.application.use_cases.recognition_events import (
    ListRecognitionEventsQuery,
    ListRecognitionEventsUseCase,
)
from app.domain.persons.entities import Person
from app.domain.recognition_events.entities import RecognitionEvent
from app.domain.shared.enums import EventDirection, PersonStatus


class FakePersonRepository:
    def list_persons(self, **kwargs):
        _ = kwargs
        return (
            [
                Person(
                    id=uuid4(),
                    employee_code="E001",
                    full_name="Nguyen Van A",
                    department_id=None,
                    title=None,
                    email=None,
                    phone=None,
                    status=PersonStatus.ACTIVE,
                    joined_at=None,
                    notes=None,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            ],
            1,
        )


class FakeRecognitionEventRepository:
    def list_recognition_events(self, **kwargs):
        _ = kwargs
        now = datetime.now(timezone.utc)
        return (
            [
                RecognitionEvent(
                    id=uuid4(),
                    person_id=uuid4(),
                    face_registration_id=uuid4(),
                    snapshot_media_asset_id=None,
                    recognized_at=now,
                    event_direction=EventDirection.ENTRY,
                    match_score=0.98,
                    spoof_score=0.01,
                    event_source="ai_service",
                    raw_payload=None,
                    is_valid=True,
                    invalid_reason=None,
                    created_at=now,
                )
            ],
            1,
        )


def test_list_persons_use_case_returns_paginated_result():
    use_case = ListPersonsUseCase(FakePersonRepository())
    result = use_case.execute(ListPersonsQuery(page=1, page_size=20))

    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].employee_code == "E001"


def test_list_recognition_events_use_case_returns_paginated_result():
    use_case = ListRecognitionEventsUseCase(FakeRecognitionEventRepository())
    result = use_case.execute(ListRecognitionEventsQuery(page=1, page_size=20))

    assert result.total == 1
    assert len(result.items) == 1
    assert result.items[0].event_source == "ai_service"
