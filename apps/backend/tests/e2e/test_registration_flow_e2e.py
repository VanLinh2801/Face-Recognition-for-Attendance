from __future__ import annotations

import json

from .helpers import (
    build_registration_completed_envelope,
    build_registration_validated_envelope,
    create_person,
    create_registration,
)


def test_registration_flow_via_redis_and_websocket(
    api_client,
    admin_headers,
    admin_tokens,
    e2e_settings,
    publish_event,
    wait_until,
    websocket_reader,
):
    person = create_person(api_client, admin_headers)
    registration_response = create_registration(
        api_client,
        admin_headers,
        person_id=person["id"],
        requested_by_person_id=person["id"],
    )
    registration = registration_response["registration"]

    ws = websocket_reader(admin_tokens["access_token"], "events.business")
    publish_event(
        stream=e2e_settings.pipeline_stream,
        envelope=build_registration_validated_envelope(
            person_id=person["id"],
            registration_id=registration["id"],
            status="accepted",
        ),
    )
    validated_message = json.loads(ws.recv())
    assert validated_message["event_type"] == "registration_input.validated"
    assert validated_message["payload"]["registration_id"] == registration["id"]
    assert validated_message["payload"]["status"] == "accepted"

    publish_event(
        stream=e2e_settings.ai_stream,
        envelope=build_registration_completed_envelope(
            person_id=person["id"],
            registration_id=registration["id"],
        ),
    )
    completed_message = json.loads(ws.recv())
    assert completed_message["event_type"] == "registration_processing.completed"
    assert completed_message["payload"]["id"] == registration["id"]
    assert completed_message["payload"]["registration_status"] == "indexed"

    def _registration_is_indexed():
        response = api_client.get(
            f"/api/v1/persons/{person['id']}/registrations/{registration['id']}",
            headers=admin_headers,
        )
        response.raise_for_status()
        payload = response.json()
        if payload["registration_status"] != "indexed":
            return None
        return payload

    persisted = wait_until(_registration_is_indexed)
    assert persisted["id"] == registration["id"]
