# AI To Backend Contracts

Active events published by AI service and consumed directly by backend.

- `frame_analysis.updated.v1.schema.json`
- `recognition_event_detected.v1.schema.json`
- `unknown_event_detected.v1.schema.json`
- `spoof_alert_detected.v1.schema.json`
- `registration_processing_completed.v1.schema.json`

## Tổng quan

Theo boundary mới, AI service là nơi chịu trách nhiệm detection, tracking, spoofing, recognition normalization và completion của registration flow.
Backend nhận hai nhóm event khác nhau:

- realtime visualization event: dùng để push lên frontend và đồng bộ box với video
- business persistence event: dùng để persist vào PostgreSQL

`frame_analysis.updated` không phải business event. Nó là gói realtime để frontend/backend biết ở một frame cụ thể phải vẽ gì.
Các event `recognition_event.detected`, `unknown_event.detected`, `spoof_alert.detected` là business event để backend lưu nghiệp vụ.

## `frame_analysis.updated.v1.schema.json`

Event realtime do AI phát sau khi phân tích một frame. Backend dùng event này để làm realtime gateway cho frontend.

Các trường chính trong `payload`:

- `stream_id`: định danh luồng video.
- `frame_id`: id của frame đã được AI phân tích.
- `frame_sequence`: số thứ tự frame trong luồng.
- `captured_at`: thời điểm frame được ghi nhận.
- `presentation_ts_ms`: timestamp trình chiếu dùng để sync overlay với video stream.
- `frame_width`: chiều rộng frame gốc.
- `frame_height`: chiều cao frame gốc.
- `tracks`: danh sách các object đang được AI theo dõi trên frame này.

Ý nghĩa từng trường trong mỗi phần tử của `tracks`:

- `track_id`: identity realtime của object đang được AI track qua nhiều frame liên tiếp.
- `bbox`: tọa độ bounding box trên frame hiện tại.
- `tracking_state`: trạng thái track, ví dụ `new`, `tracking`, `lost`.
- `classification`: AI phân loại object này là `recognized`, `unknown`, `spoof` hay `ignored`.
- `person_id`: person đã match nếu có.
- `face_registration_id`: registration đã match nếu có.
- `display_label`: text label mà frontend có thể hiển thị ngay trên box.
- `match_score`: điểm similarity nếu object là recognized.
- `spoof_score`: điểm anti-spoof nếu có.
- `quality_status`: trạng thái chất lượng tổng quát của detection trên frame này.
- `ignore_reason`: lý do bỏ qua nếu classification là `ignored`.
- `embedding_preview`: biểu diễn rút gọn của embedding chỉ phục vụ debug UI, không phải raw vector đầy đủ.

## `recognition_event_detected.v1.schema.json`

Business event do AI phát khi một track được kết luận là người đã biết và đủ điều kiện tạo recognition event.

Các trường chính:

- `stream_id`, `frame_id`, `frame_sequence`, `track_id`: metadata để correlate ngược với realtime overlay.
- `person_id`: id người được nhận diện.
- `face_registration_id`: registration cụ thể match ra kết quả này.
- `recognized_at`: thời điểm recognition xảy ra.
- `event_direction`: hướng vào/ra hoặc `unknown`.
- `match_score`, `spoof_score`: score cần lưu audit.
- `event_source`: nguồn sinh event, mặc định là `ai_service`.
- `dedupe_key`: khóa chống trùng để backend không persist nhiều recognition event giống nhau trong cửa sổ ngắn.
- `snapshot_media_asset`: snapshot minh chứng nếu AI hoặc pipeline đã tạo object.
- `raw_payload`: dữ liệu debug mở rộng.

Map nghiệp vụ:

- Event này map vào bảng `recognition_events`.

## `unknown_event_detected.v1.schema.json`

Business event do AI phát khi một track không match được với dữ liệu đã đăng ký.

Các trường chính:

- `stream_id`, `frame_id`, `frame_sequence`, `track_id`: metadata correlate với luồng realtime.
- `detected_at`: thời điểm phát hiện unknown.
- `event_direction`: hướng vào/ra hoặc `unknown`.
- `match_score`: điểm match gần nhất nếu có nearest candidate.
- `spoof_score`: điểm anti-spoof nếu có.
- `event_source`: nguồn sinh event, mặc định là `ai_service`.
- `dedupe_key`: khóa chống trùng.
- `review_status`: trạng thái review ban đầu, thường là `new`.
- `notes`: ghi chú mở rộng nếu cần.
- `snapshot_media_asset`: snapshot minh chứng nếu có.
- `raw_payload`: dữ liệu debug mở rộng.

Map nghiệp vụ:

- Event này map vào bảng `unknown_events`.

## `spoof_alert_detected.v1.schema.json`

Business event do AI phát khi một track bị đánh dấu spoof hoặc liveness fail.

Các trường chính:

- `stream_id`, `frame_id`, `frame_sequence`, `track_id`: metadata correlate với luồng realtime.
- `person_id`: có thể `null` nếu AI chưa xác định được danh tính.
- `detected_at`: thời điểm phát hiện spoof.
- `spoof_score`: điểm anti-spoof.
- `severity`: mức độ cảnh báo `low`, `medium`, `high`.
- `review_status`: trạng thái review ban đầu.
- `event_source`: nguồn sinh event, mặc định là `ai_service`.
- `dedupe_key`: khóa chống trùng.
- `notes`: ghi chú mở rộng.
- `snapshot_media_asset`: snapshot minh chứng nếu có.
- `raw_payload`: dữ liệu debug.

Map nghiệp vụ:

- Event này map vào bảng `spoof_alert_events`.

## `registration_processing_completed.v1.schema.json`

Business event do AI phát khi registration flow kết thúc và backend có thể cập nhật trạng thái cuối cho `person_face_registrations`.

Các trường chính:

- `person_id`: id nhân sự liên quan.
- `registration_id`: id của lần đăng ký khuôn mặt.
- `status`: trạng thái cuối hoặc hiện tại của registration, ví dụ `validated`, `indexed`, `failed`.
- `failure_code`: mã lỗi ngắn nếu thất bại.
- `failure_message`: thông điệp lỗi dễ đọc nếu thất bại.
- `validation_notes`: ghi chú bổ sung từ AI nếu cần lưu audit.
- `embedding_model`: model embedding đã dùng.
- `embedding_version`: version model hoặc inference pipeline.
- `indexed_at`: thời điểm index thành công vào vector store.
- `face_image_media_asset`: ảnh face cuối cùng nếu AI hoặc pipeline đã tạo object này.
- `source_media_asset_id`: id ảnh nguồn nếu backend đã persist.
- `event_source`: nguồn sinh event, mặc định là `ai_service`.

Map nghiệp vụ:

- Event này map vào vòng đời của bảng `person_face_registrations`.
- Backend không còn chờ `pipeline -> backend` completion event cho registration flow.
