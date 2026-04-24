from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.application.use_cases.event_ingestion import (
    IngestRecognitionEventUseCase,
    IngestSpoofAlertEventUseCase,
    IngestStatus,
    IngestUnknownEventUseCase,
)


class _FakeUoW:
    def __init__(self) -> None:
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        return None

    def commit(self) -> None:
        self.commits += 1

    def rollback(self) -> None:
        return None


class _FakeInboxRepo:
    def __init__(self) -> None:
        self.message_ids: set = set()

    def exists_message_id(self, message_id):
        return message_id in self.message_ids

    def add_processed_message(self, *, message_id, **_kwargs) -> None:
        self.message_ids.add(message_id)


class _FakeRecognitionRepo:
    def __init__(self) -> None:
        self.by_dedupe: set[str] = set()

    def list_recognition_events(self, **_kwargs):
        return ([], 0)

    def get_by_dedupe_key(self, dedupe_key: str):
        return object() if dedupe_key in self.by_dedupe else None

    def create_recognition_event(self, *, dedupe_key: str, **_kwargs):
        self.by_dedupe.add(dedupe_key)
        return object()


class _FakeUnknownRepo:
    def __init__(self) -> None:
        self.by_dedupe: set[str] = set()

    def list_unknown_events(self, **_kwargs):
        return ([], 0)

    def get_by_dedupe_key(self, dedupe_key: str):
        return object() if dedupe_key in self.by_dedupe else None

    def create_unknown_event(self, *, dedupe_key: str, **_kwargs):
        self.by_dedupe.add(dedupe_key)
        return object()


class _FakeSpoofRepo:
    def __init__(self) -> None:
        self.by_dedupe: set[str] = set()

    def list_spoof_alert_events(self, **_kwargs):
        return ([], 0)

    def get_by_dedupe_key(self, dedupe_key: str):
        return object() if dedupe_key in self.by_dedupe else None

    def create_spoof_alert_event(self, *, dedupe_key: str, **_kwargs):
        self.by_dedupe.add(dedupe_key)
        return object()


def _base_envelope(event_name: str, producer: str) -> dict:
    return {
        "event_name": event_name,
        "producer": producer,
        "message_id": str(uuid4()),
        "occurred_at": datetime.now(timezone.utc).isoformat(),
    }


def test_ingest_recognition_duplicate_message_id() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeRecognitionRepo()
    use_case = IngestRecognitionEventUseCase(uow=uow, inbox_repository=inbox, recognition_repository=repo)
    envelope = _base_envelope("recognition_event.detected", "ai_service")
    message_id = envelope["message_id"]
    inbox.message_ids.add(UUID(message_id))
    envelope["payload"] = {
        "person_id": str(uuid4()),
        "face_registration_id": str(uuid4()),
        "recognized_at": datetime.now(timezone.utc).isoformat(),
        "event_direction": "entry",
        "event_source": "ai_service",
        "dedupe_key": "rk-1",
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.DUPLICATE
    assert uow.commits == 0


def test_ingest_unknown_duplicate_dedupe_key() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeUnknownRepo()
    repo.by_dedupe.add("uk-1")
    use_case = IngestUnknownEventUseCase(uow=uow, inbox_repository=inbox, unknown_repository=repo)
    envelope = _base_envelope("unknown_event.detected", "ai_service")
    envelope["payload"] = {
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "event_direction": "unknown",
        "event_source": "ai_service",
        "dedupe_key": "uk-1",
        "review_status": "new",
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.DUPLICATE
    assert uow.commits == 1


def test_ingest_spoof_processed() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeSpoofRepo()
    use_case = IngestSpoofAlertEventUseCase(uow=uow, inbox_repository=inbox, spoof_repository=repo)
    envelope = _base_envelope("spoof_alert.detected", "pipeline")
    envelope["payload"] = {
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "spoof_score": 0.99,
        "severity": "high",
        "review_status": "new",
        "event_source": "pipeline",
        "dedupe_key": "sk-1",
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.PROCESSED
    assert uow.commits == 1
