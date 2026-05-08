# Face Registration Pipeline

Tài liệu này mô tả luồng đăng ký khuôn mặt nhân viên mới sau khi bổ sung registration path cho pipeline.

## Mục tiêu

Luồng đăng ký phải giữ đúng trách nhiệm của từng service:

- Backend quản lý API, database state, Redis event orchestration và realtime update.
- Pipeline xử lý ảnh nguồn: download, decode, detect face, validate, crop, upload face crop.
- AI Service chỉ xử lý ảnh mặt đã được pipeline chuẩn bị: download face crop, extract embedding, upsert vector store.

AI Service không crop từ ảnh gốc. Backend cũng không crop ảnh.

## Luồng Tổng Thể

```text
Frontend/Admin
  -> Backend API
  -> Redis stream: pipeline_backend
  -> Pipeline
  -> Redis stream: pipeline.backend.events
  -> Backend updates registration to validated/failed
  -> Redis stream: pipeline_ai
  -> AI Service
  -> Redis stream: ai_backend
  -> Backend updates registration to indexed/failed
```

## 1. Backend -> Pipeline

Backend nhận request tạo registration qua:

```text
POST /api/v1/persons/{person_id}/registrations
POST /api/v1/persons/{person_id}/registrations/upload
```

`/{person_id}/registrations` là endpoint JSON cho trường hợp ảnh nguồn đã có sẵn trong MinIO và client gửi `source_media_asset`.

`/{person_id}/registrations/upload` là endpoint multipart cho UI admin. Frontend gửi file ảnh thật, backend upload ảnh vào MinIO trước, sau đó tạo registration và publish event. Form data:

```text
file: image/jpeg | image/png
requested_by_person_id: UUID
bucket_name: optional, default MINIO_BUCKET
notes: optional
```

Backend tự sinh object key:

```text
registrations/raw/{person_id}/{timestamp}-{uuid}-{filename}
```

Sau khi có ảnh nguồn trong MinIO, backend tạo:

- `media_assets` cho ảnh nguồn.
- `person_face_registrations` với `registration_status = pending`.

Sau đó backend publish:

```text
stream: pipeline_backend
event: registration.requested
producer: backend
contract: packages/contracts/backend_pipeline/registration_requested.v1.schema.json
```

Payload chính:

```json
{
  "person_id": "...",
  "registration_id": "...",
  "requested_by_person_id": "...",
  "source_media_asset": {
    "storage_provider": "minio",
    "bucket_name": "...",
    "object_key": "uploads/source.jpg",
    "original_filename": "source.jpg",
    "mime_type": "image/jpeg",
    "file_size": 123,
    "asset_type": "registration_face"
  },
  "notes": null
}
```

## 2. Pipeline `handle_registration`

File chính:

```text
apps/pipeline/app/services/pipeline_service.py
```

Worker đã có sẵn route:

```text
apps/pipeline/app/workers/redis_worker.py
```

Khi nhận `registration.requested`, pipeline gọi:

```python
await pipeline_service.handle_registration(envelope)
```

Các bước trong `handle_registration`:

1. Lấy `person_id`, `registration_id`, `source_media_asset`.
2. Download ảnh nguồn từ MinIO bằng `source_media_asset.bucket_name` và `source_media_asset.object_key`.
3. Decode image bytes sang frame OpenCV.
4. Chạy SCRFD detector.
5. Validate số lượng face:
   - `0 face` -> reject với `NO_FACE`.
   - `>1 face` -> reject với `MULTIPLE_FACES`.
   - `1 face` -> tiếp tục.
6. Dùng `FaceCropper` để crop và resize face crop.
7. Upload crop lên MinIO dưới prefix:

```text
registration_faces/{person_id}/{registration_id}_{timestamp}.jpg
```

8. Build `face_media_asset` cho ảnh crop.
9. Publish validation result về backend.
10. Nếu accepted, publish request sang AI Service.

Các failure code hiện có:

- `IMAGE_DOWNLOAD_FAILED`
- `IMAGE_DECODE_FAILED`
- `NO_FACE`
- `MULTIPLE_FACES`
- `CROP_FAILED`
- `UPLOAD_FAILED`
- `PROCESSING_ERROR`

## 3. Pipeline -> Backend Validation Event

Pipeline publish event báo kết quả chuẩn bị ảnh:

```text
stream: pipeline.backend.events
event: registration_input.validated
producer: pipeline
contract: packages/contracts/pipeline_backend/registration_input_validated.v1.schema.json
```

Stream này được cấu hình trong:

```text
apps/pipeline/app/core/config.py
STREAM_PIPELINE_EVENTS = "pipeline.backend.events"
```

Accepted payload:

```json
{
  "person_id": "...",
  "registration_id": "...",
  "status": "accepted",
  "validated_at": "...",
  "event_source": "pipeline",
  "failure_code": null,
  "failure_message": null,
  "source_media_asset_id": "...",
  "prepared_face_media_asset": {
    "storage_provider": "minio",
    "bucket_name": "...",
    "object_key": "registration_faces/...",
    "original_filename": "registration_....jpg",
    "mime_type": "image/jpeg",
    "file_size": 123,
    "checksum": "...",
    "asset_type": "registration_face"
  },
  "quality_status": "passed",
  "validation_notes": null,
  "pipeline_metadata": {
    "bbox": [1.0, 2.0, 3.0, 4.0],
    "detection_confidence": 0.99,
    "crop_scale": 2.7,
    "detector": "scrfd"
  }
}
```

