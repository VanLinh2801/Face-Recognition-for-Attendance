from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.application.dtos.realtime import RealtimeChannel
from app.application.use_cases.realtime import GetRealtimeCatchupUseCase, RealtimeCatchupQuery
from app.domain.face_registrations.entities import PersonFaceRegistration
from app.domain.shared.enums import EventDirection, RegistrationStatus, SpoofReviewStatus, SpoofSeverity, UnknownEventReviewStatus
from app.domain.spoof_alert_events.entities import SpoofAlertEvent
from app.domain.unknown_events.entities import UnknownEvent
from app.domain.recognition_events.entities import RecognitionEvent


class _FakeRecognitionRepo:
    def list_recognition_events_since(self, *, since_timestamp, limit):
        _ = since_timestamp, limit
        now = datetime.now(timezone.utc)
        return [
            RecognitionEvent(
                id=uuid4(),
                person_id=uuid4(),
                face_registration_id=uuid4(),
                snapshot_media_asset_id=None,
                recognized_at=now + timedelta(seconds=20),
                event_direction=EventDirection.ENTRY,
                match_score=0.9,
                spoof_score=0.01,
                event_source="ai_service",
                dedupe_key="rk",
                raw_payload=None,
                is_valid=True,
                invalid_reason=None,
                created_at=now,
            )
        ]


class _FakeUnknownRepo:
    def list_unknown_events_since(self, *, since_timestamp, limit):
        _ = since_timestamp, limit
        now = datetime.now(timezone.utc)
        return [
            UnknownEvent(
                id=uuid4(),
                snapshot_media_asset_id=None,
                detected_at=now + timedelta(seconds=10),
                event_direction=EventDirection.UNKNOWN,
                match_score=None,
                spoof_score=0.2,
                event_source="ai_service",
                dedupe_key="uk",
                raw_payload=None,
                review_status=UnknownEventReviewStatus.NEW,
                notes=None,
                created_at=now,
                updated_at=now,
            )
        ]


class _FakeSpoofRepo:
    def list_spoof_alert_events_since(self, *, since_timestamp, limit):
        _ = since_timestamp, limit
        now = datetime.now(timezone.utc)
        return [
            SpoofAlertEvent(
                id=uuid4(),
                person_id=None,
                snapshot_media_asset_id=None,
                detected_at=now + timedelta(seconds=5),
                spoof_score=0.95,
                event_source="pipeline",
                dedupe_key="sk",
                raw_payload=None,
                severity=SpoofSeverity.HIGH,
                review_status=SpoofReviewStatus.NEW,
                notes=None,
                created_at=now,
                updated_at=now,
            )
        ]


class _FakeFaceRepo:
    def list_registrations_completed_since(self, *, since_timestamp, limit):
        _ = since_timestamp, limit
        now = datetime.now(timezone.utc)
        return [
            PersonFaceRegistration(
                id=uuid4(),
                person_id=uuid4(),
                source_media_asset_id=uuid4(),
                face_image_media_asset_id=None,
                registration_status=RegistrationStatus.VALIDATED,
                validation_notes=None,
                embedding_model=None,
                embedding_version=None,
                is_active=True,
                indexed_at=None,
                created_at=now,
                updated_at=now + timedelta(seconds=15),
            )
        ]


def test_catchup_business_sorted_and_limited() -> None:
    use_case = GetRealtimeCatchupUseCase(_FakeRecognitionRepo(), _FakeUnknownRepo(), _FakeSpoofRepo(), _FakeFaceRepo())
    result = use_case.execute(
        RealtimeCatchupQuery(
            channel=RealtimeChannel.EVENTS_BUSINESS,
            since_timestamp=datetime.now(timezone.utc) - timedelta(minutes=5),
            limit=10,
        )
    )
    assert [item.event_type for item in result] == [
        "spoof_alert.detected",
        "unknown_event.detected",
        "registration_processing.completed",
        "recognition_event.detected",
    ]


def test_catchup_non_business_returns_empty() -> None:
    use_case = GetRealtimeCatchupUseCase(_FakeRecognitionRepo(), _FakeUnknownRepo(), _FakeSpoofRepo(), _FakeFaceRepo())
    result = use_case.execute(
        RealtimeCatchupQuery(
            channel=RealtimeChannel.STREAM_OVERLAY,
            since_timestamp=datetime.now(timezone.utc),
            limit=10,
        )
    )
    assert result == []
