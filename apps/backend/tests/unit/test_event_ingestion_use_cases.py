from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import UUID, uuid4

from app.application.interfaces.storage_gateway import ObjectStorageStat
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
        self.latest_by_person: dict[UUID, datetime] = {}
        self.create_calls = 0
        self.last_create_kwargs: dict | None = None
        self.linked_snapshot_media_asset_id = None

    def list_recognition_events(self, **_kwargs):
        return ([], 0)

    def get_by_dedupe_key(self, dedupe_key: str):
        return object() if dedupe_key in self.by_dedupe else None

    def create_recognition_event(self, *, dedupe_key: str, **_kwargs):
        self.create_calls += 1
        self.by_dedupe.add(dedupe_key)
        self.last_create_kwargs = _kwargs
        return SimpleNamespace(id=uuid4())

    def create_media_asset_and_link_snapshot(self, *, recognition_id, **_kwargs):
        _ = recognition_id
        self.linked_snapshot_media_asset_id = True
        return None

    def get_latest_recognition_time(self, *, person_id: UUID) -> datetime | None:
        return self.latest_by_person.get(person_id)


class _FakeUnknownRepo:
    def __init__(self) -> None:
        self.by_dedupe: set[str] = set()
        self.last_create_kwargs: dict | None = None
        self.linked_snapshot_media_asset_id = None

    def list_unknown_events(self, **_kwargs):
        return ([], 0)

    def get_by_dedupe_key(self, dedupe_key: str):
        return object() if dedupe_key in self.by_dedupe else None

    def create_unknown_event(self, *, dedupe_key: str, **_kwargs):
        self.by_dedupe.add(dedupe_key)
        self.last_create_kwargs = _kwargs
        return SimpleNamespace(id=uuid4())

    def create_media_asset_and_link_snapshot(self, *, unknown_event_id, **_kwargs):
        _ = unknown_event_id
        self.linked_snapshot_media_asset_id = True
        return None


class _FakeSpoofRepo:
    def __init__(self) -> None:
        self.by_dedupe: set[str] = set()
        self.latest_by_person: dict[UUID, datetime] = {}
        self.create_calls = 0
        self.last_create_kwargs: dict | None = None
        self.linked_snapshot_media_asset_id = None

    def list_spoof_alert_events(self, **_kwargs):
        return ([], 0)

    def get_by_dedupe_key(self, dedupe_key: str):
        return object() if dedupe_key in self.by_dedupe else None

    def create_spoof_alert_event(self, *, dedupe_key: str, **_kwargs):
        self.create_calls += 1
        self.by_dedupe.add(dedupe_key)
        self.last_create_kwargs = _kwargs
        return SimpleNamespace(id=uuid4())

    def create_media_asset_and_link_snapshot(self, *, spoof_event_id, **_kwargs):
        _ = spoof_event_id
        self.linked_snapshot_media_asset_id = True
        return None

    def get_latest_spoof_time(self, *, person_id: UUID) -> datetime | None:
        return self.latest_by_person.get(person_id)


class _FakeMediaAssetRepo:
    def __init__(self) -> None:
        self.by_location: dict[tuple[str, str], SimpleNamespace] = {}
        self.create_calls = 0

    def get_media_asset_by_location(self, *, bucket_name: str, object_key: str):
        return self.by_location.get((bucket_name, object_key))

    def create_media_asset(self, **kwargs):
        self.create_calls += 1
        asset = SimpleNamespace(id=uuid4(), **kwargs)
        self.by_location[(kwargs["bucket_name"], kwargs["object_key"])] = asset
        return asset


class _FakeStorageGateway:
    def __init__(self) -> None:
        self.stats: dict[tuple[str, str], ObjectStorageStat] = {}
        self.failures: dict[tuple[str, str], Exception] = {}

    def stat_object(self, *, bucket_name: str, object_key: str) -> ObjectStorageStat:
        key = (bucket_name, object_key)
        if key in self.failures:
            raise self.failures[key]
        return self.stats[key]


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
    use_case = IngestRecognitionEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        recognition_repository=repo,
        media_asset_repository=_FakeMediaAssetRepo(),
        storage_gateway=_FakeStorageGateway(),
    )
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
    use_case = IngestUnknownEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        unknown_repository=repo,
        media_asset_repository=_FakeMediaAssetRepo(),
        storage_gateway=_FakeStorageGateway(),
    )
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
    use_case = IngestSpoofAlertEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        spoof_repository=repo,
        media_asset_repository=_FakeMediaAssetRepo(),
        storage_gateway=_FakeStorageGateway(),
    )
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


