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

---

## 🚀 Quick Start (Docker)

Để chạy dự án trên máy mới, hãy làm theo các bước sau:

### 1. Chuẩn bị biến môi trường (Environment Variables)
Vì các file cấu hình `.env` không được đẩy lên Git vì lý do bảo mật, bạn cần tạo chúng từ file mẫu:

```bash
# Tại thư mục gốc của dự án
cp .env.example .env.app
```
*Sau đó, bạn có thể mở file `.env.app` để chỉnh sửa các thông số như Cổng (Ports), User/Password nếu cần.*

### 2. Khởi động hệ thống với Docker
Đảm bảo bạn đã cài đặt **Docker** và **Docker Compose**. Chạy lệnh sau:

```bash
docker compose --env-file .env.app up --build -d
```

### 3. Khởi tạo dữ liệu ban đầu
Sau khi các container đã chạy, bạn cần khởi tạo Consumer Groups cho Redis (chỉ cần chạy một lần):

```bash
# Tạo group cho Backend
docker compose exec redis redis-cli XGROUP CREATE ai_backend backend-consumers $ MKSTREAM

# Tạo group cho AI Service
docker compose exec redis redis-cli XGROUP CREATE pipeline_ai ai-consumers $ MKSTREAM
```

### 4. Truy cập hệ thống
- **Frontend Dashboard**: [http://localhost:3000](http://localhost:3000)
- **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **MinIO Console**: [http://localhost:9001](http://localhost:9001)
- **Qdrant Dashboard**: [http://localhost:6333/dashboard](http://localhost:6333/dashboard)

