"""Realtime websocket endpoints."""

from __future__ import annotations

from fastapi import APIRouter, WebSocket, WebSocketException, status

from app.application.dtos.realtime import RealtimeChannel
from app.core.dependencies import authenticate_websocket, get_container_from_websocket
from app.core.exceptions import ValidationError

router = APIRouter(prefix="/ws/v1", tags=["realtime-ws"])


def _parse_channels(raw_channels: str | None) -> set[RealtimeChannel]:
    if raw_channels is None or not raw_channels.strip():
        return {RealtimeChannel.EVENTS_BUSINESS}
    channels: set[RealtimeChannel] = set()
    for raw in raw_channels.split(","):
        value = raw.strip()
        if not value:
            continue
        channels.add(RealtimeChannel(value))
    return channels


@router.websocket("/realtime")
async def realtime_events(websocket: WebSocket) -> None:
    container = get_container_from_websocket(websocket)
    try:
        principal = authenticate_websocket(websocket, container)
        channels = _parse_channels(websocket.query_params.get("channels"))
    except (ValidationError, ValueError) as exc:
        raise WebSocketException(code=status.WS_1008_POLICY_VIOLATION, reason=str(exc)) from exc
    await container.websocket_hub.handle_client(websocket, principal, channels)
