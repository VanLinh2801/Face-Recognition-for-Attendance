# Tài liệu kết nối Frontend -> Backend

## 1. Mục tiêu

Tài liệu này mô tả các API và WebSocket mà frontend có thể dùng để kết nối với backend hiện tại.

Phạm vi:

- REST API
- JWT auth
- Realtime WebSocket
- Catch-up API cho realtime
- Format request/response chính

Tài liệu này bám theo code backend hiện tại trong `apps/backend/app/presentation`.

---

## 2. Base URL

Tùy môi trường chạy backend:

- Chạy local trực tiếp:
  - `http://localhost:8000`
- Chạy bằng Docker e2e stack:
  - `http://localhost:18000`

Prefix API:

- REST API: `/api/v1`
- WebSocket + catchup realtime: `/api/ws/v1`

Ví dụ:

- `GET /api/v1/auth/me`
- `WS /api/ws/v1/realtime`

---

## 3. Authentication

Backend hiện dùng Bearer token.

Header chuẩn:

```http
Authorization: Bearer <access_token>
```

Hầu hết endpoint nghiệp vụ yêu cầu auth admin.

### 3.1 Login

`POST /api/v1/auth/login`

Request:

```json
{
  "username": "admin",
  "password": "secret"
}
```

Response:

```json
{
  "access_token": "<jwt>",
  "refresh_token": "<refresh_token>",
  "token_type": "Bearer",
  "expires_in": 900
}
```

### 3.2 Refresh token

`POST /api/v1/auth/refresh`

Request:

```json
{
  "refresh_token": "<refresh_token>"
}
```

Response: giống login.

### 3.3 Logout

`POST /api/v1/auth/logout`

Request:

```json
{
  "refresh_token": "<refresh_token>"
}
```

Response:

```json
{
  "status": "ok"
}
```

### 3.4 Current user

`GET /api/v1/auth/me`

Response:

```json
{
  "id": "uuid",
  "username": "admin",
  "is_active": true,
  "last_login_at": "2026-05-06T06:22:02Z"
}
```

---

## 4. Format lỗi chung

Khi backend trả lỗi nghiệp vụ:

```json
{
  "code": "validation_error",
  "message": "employee_code already exists",
  "details": {
    "employee_code": "EMP001"
  }
}
```

Các `code` thường gặp:

- `validation_error`
- `not_found`
- `conflict`
- `internal_error`

---

## 5. Persons

### 5.1 List persons

`GET /api/v1/persons`

Query params:

- `page`: mặc định `1`
- `page_size`: mặc định `20`, max `100`
- `status`: `active | inactive | resigned`
- `from_at`
- `to_at`

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "employee_code": "EMP001",
      "full_name": "Nguyen Van A",
      "department_id": "uuid",
      "title": "Engineer",
      "email": "a@example.com",
      "phone": "0900000000",
      "status": "active",
      "joined_at": "2026-01-01",
      "notes": null,
      "created_at": "2026-05-06T06:00:00Z",
      "updated_at": "2026-05-06T06:00:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### 5.2 Create person

`POST /api/v1/persons`

Request:

```json
{
  "employee_code": "EMP001",
  "full_name": "Nguyen Van A",
  "department_id": null,
  "title": "Engineer",
  "email": "a@example.com",
  "phone": "0900000000",
  "joined_at": "2026-01-01",
  "notes": "new employee"
}
```

Response: `PersonItemResponse`

### 5.3 Get person

`GET /api/v1/persons/{person_id}`

Response: `PersonItemResponse`

### 5.4 Update person

`PATCH /api/v1/persons/{person_id}`

Request: partial update

```json
{
  "full_name": "Nguyen Van A Updated",
  "department_id": null,
  "title": "Senior Engineer",
  "email": "a2@example.com",
  "phone": "0911111111",
  "status": "active",
  "joined_at": "2026-01-01",
  "notes": "updated"
}
```

### 5.5 Delete person

`DELETE /api/v1/persons/{person_id}`

Response: `204 No Content`

### 5.6 Bulk delete persons

`POST /api/v1/persons/bulk-delete`

Request:

```json
{
  "person_ids": ["uuid-1", "uuid-2"]
}
```

Response:

```json
{
  "deleted_count": 2
}
```

---

## 6. Face registrations theo person

### 6.1 Create registration

`POST /api/v1/persons/{person_id}/registrations`

Request:

