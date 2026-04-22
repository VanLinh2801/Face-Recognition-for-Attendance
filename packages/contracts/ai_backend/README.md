# AI To Backend Contracts

Active contracts published by AI service and consumed by backend.

- `stream_result.v1.schema.json`
- `frame_analysis.updated.v1.schema.json` (legacy reference)
- `recognition_event_detected.v1.schema.json` (legacy reference)
- `unknown_event_detected.v1.schema.json` (legacy reference)
- `spoof_alert_detected.v1.schema.json` (legacy reference)
- `registration_processing_completed.v1.schema.json` (legacy reference)

## Current Redis Stream transport

Stream key:

- `stream:vision:access_events`

Value format:

- Redis field `data` stores a JSON payload
- Every payload must include `task_type`

### `ACCESS_RESULT`

```json
{
  "task_type": "ACCESS_RESULT",
  "event_id": "a1b2c3d4-e5f6-7890-1234-56789abcdef0",
  "camera_id": "CAM_GATE_01",
  "timestamp": "2026-04-17T08:53:57Z",
  "image_url": "http://minio-server:9000/access-logs/2026/04/17/cam_01.jpg",
  "status": "SUCCESS",
  "qdrant_vector_id": "uuid-cua-vector-trong-qdrant",
  "is_new_vector": false,
  "confidence_score": 0.985,
  "bounding_box": {
    "x": 450,
    "y": 200,
    "width": 150,
    "height": 180
  },
  "frame_resolution": {
    "width": 1920,
    "height": 1080
  },
  "message": "Matched existing vector in Qdrant",
  "matched_label": "EMPLOYEE_CANDIDATE"
}
```

Allowed `status` values:

- `SUCCESS`
- `NO_FACE`
- `MULTIPLE_FACES`
- `LOW_QUALITY`
- `ERROR`

### `ONBOARDING_RESULT`

```json
{
  "task_type": "ONBOARDING_RESULT",
  "employee_code": "NV_001",
  "qdrant_vector_id": "new-uuid-from-qdrant",
  "status": "SUCCESS",
  "message": "Vector extracted and saved to Qdrant"
}
```

Notes:

- `ACCESS_RESULT` is the only stream shape Backend needs for debounce and persistence in v1.
- Legacy schemas remain here as references while the team converges on a single transport style.
