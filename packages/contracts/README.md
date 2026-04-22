# Contracts

Keep inter-service request and response schemas here.

- `common/`: shared schemas reused by all message types
- `backend_pipeline/`: backend -> pipeline commands
- `pipeline_ai/`: pipeline -> AI commands for realtime recognition and onboarding handoff
- `ai_backend/`: AI -> backend stream results and legacy event references
- `pipeline_backend/`: legacy marker only

Current sprint note:

- Transport between `pipeline -> ai_service -> backend` uses Redis Streams.
- Stream payloads are flat JSON with a required `task_type`.
- Legacy envelope-based schemas are still kept as naming references for future normalization.

Realtime path for the current implementation:

1. `pipeline` publishes a Redis Stream task described in `pipeline_ai/stream_task.v1.schema.json`
2. `ai_service` consumes it, runs ACCESS/ONBOARDING logic, then publishes a result described in `ai_backend/stream_result.v1.schema.json`
3. `backend` consumes the result, applies debounce, persists to PostgreSQL, and forwards realtime data to frontend
