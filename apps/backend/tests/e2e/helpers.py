from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

import httpx


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_person(api_client: httpx.Client, admin_headers: dict[str, str]) -> dict:
    employee_code = f"E2E-{uuid4().hex[:8].upper()}"
    response = api_client.post(
        "/api/v1/persons",
        headers=admin_headers,
        json={"employee_code": employee_code, "full_name": f"User {employee_code}"},
    )
    response.raise_for_status()
    return response.json()


def create_registration(
    api_client: httpx.Client,
    admin_headers: dict[str, str],
    *,
    person_id: str,
    requested_by_person_id: str,
) -> dict:
    response = api_client.post(
        f"/api/v1/persons/{person_id}/registrations",
        headers=admin_headers,
        json={
            "requested_by_person_id": requested_by_person_id,
            "source_media_asset": {
                "storage_provider": "minio",
                "bucket_name": "attendance",
                "object_key": f"uploads/{uuid4()}.jpg",
                "original_filename": "face.jpg",
                "mime_type": "image/jpeg",
                "file_size": 10,
                "asset_type": "registration_face",
            },
        },
    )
    response.raise_for_status()
    return response.json()


def build_envelope(event_name: str, producer: str, payload: dict) -> dict:
    return {
        "event_name": event_name,
        "event_version": "1.0.0",
        "message_id": str(uuid4()),
        "correlation_id": str(uuid4()),
        "causation_id": None,
        "producer": producer,
        "occurred_at": now_iso(),
        "payload": payload,
    }


def build_registration_validated_envelope(*, person_id: str, registration_id: str, status: str) -> dict:
    return build_envelope(
        "registration_input.validated",
        "pipeline",
        {
            "person_id": person_id,
            "registration_id": registration_id,
            "status": status,
            "validated_at": now_iso(),
            "event_source": "pipeline",
            "validation_notes": f"registration-{status}",
        },
    )


def build_registration_completed_envelope(*, person_id: str, registration_id: str) -> dict:
    return build_envelope(
        "registration_processing.completed",
        "ai_service",
        {
            "person_id": person_id,
            "registration_id": registration_id,
            "status": "indexed",
            "event_source": "ai_service",
            "embedding_model": "facenet",
            "embedding_version": "1",
        },
    )


def build_recognition_envelope(*, person_id: str, face_registration_id: str, dedupe_key: str) -> dict:
    return build_envelope(
        "recognition_event.detected",
        "ai_service",
        {
            "stream_id": "default",
            "frame_id": f"frame-{uuid4().hex[:8]}",
            "frame_sequence": 1,
            "track_id": f"track-{uuid4().hex[:8]}",
            "person_id": person_id,
            "face_registration_id": face_registration_id,
            "recognized_at": now_iso(),
            "event_direction": "entry",
            "event_source": "ai_service",
            "dedupe_key": dedupe_key,
        },
    )


def build_spoof_envelope(*, dedupe_key: str, notes: str | None = None) -> dict:
    return build_envelope(
        "spoof_alert.detected",
        "pipeline",
        {
            "stream_id": "default",
            "frame_id": f"frame-{uuid4().hex[:8]}",
            "frame_sequence": 1,
            "track_id": f"track-{uuid4().hex[:8]}",
            "detected_at": now_iso(),
            "spoof_score": 0.98,
            "severity": "high",
            "review_status": "new",
            "event_source": "pipeline",
            "dedupe_key": dedupe_key,
            "notes": notes,
        },
    )


def build_overlay_envelope() -> dict:
    return build_envelope(
        "frame_analysis.updated",
        "pipeline",
        {
            "stream_id": "default",
            "frame_id": f"frame-{uuid4().hex[:8]}",
            "frame_sequence": 1,
            "captured_at": now_iso(),
            "presentation_ts_ms": 100,
            "frame_width": 1280,
            "frame_height": 720,
            "tracks": [
                {
                    "track_id": f"track-{uuid4().hex[:8]}",
                    "bbox": {"x": 10, "y": 20, "width": 30, "height": 40},
                    "tracking_state": "tracking",
                    "analysis_status": "detected",
                    "display_label": "Face #1",
                }
            ],
        },
    )
