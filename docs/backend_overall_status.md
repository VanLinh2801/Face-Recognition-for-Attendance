# Backend Overall Status

## 1) Mục tiêu hệ thống backend
- Cung cấp API dữ liệu cho frontend dashboard.
- Nhận event từ `ai_service` và `pipeline` qua Redis Streams.
- Persist dữ liệu nghiệp vụ vào PostgreSQL.
- Push dữ liệu realtime tới frontend qua WebSocket.
- Hỗ trợ reconnect + catch-up để frontend không mất event.
- Hỗ trợ authentication nội bộ (admin login + access/refresh token).

---

## 2) Kiến trúc tổng thể (Clean Architecture)
Codebase đang tách theo 4 lớp chính:
- `domain`: entity và enum nghiệp vụ.
- `application`: use-cases và repository interfaces.
- `infrastructure`: ORM models, SQLAlchemy repositories, Redis/Realtime integrations.
- `presentation`: FastAPI endpoints và transport schemas.

Các thành phần nền:
- `bootstrap/container.py`: composition root + DI wiring.
- `core/config.py`: cấu hình env.
- `core/dependencies.py`: dependency providers cho API/WS.
- `main.py`: lifecycle startup/shutdown, health endpoints, middleware, exception handling.

---

## 3) API modules đã triển khai

### Persons
- CRUD person.
- Bulk delete person.
- Person registrations API (create/list/get/delete).
- Internal registration event completion endpoint.

### Recognition / Unknown / Spoof / Media
- Các read APIs phân trang + filter theo thời gian/trạng thái.

### Attendance
- Attendance events list/get.
- Person attendance history.
- Daily summary.

### Attendance Exceptions
- CRUD + bulk delete.
- Soft delete đã được hỗ trợ ở data layer.

### Auth
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

### Health
- `/health/live`
- `/health/ready`
- `/health/realtime`

---

## 4) Event ingestion và idempotency

### Inbound event flow
Backend tiêu thụ event từ Redis Streams qua consumer:
- `recognition_event.detected`
- `unknown_event.detected`
- `spoof_alert.detected`
- relay realtime:
  - `frame_analysis.updated`
  - `stream.health.updated`

### Idempotency strategy (2 lớp)
- Lớp envelope: `message_id` qua `event_inbox` table.
- Lớp business: `dedupe_key` unique trong các bảng event nghiệp vụ.

### Xử lý message
1. Parse/validate envelope.
2. Check duplicate theo `message_id`.
3. Check duplicate theo `dedupe_key`.
4. Persist business event + inbox.
5. Commit transaction.
6. Ack Redis sau commit thành công.

### Hardening chống flood business events (Case A)
- Backend áp dụng throttle cho `recognition_event.detected` (và `spoof_alert.detected` khi payload có `person_id`) để tránh ghi nhận quá nhiều event trùng lặp cho cùng 1 người.
- Cửa sổ thời gian: cấu hình `THROTTLE_BUSINESS_SECONDS` (default `30` giây).
- Khi bị throttle: không tạo bản ghi event business mới, nhưng vẫn ghi `event_inbox` với status `ignored` để giữ tính idempotency/ack flow.
- Với bối cảnh demo nhỏ (khoảng `50` person, ít camera), cách throttle hiện tại dùng query DB lấy event gần nhất theo `person_id` vẫn được xem là chấp nhận được. Nếu quy mô tăng lên, cần cân nhắc tối ưu thêm bằng composite index, cache hoặc Redis-based throttle.

---

## 5) Realtime subsystem

### Kênh realtime
- `events.business`
- `stream.overlay`
- `stream.health`

### Thành phần chính
- `RealtimeEnvelope` + `RealtimeChannel` contracts (application DTOs).
- `RealtimeEventBus` interface.
- `HubRealtimeEventBus` implementation.
- `WebSocketHub`:
  - quản lý kết nối WS,
  - subscribe/unsubscribe channel,
  - per-connection queue,
  - heartbeat,
  - backpressure disconnect cho slow client.

### Endpoint
- WS realtime: `ws /api/ws/v1/realtime`

