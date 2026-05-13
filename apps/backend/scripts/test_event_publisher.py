"""Seed fixtures and publish Redis events for backend/WebSocket testing."""

from __future__ import annotations

import argparse
import io
import json
import sys
from dataclasses import asdict, dataclass
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import redis
from minio import Minio
from minio.error import S3Error
from sqlalchemy import Text, cast, delete

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.bootstrap.container import build_container
from app.domain.shared.enums import (
    EventDirection,
    MediaAssetType,
    PersonStatus,
    RegistrationStatus,
    SpoofReviewStatus,
    SpoofSeverity,
    StorageProvider,
    UnknownEventReviewStatus,
)
from app.infrastructure.persistence.models.department_model import DepartmentModel
from app.infrastructure.persistence.models.event_inbox_model import EventInboxModel
from app.infrastructure.persistence.models.face_registration_model import FaceRegistrationModel
from app.infrastructure.persistence.models.media_asset_model import MediaAssetModel
from app.infrastructure.persistence.models.person_model import PersonModel
from app.infrastructure.persistence.models.recognition_event_model import RecognitionEventModel
from app.infrastructure.persistence.models.spoof_alert_event_model import SpoofAlertEventModel
from app.infrastructure.persistence.models.unknown_event_model import UnknownEventModel

FIXTURE_NAMESPACE = "test-events"
TEST_EVENT_SOURCE = "script:test-event-publisher"
FIXTURE_DEPARTMENT_ID = UUID("81000000-0000-0000-0000-000000000001")
FIXTURE_PERSON_ID = UUID("82000000-0000-0000-0000-000000000001")
FIXTURE_SOURCE_MEDIA_ID = UUID("83000000-0000-0000-0000-000000000001")
FIXTURE_FACE_REGISTRATION_ID = UUID("84000000-0000-0000-0000-000000000001")
FIXTURE_EMPLOYEE_CODE = "TEST-WS-001"
FIXTURE_FULL_NAME = "WebSocket Test Person"

STREAM_AI_BACKEND = "ai_backend"
STREAM_PIPELINE_BACKEND = "pipeline.backend.events"

ASSET_DIR = Path(__file__).resolve().parent / "assets"
FIXTURE_FILES = {
    "recognition": {
        "path": ASSET_DIR / "recognition-snapshot.svg",
        "filename": "recognition-snapshot.svg",
        "mime_type": "image/svg+xml",
        "asset_type": MediaAssetType.RECOGNITION_SNAPSHOT,
    },
    "unknown": {
        "path": ASSET_DIR / "unknown-snapshot.svg",
        "filename": "unknown-snapshot.svg",
        "mime_type": "image/svg+xml",
        "asset_type": MediaAssetType.UNKNOWN_SNAPSHOT,
    },
    "spoof": {
        "path": ASSET_DIR / "spoof-snapshot.svg",
        "filename": "spoof-snapshot.svg",
        "mime_type": "image/svg+xml",
        "asset_type": MediaAssetType.SPOOF_SNAPSHOT,
    },
    "registration": {
        "path": ASSET_DIR / "recognition-snapshot.svg",
        "filename": "registration-source.svg",
        "mime_type": "image/svg+xml",
        "asset_type": MediaAssetType.REGISTRATION_FACE,
    },
}


@dataclass(slots=True)
class FixtureContext:
    department_id: UUID = FIXTURE_DEPARTMENT_ID
    person_id: UUID = FIXTURE_PERSON_ID
    source_media_asset_id: UUID = FIXTURE_SOURCE_MEDIA_ID
    face_registration_id: UUID = FIXTURE_FACE_REGISTRATION_ID
    full_name: str = FIXTURE_FULL_NAME


@dataclass(slots=True)
class SnapshotAssetRecord:
    id: UUID | None
    bucket_name: str
    object_key: str
    original_filename: str
    mime_type: str
    asset_type: MediaAssetType
    file_size: int


