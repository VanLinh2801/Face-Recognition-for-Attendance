"""Realtime event bus abstraction."""

from __future__ import annotations

from typing import Protocol

from app.application.dtos.realtime import RealtimeEnvelope


class RealtimeEventBus(Protocol):
    async def publish(self, envelope: RealtimeEnvelope) -> None: ...