```json
{
  "requested_by_person_id": "uuid",
  "source_media_asset": {
    "storage_provider": "minio",
    "bucket_name": "attendance",
    "object_key": "registrations/raw/file.jpg",
    "original_filename": "file.jpg",
    "mime_type": "image/jpeg",
    "file_size": 123456,
    "checksum": null,
    "asset_type": "registration_face"
  },
  "notes": "register from admin panel"
}
```

Response:

```json
{
  "registration": {
    "id": "uuid",
    "person_id": "uuid",
    "source_media_asset_id": "uuid",
    "face_image_media_asset_id": null,
    "registration_status": "pending",
    "validation_notes": null,
    "embedding_model": null,
    "embedding_version": null,
    "is_active": true,
    "indexed_at": null,
    "created_at": "2026-05-06T06:00:00Z",
    "updated_at": "2026-05-06T06:00:00Z"
  },
  "stream_id": "pipeline.backend.events",
  "message_id": "uuid",
  "correlation_id": "uuid"
}
```

Ghi chú:

- Đây là endpoint frontend quan trọng cho flow đăng ký khuôn mặt.
- Sau khi tạo record DB, backend publish event sang pipeline.

### 6.2 List registrations của một person

`GET /api/v1/persons/{person_id}/registrations`

Query:

- `page`
- `page_size`

Response:

```json
{
  "items": [
    {
      "id": "uuid",
      "person_id": "uuid",
      "source_media_asset_id": "uuid",
      "face_image_media_asset_id": "uuid",
      "registration_status": "indexed",
      "validation_notes": null,
      "embedding_model": "arcface",
      "embedding_version": "v1",
      "is_active": true,
      "indexed_at": "2026-05-06T06:10:00Z",
      "created_at": "2026-05-06T06:00:00Z",
      "updated_at": "2026-05-06T06:10:00Z"
    }
  ],
  "total": 1,
  "page": 1,
  "page_size": 20
}
```

### 6.3 Get registration

`GET /api/v1/persons/{person_id}/registrations/{registration_id}`

Response: `PersonRegistrationItemResponse`

### 6.4 Delete registration

`DELETE /api/v1/persons/{person_id}/registrations/{registration_id}`

Response: `204 No Content`

### 6.5 Internal completed endpoint

`POST /api/v1/internal/registrations/events/completed`

Đây là endpoint nội bộ, không phải endpoint frontend thông thường.

Frontend không nên gọi trực tiếp endpoint này trừ khi có nhu cầu test nội bộ.

---

## 7. Departments

### 7.1 List departments

`GET /api/v1/departments`

Query:

- `page`
- `page_size`
- `is_active`

### 7.2 Create department

`POST /api/v1/departments`

Request:

```json
{
  "code": "ENG",
  "name": "Engineering",
  "parent_id": null,
  "is_active": true
}
```

### 7.3 Get department

`GET /api/v1/departments/{department_id}`

### 7.4 Update department

`PATCH /api/v1/departments/{department_id}`

### 7.5 Delete department

`DELETE /api/v1/departments/{department_id}`

Response: `204 No Content`

`DepartmentItemResponse`:

```json
{
  "id": "uuid",
  "code": "ENG",
  "name": "Engineering",
  "parent_id": null,
  "is_active": true,
  "created_at": "2026-05-06T06:00:00Z",
  "updated_at": "2026-05-06T06:00:00Z"
}
```

---

## 8. Recognition events

### 8.1 List recognition events

`GET /api/v1/recognition-events`

Query:

- `page`
- `page_size`
- `from_at`
- `to_at`

Response item:

```json
{
  "id": "uuid",
  "person_id": "uuid",
  "face_registration_id": "uuid",
  "snapshot_media_asset_id": null,
  "recognized_at": "2026-05-06T06:00:00Z",
  "event_direction": "entry",
  "match_score": 0.93,
  "spoof_score": 0.02,
  "event_source": "ai_service",
  "raw_payload": {},
  "is_valid": true,
  "invalid_reason": null,
  "created_at": "2026-05-06T06:00:00Z"
}
```

---

## 9. Unknown events

### 9.1 List unknown events

`GET /api/v1/unknown-events`

Query:

- `page`
- `page_size`
- `from_at`
- `to_at`
- `review_status`: `new | reviewed | ignored`

Response item:

```json
{
  "id": "uuid",
  "snapshot_media_asset_id": null,
  "detected_at": "2026-05-06T06:00:00Z",
  "event_direction": "entry",
  "match_score": null,
  "spoof_score": 0.01,
  "event_source": "ai_service",
  "raw_payload": {},
  "review_status": "new",
  "notes": null,
  "created_at": "2026-05-06T06:00:00Z",
  "updated_at": "2026-05-06T06:00:00Z"
}
```