@dataclass(slots=True)
class PublishResult:
    event_name: str
    stream_name: str
    message_id: str
    correlation_id: str
    dedupe_key: str
    person_id: str | None
    face_registration_id: str | None
    snapshot_media_asset_id: str | None
    object_key: str | None
    redis_entry_id: str


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Publish backend test events into Redis Streams.")
    subparsers = parser.add_subparsers(dest="command", required=True)
    for name in (
        "recognition-known",
        "recognition-invalid-person",
        "unknown",
        "spoof",
        "overlay",
        "stream-health",
        "cleanup",
    ):
        subparsers.add_parser(name)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    container = build_container()
    fixture = FixtureContext()
    redis_client = redis.Redis.from_url(container.settings.redis_url, decode_responses=True)
    minio_client = build_minio_client(
        endpoint=container.settings.minio_endpoint,
        access_key=container.settings.minio_access_key,
        secret_key=container.settings.minio_secret_key,
    )
    bucket_name = container.settings.minio_bucket
    ensure_bucket(minio_client, bucket_name)

    with container.session_factory() as session:
        if args.command == "cleanup":
            cleanup_fixtures(session, minio_client, bucket_name)
            session.commit()
            print("Cleanup completed.")
            return

        ensure_base_fixtures(session, minio_client, fixture, bucket_name)
        session.commit()

        if args.command == "recognition-known":
            result = publish_recognition_known(session, redis_client, minio_client, fixture, bucket_name)
        elif args.command == "recognition-invalid-person":
            result = publish_recognition_invalid_person(session, redis_client, minio_client, fixture, bucket_name)
        elif args.command == "unknown":
            result = publish_unknown(session, redis_client, minio_client, fixture, bucket_name)
        elif args.command == "spoof":
            result = publish_spoof(session, redis_client, minio_client, fixture, bucket_name)
        elif args.command == "overlay":
            result = publish_overlay(redis_client)
        else:
            result = publish_stream_health(redis_client)

        session.commit()
        print(json.dumps(asdict(result), indent=2))


def publish_recognition_known(session, redis_client, minio_client: Minio, fixture: FixtureContext, bucket_name: str) -> PublishResult:
    snapshot = create_snapshot_asset(
        minio_client=minio_client,
        bucket_name=bucket_name,
        event_type="recognition",
    )
    occurred_at = utcnow()
    payload = {
        "stream_id": "default",
        "frame_id": f"frame-{occurred_at.strftime('%H%M%S')}",
        "frame_sequence": int(occurred_at.timestamp()),
        "track_id": f"track-{uuid4().hex[:8]}",
        "person_id": str(fixture.person_id),
        "face_registration_id": str(fixture.face_registration_id),
        "recognized_at": occurred_at.isoformat(),
        "event_direction": EventDirection.ENTRY.value,
        "match_score": 0.9821,
        "spoof_score": 0.0123,
        "event_source": TEST_EVENT_SOURCE,
        "dedupe_key": make_dedupe_key("recognition-known"),
        "raw_payload": {"fixture": "recognition-known", "source": TEST_EVENT_SOURCE},
        "snapshot_media_asset": build_snapshot_media_payload(snapshot),
    }
    return publish_event(
        redis_client=redis_client,
        stream_name=STREAM_AI_BACKEND,
        event_name="recognition_event.detected",
        producer="ai_service",
        payload=payload,
        snapshot=snapshot,
        person_id=str(fixture.person_id),
        face_registration_id=str(fixture.face_registration_id),
    )


def publish_recognition_invalid_person(session, redis_client, minio_client: Minio, fixture: FixtureContext, bucket_name: str) -> PublishResult:
    snapshot = create_snapshot_asset(
        minio_client=minio_client,
        bucket_name=bucket_name,
        event_type="unknown",
    )
    occurred_at = utcnow()
    payload = {
        "stream_id": "default",
        "frame_id": f"frame-{occurred_at.strftime('%H%M%S')}",
        "frame_sequence": int(occurred_at.timestamp()),
        "track_id": f"track-{uuid4().hex[:8]}",
        "person_id": str(UUID("ffffffff-ffff-ffff-ffff-ffffffffffff")),
        "face_registration_id": str(fixture.face_registration_id),
        "recognized_at": occurred_at.isoformat(),
        "event_direction": EventDirection.UNKNOWN.value,
        "match_score": 0.4123,
        "spoof_score": 0.2211,
        "event_source": TEST_EVENT_SOURCE,
        "dedupe_key": make_dedupe_key("recognition-invalid-person"),
        "raw_payload": {"fixture": "recognition-invalid-person", "source": TEST_EVENT_SOURCE},
        "snapshot_media_asset": build_snapshot_media_payload(snapshot),
    }
    return publish_event(
        redis_client=redis_client,
        stream_name=STREAM_AI_BACKEND,
        event_name="recognition_event.detected",
        producer="ai_service",
        payload=payload,
        snapshot=snapshot,
        person_id=payload["person_id"],
        face_registration_id=str(fixture.face_registration_id),
    )


