"""Realtime event bus implementation."""

from __future__ import annotations

from app.application.dtos.realtime import RealtimeEnvelope
from app.application.interfaces.realtime_event_bus import RealtimeEventBus
from app.infrastructure.realtime.websocket_hub import WebSocketHub


class HubRealtimeEventBus(RealtimeEventBus):
    def __init__(self, hub: WebSocketHub) -> None:
        self._hub = hub

    async def publish(self, envelope: RealtimeEnvelope) -> None:
        await self._hub.publish(envelope)
