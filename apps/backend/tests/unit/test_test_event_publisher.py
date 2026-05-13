from __future__ import annotations

from uuid import uuid4

from scripts.test_event_publisher import (
    SnapshotAssetRecord,
    build_envelope,
    build_snapshot_media_payload,
    build_spoof_snapshot_media_payload,
    make_dedupe_key,
)

from app.domain.shared.enums import MediaAssetType, StorageProvider


def test_build_snapshot_media_payload_matches_frame_asset_ref_shape() -> None:
    asset_id = uuid4()
    record = SnapshotAssetRecord(
        id=asset_id,
        bucket_name="attendance",
        object_key="test-events/recognition/example.svg",
        original_filename="example.svg",
        mime_type="image/svg+xml",
        asset_type=MediaAssetType.RECOGNITION_SNAPSHOT,
        file_size=123,
    )

    payload = build_snapshot_media_payload(record)

    assert payload["bucket_name"] == "attendance"
    assert payload["object_key"] == "test-events/recognition/example.svg"
    assert set(payload.keys()) == {"bucket_name", "object_key"}


def test_build_spoof_snapshot_media_payload_matches_media_asset_ref_shape() -> None:
    record = SnapshotAssetRecord(
        id=None,
        bucket_name="attendance",
        object_key="test-events/spoof/example.svg",
        original_filename="example.svg",
        mime_type="image/svg+xml",
        asset_type=MediaAssetType.SPOOF_SNAPSHOT,
        file_size=123,
    )

    payload = build_spoof_snapshot_media_payload(record)

    assert payload["storage_provider"] == StorageProvider.MINIO.value
    assert payload["asset_type"] == MediaAssetType.SPOOF_SNAPSHOT.value
    assert payload["object_key"] == "test-events/spoof/example.svg"


def test_build_envelope_uses_contract_shape() -> None:
    envelope = build_envelope(
        event_name="unknown_event.detected",
        producer="ai_service",
        payload={"dedupe_key": "test-events:unknown"},
    )

    assert envelope["event_name"] == "unknown_event.detected"
    assert envelope["event_version"] == "1.0.0"
    assert envelope["producer"] == "ai_service"
    assert envelope["causation_id"] is None
    assert envelope["payload"]["dedupe_key"] == "test-events:unknown"


def test_make_dedupe_key_uses_test_events_prefix() -> None:
    assert make_dedupe_key("recognition").startswith("test-events:recognition:")
