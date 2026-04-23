# Hợp đồng AI -> Backend

Thư mục này chứa các event do AI service phát và backend tiêu thụ.

- `recognition_event_detected.v1.schema.json`
- `unknown_event_detected.v1.schema.json`
- `registration_processing_completed.v1.schema.json`

## Tổng quan

AI service không còn chịu trách nhiệm realtime detection, tracking hoặc spoof/liveness. Pipeline đã chuẩn bị face batch trước khi gửi sang AI.

AI service chịu trách nhiệm:

- Extract feature từ face crop.
- Search vector index để tìm người đã đăng ký.
- Phát business event recognition/unknown về backend.
- Extract và index embedding cho registration flow.

## `recognition_event_detected.v1.schema.json`

AI phát `recognition_event.detected` khi một face/track match được người đã đăng ký và đủ điều kiện tạo business event.

Payload chính:

- `stream_id`, `frame_id`, `frame_sequence`, `track_id`: thông tin correlate với frame/track từ pipeline.
- `person_id`: người được nhận diện.
- `face_registration_id`: registration cụ thể match ra kết quả này.
- `recognized_at`: thời điểm nhận diện.
- `event_direction`: `entry`, `exit` hoặc `unknown`.
- `match_score`: điểm match từ vector search nếu có.
- `spoof_score`: điểm spoof do pipeline gửi sang AI nếu AI forward lại.
- `event_source`: thường là `ai_service`.
- `dedupe_key`: khóa chống ghi trùng.
- `snapshot_media_asset`: snapshot minh chứng nếu có.
- `raw_payload`: dữ liệu debug mở rộng nếu cần.

## `unknown_event_detected.v1.schema.json`

AI phát `unknown_event.detected` khi một face/track không match được người đã đăng ký.

Payload chính:

- `stream_id`, `frame_id`, `frame_sequence`, `track_id`: thông tin correlate với frame/track từ pipeline.
- `detected_at`: thời điểm phát hiện unknown.
- `event_direction`: `entry`, `exit` hoặc `unknown`.
- `match_score`: điểm match gần nhất nếu AI có nearest candidate.
- `spoof_score`: điểm spoof do pipeline gửi sang AI nếu AI forward lại.
- `event_source`: thường là `ai_service`.
- `dedupe_key`: khóa chống ghi trùng.
- `review_status`: trạng thái review ban đầu.
- `notes`: ghi chú mở rộng nếu có.
- `snapshot_media_asset`: snapshot minh chứng nếu có.
- `raw_payload`: dữ liệu debug mở rộng nếu cần.

## `registration_processing_completed.v1.schema.json`

AI phát `registration_processing.completed` khi registration flow đã xử lý xong ở phía AI.

Payload chính:

- `person_id`: id nhân sự liên quan.
- `registration_id`: id lượt đăng ký khuôn mặt.
- `status`: `pending`, `validated`, `indexed` hoặc `failed`.
- `failure_code`, `failure_message`: thông tin lỗi nếu thất bại.
- `validation_notes`: ghi chú validate từ AI nếu có.
- `embedding_model`, `embedding_version`: thông tin model đã dùng.
- `indexed_at`: thời điểm index thành công.
- `face_image_media_asset`: ảnh face cuối cùng nếu có.
- `source_media_asset_id`: id ảnh nguồn nếu backend đã persist.
- `event_source`: thường là `ai_service`.