def publish_unknown(session, redis_client, minio_client: Minio, fixture: FixtureContext, bucket_name: str) -> PublishResult:
    snapshot = create_snapshot_asset(
        minio_client=minio_client,
        bucket_name=bucket_name,
        event_type="unknown",
    )
    occurred_at = utcnow()
    payload = {
        "stream_id": "default",
        "frame_id": f"frame-{occurred_at.strftime('%H%M%S')}",
        "frame_sequence": int(occurred_at.timestamp()),
        "track_id": f"track-{uuid4().hex[:8]}",
        "detected_at": occurred_at.isoformat(),
        "event_direction": EventDirection.UNKNOWN.value,
        "match_score": 0.4587,
        "spoof_score": 0.0712,
        "event_source": TEST_EVENT_SOURCE,
        "review_status": UnknownEventReviewStatus.NEW.value,
        "notes": "Generated by test_event_publisher",
        "dedupe_key": make_dedupe_key("unknown"),
        "raw_payload": {"fixture": "unknown", "source": TEST_EVENT_SOURCE},
        "snapshot_media_asset": build_snapshot_media_payload(snapshot),
    }
    return publish_event(
        redis_client=redis_client,
        stream_name=STREAM_AI_BACKEND,
        event_name="unknown_event.detected",
        producer="ai_service",
        payload=payload,
        snapshot=snapshot,
        person_id=None,
        face_registration_id=None,
    )


def publish_spoof(session, redis_client, minio_client: Minio, fixture: FixtureContext, bucket_name: str) -> PublishResult:
    snapshot = create_snapshot_asset(
        minio_client=minio_client,
        bucket_name=bucket_name,
        event_type="spoof",
    )
    occurred_at = utcnow()
    payload = {
        "stream_id": "default",
        "frame_id": f"frame-{occurred_at.strftime('%H%M%S')}",
        "frame_sequence": int(occurred_at.timestamp()),
        "track_id": f"track-{uuid4().hex[:8]}",
        "person_id": str(fixture.person_id),
        "detected_at": occurred_at.isoformat(),
        "spoof_score": 0.9814,
        "severity": SpoofSeverity.HIGH.value,
        "review_status": SpoofReviewStatus.NEW.value,
        "notes": "Generated by test_event_publisher",
        "event_source": TEST_EVENT_SOURCE,
        "dedupe_key": make_dedupe_key("spoof"),
        "raw_payload": {"fixture": "spoof", "source": TEST_EVENT_SOURCE},
        "snapshot_media_asset": build_spoof_snapshot_media_payload(snapshot),
    }
    return publish_event(
        redis_client=redis_client,
        stream_name=STREAM_PIPELINE_BACKEND,
        event_name="spoof_alert.detected",
        producer="pipeline",
        payload=payload,
        snapshot=snapshot,
        person_id=str(fixture.person_id),
        face_registration_id=None,
    )


def publish_overlay(redis_client) -> PublishResult:
    occurred_at = utcnow()
    payload = {
        "stream_id": "default",
        "frame_id": f"frame-{occurred_at.strftime('%H%M%S')}",
        "frame_sequence": int(occurred_at.timestamp()),
        "captured_at": occurred_at.isoformat(),
        "presentation_ts_ms": 120,
        "frame_width": 1280,
        "frame_height": 720,
        "tracks": [
            {
                "track_id": f"track-{uuid4().hex[:8]}",
                "bbox": {"x": 180, "y": 80, "width": 220, "height": 220},
                "tracking_state": "tracking",
                "analysis_status": "detected",
                "display_label": "Test track",
            }
        ],
    }
    return publish_passthrough_event(
        redis_client=redis_client,
        stream_name=STREAM_PIPELINE_BACKEND,
        event_name="frame_analysis.updated",
        producer="pipeline",
        payload=payload,
        dedupe_key=make_dedupe_key("overlay"),
    )


def publish_stream_health(redis_client) -> PublishResult:
    payload = {"status": "ok", "stream_id": "default"}
    return publish_passthrough_event(
        redis_client=redis_client,
        stream_name=STREAM_PIPELINE_BACKEND,
        event_name="stream.health.updated",
        producer="pipeline",
        payload=payload,
        dedupe_key=make_dedupe_key("stream-health"),
    )


