import importlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core import dependencies
from app.domain.auth.entities import User
from app.domain.media_assets.entities import MediaAsset
from app.application.interfaces.repositories.event_feed_repository import EventFeedItem, EventFeedType
from app.domain.shared.enums import EventDirection, MediaAssetType, StorageProvider, UnknownEventReviewStatus
from app.domain.shared.enums import SpoofReviewStatus
from app.domain.spoof_alert_events.entities import SpoofAlertEvent
from app.domain.unknown_events.entities import UnknownEvent


class _FakePageResult:
    def __init__(self, items):
        self.items = items
        self.total = len(items)
        self.page = 1
        self.page_size = 20


class _FakeEventFeedUseCase:
    def execute(self, _query):
        now = datetime.now(timezone.utc)
        return _FakePageResult(
            [
                EventFeedItem(
                    id=uuid4(),
                    type=EventFeedType.RECOGNITION,
                    occurred_at=now,
                    person_id=uuid4(),
                    person_name="Nguyen Van A",
                    direction=EventDirection.ENTRY,
                    score=0.98,
                    spoof_score=0.01,
                    source="camera-1",
                    status="valid",
                    severity=None,
                    review_status=None,
                    snapshot_media_asset_id=None,
                    raw_payload={"track_id": "t1"},
                    metadata={"face_registration_id": str(uuid4()), "created_at": now},
                )
            ]
        )


class _FakeUnknownUpdateUseCase:
    def execute(self, command):
        now = datetime.now(timezone.utc)
        return UnknownEvent(
            id=command.event_id,
            snapshot_media_asset_id=None,
            detected_at=now,
            event_direction=EventDirection.UNKNOWN,
            match_score=None,
            spoof_score=0.45,
            event_source="camera-2",
            raw_payload=None,
            review_status=command.review_status or UnknownEventReviewStatus.NEW,
            notes=command.notes,
            created_at=now,
            updated_at=now,
        )


class _FakeSpoofUpdateUseCase:
    def execute(self, command):
        now = datetime.now(timezone.utc)
        return SpoofAlertEvent(
            id=command.event_id,
            person_id=None,
            snapshot_media_asset_id=None,
            detected_at=now,
            spoof_score=0.92,
            event_source="camera-3",
            raw_payload=None,
            severity="high",
            review_status=command.review_status or SpoofReviewStatus.NEW,
            notes=command.notes,
            created_at=now,
            updated_at=now,
        )


class _FakeGetMediaAssetUseCase:
    def execute(self, asset_id):
        now = datetime.now(timezone.utc)
        return MediaAsset(
            id=asset_id,
            storage_provider=StorageProvider.MINIO,
            bucket_name="attendance",
            object_key="snapshots/test.jpg",
            original_filename="test.jpg",
            mime_type="image/jpeg",
            file_size=12345,
            checksum=None,
            asset_type=MediaAssetType.RECOGNITION_SNAPSHOT,
            uploaded_by_person_id=None,
            created_at=now,
        )


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


def test_events_api_endpoints(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "sqlite+pysqlite:///:memory:")
    monkeypatch.setenv("ENABLE_EVENT_CONSUMER", "false")
    monkeypatch.setenv("FILTER_RETENTION_DAYS", "14")
    from app.core.config import get_settings

    get_settings.cache_clear()
    import app.main as app_main

    importlib.reload(app_main)
    app_main.app.dependency_overrides[dependencies.get_admin_user] = lambda: _build_admin_user()
    app_main.app.dependency_overrides[dependencies.get_list_event_feed_use_case] = lambda: _FakeEventFeedUseCase()
    app_main.app.dependency_overrides[dependencies.get_update_unknown_event_review_use_case] = (
        lambda: _FakeUnknownUpdateUseCase()
    )
    app_main.app.dependency_overrides[dependencies.get_update_spoof_alert_event_review_use_case] = (
        lambda: _FakeSpoofUpdateUseCase()
    )
    app_main.app.dependency_overrides[dependencies.get_get_media_asset_use_case] = lambda: _FakeGetMediaAssetUseCase()
    app_main.app.dependency_overrides[dependencies.get_unit_of_work] = lambda: _FakeUoW()

    unknown_id = uuid4()
    spoof_id = uuid4()
    asset_id = uuid4()

    with TestClient(app_main.app) as client:
        policy_response = client.get("/api/v1/system/filter-policy")
        assert policy_response.status_code == 200
        policy_payload = policy_response.json()
        assert policy_payload["retention_days"] == 14
        assert policy_payload["events"]["max_future_hours"] == 1
        assert policy_payload["attendance"]["max_future_days"] == 0

        app_main.app.state.container.dashboard_health_state.record_stream_health(
            payload={
                "status": "ok",
                "fps": 30,
                "latency_ms": 42,
                "stream_id": "cam-01",
                "camera_name": "Main Gate",
                "source_online": True,
            },
            occurred_at=datetime.now(timezone.utc),
        )
        dashboard_health_response = client.get("/api/v1/system/dashboard-health")
        assert dashboard_health_response.status_code == 200
        dashboard_health_payload = dashboard_health_response.json()
        assert dashboard_health_payload["backend"]["status"] == "healthy"
        assert dashboard_health_payload["stream"]["details"]["fps"] == 30.0
        assert dashboard_health_payload["camera_source"]["label"] == "online"

        feed_response = client.get("/api/v1/events?type=all&page=1&page_size=20")
        assert feed_response.status_code == 200
        feed_payload = feed_response.json()
        assert feed_payload["items"][0]["type"] == "recognition"
        assert feed_payload["items"][0]["person_name"] == "Nguyen Van A"

        too_old = (datetime.now(timezone.utc) - timedelta(days=15)).isoformat()
        too_future = (datetime.now(timezone.utc) + timedelta(hours=2)).isoformat()
        invalid_from = client.get(f"/api/v1/events?from_at={too_old}")
        assert invalid_from.status_code == 422
        invalid_to = client.get(f"/api/v1/events?to_at={too_future}")
        assert invalid_to.status_code == 422

        unknown_response = client.patch(
            f"/api/v1/unknown-events/{unknown_id}",
            json={"review_status": "reviewed", "notes": "done"},
        )
        assert unknown_response.status_code == 200
        assert unknown_response.json()["review_status"] == "reviewed"
        assert unknown_response.json()["notes"] == "done"

        invalid_unknown_response = client.patch(f"/api/v1/unknown-events/{unknown_id}", json={})
        assert invalid_unknown_response.status_code == 422

        spoof_response = client.patch(
            f"/api/v1/spoof-alert-events/{spoof_id}",
            json={"review_status": "ignored", "notes": None},
        )
        assert spoof_response.status_code == 200
        assert spoof_response.json()["review_status"] == "ignored"

        media_response = client.get(f"/api/v1/media-assets/{asset_id}")
        assert media_response.status_code == 200
        assert media_response.json()["id"] == str(asset_id)
