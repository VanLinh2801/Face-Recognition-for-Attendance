from __future__ import annotations

import json

from .helpers import build_overlay_envelope, build_registration_validated_envelope, create_person, create_registration


def _read_non_heartbeat(ws) -> dict:
    while True:
        message = json.loads(ws.recv())
        if message.get("event_type") != "heartbeat":
            return message


def test_business_and_overlay_websocket_channels(
    api_client,
    admin_headers,
    admin_tokens,
    e2e_settings,
    publish_event,
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

    business_ws = websocket_reader(admin_tokens["access_token"], "events.business")
    overlay_ws = websocket_reader(admin_tokens["access_token"], "stream.overlay")

    publish_event(
        stream=e2e_settings.pipeline_stream,
        envelope=build_registration_validated_envelope(
            person_id=person["id"],
            registration_id=registration["id"],
            status="accepted",
        ),
    )
    business_message = _read_non_heartbeat(business_ws)
    assert business_message["channel"] == "events.business"
    assert business_message["event_type"] == "registration_input.validated"

    overlay_envelope = build_overlay_envelope()
    publish_event(stream=e2e_settings.pipeline_stream, envelope=overlay_envelope)
    overlay_message = _read_non_heartbeat(overlay_ws)
    assert overlay_message["channel"] == "stream.overlay"
    assert overlay_message["event_type"] == "frame_analysis.updated"
    assert overlay_message["payload"]["stream_id"] == "default"
