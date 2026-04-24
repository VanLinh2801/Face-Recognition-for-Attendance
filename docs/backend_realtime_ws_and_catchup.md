# Backend Realtime (WebSocket + Event Bus + Catch-up)

## Mục tiêu
- Đẩy dữ liệu realtime từ backend sang dashboard qua WebSocket.
- Cho phép client reconnect và lấy lại các event bị lỡ bằng cơ chế catch-up theo `since_timestamp`.
- Giữ tách lớp theo clean architecture: `application` -> `infrastructure` -> `presentation`.

## Bức tranh tổng quan
```mermaid
flowchart LR
  redisStreams[Redis Streams] --> consumer[RedisEventConsumer]
  consumer --> ingestUseCases[Ingest Use Cases]
  ingestUseCases --> postgres[(PostgreSQL)]
  ingestUseCases --> realtimeBus[RealtimeEventBus]
  realtimeBus --> wsHub[WebSocketHub]
  wsClient[Dashboard Client] -->|WS connect| wsEndpoint[WebSocket Endpoint]
  wsClient -->|GET catchup since_timestamp| catchupEndpoint[Catch-up REST API]
  catchupEndpoint --> postgres
  wsEndpoint --> wsHub
```

---

## Các thành phần chính và ý nghĩa

### 1) Realtime DTO + Channel contract
- File: `apps/backend/app/application/dtos/realtime.py`
- Vai trò:
  - Định nghĩa các kênh realtime:
    - `events.business`
    - `stream.overlay`
    - `stream.health`
  - Định nghĩa format message chuẩn `RealtimeEnvelope`.

`RealtimeEnvelope` gồm:
- `channel`: kênh nhận.
- `event_type`: loại event cụ thể.
- `occurred_at`: thời điểm event xảy ra.
- `correlation_id`: id truy vết liên luồng.
- `dedupe_key`: khóa chống trùng ở business level.
- `payload`: dữ liệu nghiệp vụ.
- `metadata`: metadata kỹ thuật (ví dụ `message_id`, `producer`).

### 2) Realtime Event Bus (abstraction + implementation)
- Interface: `apps/backend/app/application/interfaces/realtime_event_bus.py`
- Implementation: `apps/backend/app/infrastructure/realtime/event_bus.py`
- Vai trò:
  - Là lớp trung chuyển giữa use-case và websocket hub.
  - Use-case chỉ gọi `publish(envelope)` qua interface, không phụ thuộc chi tiết websocket.

### 3) WebSocket Hub
- File: `apps/backend/app/infrastructure/realtime/websocket_hub.py`
- Vai trò:
  - Quản lý danh sách client WS đang kết nối.
  - Quản lý subscribe/unsubscribe theo channel.
  - Fan-out message tới đúng client.
  - Có queue per-connection để chống nghẽn.
  - Có heartbeat và metrics runtime.

Metrics hiện có:
- `active_connections`
- `sent_messages`
- `dropped_messages`
- `disconnect_slow_client`

### 4) JWT bảo vệ kết nối WS
- File: `apps/backend/app/core/security.py`
- Vai trò:
  - Parse bearer token (header/query).
  - Verify JWT HS256 signature.
  - Validate các claim quan trọng: `iss`, `aud`, `exp`, `sub`.
  - Trả về `AuthenticatedPrincipal`.

### 5) WebSocket endpoint + Catch-up endpoint
- File: `apps/backend/app/presentation/api/v1/realtime_ws.py`
- Endpoint:
  - WS realtime: `ws /api/ws/v1/realtime`
  - REST catch-up: `GET /api/ws/v1/realtime/catchup`

---

## Input/Output chi tiết

## A. WebSocket realtime
### Input khi connect
- URL: `/api/ws/v1/realtime`
- Auth:
  - Header `Authorization: Bearer <token>` hoặc query `token=<jwt>`
- Query tùy chọn:
  - `channels=events.business,stream.overlay,...`
  - Nếu không truyền -> mặc định `events.business`.