---

## 10. Spoof alert events

### 10.1 List spoof alerts

`GET /api/v1/spoof-alert-events`

Query:

- `page`
- `page_size`
- `from_at`
- `to_at`
- `review_status`: `new | reviewed | ignored`

Response item:

```json
{
  "id": "uuid",
  "person_id": null,
  "snapshot_media_asset_id": null,
  "detected_at": "2026-05-06T06:00:00Z",
  "spoof_score": 0.97,
  "event_source": "pipeline",
  "raw_payload": {},
  "severity": "high",
  "review_status": "new",
  "notes": "possible spoof",
  "created_at": "2026-05-06T06:00:00Z",
  "updated_at": "2026-05-06T06:00:00Z"
}
```

---

## 11. Attendance

### 11.1 List attendance events

`GET /api/v1/attendance/events`

Query:

- `page`
- `page_size`
- `person_id`
- `from_at`
- `to_at`

Response item:

```json
{
  "id": "uuid",
  "person_id": "uuid",
  "person_full_name": "Nguyen Van A",
  "recognized_at": "2026-05-06T08:00:00Z",
  "event_direction": "entry",
  "match_score": 0.95,
  "spoof_score": 0.01,
  "event_source": "ai_service",
  "is_valid": true
}
```

### 11.2 Get one attendance event

`GET /api/v1/attendance/events/{event_id}`

### 11.3 Attendance history của một person

`GET /api/v1/attendance/persons/{person_id}/history`

### 11.4 Daily summary

`GET /api/v1/attendance/summary/daily?work_date=2026-05-06`

Response:

```json
{
  "work_date": "2026-05-06",
  "total_events": 10,
  "unique_persons": 7,
  "total_entries": 5,
  "total_exits": 5
}
```

---

## 12. Attendance exceptions

### 12.1 Create exception

`POST /api/v1/attendance-exceptions`

Request:

```json
{
  "person_id": "uuid",
  "exception_type": "business_trip",
  "start_at": "2026-05-06T08:00:00Z",
  "end_at": "2026-05-06T17:00:00Z",
  "work_date": "2026-05-06",
  "reason": "Customer meeting",
  "notes": null,
  "created_by_person_id": "uuid"
}
```

### 12.2 List exceptions

`GET /api/v1/attendance-exceptions`

Query:

- `page`
- `page_size`
- `person_id`
- `exception_type`
- `work_date_from`
- `work_date_to`

### 12.3 Get exception

`GET /api/v1/attendance-exceptions/{exception_id}`

### 12.4 Update exception

`PATCH /api/v1/attendance-exceptions/{exception_id}`

### 12.5 Delete exception

`DELETE /api/v1/attendance-exceptions/{exception_id}?deleted_by_person_id=<uuid>`

### 12.6 Bulk delete exceptions

`POST /api/v1/attendance-exceptions/bulk-delete`

Request:

```json
{
  "exception_ids": ["uuid-1", "uuid-2"],
  "deleted_by_person_id": "uuid"
}
```

---

## 13. Media assets

### 13.1 List media assets

`GET /api/v1/media-assets`

Query:

- `page`
- `page_size`
- `asset_type`
- `from_at`
- `to_at`

`asset_type` hiện có:

- `registration_face`
- `recognition_snapshot`
- `unknown_snapshot`
- `spoof_snapshot`
- `face_crop`

Response item:

```json
{
  "id": "uuid",
  "storage_provider": "minio",
  "bucket_name": "attendance",
  "object_key": "registrations/raw/file.jpg",
  "original_filename": "file.jpg",
  "mime_type": "image/jpeg",
  "file_size": 123456,
  "checksum": null,
  "asset_type": "registration_face",
  "uploaded_by_person_id": null,
  "created_at": "2026-05-06T06:00:00Z"
}
```

### 13.2 Internal cleanup endpoint

`POST /api/v1/internal/media-assets/cleanup`

Đây là endpoint nội bộ, không phải endpoint frontend thông thường.

---

## 14. Realtime WebSocket

### 14.1 Endpoint

`WS /api/ws/v1/realtime`

Query params:

- `token=<access_token>`
- `channels=<comma-separated-channels>`

Ví dụ:

```text
ws://localhost:8000/api/ws/v1/realtime?token=<access_token>&channels=events.business
```

