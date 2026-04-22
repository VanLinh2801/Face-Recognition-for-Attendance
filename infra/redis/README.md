# Redis

Redis is used as the current demo transport layer between:

- `pipeline -> ai_service` via `stream:vision:frames_to_process`
- `ai_service -> backend` via `stream:vision:access_events`

Recommended consumer groups:

- `ai_service_group`
- `backend_group`

Recommended debounce key format at backend:

- `log:{camera_id}:{qdrant_vector_id}`

Recommended TTL:

- `10` seconds
