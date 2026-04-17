# Face Recognition Attendance

Monorepo scaffold for a camera-based attendance system with four app boundaries:

- `frontend`: user-facing dashboard
- `backend`: business logic and PostgreSQL owner
- `ai_service`: face recognition and Qdrant owner
- `pipeline`: camera ingestion and realtime event pipeline

## Repo layout

- `apps/`: application services with minimal bootstrap only
- `packages/contracts/`: shared API schemas between services
- `packages/common/`: shared technical utilities only
- `packages/clients/`: reusable HTTP/storage clients
- `infra/`: local infrastructure config
- `tests_shared/fixtures/`: shared payloads, images, videos for testing
- `tools/mock_*`: mock services for independent development

## Development principle

Work contract-first:

1. Define request/response schemas in `packages/contracts/`
2. Build mocks in `tools/`
3. Implement each service independently
4. Integrate after contracts are stable

## Folder ownership rule

This repo does not predefine the internal folder structure of `backend`, `ai_service`, or `pipeline`.

Only the following are fixed up front:

- app boundaries in `apps/`
- shared contracts in `packages/contracts/`
- local infrastructure in `infra/`
- shared fixtures and mocks for independent testing

Each owner can organize internal folders inside their service when the implementation becomes clear.