def publish_event(
    *,
    redis_client,
    stream_name: str,
    event_name: str,
    producer: str,
    payload: dict[str, Any],
    snapshot: SnapshotAssetRecord,
    person_id: str | None,
    face_registration_id: str | None,
) -> PublishResult:
    envelope = build_envelope(event_name=event_name, producer=producer, payload=payload)
    entry_id = redis_client.xadd(stream_name, {"envelope": json.dumps(envelope, default=str)})
    return PublishResult(
        event_name=event_name,
        stream_name=stream_name,
        message_id=envelope["message_id"],
        correlation_id=envelope["correlation_id"],
        dedupe_key=payload["dedupe_key"],
        person_id=person_id,
        face_registration_id=face_registration_id,
        snapshot_media_asset_id=str(snapshot.id) if snapshot.id is not None else None,
        object_key=snapshot.object_key,
        redis_entry_id=entry_id,
    )


def publish_passthrough_event(*, redis_client, stream_name: str, event_name: str, producer: str, payload: dict[str, Any], dedupe_key: str) -> PublishResult:
    envelope = build_envelope(event_name=event_name, producer=producer, payload=payload)
    entry_id = redis_client.xadd(stream_name, {"envelope": json.dumps(envelope, default=str)})
    return PublishResult(
        event_name=event_name,
        stream_name=stream_name,
        message_id=envelope["message_id"],
        correlation_id=envelope["correlation_id"],
        dedupe_key=dedupe_key,
        person_id=None,
        face_registration_id=None,
        snapshot_media_asset_id=None,
        object_key=None,
        redis_entry_id=entry_id,
    )


def ensure_base_fixtures(session, minio_client: Minio, fixture: FixtureContext, bucket_name: str) -> None:
    now = utcnow()

    if session.get(DepartmentModel, fixture.department_id) is None:
        session.add(
            DepartmentModel(
                id=fixture.department_id,
                code="TEST-WS",
                name="WebSocket Test Department",
                parent_id=None,
                is_active=True,
                created_at=now,
                updated_at=now,
            )
        )

    session.flush()

    if session.get(PersonModel, fixture.person_id) is None:
        session.add(
            PersonModel(
                id=fixture.person_id,
                employee_code=FIXTURE_EMPLOYEE_CODE,
                full_name=fixture.full_name,
                department_id=fixture.department_id,
                title="Realtime QA",
                email="test-ws@example.local",
                phone="0900009999",
                status=PersonStatus.ACTIVE,
                joined_at=date(2026, 5, 1),
                notes="Created by test_event_publisher",
                created_at=now,
                updated_at=now,
            )
        )

    session.flush()

    if session.get(MediaAssetModel, fixture.source_media_asset_id) is None:
        source_asset = upload_fixture_asset(
            minio_client=minio_client,
            bucket_name=bucket_name,
            asset_key="registration",
            object_key=f"{FIXTURE_NAMESPACE}/fixtures/registration-source.svg",
            asset_id=fixture.source_media_asset_id,
            original_filename=FIXTURE_FILES["registration"]["filename"],
        )
        session.add(
            MediaAssetModel(
                id=source_asset.id,
                storage_provider=StorageProvider.MINIO,
                bucket_name=source_asset.bucket_name,
                object_key=source_asset.object_key,
                original_filename=source_asset.original_filename,
                mime_type=source_asset.mime_type,
                file_size=source_asset.file_size,
                checksum=None,
                asset_type=source_asset.asset_type,
                uploaded_by_person_id=fixture.person_id,
                created_at=now,
            )
        )

    session.flush()

    if session.get(FaceRegistrationModel, fixture.face_registration_id) is None:
        session.add(
            FaceRegistrationModel(
                id=fixture.face_registration_id,
                person_id=fixture.person_id,
                source_media_asset_id=fixture.source_media_asset_id,
                face_image_media_asset_id=None,
                registration_status=RegistrationStatus.INDEXED,
                validation_notes="Created by test_event_publisher",
                embedding_model="arcface",
                embedding_version="v1",
                is_active=True,
                indexed_at=now,
                created_at=now,
                updated_at=now,
            )
        )


