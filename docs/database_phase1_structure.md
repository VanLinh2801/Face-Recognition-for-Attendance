# Database Structure Phase 1

Tài liệu này chốt lại cấu trúc database PostgreSQL cho phase 1 của dự án Camera AI Attendance.

Mục tiêu của phase 1:

- đủ để lưu dữ liệu nghiệp vụ cốt lõi
- không ôm quá nhiều bảng attendance nâng cao
- mở đường cho các phase sau như daily summary, session, segment, import Excel, batch jobs

## 1. Nguyên tắc chung

- PostgreSQL là database chính và là source of truth ở mức nghiệp vụ
- Backend là owner của schema PostgreSQL
- AI service không sở hữu business tables
- Pipeline không ghi trực tiếp vào PostgreSQL
- MinIO chỉ lưu file, PostgreSQL lưu metadata và ý nghĩa nghiệp vụ của file
- Vector database chỉ lưu embedding và payload để map ngược về PostgreSQL

## 2. Danh sách bảng phase 1

Phase 1 gồm 8 bảng:

- `departments`
- `persons`
- `media_assets`
- `person_face_registrations`
- `recognition_events`
- `unknown_events`
- `spoof_alert_events`
- `attendance_exceptions`

## 3. Chi tiết từng bảng

### 3.1 `departments`

Quản lý phòng ban của nhân sự.

Trường dữ liệu:

- `id`: khóa chính của phòng ban
- `code`: mã phòng ban, ví dụ `HR`, `IT`, `OPS`
- `name`: tên phòng ban
- `parent_id`: tham chiếu đến phòng ban cha nếu sau này cần cấu trúc cây
- `is_active`: phòng ban còn hoạt động hay không
- `created_at`: thời điểm tạo bản ghi
- `updated_at`: thời điểm cập nhật gần nhất

Ý nghĩa:

- dùng để phân loại nhân sự
- hỗ trợ filter và báo cáo theo phòng ban
- mở rộng được cho cấu trúc tổ chức sau này

### 3.2 `persons`

Bảng nhân sự trung tâm của hệ thống.

Trường dữ liệu:

- `id`: khóa chính của nhân sự
- `employee_code`: mã nhân viên duy nhất
- `full_name`: họ và tên
- `department_id`: khóa ngoại sang `departments`
- `title`: chức danh
- `email`: email nội bộ, có thể để trống
- `phone`: số điện thoại, có thể để trống
- `status`: trạng thái nhân sự như `active`, `inactive`, `resigned`
- `joined_at`: ngày vào công ty
- `notes`: ghi chú nội bộ
- `created_at`: thời điểm tạo
- `updated_at`: thời điểm cập nhật

Ý nghĩa:

- là thực thể nhân sự chính của bài toán
- được dùng để liên kết với đăng ký khuôn mặt, event nhận diện, và attendance exception

### 3.3 `media_assets`

Lưu metadata của file trên MinIO. Bảng này không lưu file thật.

Trường dữ liệu:

- `id`: khóa chính
- `storage_provider`: loại storage, phase 1 có thể là `minio`
- `bucket_name`: tên bucket
- `object_key`: đường dẫn object trong bucket
- `original_filename`: tên file gốc
- `mime_type`: kiểu file
- `file_size`: kích thước file
- `checksum`: hash file nếu cần kiểm tra trùng hoặc lỗi
- `asset_type`: loại file như `registration_face`, `recognition_snapshot`, `unknown_snapshot`
- `uploaded_by_person_id`: người upload nếu có
- `created_at`: thời điểm tạo metadata

Ý nghĩa:

- làm cầu nối giữa storage và nghiệp vụ
- cho phép truy vết file đăng ký, snapshot recognition, snapshot unknown

### 3.4 `person_face_registrations`

Quản lý các lần đăng ký khuôn mặt của từng nhân sự.

Trường dữ liệu:

- `id`: khóa chính của lần đăng ký
- `person_id`: khóa ngoại sang `persons`
- `source_media_asset_id`: ảnh gốc dùng để đăng ký
- `face_image_media_asset_id`: ảnh face crop sau xử lý nếu có
- `registration_status`: trạng thái đăng ký như `pending`, `validated`, `indexed`, `failed`
- `validation_notes`: ghi chú nếu ảnh lỗi hoặc không đạt chất lượng
- `embedding_model`: tên model embedding đã dùng
- `embedding_version`: version model hoặc version pipeline
- `is_active`: registration này còn được dùng để match hay không
- `indexed_at`: thời điểm index thành công vào vector database
- `created_at`: thời điểm tạo
- `updated_at`: thời điểm cập nhật

Ý nghĩa:

- theo dõi toàn bộ vòng đời đăng ký khuôn mặt
- map với vector database bằng payload trong vector database chứa `registration_id` và `person_id`
- phase 1 không cần bảng `face_vector_links`
- phase 1 không cần trường `vector_payload_key`

### 3.5 `recognition_events`

Raw event khi hệ thống nhận diện được người quen.

Trường dữ liệu:

