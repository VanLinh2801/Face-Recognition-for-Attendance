# Contracts

Keep inter-service request and response schemas here.

- `common/`: shared schemas reused by all message types
- `backend_pipeline/`: backend -> pipeline commands
- `pipeline_ai/`: pipeline -> AI commands for realtime recognition and registration input handoff
- `ai_backend/`: AI -> backend realtime visualization and business events
- `pipeline_backend/`: no active contracts; kept only as a marker that this path is no longer used

These files should be the first artifacts created before implementation.

The team aligns on contracts first, while each service keeps freedom to choose its own internal folder structure.

Active phase 1 contracts after the boundary change:

- `registration.requested`
- `recognition.requested`
- `frame_analysis.updated`
- `recognition_event.detected`
- `unknown_event.detected`
- `spoof_alert.detected`
- `registration_processing.completed`

Realtime recognition path:

1. `pipeline` publishes frame-level request to `pipeline_ai/recognition_requested.v1.schema.json`
2. `ai_service` publishes realtime overlay event to `ai_backend/frame_analysis.updated.v1.schema.json`
3. `ai_service` publishes business events to `ai_backend/*detected.v1.schema.json`
4. `backend` persists business events and forwards realtime overlay data to frontend

Registration path:

1. `backend` publishes `backend_pipeline/registration_requested.v1.schema.json`
2. `pipeline` publishes `pipeline_ai/registration_requested.v1.schema.json`
3. `ai_service` publishes `ai_backend/registration_processing_completed.v1.schema.json`
4. `backend` updates registration state in PostgreSQL
