# Common Contracts

Shared JSON schemas reused by service-to-service contracts.

- `envelope.schema.json`: common event envelope for Redis Streams
- `media_asset_ref.schema.json`: metadata reference for files stored in MinIO

## `envelope.schema.json`

Schema này là lớp vỏ chung cho hầu hết mọi message đi qua Redis Streams.
Mục tiêu là để mọi service dùng cùng một cấu trúc tối thiểu cho event-driven integration.

Các trường chính:

- `event_name`: tên nghiệp vụ của event, ví dụ `recognition.completed` hoặc `unknown_event.detected`.
- `event_version`: version của contract. Khi thay đổi breaking change thì tăng version thay vì sửa ngầm payload cũ.
- `message_id`: id duy nhất của message, dùng cho trace và chống xử lý trùng.
- `correlation_id`: id liên kết các bước của cùng một flow, ví dụ từ pipeline gửi request sang AI rồi AI trả kết quả về.
- `causation_id`: id của message gốc sinh ra message hiện tại. Field này hữu ích khi debug chuỗi event.
- `producer`: service phát ra event. Hiện tại chỉ cho phép `backend`, `pipeline`, `ai_service`.
- `occurred_at`: thời điểm event được phát ra theo UTC.
- `payload`: phần dữ liệu nghiệp vụ thật của event.

Ý nghĩa thực tế:

- `envelope` là phần để tất cả team trace, monitor, retry và correlate message.
- `payload` là phần phục vụ logic nghiệp vụ.

## `media_asset_ref.schema.json`

Schema này mô tả một tham chiếu tới file đã nằm trong MinIO hoặc object storage.
Schema này không mang file thật, chỉ mang metadata để service khác biết file nào đang được nói tới.

Các trường chính:

- `media_asset_id`: id business nếu backend đã tạo record `media_assets`. Có thể `null` khi object vừa được pipeline tạo và backend chưa persist.
- `storage_provider`: loại storage. Phase 1 chỉ dùng `minio`.
- `bucket_name`: tên bucket chứa file.
- `object_key`: đường dẫn object trong bucket.
- `original_filename`: tên file gốc để phục vụ audit hoặc hiển thị.
- `mime_type`: kiểu nội dung, ví dụ `image/jpeg`.
- `file_size`: kích thước file theo byte.
- `checksum`: hash file nếu cần phát hiện trùng hoặc kiểm tra lỗi truyền.
- `asset_type`: loại nghiệp vụ của file, ví dụ ảnh đăng ký, snapshot recognition, snapshot unknown, spoof snapshot hoặc face crop.

Ý nghĩa thực tế:

- Pipeline và AI không cần nói chuyện bằng binary image trong mọi message.
- Chỉ cần một `media_asset_ref` là đủ để service khác truy vết đúng object.