def create_snapshot_asset(*, minio_client: Minio, bucket_name: str, event_type: str) -> SnapshotAssetRecord:
    asset_id = uuid4()
    object_key = f"{FIXTURE_NAMESPACE}/{event_type}/{utcnow().strftime('%Y%m%dT%H%M%S')}-{asset_id}.svg"
    return upload_fixture_asset(
        minio_client=minio_client,
        bucket_name=bucket_name,
        asset_key=event_type,
        object_key=object_key,
        asset_id=None,
        original_filename=FIXTURE_FILES[event_type]["filename"],
    )


def upload_fixture_asset(*, minio_client: Minio, bucket_name: str, asset_key: str, object_key: str, asset_id: UUID | None, original_filename: str) -> SnapshotAssetRecord:
    file_meta = FIXTURE_FILES[asset_key]
    content = file_meta["path"].read_bytes()
    minio_client.put_object(
        bucket_name,
        object_key,
        io.BytesIO(content),
        length=len(content),
        content_type=file_meta["mime_type"],
    )
    return SnapshotAssetRecord(
        id=asset_id,
        bucket_name=bucket_name,
        object_key=object_key,
        original_filename=original_filename,
        mime_type=file_meta["mime_type"],
        asset_type=file_meta["asset_type"],
        file_size=len(content),
    )


def cleanup_fixtures(session, minio_client: Minio, bucket_name: str) -> None:
    delete_minio_test_objects(minio_client, bucket_name)
    session.execute(delete(RecognitionEventModel).where(RecognitionEventModel.event_source == TEST_EVENT_SOURCE))
    session.execute(delete(UnknownEventModel).where(UnknownEventModel.event_source == TEST_EVENT_SOURCE))
    session.execute(delete(SpoofAlertEventModel).where(SpoofAlertEventModel.event_source == TEST_EVENT_SOURCE))
    session.execute(delete(EventInboxModel).where(cast(EventInboxModel.details, Text).like(f'%{FIXTURE_NAMESPACE}%')))
    session.execute(delete(FaceRegistrationModel).where(FaceRegistrationModel.id == FIXTURE_FACE_REGISTRATION_ID))
    session.execute(delete(MediaAssetModel).where(MediaAssetModel.object_key.like(f"{FIXTURE_NAMESPACE}/%")))
    session.execute(delete(PersonModel).where(PersonModel.id == FIXTURE_PERSON_ID))
    session.execute(delete(DepartmentModel).where(DepartmentModel.id == FIXTURE_DEPARTMENT_ID))


def delete_minio_test_objects(minio_client: Minio, bucket_name: str) -> None:
    objects = list(minio_client.list_objects(bucket_name, prefix=f"{FIXTURE_NAMESPACE}/", recursive=True))
    for obj in objects:
        minio_client.remove_object(bucket_name, obj.object_name)


def build_snapshot_media_payload(snapshot: SnapshotAssetRecord) -> dict[str, Any]:
    return {
        "bucket_name": snapshot.bucket_name,
        "object_key": snapshot.object_key,
    }


def build_spoof_snapshot_media_payload(snapshot: SnapshotAssetRecord) -> dict[str, Any]:
    return {
        "storage_provider": StorageProvider.MINIO.value,
        "bucket_name": snapshot.bucket_name,
        "object_key": snapshot.object_key,
        "original_filename": snapshot.original_filename,
        "mime_type": snapshot.mime_type,
        "file_size": snapshot.file_size,
        "asset_type": snapshot.asset_type.value,
    }


def build_envelope(*, event_name: str, producer: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "event_name": event_name,
        "event_version": "1.0.0",
        "message_id": str(uuid4()),
        "correlation_id": str(uuid4()),
        "causation_id": None,
        "producer": producer,
        "occurred_at": utcnow().isoformat(),
        "payload": payload,
    }


def make_dedupe_key(label: str) -> str:
    return f"{FIXTURE_NAMESPACE}:{label}:{utcnow().strftime('%Y%m%dT%H%M%S%f')}:{uuid4().hex[:8]}"


def build_minio_client(*, endpoint: str, access_key: str, secret_key: str) -> Minio:
    return Minio(endpoint, access_key=access_key, secret_key=secret_key, secure=False)


def ensure_bucket(minio_client: Minio, bucket_name: str) -> None:
    if not minio_client.bucket_exists(bucket_name):
        minio_client.make_bucket(bucket_name)


def utcnow() -> datetime:
    return datetime.now(UTC)


if __name__ == "__main__":
    try:
        main()
    except S3Error as exc:
        print(f"MinIO error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
    except Exception as exc:  # pragma: no cover
        print(f"Error: {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
