# Hợp đồng dùng chung

Thư mục này chứa schema dùng chung cho các contract giao tiếp giữa service.

- `envelope.schema.json`: envelope chung cho message đi qua event bus.
- `media_asset_ref.schema.json`: tham chiếu metadata tới file trong MinIO hoặc object storage.

## `envelope.schema.json`

Envelope là lớp vỏ chung cho event.

Các trường chính:

- `event_name`: tên event nghiệp vụ, ví dụ `recognition_event.detected`.
- `event_version`: version contract theo semantic version.
- `message_id`: id duy nhất của message.
- `correlation_id`: id liên kết các bước trong cùng một flow.
- `causation_id`: id message gốc tạo ra message hiện tại, có thể `null`.
- `producer`: service phát event, hiện gồm `backend`, `pipeline`, `ai_service`.
- `occurred_at`: thời điểm event được phát.
- `payload`: dữ liệu nghiệp vụ của event.

## `media_asset_ref.schema.json`

Schema này mô tả tham chiếu tới một file đã nằm trong MinIO hoặc object storage.

Các trường chính:

- `media_asset_id`: id business nếu backend đã tạo record, có thể `null`.
- `storage_provider`: provider lưu trữ, phase hiện tại dùng `minio`.
- `bucket_name`: tên bucket chứa file.
- `object_key`: đường dẫn object trong bucket.
- `original_filename`: tên file gốc.
- `mime_type`: kiểu nội dung.
- `file_size`: kích thước file theo byte.
- `checksum`: hash file nếu có.
- `asset_type`: loại file nghiệp vụ, ví dụ `registration_face`, `recognition_snapshot`, `unknown_snapshot`, `spoof_snapshot`, `face_crop`.
