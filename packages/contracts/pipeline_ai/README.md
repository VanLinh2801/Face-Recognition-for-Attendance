# Hợp đồng Pipeline -> AI

Thư mục này chứa các event/command do pipeline phát và AI service tiêu thụ.

- `recognition_requested.v1.schema.json`
- `registration_requested.v1.schema.json`

## `recognition_requested.v1.schema.json`

Pipeline phát `recognition.requested` sau khi đã xử lý realtime frame ở phía pipeline.

Trong luồng realtime, AI không tự detect face, không tự tracking và không tự xử lý spoof/liveness. AI chỉ nhận face batch đã được pipeline chuẩn bị để extract feature và search vector index.

Payload chính:

- `stream_id`: định danh luồng video.
- `frame_id`: định danh frame nguồn.
- `frame_sequence`: số thứ tự frame trong luồng.
- `captured_at`: thời điểm frame được ghi nhận.
- `presentation_ts_ms`: timestamp dùng để sync overlay với video.
- `frame_width`, `frame_height`: kích thước frame gốc.
- `faces`: danh sách face crop pipeline gửi sang AI.
- `faces[].track_id`: track id do pipeline gán.
- `faces[].bbox`: bounding box của face trên frame gốc.
- `faces[].face_media_asset`: tham chiếu tới face crop trong object storage.
- `faces[].detection_confidence`: confidence từ detector của pipeline nếu có.
- `faces[].quality_status`: trạng thái chất lượng do pipeline đánh giá.
- `faces[].pipeline_metadata`: metadata kỹ thuật mở rộng của pipeline.

Nếu hệ thống phase đầu chỉ có một camera, các service dùng thống nhất `stream_id = "default"`.

AI dùng event này để tạo embedding và search người đã đăng ký. Kết quả business cuối cùng được AI gửi thẳng về backend bằng `recognition_event.detected` hoặc `unknown_event.detected`.

## `registration_requested.v1.schema.json`

Pipeline phát `registration.requested` khi face đăng ký đã được crop/normalize và đủ điều kiện gửi sang AI.

Luồng sử dụng:

1. Backend phát `backend_pipeline/registration_requested`.
2. Pipeline đọc ảnh nguồn từ storage.
3. Pipeline validate ảnh, crop hoặc normalize nếu cần.
4. Pipeline phát `pipeline_backend/registration_input_validated` về backend.
5. Nếu ảnh hợp lệ, pipeline chỉ gửi face đã chuẩn bị sang AI bằng `registration.requested`.
6. AI extract feature, index vector và phát `registration_processing.completed` trực tiếp về backend.

Payload chính:

- `person_id`: id nhân sự liên quan.
- `registration_id`: id lượt đăng ký khuôn mặt.
- `face_media_asset`: face crop/ảnh đã normalize mà AI sẽ dùng để extract feature.
- `source_media_asset_id`: id ảnh nguồn nếu backend đã persist, chỉ dùng để correlate/audit.
- `quality_status`: trạng thái chất lượng do pipeline đánh giá trước khi gửi sang AI.
- `captured_at`: thời điểm ảnh được ghi nhận nếu có.
- `pipeline_metadata`: metadata mở rộng cho bước chuẩn bị input.