### Input control message trong WS session
- Subscribe:
```json
{"action":"subscribe","channel":"stream.overlay"}
```
- Unsubscribe:
```json
{"action":"unsubscribe","channel":"stream.overlay"}
```

### Output từ server qua WS
- Format:
```json
{
  "channel": "events.business",
  "event_type": "recognition_event.detected",
  "occurred_at": "2026-04-24T01:02:03+00:00",
  "correlation_id": "uuid-or-null",
  "dedupe_key": "optional-key",
  "payload": {...},
  "metadata": {...}
}
```
- Heartbeat:
```json
{"event_type":"heartbeat"}
```

## B. Catch-up REST API
### Request
- `GET /api/ws/v1/realtime/catchup`
- Query params:
  - `channel` (mặc định `events.business`)
  - `since_timestamp` (bắt buộc, ISO datetime)
  - `limit` (mặc định 200, max 1000)

### Response
- Schema: `RealtimeCatchupResponse`
- Ví dụ:
```json
{
  "channel": "events.business",
  "since_timestamp": "2026-04-24T00:59:00+00:00",
  "items": [
    {
      "event_type": "spoof_alert.detected",
      "occurred_at": "2026-04-24T01:00:00+00:00",
      "correlation_id": null,
      "dedupe_key": "sk-1",
      "payload": {"id":"spoof-1"},
      "metadata": {"source":"catchup"}
    }
  ]
}
```

Lưu ý hiện tại:
- `events.business`: có dữ liệu catch-up từ DB.
- `stream.overlay`, `stream.health`: đang trả rỗng vì chưa persist lịch sử trong DB.

---

## Luồng dữ liệu chính

### 1) Luồng live realtime
1. `RedisEventConsumer` nhận event từ Redis stream.
2. Ingest use-case xử lý + ghi DB (nếu là business event).
3. Sau khi processed, backend tạo `RealtimeEnvelope`.
4. Gọi `realtime_event_bus.publish(...)`.
5. `WebSocketHub` phát message cho client subscribe đúng channel.

### 2) Luồng reconnect + catch-up
1. Client reconnect WS.
2. Client gọi `GET /api/ws/v1/realtime/catchup?since_timestamp=...`.
3. Backend query recognition/unknown/spoof theo timestamp và merge-sort tăng dần thời gian.
4. Client merge replay theo `dedupe_key`.
5. Client tiếp tục nhận live qua WS.

---

## Mapping event sources -> channel
- `recognition_event.detected` -> `events.business`
- `unknown_event.detected` -> `events.business`
- `spoof_alert.detected` -> `events.business`
- `frame_analysis.updated` -> `stream.overlay`
- `stream.health.updated` -> `stream.health`

---

## Cấu hình liên quan
- File: `apps/backend/app/core/config.py`
- Nhóm chính:
  - JWT: `JWT_ALGORITHM`, `JWT_SECRET_KEY`, `JWT_ISSUER`, `JWT_AUDIENCE`
  - WS: `WS_ENABLE`, `WS_MAX_CONNECTIONS`, `WS_QUEUE_SIZE`, `WS_HEARTBEAT_SECONDS`
  - Redis streams: `REDIS_STREAM_AI_EVENTS`, `REDIS_STREAM_PIPELINE_EVENTS`, ...

---

## Test coverage hiện có (realtime/reconnect)
- `apps/backend/tests/unit/test_security_jwt.py`
  - verify JWT success/fail.
- `apps/backend/tests/integration/test_realtime_websocket.py`
  - WS auth và fan-out cơ bản.
- `apps/backend/tests/unit/test_realtime_catchup_use_case.py`
  - catch-up sort order + channel behavior.
- `apps/backend/tests/integration/test_realtime_catchup_api.py`
  - endpoint catch-up response shape.

---

## Hạn chế hiện tại
- Catch-up cho `stream.overlay` và `stream.health` chưa có persistence replay.
- Chưa có session resume theo cursor/message_id (đang dùng `since_timestamp`).
- Logic reconnect tự động/backoff nằm phía frontend client (backend đã hỗ trợ endpoint + flow).

