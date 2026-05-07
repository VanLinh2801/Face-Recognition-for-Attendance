# Backend API Upgrade Notes
File này dùng để ghi ngắn gọn các API/backend behavior cần bổ sung sau này. 

## Media snapshot URLs for attendance UI

Frontend can hien thi 2 anh snapshot trong dialog chi tiet daily presence:

- Anh lan dau xuat hien trong ngay.
- Anh lan cuoi xuat hien trong ngay.
- Hai anh nay nen lay tu `snapshot_media_asset_id` cua recognition event dau/cuoi.

`GET /api/v1/attendance/daily-presence` nen tra them:

- `first_snapshot_media_asset_id`
- `last_snapshot_media_asset_id`

Backend hien moi co metadata `media_assets` (`bucket_name`, `object_key`, ...), chua co API tra URL anh. Nen bo sung mot trong hai huong:

```http
GET /api/v1/media-assets/{media_asset_id}/presigned-url
```

Response goi y:

```json
{
  "media_asset_id": "uuid",
  "url": "https://...",
  "expires_at": "2026-05-07T09:00:00Z"
}
```

Hoac backend co the proxy binary:

```http
GET /api/v1/media-assets/{media_asset_id}/content
```

Khuyen nghi: dung presigned URL de frontend khong can MinIO credential, anh van private va URL co thoi han. Neu muon giam request khi mo dialog, `daily-presence` co the tra luon `first_snapshot` va `last_snapshot` gom `id`, `url`, `bucket_name`, `object_key`.

## Attendance check-in only

Hệ thống demo hiện chỉ dùng 1 camera, nên attendance nên xử lý theo hướng **check-in only / daily presence**, không dựa vào entry-exit đầy đủ.

Backend cần bổ sung API tính `last_seen_at` cho từng nhân viên trong ngày.

Gợi ý API:

```http
GET /api/v1/attendance/daily-presence?work_date=2026-05-07
```

Query params cần hỗ trợ:

- `work_date`
- `department_id`
- `include_child_departments=true|false`
- `status=present|late|absent`
- `person_id`
- `page`
- `page_size`

Yêu cầu tối thiểu:

- Tính từ `recognition_events` hợp lệ (`is_valid = true`).
- Group theo `person_id` và `work_date`.
- Trả về:
  - `person_id`
  - `person_full_name`
  - `work_date`
  - `first_seen_at` = lần nhận diện đầu tiên trong ngày
  - `last_seen_at` = lần nhận diện gần nhất trong ngày
  - `recognition_count`
  - `best_match_score`
  - `max_spoof_score`
  - `status` nếu backend đã có rule tính `present/late/absent`

Khi có `department_id`:

- Nếu `include_child_departments=false`: chỉ lấy nhân viên trực tiếp thuộc phòng ban đó.
- Nếu `include_child_departments=true`: lấy cả nhân viên thuộc các phòng ban con/cháu.
- Response item nên có thêm `department_id`, `department_name`.
- Query cần xuất phát từ `persons` rồi left join recognition aggregate để vẫn trả được nhân viên `absent`.

Chưa cần sửa migration ở bước đầu; có thể tính bằng aggregate query từ `recognition_events`. Nếu sau này cần report nhanh hơn thì cân nhắc thêm bảng summary riêng.

## Attendance statistics by period

Frontend cần có nút tạo thống kê số ngày `đi làm`, `đi muộn`, `vắng mặt` của nhân viên trong một khoảng thời gian.

Khuyến nghị backend: **chưa cần thêm bảng ở giai đoạn đầu**. Thêm API aggregate trước, tính trực tiếp từ `persons`, `departments` và `recognition_events`.

Gợi ý API:

```http
GET /api/v1/attendance/presence-statistics?from_date=2026-05-01&to_date=2026-05-31
```

Query params cần hỗ trợ:

- `from_date`
- `to_date`
- `department_id`
- mặc định luôn bao gồm phòng ban con
- `person_search`
- `page`
- `page_size`

Response item nên có:

- `person_id`
- `person_full_name`
- `department_id`
- `department_name`
- `present_days`
- `late_days`
- `absent_days`
- `total_recognitions`

Backend cần sinh danh sách ngày trong khoảng thời gian, left join với danh sách nhân viên để tính được cả ngày `absent`.

Chỉ nên thêm bảng summary như `attendance_daily_records` sau này nếu dữ liệu lớn, report chạy chậm, hoặc cần lưu snapshot kết quả chấm công đã chốt theo ngày.
# Backend API Upgrade Notes