def test_ingest_recognition_throttled_within_window() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeRecognitionRepo()

    latest = datetime.now(timezone.utc)
    person_id = uuid4()
    repo.latest_by_person[person_id] = latest

    use_case = IngestRecognitionEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        recognition_repository=repo,
        media_asset_repository=_FakeMediaAssetRepo(),
        storage_gateway=_FakeStorageGateway(),
        throttle_window_seconds=30,
    )

    envelope = _base_envelope("recognition_event.detected", "ai_service")
    envelope["payload"] = {
        "person_id": str(person_id),
        "face_registration_id": str(uuid4()),
        "recognized_at": (latest + timedelta(seconds=10)).isoformat(),
        "event_direction": "entry",
        "event_source": "ai_service",
        "dedupe_key": "rk-new",
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.IGNORED
    assert uow.commits == 1
    assert "rk-new" not in repo.by_dedupe
    assert repo.create_calls == 0


def test_ingest_spoof_throttled_within_window() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeSpoofRepo()

    latest = datetime.now(timezone.utc)
    person_id = uuid4()
    repo.latest_by_person[person_id] = latest

    use_case = IngestSpoofAlertEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        spoof_repository=repo,
        media_asset_repository=_FakeMediaAssetRepo(),
        storage_gateway=_FakeStorageGateway(),
        throttle_window_seconds=30,
    )

    envelope = _base_envelope("spoof_alert.detected", "pipeline")
    envelope["payload"] = {
        "person_id": str(person_id),
        "detected_at": (latest + timedelta(seconds=10)).isoformat(),
        "spoof_score": 0.99,
        "severity": "high",
        "review_status": "new",
        "event_source": "pipeline",
        "dedupe_key": "sk-new",
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.IGNORED
    assert uow.commits == 1
    assert "sk-new" not in repo.by_dedupe
    assert repo.create_calls == 0


def test_ingest_recognition_resolves_existing_snapshot_media_asset() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeRecognitionRepo()
    media_repo = _FakeMediaAssetRepo()
    storage = _FakeStorageGateway()
    existing_id = uuid4()
    media_repo.by_location[("attendance", "test-events/recognition/existing.svg")] = SimpleNamespace(id=existing_id)
    use_case = IngestRecognitionEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        recognition_repository=repo,
        media_asset_repository=media_repo,
        storage_gateway=storage,
    )

    envelope = _base_envelope("recognition_event.detected", "ai_service")
    envelope["payload"] = {
        "person_id": str(uuid4()),
        "face_registration_id": str(uuid4()),
        "recognized_at": datetime.now(timezone.utc).isoformat(),
        "event_direction": "entry",
        "event_source": "ai_service",
        "dedupe_key": "rk-existing-media",
        "snapshot_media_asset": {
            "bucket_name": "attendance",
            "object_key": "test-events/recognition/existing.svg",
        },
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.PROCESSED
    assert repo.last_create_kwargs is not None
    assert repo.last_create_kwargs["snapshot_media_asset_id"] == existing_id
    assert media_repo.create_calls == 0


def test_ingest_unknown_creates_snapshot_media_asset_from_storage_location() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeUnknownRepo()
    media_repo = _FakeMediaAssetRepo()
    storage = _FakeStorageGateway()
    storage.stats[("attendance", "test-events/unknown/new.svg")] = ObjectStorageStat(
        size=512,
        content_type="image/svg+xml",
    )
    use_case = IngestUnknownEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        unknown_repository=repo,
        media_asset_repository=media_repo,
        storage_gateway=storage,
    )

    envelope = _base_envelope("unknown_event.detected", "ai_service")
    envelope["payload"] = {
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "event_direction": "unknown",
        "event_source": "ai_service",
        "dedupe_key": "uk-new-media",
        "review_status": "new",
        "snapshot_media_asset": {
            "bucket_name": "attendance",
            "object_key": "test-events/unknown/new.svg",
        },
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.PROCESSED
    assert repo.last_create_kwargs is not None
    assert repo.last_create_kwargs["snapshot_media_asset_id"] is not None
    assert media_repo.create_calls == 1


def test_ingest_spoof_allows_missing_snapshot_object() -> None:
    uow = _FakeUoW()
    inbox = _FakeInboxRepo()
    repo = _FakeSpoofRepo()
    media_repo = _FakeMediaAssetRepo()
    storage = _FakeStorageGateway()
    storage.failures[("attendance", "test-events/spoof/missing.svg")] = FileNotFoundError("missing")
    use_case = IngestSpoofAlertEventUseCase(
        uow=uow,
        inbox_repository=inbox,
        spoof_repository=repo,
        media_asset_repository=media_repo,
        storage_gateway=storage,
    )

    envelope = _base_envelope("spoof_alert.detected", "pipeline")
    envelope["payload"] = {
        "detected_at": datetime.now(timezone.utc).isoformat(),
        "spoof_score": 0.99,
        "severity": "high",
        "review_status": "new",
        "event_source": "pipeline",
        "dedupe_key": "sk-missing-media",
        "snapshot_media_asset": {
            "bucket_name": "attendance",
            "object_key": "test-events/spoof/missing.svg",
            "storage_provider": "minio",
            "original_filename": "missing.svg",
            "mime_type": "image/svg+xml",
            "file_size": 99,
            "asset_type": "spoof_snapshot",
        },
    }

    result = use_case.execute(envelope)
    assert result.status == IngestStatus.PROCESSED
    assert repo.last_create_kwargs is not None
    assert repo.last_create_kwargs["snapshot_media_asset_id"] is None
    assert media_repo.create_calls == 0