Rejected payload giống cấu trúc trên nhưng:

```json
{
  "status": "rejected",
  "prepared_face_media_asset": null,
  "quality_status": null,
  "failure_code": "NO_FACE",
  "failure_message": "No face detected in registration image"
}
```

Backend xử lý event này tại:

```text
apps/backend/app/infrastructure/integrations/event_handlers.py
handle_registration_input_validated
```

State backend:

- `accepted` -> `registration_status = validated`
- `rejected` -> `registration_status = failed`

Nếu `prepared_face_media_asset` tồn tại, backend lưu media asset đó và gắn vào registration.

## 4. Pipeline -> AI Service

Chỉ khi validation accepted, pipeline publish:

```text
stream: pipeline_ai
event: registration.requested
producer: pipeline
contract: packages/contracts/pipeline_ai/registration_requested.v1.schema.json
```

Payload quan trọng là `face_media_asset`, không phải `source_media_asset`:

```json
{
  "person_id": "...",
  "registration_id": "...",
  "face_media_asset": {
    "storage_provider": "minio",
    "bucket_name": "...",
    "object_key": "registration_faces/...",
    "original_filename": "registration_....jpg",
    "mime_type": "image/jpeg",
    "file_size": 123,
    "checksum": "...",
    "asset_type": "registration_face"
  },
  "source_media_asset_id": "...",
  "quality_status": "passed",
  "captured_at": "...",
  "pipeline_metadata": {
    "bbox": [1.0, 2.0, 3.0, 4.0],
    "detection_confidence": 0.99,
    "crop_scale": 2.7,
    "detector": "scrfd"
  }
}
```

## 5. AI Service -> Backend Completion Event

AI Service handler:

```text
apps/ai_service/app/presentation/event_handlers/registration_requested_handler.py
```

AI Service now reads:

```python
payload["face_media_asset"]
```

It downloads the prepared face crop, extracts embedding, upserts Qdrant, then publishes:

```text
stream: ai_backend
event: registration_processing.completed
producer: ai_service
contract: packages/contracts/ai_backend/registration_processing_completed.v1.schema.json
```

Success:

```json
{
  "status": "indexed",
  "face_image_media_asset": { "...": "same face_media_asset from pipeline" },
  "embedding_model": "buffalo_l",
  "embedding_version": "1.0",
  "indexed_at": "..."
}
```

Failure:

```json
{
  "status": "failed",
  "failure_code": "FACE_IMAGE_DOWNLOAD_FAILED",
  "failure_message": "...",
  "face_image_media_asset": null
}
```

Failure codes currently emitted by AI Service:

- `INVALID_REGISTRATION_REQUEST`
- `MISSING_FACE_MEDIA_ASSET`
- `INVALID_FACE_MEDIA_ASSET`
- `FACE_IMAGE_DOWNLOAD_FAILED`
- `FACE_IMAGE_EMPTY`
- `PROCESSING_ERROR`

Backend handles completion in:

```text
apps/backend/app/infrastructure/integrations/event_handlers.py
handle_registration_processing_completed
```

State backend:

- `indexed` -> `registration_status = indexed`
- `failed` -> `registration_status = failed`

If AI fails after pipeline already saved a prepared crop, backend keeps the prepared crop reference instead of clearing it.

## Files Changed

Pipeline:

- `apps/pipeline/app/services/pipeline_service.py`
  - Added `handle_registration`.
  - Added publish helper for `registration_input.validated`.
  - Added publish helper for `pipeline_ai registration.requested`.
  - Added face crop upload helper.

- `apps/pipeline/app/core/config.py`
  - Added `STREAM_PIPELINE_EVENTS`.

- `apps/pipeline/app/clients/storage_client.py`
  - Added optional bucket support for upload/download.

AI Service:

- `apps/ai_service/app/presentation/event_handlers/registration_requested_handler.py`
  - Reads `face_media_asset`.
  - Publishes explicit failed completion events for invalid input/download failures.

Backend:

- `apps/backend/app/presentation/api/v1/persons_registrations.py`
  - Added multipart upload endpoint `POST /api/v1/persons/{person_id}/registrations/upload`.
  - Uploads the selected source image to MinIO, creates the source media asset, then publishes `registration.requested`.

- `apps/backend/app/infrastructure/storage/minio_storage_gateway.py`
  - Added byte upload support and bucket auto-create for registration source images.

- `apps/backend/app/infrastructure/persistence/repositories/face_registration_repository.py`
  - Accepted validation now moves registration to `validated`.
  - AI failure no longer clears an already stored prepared crop asset.

- `apps/frontend/src/components/persons/face-registration-form.tsx`
  - Sends `multipart/form-data` with the selected file instead of requiring manual MinIO upload.

Tests:

- `apps/pipeline/tests/test_pipeline_registration_publishers.py`
- `apps/ai_service/tests/test_registration_requested_handler.py`
- `apps/backend/tests/unit/test_face_registration_use_cases.py`
- `apps/backend/tests/unit/test_event_handlers.py`
- `apps/backend/tests/integration/test_event_flow_scenarios.py`
