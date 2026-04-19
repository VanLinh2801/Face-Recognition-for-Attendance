# Backend To Pipeline Contracts

Commands published by backend and consumed by pipeline.

- `registration_requested.v1.schema.json`

## `registration_requested.v1.schema.json`

Event này được backend publish khi có yêu cầu xử lý ảnh đăng ký khuôn mặt cho một nhân sự.
Pipeline consume event này để bắt đầu đọc ảnh nguồn, chuẩn bị input và chuyển tiếp sang AI.

Luồng sử dụng:

1. Frontend gửi yêu cầu tạo hoặc cập nhật đăng ký khuôn mặt lên backend.
2. Backend tạo `person_face_registrations` ở trạng thái ban đầu.
3. Backend publish `registration.requested`.
4. Pipeline nhận event, chuẩn bị input phù hợp và phát tiếp `pipeline_ai/registration_requested`.
5. AI xử lý ảnh và gửi kết quả cuối về backend.

Các trường chính trong `payload`:

- `person_id`: id nhân sự trong hệ thống. Pipeline không sở hữu person record nhưng cần field này để gắn kết kết quả xử lý về đúng người.
- `registration_id`: id của lần đăng ký khuôn mặt. Đây là key chính để mọi bước sau map ngược về bảng `person_face_registrations`.
- `requested_by_person_id`: id người dùng hoặc admin đã tạo yêu cầu đăng ký.
- `source_media_asset`: metadata của ảnh gốc cần xử lý. Đây là input chính để pipeline tải đúng file từ storage.
- `notes`: ghi chú bổ sung từ backend nếu có.

Ý nghĩa thiết kế:

- Backend là owner của nghiệp vụ đăng ký.
- Pipeline là worker chịu trách nhiệm chuẩn bị input và chuyển tiếp sang AI.
- Event này không chứa embedding hay logic AI, vì đó chưa phải trách nhiệm của backend.
