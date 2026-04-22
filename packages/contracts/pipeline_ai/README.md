# Pipeline To AI Contracts

Active contracts published by pipeline and consumed by AI service.

- `stream_task.v1.schema.json`
- `recognition_requested.v1.schema.json` (legacy reference)
- `registration_requested.v1.schema.json` (legacy reference)

## Current Redis Stream transport

Stream key:

- `stream:vision:frames_to_process`

Value format:

- Redis field `data` stores a JSON payload
- Every payload must include `task_type`

### `ACCESS`

```json
{
  "task_type": "ACCESS",
  "event_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
  "camera_id": "CAM_GATE_01",
  "image_url": "http://minio-server:9000/access-logs/2026/04/17/cam_01.jpg",
  "timestamp": "2026-04-17T08:53:57Z"
}
```

### `ONBOARDING`

```json
{
  "task_type": "ONBOARDING",
  "event_id": "f7f4eb75-88f9-4a8d-9fe4-9038d2fd5a0f",
  "employee_code": "NV_001",
  "image_url": "http://minio-server:9000/onboarding/nv001_raw.jpg",
  "timestamp": "2026-04-18T10:00:00Z"
}
```

Notes:

- `event_id` is recommended for correlation and idempotency.
- `image_url` points to a MinIO object or another reachable object URL.
- Legacy envelope-based contracts are kept in this folder only as field naming references.
