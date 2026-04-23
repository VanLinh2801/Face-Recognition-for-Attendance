import importlib
from datetime import datetime, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.media_assets.entities import MediaAsset
from app.domain.persons.entities import Person
from app.domain.recognition_events.entities import RecognitionEvent
from app.domain.shared.enums import (
    EventDirection,
    MediaAssetType,
    PersonStatus,
    SpoofReviewStatus,
    SpoofSeverity,
    StorageProvider,
    UnknownEventReviewStatus,
)
from app.domain.spoof_alert_events.entities import SpoofAlertEvent
from app.domain.unknown_events.entities import UnknownEvent


class _FakeResult:
    def __init__(self, items):
        self.items = items
        self.total = len(items)
        self.page = 1
        self.page_size = 20


class _FakeUseCase:
    def __init__(self, items):
        self._items = items

    def execute(self, _query):
        return _FakeResult(self._items)


def test_phase2_read_endpoints_return_paginated_shape(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    import app.main as app_main

    importlib.reload(app_main)
    now = datetime.now(timezone.utc)

    app_main.app.dependency_overrides[dependencies.get_list_persons_use_case] = lambda: _FakeUseCase(
        [
            Person(
                id=uuid4(),
                employee_code="E001",
                full_name="Person A",
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
        ]
    )
    app_main.app.dependency_overrides[dependencies.get_list_recognition_events_use_case] = lambda: _FakeUseCase(
        [
            RecognitionEvent(
                id=uuid4(),
                person_id=uuid4(),
                face_registration_id=uuid4(),
                snapshot_media_asset_id=None,
                recognized_at=now,
                event_direction=EventDirection.ENTRY,
                match_score=0.95,
                spoof_score=0.01,
                event_source="ai_service",
                raw_payload=None,
                is_valid=True,
                invalid_reason=None,
                created_at=now,
            )
        ]
    )
    app_main.app.dependency_overrides[dependencies.get_list_unknown_events_use_case] = lambda: _FakeUseCase(
        [
            UnknownEvent(
                id=uuid4(),
                snapshot_media_asset_id=None,
                detected_at=now,
                event_direction=EventDirection.UNKNOWN,
                match_score=None,
                spoof_score=0.2,
                event_source="ai_service",
                raw_payload=None,
                review_status=UnknownEventReviewStatus.NEW,
                notes=None,
                created_at=now,
                updated_at=now,
            )
        ]
    )
    app_main.app.dependency_overrides[dependencies.get_list_spoof_alert_events_use_case] = lambda: _FakeUseCase(
        [
            SpoofAlertEvent(
                id=uuid4(),
                person_id=None,
                snapshot_media_asset_id=None,
                detected_at=now,
                spoof_score=0.92,
                event_source="ai_service",
                raw_payload=None,
                severity=SpoofSeverity.HIGH,
                review_status=SpoofReviewStatus.NEW,
                notes=None,
                created_at=now,
                updated_at=now,
            )
        ]
    )
    app_main.app.dependency_overrides[dependencies.get_list_media_assets_use_case] = lambda: _FakeUseCase(
        [
            MediaAsset(
                id=uuid4(),
                storage_provider=StorageProvider.MINIO,
                bucket_name="attendance",
                object_key="snapshots/1.jpg",
                original_filename="1.jpg",
                mime_type="image/jpeg",
                file_size=123,
                checksum=None,
                asset_type=MediaAssetType.RECOGNITION_SNAPSHOT,
                uploaded_by_person_id=None,
                created_at=now,
            )
        ]
    )

    with TestClient(app_main.app) as client:
        for path in (
            "/api/v1/persons",
            "/api/v1/recognition-events",
            "/api/v1/unknown-events",
            "/api/v1/spoof-alert-events",
            "/api/v1/media-assets",
        ):
            response = client.get(path)
            assert response.status_code == 200
            payload = response.json()
            assert "items" in payload
            assert payload["page"] == 1
            assert payload["page_size"] == 20
