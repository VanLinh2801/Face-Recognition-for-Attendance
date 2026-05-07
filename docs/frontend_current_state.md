# Frontend Current State

File này dùng để chuyển tiếp context frontend sang đoạn chat mới.

## Stack

- Frontend nằm trong `apps/frontend`.
- Next.js App Router, TypeScript, Tailwind CSS.
- UI primitives tự quản lý trong `src/components/ui`.
- Icon dùng `lucide-react`.
- Chart dùng `recharts`.
- Dữ liệu hiện tại là mock, chưa kết nối backend thật.

## Layout chung

- Sidebar nằm bên trái, có thể collapse/expand.
- Main content co giãn theo trạng thái sidebar.
- Theme tổng thể là light admin.
- Khu dashboard realtime dùng dark surface riêng cho camera.

## Routes hiện có

- `/` và `/dashboard`: dashboard realtime.
- `/persons`: danh sách nhân sự.
- `/persons/new`: thêm nhân sự kèm upload ảnh đăng ký khuôn mặt.
- `/persons/[id]`: chi tiết nhân sự.
- `/persons/[id]/face-registrations/new`: đăng ký khuôn mặt cho nhân sự đã chọn.
- `/attendance`: chấm công theo hướng check-in only.
- `/events`: trang sự kiện hợp nhất recognition / unknown / spoof.
- `/departments`: danh sách phòng ban.
- `/departments/[id]`: chi tiết phòng ban.
- `/media-assets`: danh sách media assets.
- `/face-registrations`: redirect về `/persons`.

## Mock data

- Types nằm trong `src/lib/types.ts`.
- Mock data nằm trong `src/lib/mock-data.ts`.
- Repository mock nằm trong `src/lib/mock-repository.ts`.
- Mock data đang cố giữ shape gần với backend contract trong `docs/frontend_backend_integration.md`.

## Dashboard

- First viewport gồm camera realtime lớn và latest events sidebar bên phải.
- Camera có overlay bounding box, live badge, FPS, latency.
- Bên dưới có stat cards, charts, tables và system health.

## Nhân sự

- Bảng nhân sự dùng STT thay cho mã nhân viên.
- Có checkbox chọn nhiều dòng.
- Checkbox header chọn/bỏ chọn toàn bộ dòng đang hiển thị.
- Nút bulk delete đổi tên là `Xóa` và có dialog xác nhận.
- Action trong từng dòng là dropdown `...`, gồm:
  - Xem chi tiết.
  - Thêm face.
  - Sửa thông tin.
  - Xóa.
- Sửa nhân sự dùng dialog giữa màn hình, overlay mờ, chỉ sửa thông tin bảng `persons`, không bao gồm face registration.
- Xóa từng nhân sự có dialog xác nhận.
- Trang thêm nhân sự chia 2 phần:
  - Thông tin cá nhân.
  - Upload ảnh để đăng ký khuôn mặt ngay.

## Đăng ký khuôn mặt

- Không còn là item riêng trên sidebar.
- Flow chính là đi từ trang nhân sự hoặc từ action của nhân sự.
- Route chi tiết: `/persons/[id]/face-registrations/new`.

## Sự kiện

- Recognition, Unknown và Spoof đã gộp vào một trang `/events`.
- Không còn route riêng trên sidebar cho từng loại.
- Trang có tab filter loại event: Tất cả / Recognition / Unknown / Spoof.
- Đã bỏ filter source, status, ngày đơn.
- Filter thời gian dùng `from` và `to`, chọn được ngày + giờ.
- Bảng đã bỏ cột `trạng thái` và `nguồn`.
- Action xem chi tiết mở dialog giữa màn hình.
- Dialog chi tiết có vùng lớn để hiển thị media liên quan đến event.

## Phòng ban

- Trang `/departments` đã bỏ form thêm phòng ban luôn hiển thị.
- Có nút `Thêm phòng ban`, mở dialog.
- Bảng có action xem chi tiết, sửa, xóa.
- Cột `parent` đổi tên thành `Trực thuộc`.
- Mock department đã có cây phân cấp đa dạng:
  - Engineering
    - AI Platform
      - Model Research
    - Frontend Web
  - Operations
    - Human Resources
    - Security
    - Camera Operations
- Chi tiết phòng ban đã đổi từ dialog sang page riêng `/departments/[id]`.
- Cây trực thuộc có nút expand/collapse.
- Double click vào node phòng ban trong cây sẽ chuyển sang trang chi tiết phòng ban đó.
- Sửa parent department có validate UI:
  - Không được chọn chính nó làm parent.
  - Không được chọn con/cháu của nó làm parent để tránh cycle.
- Bảng nhân viên trong trang chi tiết phòng ban có action dropdown:
  - Xem chi tiết nhân viên.
  - Xóa.
- Xóa nhân viên trong trang chi tiết phòng ban có dialog xác nhận.

## Chấm công

- Đã chuyển theo hướng `check-in only / daily presence` vì demo chỉ dùng 1 camera.
- Không dùng entry/exit đầy đủ.
- Daily presence hiển thị:
  - First seen.
  - Last seen.
  - Số lần nhận diện.
  - Trạng thái present / late / absent.
- Đã bỏ các cột best match và max spoof.
- Đã bỏ phần `Recognition log trong ngày`.
- Filter trên một hàng:
  - Search theo tên nhân viên.
  - Ngày.
  - Dropdown phòng ban dạng cây.
  - Trạng thái.
- Dropdown phòng ban mặc định luôn bao gồm phòng ban con, không còn checkbox `bao gồm phòng ban con`.
- Danh sách nhân viên có phân trang.
- Đã thêm nút `Tạo report`.
- Dialog report có:
  - Ngày bắt đầu.
  - Ngày kết thúc.
  - Dropdown phòng ban dạng cây giống trang chấm công.
  - Nút `Thống kê`.
  - Bảng kết quả: đi làm, đi muộn, vắng mặt, nhận diện.
  - Nút `In report` sau khi có kết quả.
- `In report` mở bản HTML tối giản và gọi hộp thoại in trình duyệt.

## Backend notes liên quan

- File notes backend: `docs/backend_api_upgrade_notes.md`.
- Đã note API cần thêm:
  - `GET /api/v1/attendance/daily-presence`
  - `GET /api/v1/attendance/presence-statistics`
- Khuyến nghị hiện tại:
  - Chưa cần thêm bảng attendance summary ở bước đầu.
  - Backend có thể aggregate trực tiếp từ `persons`, `departments`, `recognition_events`.
  - Chỉ thêm bảng summary như `attendance_daily_records` khi dữ liệu lớn, report chậm hoặc cần snapshot kết quả đã chốt.

## Việc đang dang dở / yêu cầu mới nhất chưa làm

- Ở bảng daily presence của trang chấm công, nút `Xem` hiện vẫn dẫn đến trang chi tiết nhân viên.
- Yêu cầu tiếp theo: đổi nút `Xem` thành dialog tại chỗ.
- Dialog này cần hiển thị:
  - Ảnh nhân viên.
  - Thông tin nhân viên.
  - Lần đầu xuất hiện trong ngày.
  - Lần cuối xuất hiện trong ngày.
  - Có thể thêm số lần nhận diện và trạng thái present / late / absent.

## Verification gần nhất

- Sau các chỉnh sửa frontend gần đây:
  - `npm run typecheck` pass.
  - `npm run lint` pass.
- `npm run build` đã từng pass sau khi chạy ngoài sandbox vì `.next` có lỗi quyền ghi/xóa trong sandbox.
