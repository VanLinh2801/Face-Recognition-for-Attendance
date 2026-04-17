# Contracts

Keep inter-service request and response schemas here.

- `pipeline_ai/`: pipeline -> AI inference contracts
- `pipeline_backend/`: pipeline -> backend event contracts
- `backend_ai/`: backend -> AI indexing contracts

These files should be the first artifacts created before implementation.

The team aligns on contracts first, while each service keeps freedom to choose its own internal folder structure.