---

## 6) Reconnect + catch-up

### Mục tiêu
Cho phép client reconnect và lấy lại event bị lỡ trước khi tiếp tục live stream.

### Endpoint
- `GET /api/ws/v1/realtime/catchup`
  - params:
    - `channel`
    - `since_timestamp`
    - `limit`

### Trạng thái hiện tại
- `events.business`: có replay từ DB (recognition/unknown/spoof).
- `stream.overlay` và `stream.health`: chưa có persistence replay (trả rỗng).

---

## 7) Authentication và token lifecycle

### Data model auth
- `users` table:
  - `id`, `username`, `password_hash`, `is_active`, `last_login_at`, timestamps.
- `auth_refresh_tokens` table:
  - `id`, `user_id`, `token_hash`, `expires_at`, `revoked_at`, `created_at`, `last_used_at`.

### Security primitives
- Password hash/verify: `bcrypt`.
- Access token: JWT HS256.
- Refresh token: opaque token (lưu hash sha256 trong DB).
- JWT checks: `iss`, `aud`, `exp`, `sub`.

### Admin bootstrap
- Script seed admin: `apps/backend/scripts/seed_admin.py`.
- Optional auto-seed lúc startup nếu set env `AUTH_SEED_ADMIN_USERNAME/PASSWORD`.

### Phạm vi bảo vệ JWT hiện tại
- JWT đã được dùng đầy đủ cho nhóm auth lifecycle (`/auth/me`), WebSocket realtime và các API `departments` mới thêm.
- Nhiều API backend khác (persons, attendance, recognition/unknown/spoof/media, registrations...) hiện chưa được bảo vệ JWT hoàn toàn và vẫn là một hạng mục cần hoàn thiện thêm.

---

## 8) Cấu hình quan trọng

### Redis / consumer
- `REDIS_URL`
- `REDIS_STREAM_AI_EVENTS`
- `REDIS_STREAM_PIPELINE_EVENTS`
- `REDIS_CONSUMER_GROUP`
- `REDIS_CONSUMER_NAME`

### Realtime WS
- `WS_ENABLE`
- `WS_MAX_CONNECTIONS`
- `WS_QUEUE_SIZE`
- `WS_HEARTBEAT_SECONDS`

### JWT / Auth
- `JWT_ALGORITHM`
- `JWT_SECRET_KEY`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_ACCESS_EXPIRES_SECONDS`
- `JWT_REFRESH_EXPIRES_SECONDS`
- `AUTH_BCRYPT_ROUNDS`
- `AUTH_SEED_ADMIN_USERNAME`
- `AUTH_SEED_ADMIN_PASSWORD`

---

## 9) Testing status
Đã có test unit/integration cho các mảng chính:
- Core/container/uow/config.
- CRUD/use-cases cho persons, registrations, attendance, exceptions.
- Redis consumer + event ingestion.
- Realtime websocket flow.
- Catch-up API/use-case.
- Auth security services + auth use-cases + auth API lifecycle.
- Smoke test app startup/health.

Kết quả gần nhất: các batch test auth + realtime + smoke đều pass.

---

## 10) Tài liệu liên quan
- `docs/backend_clean_architecture_roadmap.md`
- `docs/backend_realtime_ws_and_catchup.md`
- `docs/backend_authentication_and_tokens.md`

---

## 11) Các điểm còn thiếu / hướng nâng cấp tiếp
- Refresh token rotation (mỗi lần refresh cấp token mới + revoke token cũ).
- Replay cho `stream.overlay` và `stream.health` nếu cần đầy đủ reconnect cho mọi channel.
- Chưa triển khai xử lý unindex vector DB khi xóa/sửa `FaceRegistration` (mặc định backend hiện mới soft-deactivate trong Postgres). Tạm gác việc này và chờ khi AI được xử lý xong / xác định phương án mapping point-id <-> registration-id để triển khai hướng phù hợp.
- Hardening production:
  - stricter secret management,
  - observability sâu hơn (metrics export/alerts),
  - rate-limit auth endpoints,
  - audit logs chi tiết.