- `id`: khóa chính event
- `person_id`: người được nhận diện
- `face_registration_id`: registration đã match ra kết quả này
- `snapshot_media_asset_id`: ảnh minh chứng tại thời điểm nhận diện, có thể để trống
- `recognized_at`: thời điểm nhận diện xảy ra
- `event_direction`: hướng di chuyển suy luận được, giá trị như `entry`, `exit`, `unknown`
- `match_score`: điểm similarity hoặc match score
- `spoof_score`: điểm anti-spoof nếu cần lưu để tra cứu
- `event_source`: nguồn event, ví dụ `pipeline`
- `raw_payload`: JSON thô từ pipeline hoặc AI để debug
- `is_valid`: event có hợp lệ để dùng cho nghiệp vụ hay không
- `invalid_reason`: lý do loại event nếu có
- `created_at`: thời điểm ghi vào database

Ý nghĩa:

- đây là dữ liệu máy quan sát được
- chưa phải kết luận chấm công cuối cùng
- đã lưu `event_direction` từ phase 1 để mở đường cho session và attendance summary ở phase sau

### 3.6 `unknown_events`

Raw event khi hệ thống phát hiện người lạ.

Trường dữ liệu:

- `id`: khóa chính event
- `snapshot_media_asset_id`: ảnh người lạ
- `detected_at`: thời điểm phát hiện
- `event_direction`: hướng di chuyển suy luận được, giá trị như `entry`, `exit`, `unknown`
- `match_score`: điểm gần nhất với vector đã biết nếu cần lưu
- `spoof_score`: điểm anti-spoof nếu có
- `event_source`: nguồn event
- `raw_payload`: JSON thô để debug
- `review_status`: trạng thái xử lý nội bộ như `new`, `reviewed`, `ignored`
- `notes`: ghi chú của admin
- `created_at`: thời điểm ghi vào database
- `updated_at`: thời điểm cập nhật

Ý nghĩa:

- lưu dấu vết người lạ mà hệ thống đã phát hiện
- `event_direction` được lưu từ phase 1 để hỗ trợ các bài toán phân tích sau này

### 3.7 `spoof_alert_events`

Lưu các cảnh báo giả mạo hoặc liveness fail.

Trường dữ liệu:

- `id`: khóa chính event
- `person_id`: có thể để trống nếu chưa xác định được danh tính
- `snapshot_media_asset_id`: ảnh minh chứng nếu có
- `detected_at`: thời điểm phát hiện
- `spoof_score`: điểm anti-spoof
- `event_source`: nguồn event
- `raw_payload`: dữ liệu thô từ pipeline hoặc AI
- `severity`: mức độ cảnh báo như `low`, `medium`, `high`
- `review_status`: trạng thái đã xử lý hay chưa
- `notes`: ghi chú nội bộ
- `created_at`: thời điểm tạo
- `updated_at`: thời điểm cập nhật

Ý nghĩa:

- tách riêng các cảnh báo spoof khỏi recognition và unknown
- giúp theo dõi và audit các trường hợp nghi ngờ gian lận

### 3.8 `attendance_exceptions`

Lưu các ngoại lệ nghiệp vụ do admin nhập để tránh chấm công sai.

Ví dụ:

- đi họp bên ngoài công ty
- đi công tác
- được duyệt về sớm
- điều chỉnh công thủ công

Trường dữ liệu:

- `id`: khóa chính
- `person_id`: nhân sự được áp dụng ngoại lệ
- `exception_type`: loại ngoại lệ như `offsite_meeting`, `business_trip`, `approved_early_leave`, `manual_adjustment`
- `start_at`: thời điểm bắt đầu áp dụng
- `end_at`: thời điểm kết thúc áp dụng
- `work_date`: ngày làm việc liên quan
- `reason`: lý do nghiệp vụ
- `notes`: ghi chú thêm
- `created_by_person_id`: admin đã tạo ngoại lệ này
- `created_at`: thời điểm tạo
- `updated_at`: thời điểm cập nhật

Ý nghĩa:

- đây là dữ liệu nghiệp vụ gốc do con người nhập vào
- không phải bảng tổng hợp
- nên có ngay từ phase 1 vì không thể suy ra từ raw event nếu ban đầu không lưu
- phase 1 chưa cần `approved_by_person_id`, `approved_at`, hoặc workflow duyệt nhiều bước

## 4. Những gì chưa đưa vào phase 1

Những thành phần sau để cho phase sau:

- `attendance_daily_summary`
- `presence_sessions`
- `presence_segments`
- `notifications`
- `face_vector_links`
- import Excel cho `attendance_exceptions`
- Celery hoặc batch jobs cuối ngày, cuối tháng

Lý do:

- phase 1 ưu tiên data model cốt lõi
- event và exception là dữ liệu gốc cần có sớm
- summary, session, segment có thể thêm bằng migration sau mà không phá vỡ hướng thiết kế hiện tại

## 5. Định hướng cho phase sau

Phase sau có thể mở rộng theo thứ tự:

1. thêm `attendance_daily_summary`
2. thêm script hoặc job tính tổng hợp cuối ngày
3. thêm import Excel cho `attendance_exceptions`
4. nếu bài toán attendance phức tạp hơn, mới thêm `presence_sessions` và `presence_segments`
5. sau khi flow ổn định mới đưa Celery vào cho batch jobs

## 6. Tóm tắt

Schema phase 1 được chốt theo hướng:

- ít bảng nhưng đúng vai trò
- lưu đủ raw event và ngoại lệ nghiệp vụ ngay từ đầu
- không ôm quá nhiều bảng attendance nâng cao
- dễ mở rộng ở các phase sau mà không bị khóa thiết kế