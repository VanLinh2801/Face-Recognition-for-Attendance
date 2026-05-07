# Hướng Dẫn Sửa Backend - Trang Nhân Sự (Ngắn Gọn)

Mục tiêu: đáp ứng đủ API cho trang Nhân sự và các trang được liên kết trực tiếp từ trang này.

## 1) Bổ sung filter phòng ban cho danh sách nhân sự
File chính: apps/backend/app/presentation/api/v1/persons.py

- Thêm query param `department_id: UUID | None` vào `GET /api/v1/persons`.
- Truyền param này xuống `ListPersonsQuery` và bổ sung xử lý ở application/repository.

Kết quả mong muốn:
- Frontend lọc theo phòng ban đúng ở server-side.
- Phù hợp khi phân trang lớn (không phụ thuộc lọc client-side).

## 2) Cho phép set status ngay khi tạo nhân sự
File chính: apps/backend/app/presentation/schemas/persons.py

- Thêm trường `status: PersonStatus | None = None` vào `CreatePersonRequest`.
- Trong `POST /api/v1/persons`, truyền `status` vào `CreatePersonCommand`.
- Nếu không truyền, giữ default hiện tại của domain.

Kết quả mong muốn:
- Form Thêm Nhân sự submit 1 lần là đủ (không cần tạo xong mới PATCH).

## 3) Thêm API lấy preview URL cho media asset
File chính: apps/backend/app/presentation/api/v1/media_assets.py

- Thêm endpoint: `GET /api/v1/media-assets/{asset_id}/presigned-url?expires_in=3600`
- Response tối thiểu:
  - `asset_id`
  - `url`
  - `expires_in`

Kết quả mong muốn:
- Trang chi tiết nhân sự/registration hiển thị được ảnh thật (không mock preview).

## 4) Test nhanh sau khi sửa
- `GET /api/v1/persons?department_id=<uuid>&page=1&page_size=20` trả đúng tập dữ liệu.
- `POST /api/v1/persons` có `status` và lưu đúng giá trị.
- `GET /api/v1/media-assets/{id}/presigned-url` trả URL truy cập được.

## Ưu tiên thực hiện
1. Filter `department_id` cho persons list
2. `status` trong create person
3. Presigned URL cho media asset

Tổng effort ước tính: 0.5-1.5 ngày (nếu tầng query/repo không quá phức tạp).