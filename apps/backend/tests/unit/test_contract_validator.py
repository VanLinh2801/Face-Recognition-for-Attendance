from __future__ import annotations

from copy import deepcopy
from uuid import uuid4

import pytest

from app.core.exceptions import ValidationError
from app.infrastructure.integrations.contract_validator import ContractValidator


def _base_envelope(event_name: str, producer: str, payload: dict) -> dict:
    return {
        "event_name": event_name,
        "event_version": "1.0.0",
        "message_id": str(uuid4()),
        "correlation_id": str(uuid4()),
        "causation_id": None,
        "producer": producer,
        "occurred_at": "2026-05-06T00:00:00Z",
        "payload": payload,
    }


def _event_envelopes() -> dict[str, dict]:
    recognition_person_id = str(uuid4())
    recognition_registration_id = str(uuid4())
    registration_person_id = str(uuid4())
    registration_id = str(uuid4())
    return {
        "recognition_event.detected": _base_envelope(
            "recognition_event.detected",
            "ai_service",
            {
                "stream_id": "default",
                "frame_id": "frame-1",
                "frame_sequence": 1,
                "track_id": "track-1",
                "person_id": recognition_person_id,
                "face_registration_id": recognition_registration_id,
                "recognized_at": "2026-05-06T00:00:00Z",
                "event_direction": "entry",
                "event_source": "ai_service",
                "dedupe_key": "dedupe-1",
            },
        ),
        "unknown_event.detected": _base_envelope(
            "unknown_event.detected",
            "ai_service",
            {
                "stream_id": "default",
                "frame_id": "frame-2",
                "frame_sequence": 2,
                "track_id": "track-2",
                "detected_at": "2026-05-06T00:00:00Z",
                "event_direction": "unknown",
                "event_source": "ai_service",
                "dedupe_key": "dedupe-2",
                "review_status": "new",
            },
        ),
        "spoof_alert.detected": _base_envelope(
            "spoof_alert.detected",
            "pipeline",
            {
                "stream_id": "default",
                "frame_id": "frame-3",
                "frame_sequence": 3,
                "track_id": "track-3",
                "detected_at": "2026-05-06T00:00:00Z",
                "spoof_score": 0.99,
                "severity": "high",
                "review_status": "new",
                "event_source": "pipeline",
                "dedupe_key": "dedupe-3",
            },
        ),
        "frame_analysis.updated": _base_envelope(
            "frame_analysis.updated",
            "pipeline",
            {
                "stream_id": "default",
                "frame_id": "frame-4",
                "frame_sequence": 4,
                "captured_at": "2026-05-06T00:00:00Z",
                "presentation_ts_ms": 120,
                "frame_width": 1280,
                "frame_height": 720,
                "tracks": [
                    {
                        "track_id": "track-4",
                        "bbox": {"x": 10, "y": 20, "width": 30, "height": 40},
                        "tracking_state": "tracking",
                        "analysis_status": "detected",
                        "display_label": "Face #1",
                    }
                ],
            },
        ),
        "registration_processing.completed": _base_envelope(
            "registration_processing.completed",
            "ai_service",
            {
                "person_id": registration_person_id,
                "registration_id": registration_id,
                "status": "indexed",
                "event_source": "ai_service",
            },
        ),
        "registration_input.validated": _base_envelope(
            "registration_input.validated",
            "pipeline",
            {
                "person_id": registration_person_id,
                "registration_id": registration_id,
                "status": "accepted",
                "validated_at": "2026-05-06T00:00:00Z",
                "event_source": "pipeline",
            },
        ),
    }


@pytest.mark.parametrize("event_name", list(_event_envelopes().keys()))
def test_contract_validator_accepts_all_supported_events(event_name: str) -> None:
    validator = ContractValidator()
    validator.validate(deepcopy(_event_envelopes()[event_name]))


@pytest.mark.parametrize(
    ("event_name", "bad_producer"),
    [
        ("recognition_event.detected", "pipeline"),
        ("unknown_event.detected", "pipeline"),
        ("spoof_alert.detected", "ai_service"),
        ("frame_analysis.updated", "ai_service"),
        ("registration_processing.completed", "pipeline"),
        ("registration_input.validated", "ai_service"),
    ],
)
def test_contract_validator_rejects_wrong_producer(event_name: str, bad_producer: str) -> None:
    validator = ContractValidator()
    envelope = deepcopy(_event_envelopes()[event_name])
    envelope["producer"] = bad_producer

    with pytest.raises(ValidationError):
        validator.validate(envelope)


@pytest.mark.parametrize(
    ("event_name", "payload_key"),
    [
        ("recognition_event.detected", "dedupe_key"),
        ("unknown_event.detected", "review_status"),
        ("spoof_alert.detected", "spoof_score"),
        ("frame_analysis.updated", "tracks"),
        ("registration_processing.completed", "status"),
        ("registration_input.validated", "validated_at"),
    ],
)
def test_contract_validator_rejects_missing_required_payload_field(event_name: str, payload_key: str) -> None:
    validator = ContractValidator()
    envelope = deepcopy(_event_envelopes()[event_name])
    del envelope["payload"][payload_key]

    with pytest.raises(ValidationError):
        validator.validate(envelope)


def test_contract_validator_allows_stream_health_passthrough() -> None:
    validator = ContractValidator()
    validator.validate(
        {
            "event_name": "stream.health.updated",
            "event_version": "1.0.0",
            "message_id": "not-used",
            "correlation_id": "not-used",
            "producer": "pipeline",
            "occurred_at": "2026-05-06T00:00:00Z",
            "payload": {"status": "ok"},
        }
    )
