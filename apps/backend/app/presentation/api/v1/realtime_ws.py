"""Realtime websocket endpoints."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketException, status

from app.application.dtos.realtime import RealtimeChannel
from app.application.use_cases.realtime import GetRealtimeCatchupUseCase, RealtimeCatchupQuery
from app.core.dependencies import (
    authenticate_websocket,
    get_container_from_websocket,
    get_realtime_catchup_use_case,
)
from app.core.exceptions import ValidationError
from app.presentation.schemas.realtime import RealtimeCatchupItemResponse, RealtimeCatchupResponse

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


@router.get("/realtime/catchup", response_model=RealtimeCatchupResponse)
def get_realtime_catchup(
    channel: str = Query(default="events.business"),
    since_timestamp: str = Query(...),
    limit: int = Query(default=200, ge=1, le=1000),
    use_case: GetRealtimeCatchupUseCase = Depends(get_realtime_catchup_use_case),
) -> RealtimeCatchupResponse:
    """Client reconnect flow: fetch missed events then continue live websocket stream."""
    try:
        selected_channel = RealtimeChannel(channel)
    except ValueError as exc:
        raise ValidationError("Invalid channel") from exc
    try:
        parsed_since = datetime.fromisoformat(since_timestamp.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValidationError("Invalid since_timestamp") from exc
    envelopes = use_case.execute(
        RealtimeCatchupQuery(
            channel=selected_channel,
            since_timestamp=parsed_since,
            limit=limit,
        )
    )
    return RealtimeCatchupResponse(
        channel=selected_channel.value,
        since_timestamp=parsed_since,
        items=[
            RealtimeCatchupItemResponse(
                event_type=item.event_type,
                occurred_at=item.occurred_at,
                correlation_id=item.correlation_id,
                dedupe_key=item.dedupe_key,
                payload=item.payload,
                metadata=item.metadata,
            )
            for item in envelopes
        ],
    )
