# Pipeline To AI Contracts

Active commands published by pipeline and consumed by AI service.

- `recognition_requested.v1.schema.json`
- `registration_requested.v1.schema.json`

## `recognition_requested.v1.schema.json`

Event này được pipeline publish khi cần giao một frame của luồng video sang AI để AI tự detect, tự track và tự phân tích.
Pipeline không còn chịu trách nhiệm detection, tracking, hay quality filtering sâu trong realtime recognition path.

Luồng sử dụng:

1. Pipeline nhận stream frame từ camera hoặc video source.
2. Pipeline có thể sampling hoặc resize nhẹ nếu cần tối ưu băng thông.
3. Pipeline publish `recognition.requested` với frame-level payload.
4. AI service đọc event, tự detect face, track, phân loại spoof/known/unknown và phát event trực tiếp sang backend.

Các trường chính trong `payload`:

- `frame_sequence`: số thứ tự tăng dần của frame trong luồng mà pipeline đang phát sang AI.
- `captured_at`: thời điểm frame được ghi nhận.
- `frame_width`: chiều rộng frame mà AI sẽ xử lý.
- `frame_height`: chiều cao frame mà AI sẽ xử lý.
- `frame_ref`: tham chiếu tới frame đã được đặt trong object storage hoặc một nơi chia sẻ mà AI có thể đọc. Realtime path hiện tại không gửi nguyên ảnh trực tiếp trong event bus.
- `pipeline_metadata`: vùng mở rộng cho metadata kỹ thuật riêng của pipeline nếu cần, ví dụ bitrate profile hoặc thông tin sampling.

Ý nghĩa thiết kế:

- Pipeline chỉ là lớp ingest và transfer frame.
- AI service là owner của detection, tracking, quality filtering và recognition normalization.
- Contract này là input realtime kỹ thuật, không phải business event.
- `captured_at` là mốc thời gian chính để AI và backend correlate frame với phân tích và với video stream ở các bước sau.

## `registration_requested.v1.schema.json`

Event này được pipeline publish khi đã chuẩn bị xong input cho registration flow và cần giao ảnh sang AI để validate, tạo embedding và index.

Luồng sử dụng:

1. Backend publish `backend_pipeline/registration_requested`.
2. Pipeline đọc ảnh nguồn từ storage.
3. Pipeline có thể crop hoặc chuẩn hóa ảnh nếu cần.
4. Pipeline publish `registration.requested` sang AI.
5. AI xử lý và publish `registration_processing.completed` trực tiếp về backend.

Các trường chính trong `payload`:

- `person_id`: id nhân sự liên quan.
- `registration_id`: id của lần đăng ký khuôn mặt.
- `source_media_asset`: ảnh nguồn mà pipeline nhận được từ backend.
- `prepared_face_media_asset`: ảnh đã được pipeline chuẩn bị lại nếu có, ví dụ face crop hoặc ảnh chuẩn hóa.
- `captured_at`: thời điểm ảnh được ghi nhận nếu có thông tin này.
- `pipeline_metadata`: metadata mở rộng cho bước chuẩn bị input.

Ý nghĩa thiết kế:

- Pipeline không publish completion event về backend nữa.
- AI là nơi đưa ra kết quả cuối cùng của registration flow.
