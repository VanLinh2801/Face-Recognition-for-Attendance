"""In-memory websocket hub for realtime fan-out."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from dataclasses import dataclass, field
from uuid import uuid4

from fastapi import WebSocket, WebSocketDisconnect

from app.application.dtos.realtime import RealtimeChannel, RealtimeEnvelope
from app.core.config import Settings
from app.core.security import AuthenticatedPrincipal

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class RealtimeMetrics:
    active_connections: int = 0
    sent_messages: int = 0
    dropped_messages: int = 0
    disconnect_slow_client: int = 0


@dataclass(slots=True)
class _Connection:
    id: str
    websocket: WebSocket
    principal: AuthenticatedPrincipal
    subscriptions: set[RealtimeChannel]
    queue: asyncio.Queue[dict] = field(default_factory=asyncio.Queue)
    sender_task: asyncio.Task[None] | None = None
    heartbeat_task: asyncio.Task[None] | None = None


class WebSocketHub:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._connections: dict[str, _Connection] = {}
        self._lock = asyncio.Lock()
        self._metrics = RealtimeMetrics()

    @property
    def metrics(self) -> RealtimeMetrics:
        return self._metrics

    async def handle_client(
        self,
        websocket: WebSocket,
        principal: AuthenticatedPrincipal,
        channels: set[RealtimeChannel],
    ) -> None:
        await websocket.accept()
        async with self._lock:
            if len(self._connections) >= self._settings.ws_max_connections:
                await websocket.close(code=1013, reason="server overloaded")
                return
            conn = _Connection(
                id=str(uuid4()),
                websocket=websocket,
                principal=principal,
                subscriptions=channels or {RealtimeChannel.EVENTS_BUSINESS},
                queue=asyncio.Queue(maxsize=self._settings.ws_queue_size),
            )
            self._connections[conn.id] = conn
            self._metrics.active_connections = len(self._connections)
        logger.info("ws connected client_id=%s subject=%s", conn.id, principal.subject)

        conn.sender_task = asyncio.create_task(self._sender_loop(conn))
        conn.heartbeat_task = asyncio.create_task(self._heartbeat_loop(conn))
        try:
            await self._receiver_loop(conn)
        except WebSocketDisconnect:
            pass
        finally:
            await self._disconnect(conn.id, "disconnect")

    async def publish(self, envelope: RealtimeEnvelope) -> None:
        message = envelope.to_message()
        dead_connections: list[str] = []
        async with self._lock:
            targets = list(self._connections.values())
        for conn in targets:
            if envelope.channel not in conn.subscriptions:
                continue
            try:
                conn.queue.put_nowait(message)
            except asyncio.QueueFull:
                dead_connections.append(conn.id)
                self._metrics.dropped_messages += 1
                self._metrics.disconnect_slow_client += 1
        for conn_id in dead_connections:
            await self._disconnect(conn_id, "slow client")

    async def _sender_loop(self, conn: _Connection) -> None:
        while True:
            message = await conn.queue.get()
            await conn.websocket.send_json(message)
            self._metrics.sent_messages += 1

    async def _receiver_loop(self, conn: _Connection) -> None:
        while True:
            packet = await conn.websocket.receive_json()
            action = packet.get("action")
            channel = packet.get("channel")
            if not isinstance(channel, str):
                continue
            try:
                enum_channel = RealtimeChannel(channel)
            except ValueError:
                continue
            if action == "subscribe":
                conn.subscriptions.add(enum_channel)
            elif action == "unsubscribe":
                conn.subscriptions.discard(enum_channel)

    async def _heartbeat_loop(self, conn: _Connection) -> None:
        while True:
            await asyncio.sleep(self._settings.ws_heartbeat_seconds)
            await conn.websocket.send_json({"event_type": "heartbeat"})

    async def _disconnect(self, connection_id: str, reason: str) -> None:
        async with self._lock:
            conn = self._connections.pop(connection_id, None)
            self._metrics.active_connections = len(self._connections)
        if conn is None:
            return
        if conn.sender_task is not None:
            conn.sender_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await conn.sender_task
        if conn.heartbeat_task is not None:
            conn.heartbeat_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await conn.heartbeat_task
        with contextlib.suppress(Exception):
            await conn.websocket.close()
        logger.info("ws disconnected client_id=%s reason=%s", connection_id, reason)
