# Kế hoạch Tích hợp Data Thật cho Trang Chấm Công (Attendance)

Tài liệu này phân tích chi tiết việc thay thế mock data bằng việc gọi API thật cho trang chấm công (`apps/frontend/src/app/attendance/page.tsx` và `apps/frontend/src/components/attendance/attendance-presence-view.tsx`).

## 1. Phân tích Frontend hiện tại

Hiện tại, trang chấm công sử dụng mock data từ `@/lib/mock-repository`:
- `listAttendanceEvents()`
- `listDepartments()`
- `listMediaAssets()`
- `listPersons()`

**Cách hoạt động cũ:**
1. Fetch TOÀN BỘ dữ liệu ở server-side hoặc root component.
2. Truyền tất cả dữ liệu xuống `AttendancePresenceView`.
3. `AttendancePresenceView` thực hiện filter, map trên RAM (client-side) để tính toán:
   - Các dòng sự kiện trong ngày (Daily presence) cho tất cả nhân sự.
   - Thống kê (present, late, absent).
   - Generate Report chấm công cho một khoảng thời gian.
   - Hiển thị thông tin ảnh snapshot dựa trên lookup mảng `mediaAssets`.

## 2. Các API Backend (Be) liên quan

Thông qua việc rà soát thư mục backend (`app/presentation/api/v1`), đây là các API sẵn có:

- **Phòng ban:** `GET /api/v1/departments` (Trả về danh sách `DepartmentItemResponse`)
- **Nhân sự:** `GET /api/v1/persons` (Trả về danh sách `PersonItemResponse`)
- **Chấm công:**
  - `GET /api/v1/attendance/events` (Danh sách sự kiện, hỗ trợ filter `from_at`, `to_at`, `person_id`)
  - `GET /api/v1/attendance/events/{event_id}`
  - `GET /api/v1/attendance/summary/daily` (Thống kê số lượng theo ngày)
- **Media (Ảnh):**
  - `GET /api/v1/media-assets/{media_asset_id}/content` (Trả về nội dung byte của ảnh)

## 3. Các điểm thiếu sót cần bổ sung trên Backend

> **Lưu ý quan trọng**
> Mặc dù backend đã có logic lấy dữ liệu chấm công, nhưng API `GET /api/v1/attendance/events` hiện tại **CHƯA TRẢ VỀ** trường `snapshot_media_asset_id`. Frontend cần ID này để hiển thị ảnh snapshot lúc vào/ra của nhân viên.

**Các bước cập nhật Backend:**
1. **Cập nhật Model View:** Thêm `snapshot_media_asset_id: UUID | None` vào lớp `AttendanceEventView` trong `app/application/use_cases/attendance/__init__.py`.
2. **Cập nhật Repository:** Mở tệp `SqlAlchemyAttendanceRepository` (`app/infrastructure/persistence/repositories/attendance_repository.py`), thêm trường `RecognitionEventModel.snapshot_media_asset_id` vào câu lệnh `select()` của hàm `list_attendance_events` và `get_attendance_event`.
3. **Cập nhật API Schema:** Trong `app/presentation/schemas/attendance.py`, cập nhật `AttendanceEventItemResponse` để bao gồm trường `snapshot_media_asset_id: UUID | None`.

*(Tùy chọn: Để lấy metadata của ảnh (size, bucket), cần bổ sung thêm API `GET /api/v1/media-assets/{id}`. Nếu không, UI frontend chỉ cần dùng link `content` để hiển thị ảnh, bỏ qua hiển thị metadata).*

## 4. Kế hoạch Refactor Frontend

### A. Đầu vào & Đầu ra API (Dữ liệu fetch)

Thay vì gọi hàm mock, chúng ta cần tạo các service (dùng `fetch`, `axios` hoặc thư viện như `SWR`, `React Query` đang dùng trong project) để lấy data:

1. **fetchDepartments():** Gọi `GET /api/v1/departments?page_size=1000`
2. **fetchPersons():** Gọi `GET /api/v1/persons?page_size=1000`
3. **fetchEvents(workDate):** Gọi `GET /api/v1/attendance/events?from_at={start_of_day}&to_at={end_of_day}&page_size=1000`

### B. Cấu trúc Component `AttendancePage` (page.tsx)
- Đổi từ Server Component sang Client Component (thêm `"use client"`) hoặc giữ nguyên Server Component nếu ứng dụng hỗ trợ fetch token trên server.
- Sử dụng hooks (như `useEffect`, `useState`) để lấy danh sách `departments` và `persons` một lần lúc khởi tạo.
- Truyền danh sách `departments` và `persons` xuống `AttendancePresenceView`.
- `AttendancePresenceView` sau đó tự quản lý `events` (fetch theo `workDate`) và không còn nhận `events` / `mediaAssets` qua props nữa. Props interface thu hẹp: chỉ còn `persons` và `departments`.

### C. Refactor `AttendancePresenceView.tsx`

> **Mẹo tối ưu:**
> Thay vì lấy toàn bộ events trong lịch sử, chỉ fetch `events` cho ngày làm việc (`workDate`) được chọn.

- **Khi workDate thay đổi:** Gọi lại API fetch `events` cho ngày mới.
- **Tạo Report:**
  Khi người dùng chọn dải ngày và bấm "Thống kê", thay vì lọc mảng có sẵn, component sẽ gọi API `GET /api/v1/attendance/events?from_at={reportFromDate}&to_at={reportToDate}&page_size=5000` để lấy toàn bộ sự kiện trong khoảng đó rồi chạy logic map tính toán `present/late/absent`.
  *(Nếu data lớn, tương lai có thể cân nhắc viết thêm một API chuyên tính toán report trên backend để gửi về file Excel hoặc json thống kê).*
- **Hiển thị Ảnh (SnapshotPanel):**
  - Xóa mảng `mediaAssets` được truyền qua props.
  - Sửa `SnapshotPanel` để sử dụng trực tiếp URL ảnh: `<img src={\`/api/v1/media-assets/\${event.snapshot_media_asset_id}/content\`} ... />` thay vì cố gắng tìm metadata trong mảng.
  - Có thể loại bỏ các UI phụ hiển thị `bucket`, `object_key`, `file_size` (do đây là thông tin nội bộ của storage không quan trọng cho người chấm công).

## 5. Các bước triển khai (Checklist)

- [ ] **(Backend)** Cập nhật schema `AttendanceEventItemResponse` để thêm `snapshot_media_asset_id`.
- [ ] **(Backend)** Cập nhật repository để select trường `snapshot_media_asset_id` từ CSDL.
- [ ] **(Frontend)** Tạo các hàm utils để gọi API REST đến backend.
- [ ] **(Frontend)** Cập nhật `AttendancePage` (`page.tsx`) để fetch data từ API thật.
- [ ] **(Frontend)** Sửa `AttendancePresenceView` để:
  - Loại bỏ các mock data liên quan tới `mediaAssets`.
  - Thay thế cách load ảnh bằng link `/api/v1/media-assets/{id}/content`.
  - Fetch lại sự kiện chấm công khi `workDate` thay đổi.
  - Tối ưu hóa fetch events khi Tạo Report.
