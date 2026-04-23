# Hợp đồng Pipeline -> Backend

Thư mục này chứa các event do pipeline phát và backend tiêu thụ.

- `frame_analysis.updated.v1.schema.json`
- `spoof_alert_detected.v1.schema.json`
- `registration_input_validated.v1.schema.json`

## Tổng quan

Pipeline sở hữu realtime detection, tracking, quality filtering, spoof/liveness và bước chuẩn bị input trước khi gửi sang AI.

Pipeline không phát `recognition_event.detected` hoặc `unknown_event.detected`. Hai business event đó do AI gửi trực tiếp về backend sau khi extract/search.

## `frame_analysis.updated.v1.schema.json`

Pipeline phát `frame_analysis.updated` để backend có dữ liệu realtime overlay gửi lên frontend.

Payload chính:

- `stream_id`: định danh luồng video.
- `frame_id`: định danh frame.
- `frame_sequence`: số thứ tự frame.
- `captured_at`: thời điểm frame được ghi nhận.
- `presentation_ts_ms`: timestamp sync overlay với video.
- `frame_width`, `frame_height`: kích thước frame.
- `tracks`: danh sách track trên frame hiện tại.

Trong mỗi track:

- `track_id`: track id do pipeline gán.
- `bbox`: bounding box trên frame.
- `tracking_state`: `new`, `tracking` hoặc `lost`.
- `analysis_status`: trạng thái pipeline biết tại thời điểm phân tích frame, gồm `detected`, `spoof`, `low_quality` hoặc `ignored`.
- `spoof_score`, `quality_status`, `ignore_reason`: kết quả do pipeline tính.

## `spoof_alert_detected.v1.schema.json`

Pipeline phát `spoof_alert.detected` khi phát hiện spoof hoặc liveness fail.

Event này không phụ thuộc vào kết quả search của AI.

Payload chính:

- `stream_id`, `frame_id`, `frame_sequence`, `track_id`: thông tin correlate với frame/track.
- `person_id`: có thể `null` nếu chưa xác định được danh tính.
- `detected_at`: thời điểm phát hiện spoof.
- `spoof_score`: điểm spoof/liveness.
- `severity`: `low`, `medium` hoặc `high`.
- `review_status`: trạng thái review ban đầu.
- `event_source`: thường là `pipeline`.
- `dedupe_key`: khóa chống ghi trùng.
- `snapshot_media_asset`: snapshot minh chứng nếu có.

## `registration_input_validated.v1.schema.json`

Pipeline phát `registration_input.validated` sau khi đọc ảnh nguồn và kiểm tra ảnh có hợp lệ để gửi sang AI hay không.

Payload chính:

- `person_id`: id nhân sự liên quan.
- `registration_id`: id lượt đăng ký khuôn mặt.
- `status`: `accepted` hoặc `rejected`.
- `validated_at`: thời điểm pipeline validate xong.
- `event_source`: thường là `pipeline`.
- `failure_code`, `failure_message`: thông tin lỗi nếu ảnh bị reject.
- `source_media_asset_id`: id ảnh nguồn nếu có.
- `prepared_face_media_asset`: ảnh face crop/normalize nếu pipeline đã tạo.
- `quality_status`: `passed`, `marginal` hoặc `failed`.
- `validation_notes`: ghi chú validate nếu cần.
- `pipeline_metadata`: metadata kỹ thuật mở rộng.

Nếu `status = rejected`, backend có thể cập nhật registration sang trạng thái lỗi sớm. Nếu `status = accepted`, pipeline tiếp tục gửi `registration.requested` sang AI.
