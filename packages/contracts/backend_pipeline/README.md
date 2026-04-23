# Hợp đồng Backend -> Pipeline

Thư mục này chứa các event/command do backend phát và pipeline tiêu thụ.

- `registration_requested.v1.schema.json`

## `registration_requested.v1.schema.json`

Backend phát `registration.requested` khi có yêu cầu xử lý ảnh đăng ký khuôn mặt cho một nhân sự.

Pipeline tiêu thụ event này để:

1. Đọc ảnh nguồn từ storage.
2. Validate ảnh có hợp lệ không.
3. Detect/crop/normalize ảnh nếu cần.
4. Phát `registration_input.validated` về backend.
5. Nếu ảnh hợp lệ, phát `registration.requested` sang AI theo contract `pipeline_ai`.

Payload chính:

- `person_id`: id nhân sự trong hệ thống.
- `registration_id`: id lượt đăng ký khuôn mặt.
- `requested_by_person_id`: id người dùng hoặc admin tạo yêu cầu.
- `source_media_asset`: metadata ảnh nguồn cần xử lý.
- `notes`: ghi chú bổ sung nếu có.

Backend là owner nghiệp vụ registration. Pipeline chỉ chuẩn bị input và điều phối bước tiếp theo sang AI.