Hoặc subscribe nhiều channel:

```text
ws://localhost:8000/api/ws/v1/realtime?token=<access_token>&channels=events.business,stream.overlay
```

Nếu không truyền `channels`, backend mặc định dùng:

- `events.business`

### 14.2 Các channel hiện có

- `events.business`
  - recognition events
  - unknown events
  - spoof alerts
  - registration completed / registration validated khi backend publish
- `stream.overlay`
  - dữ liệu overlay realtime cho frame/camera
- `stream.health`
  - trạng thái sức khỏe stream

### 14.3 Format message WebSocket

Backend gửi message dạng:

```json
{
  "channel": "events.business",
  "event_type": "recognition_event.detected",
  "occurred_at": "2026-05-06T06:00:00+00:00",
  "correlation_id": "uuid",
  "dedupe_key": "rk-123",
  "payload": {},
  "metadata": {}
}
```

Ý nghĩa field:

- `channel`: channel realtime
- `event_type`: loại event
- `occurred_at`: thời điểm event
- `correlation_id`: id để nối event cùng flow
- `dedupe_key`: key dedupe của event nếu có
- `payload`: dữ liệu chính
- `metadata`: dữ liệu phụ, ví dụ `message_id`, `producer`

### 14.4 Event types frontend nên quan tâm

Phổ biến nhất:

- `recognition_event.detected`
- `unknown_event.detected`
- `spoof_alert.detected`
- `registration_processing.completed`
- `registration_input.validated`
- `frame_analysis.updated`
- `stream.health.updated`

Lưu ý:

- `payload` của `events.business` thường là DTO tương ứng với entity backend đã lưu.
- `payload` của `stream.overlay` là payload raw overlay để vẽ bounding box / track state.

---

## 15. Realtime catch-up API

Frontend nên dùng endpoint này khi:

- reconnect WebSocket
- cần lấy lại các event bị miss trong lúc mất kết nối

### 15.1 Endpoint

`GET /api/ws/v1/realtime/catchup`

Query params:

- `channel`: mặc định `events.business`
- `since_timestamp`: bắt buộc, ISO datetime
- `limit`: mặc định `200`, max `1000`

Ví dụ:

```text
GET /api/ws/v1/realtime/catchup?channel=events.business&since_timestamp=2026-05-06T06:00:00Z&limit=100
```

Response:

```json
{
  "channel": "events.business",
  "since_timestamp": "2026-05-06T06:00:00Z",
  "items": [
    {
      "event_type": "recognition_event.detected",
      "occurred_at": "2026-05-06T06:01:00Z",
      "correlation_id": "uuid",
      "dedupe_key": "rk-123",
      "payload": {},
      "metadata": {
        "message_id": "uuid",
        "producer": "ai_service"
      }
    }
  ]
}
```

Frontend flow khuyến nghị:

1. Lưu `occurred_at` hoặc timestamp cuối đã xử lý.
2. Khi reconnect:
   - gọi `catchup`
   - render các event bị miss
   - sau đó mở lại WebSocket live

---

## 16. Gợi ý tích hợp frontend

### 16.1 Flow auth cơ bản

1. Login -> nhận `access_token`, `refresh_token`
2. Lưu access token ở memory hoặc storage phù hợp
3. Gọi API kèm header `Authorization`
4. Khi access token hết hạn:
   - gọi `/auth/refresh`
   - cập nhật token mới

### 16.2 Flow dashboard realtime

1. Login
2. Gọi `/api/ws/v1/realtime/catchup`
3. Kết nối WebSocket tới:
   - `events.business`
   - `stream.overlay`
4. Khi disconnect:
   - reconnect
   - gọi `catchup` để bù event bị miss

### 16.3 Flow đăng ký khuôn mặt

1. Frontend upload file lên MinIO hoặc thông qua service upload tương ứng
2. Frontend gọi:
   - `POST /api/v1/persons/{person_id}/registrations`
3. Frontend theo dõi:
   - `GET /api/v1/persons/{person_id}/registrations`
   - hoặc nhận realtime `registration_processing.completed`

---

## 17. Ghi chú hiện trạng

- Tài liệu này phản ánh backend hiện tại, không phải contract dự kiến tương lai.
- Một số endpoint có prefix `internal` là endpoint nội bộ; frontend bình thường không nên phụ thuộc vào chúng.
- Route `face-registrations` riêng đang chưa phải bề mặt API chính; hiện frontend nên dùng registration flow dưới `/persons/{person_id}/registrations`.
