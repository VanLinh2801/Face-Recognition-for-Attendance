from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from .helpers import build_recognition_envelope, build_spoof_envelope, create_person, create_registration


def test_recognition_and_spoof_events_are_ingested_and_exposed(
    api_client,
    admin_headers,
    e2e_settings,
    publish_event,
    wait_until,
):
    person = create_person(api_client, admin_headers)
    registration_response = create_registration(
        api_client,
        admin_headers,
        person_id=person["id"],
        requested_by_person_id=person["id"],
    )
    registration = registration_response["registration"]

    recognition_dedupe_key = f"rk-{uuid4()}"
    spoof_dedupe_key = f"sk-{uuid4()}"
    spoof_notes = f"spoof-{uuid4()}"
    since = datetime.now(timezone.utc).isoformat()

    publish_event(
        stream=e2e_settings.ai_stream,
        envelope=build_recognition_envelope(
            person_id=person["id"],
            face_registration_id=registration["id"],
            dedupe_key=recognition_dedupe_key,
        ),
    )
    publish_event(
        stream=e2e_settings.pipeline_stream,
        envelope=build_spoof_envelope(dedupe_key=spoof_dedupe_key, notes=spoof_notes),
    )

    def _recognition_visible():
        response = api_client.get("/api/v1/recognition-events", headers=admin_headers)
        response.raise_for_status()
        for item in response.json()["items"]:
            if item["person_id"] == person["id"] and item["face_registration_id"] == registration["id"]:
                return item
        return None

    recognition_item = wait_until(_recognition_visible)
    assert recognition_item["event_source"] == "ai_service"

    def _spoof_visible():
        response = api_client.get("/api/v1/spoof-alert-events", headers=admin_headers)
        response.raise_for_status()
        for item in response.json()["items"]:
            if item["event_source"] == "pipeline" and item["notes"] == spoof_notes:
                return item
        return None

    spoof_item = wait_until(_spoof_visible)
    assert spoof_item["review_status"] == "new"

    def _catchup_has_both():
        response = api_client.get(
            "/api/ws/v1/realtime/catchup",
            headers=admin_headers,
            params={"channel": "events.business", "since_timestamp": since, "limit": 50},
        )
        response.raise_for_status()
        items = response.json()["items"]
        has_recognition = any(
            item["event_type"] == "recognition_event.detected"
            and item["payload"].get("person_id") == person["id"]
            and item["payload"].get("face_registration_id") == registration["id"]
            for item in items
        )
        has_spoof = any(
            item["event_type"] == "spoof_alert.detected"
            and item["payload"].get("notes") == spoof_notes
            for item in items
        )
        if has_recognition and has_spoof:
            return items
        return None

    catchup_items = wait_until(_catchup_has_both)
    event_types = {item["event_type"] for item in catchup_items}
    assert "recognition_event.detected" in event_types
    assert "spoof_alert.detected" in event_types
