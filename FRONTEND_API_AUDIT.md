# 📋 FRONTEND API REQUIREMENTS AUDIT
**Thời gian**: 07/05/2026

---

## 🎯 MỤC TIÊU

Sàng lọc toàn bộ các API endpoint cần thiết để **Frontend hoạt động được** kết nối với Backend.

Bao gồm:
1. ✅ APIs đã có trong backend (hoạt động)
2. ⏳ APIs cần thêm/bổ sung
3. ❌ APIs thiếu hoàn toàn

---

## 📊 TÓML THỐNG KÊ

| Loại | Tổng | Đã có | Cần thêm | Thiếu |
|---|---|---|---|---|
| **Auth** | 4 | ✅ 4 | 0 | 0 |
| **Persons** | 6 | ✅ 6 | 0 | 0 |
| **Face Registrations** | 5 | ✅ 5 | 0 | 0 |
| **Departments** | 5 | ✅ 5 | 0 | 0 |
| **Recognition Events** | 3 | ✅ 3 | 0 | 0 |
| **Unknown Events** | 2 | ✅ 2 | 0 | 0 |
| **Spoof Alerts** | 2 | ✅ 2 | 0 | 0 |
| **Attendance** | 5 | ✅ 2 | ⏳ 3 | 0 |
| **Attendance Exceptions** | 6 | ✅ 6 | 0 | 0 |
| **Media Assets** | 3 | ✅ 2 | ⏳ 1 | 0 |
| **Realtime/WebSocket** | 2 | ✅ 2 | 0 | 0 |
| **Realtime Catch-up** | 1 | ✅ 1 | 0 | 0 |
| **TOTAL** | **47** | ✅ **41** | ⏳ **4** | ❌ **0** |

---

## 📌 PHÂN LOẠI CHI TIẾT

### ✅ 1. AUTHENTICATION (4 endpoints) - HOÀN THÀNH

```
✅ POST   /api/v1/auth/login              - Admin login
✅ POST   /api/v1/auth/refresh            - Refresh token
✅ POST   /api/v1/auth/logout             - Logout (revoke token)
✅ GET    /api/v1/auth/me                 - Get current user
```

**Frontend cần**: 
- Login form, token storage, auth interceptor
- Auto-refresh logic

---

### ✅ 2. PERSONS MANAGEMENT (6 endpoints) - HOÀN THÀNH

```
✅ GET    /api/v1/persons                 - List (page, status, from_at, to_at)
✅ POST   /api/v1/persons                 - Create
✅ GET    /api/v1/persons/{person_id}    - Get detail
✅ PATCH  /api/v1/persons/{person_id}    - Update
✅ DELETE /api/v1/persons/{person_id}    - Delete
✅ POST   /api/v1/persons/bulk-delete    - Bulk delete
```

**Frontend dùng cho**:
- `/persons` page: List, create, edit, delete, bulk delete
- `/persons/[id]` page: Detail, edit

**Yêu cầu UI từ frontend**:
- Filter by department (nên support trong query)

---

### ✅ 3. FACE REGISTRATIONS (5 endpoints) - HOÀN THÀNH

```
✅ POST   /api/v1/persons/{person_id}/registrations         - Create
✅ GET    /api/v1/persons/{person_id}/registrations         - List
✅ GET    /api/v1/persons/{person_id}/registrations/{reg_id}  - Get detail
✅ DELETE /api/v1/persons/{person_id}/registrations/{reg_id}  - Delete
✅ POST   /api/v1/internal/registrations/events/completed   - Internal webhook
```

**Frontend dùng cho**:
- `/persons/[id]/face-registrations/new` page: Create registration
- Person detail xem registrations

**Status tracking**:
- pending → validated → indexed (hoặc failed)
- Frontend theo dõi status từ WebSocket hoặc polling

---

### ✅ 4. DEPARTMENTS MANAGEMENT (5 endpoints) - HOÀN THÀNH

```
✅ GET    /api/v1/departments                 - List (page, is_active)
✅ POST   /api/v1/departments                 - Create
✅ GET    /api/v1/departments/{department_id} - Get detail
✅ PATCH  /api/v1/departments/{department_id} - Update
✅ DELETE /api/v1/departments/{department_id} - Delete
```

**Frontend dùng cho**:
- `/departments` page: CRUD
- `/departments/[id]` page: Hierarchical view

---

### ✅ 5. RECOGNITION EVENTS (3 endpoints) - HOÀN THÀNH

```
✅ GET    /api/v1/recognition-events              - List (page, from_at, to_at)
✅ GET    /api/v1/recognition-events/{event_id}  - Get detail
(No delete/update - events are immutable)
```

**Frontend dùng cho**:
- `/events` page (Recognition tab)
- Realtime event feed
- Dashboard event list

---

### ✅ 6. UNKNOWN EVENTS (2 endpoints) - HOÀN THÀNH

```
✅ GET    /api/v1/unknown-events              - List (page, from_at, to_at, review_status)
✅ GET    /api/v1/unknown-events/{event_id}  - Get detail
```

**Frontend dùng cho**:
- `/events` page (Unknown tab)
- Realtime event feed

**TODO Backend**: Update unknown event (to change review_status) - MISSING!

---

### ✅ 7. SPOOF ALERT EVENTS (2 endpoints) - HOÀN THÀNH

```
✅ GET    /api/v1/spoof-alert-events              - List (page, from_at, to_at, review_status)
✅ GET    /api/v1/spoof-alert-events/{event_id}  - Get detail
```

**Frontend dùng cho**:
- `/events` page (Spoof tab)
- Realtime event feed

**TODO Backend**: Update spoof alert (to change review_status) - MISSING!

---

### ⏳ 8. ATTENDANCE MODULE (5 endpoints) - PARTIALLY DONE

#### ✅ Đã có (2):
```
✅ GET    /api/v1/attendance/events              - List (page, person_id, from_at, to_at)
✅ GET    /api/v1/attendance/events/{event_id}  - Get detail
```

#### ⏳ Cần thêm (3):
```
⏳ GET    /api/v1/attendance/daily-presence      - Daily presence per person
⏳ GET    /api/v1/attendance/presence-statistics - Statistics by period
✅ GET    /api/v1/attendance/summary/daily       - Đã có nhưng cần extend
```

**Frontend dùng cho**:
- `/attendance` page: Daily presence table
- Statistics / report

**Chi tiết API cần thêm**:

#### 1) Daily Presence API
```http
GET /api/v1/attendance/daily-presence?work_date=2026-05-07
```

Query params:
- `work_date` (bắt buộc) - ISO date
- `department_id` (tùy chọn)
- `include_child_departments` (default true)
- `status` - present | late | absent
- `person_id` (tùy chọn)
- `page` (default 1)
- `page_size` (default 20)

Response:
```json
{
  "items": [
    {
      "person_id": "uuid",
      "person_full_name": "Nguyen Van A",
      "employee_code": "EMP001",
      "department_id": "uuid",
      "department_name": "Engineering",
      "work_date": "2026-05-07",
      "first_seen_at": "2026-05-07T08:01:00Z",
      "last_seen_at": "2026-05-07T17:45:00Z",
      "first_snapshot_media_asset_id": "uuid",
      "last_snapshot_media_asset_id": "uuid",
      "recognition_count": 3,
      "best_match_score": 0.96,
      "max_spoof_score": 0.03,
      "status": "present"
    }
  ],
  "total": 7,
  "page": 1,
  "page_size": 20
}
```

**Ghi chú**:
- Tính từ `recognition_events` có `is_valid = true`
- Group by person + work_date
- Include `first_snapshot_media_asset_id`, `last_snapshot_media_asset_id` để frontend load preview
- Status logic: `present` nếu `first_seen_at` <= 8:30, `late` nếu > 8:30, `absent` nếu không có record
- Department hierarchy: nếu `include_child_departments=true`, lấy nhân viên từ tất cả phòng ban con

#### 2) Presence Statistics API
```http
GET /api/v1/attendance/presence-statistics?from_date=2026-05-01&to_date=2026-05-31
```

Query params:
- `from_date`, `to_date` (bắt buộc)
- `department_id` (tùy chọn)
- `include_child_departments` (default true)
- `person_search` (tùy chọn - search name/code)
- `page` (default 1)
- `page_size` (default 20)

Response:
```json
{
  "items": [
    {
      "person_id": "uuid",
      "person_full_name": "Nguyen Van A",
      "employee_code": "EMP001",
      "department_id": "uuid",
      "department_name": "Engineering",
      "present_days": 20,
      "late_days": 2,
      "absent_days": 3,
      "total_recognitions": 48
    }
  ],
  "total": 7,
  "page": 1,
  "page_size": 20
}
```

#### 3) Update Daily Summary Response
```http
GET /api/v1/attendance/summary/daily?work_date=2026-05-07
```

Existing response:
```json
{
  "work_date": "2026-05-07",
  "total_events": 10,
  "unique_persons": 7,
  "total_entries": 5,
  "total_exits": 5
}
```

Có thể giữ nguyên hoặc extend với thêm field: `present_count`, `late_count`, `absent_count`

---

### ✅ 9. ATTENDANCE EXCEPTIONS (6 endpoints) - HOÀN THÀNH

```
✅ POST   /api/v1/attendance-exceptions               - Create
✅ GET    /api/v1/attendance-exceptions               - List
✅ GET    /api/v1/attendance-exceptions/{exception_id} - Get
✅ PATCH  /api/v1/attendance-exceptions/{exception_id} - Update
✅ DELETE /api/v1/attendance-exceptions/{exception_id} - Delete
✅ POST   /api/v1/attendance-exceptions/bulk-delete   - Bulk delete
```

**Frontend dùng cho**:
- Exception management (nếu có)
- Attendance adjustment

---

### ⏳ 10. MEDIA ASSETS (3 endpoints) - PARTIALLY DONE

#### ✅ Đã có (2):
```
✅ GET    /api/v1/media-assets                    - List (page, asset_type, from_at, to_at)
✅ POST   /api/v1/internal/media-assets/cleanup   - Internal cleanup
```

#### ⏳ Cần thêm (1):
```
⏳ GET    /api/v1/media-assets/{media_asset_id}/presigned-url
   OR
⏳ GET    /api/v1/media-assets/{media_asset_id}/content
```

**Frontend cần**: Display ảnh snapshot từ MinIO
- Presigned URL (khuyến nghị): Frontend load từ URL trực tiếp, không qua backend
- Content proxy: Backend trả binary, frontend render

**Chi tiết API cần thêm**:

#### Presigned URL API (KHUYẾN NGHỊ)
```http
GET /api/v1/media-assets/{media_asset_id}/presigned-url
```

Response:
```json
{
  "media_asset_id": "uuid",
  "url": "https://minio.example.com/attendance/registrations/...",
  "expires_at": "2026-05-07T09:00:00Z",
  "content_type": "image/jpeg"
}
```

**Lợi ích**:
- Frontend tải ảnh mà không cần qua backend
- Giảm tải cho backend
- URL có thời hạn (security)
- MinIO credential không expose cho frontend

**Cách dùng**:
```javascript
// Frontend
const response = await fetch(`/api/v1/media-assets/${assetId}/presigned-url`);
const { url } = await response.json();
// Use url directly in <img src={url} />
```

---

### ✅ 11. REALTIME - WEBSOCKET (2 endpoints) - HOÀN THÀNH

```
✅ WS    /api/ws/v1/realtime                      - WebSocket realtime events
✅ GET   /api/ws/v1/realtime/catchup              - Catch-up events after disconnect
```

**Frontend dùng cho**:
- Dashboard live event feed
- Real-time overlay update
- Health status update

**Channels**:
- `events.business` - Recognition, Unknown, Spoof, Registration completed
- `stream.overlay` - Frame overlay data
- `stream.health` - Stream health metrics

---

## 🔍 CHI TIẾT CÁC API CẦN THÊM/SỬA

### 📌 PRIORITY 1 - CRITICAL FOR MVP

#### 1️⃣ Daily Presence API (URGENT)
- **Endpoint**: `GET /api/v1/attendance/daily-presence`
- **Tính năng**: Show ai đi làm, ai đi muộn, ai vắng
- **Frontend page**: `/attendance` (main feature)
- **Khó độ**: Medium
- **Dependencies**: recognition_events table aggregate

#### 2️⃣ Presigned URL API for Media (URGENT)
- **Endpoint**: `GET /api/v1/media-assets/{media_asset_id}/presigned-url`
- **Tính năng**: Frontend load ảnh snapshot từ MinIO
- **Frontend pages**: Events detail dialog, Attendance daily presence snapshots
- **Khó độ**: Easy
- **Dependencies**: MinIO client in backend

#### 3️⃣ Update Unknown Event (NEW)
- **Endpoint**: `PATCH /api/v1/unknown-events/{event_id}`
- **Request**: `{ "review_status": "reviewed|ignored", "notes": "..." }`
- **Tính năng**: Frontend mark unknown event as reviewed/ignored
- **Khó độ**: Easy

#### 4️⃣ Update Spoof Alert (NEW)
- **Endpoint**: `PATCH /api/v1/spoof-alert-events/{event_id}`
- **Request**: `{ "review_status": "reviewed|ignored", "notes": "..." }`
- **Tính năng**: Frontend mark spoof alert as reviewed/ignored
- **Khó độ**: Easy

---

### 📌 PRIORITY 2 - NICE TO HAVE FOR MVP+

#### 5️⃣ Presence Statistics API (NICE TO HAVE)
- **Endpoint**: `GET /api/v1/attendance/presence-statistics`
- **Tính năng**: Statistics dashboard (present days, late days, absent days)
- **Frontend page**: `/attendance` (secondary feature, if time allows)
- **Khó độ**: Medium

---

## ✅ CHECKLIST API IMPLEMENTATION

### Backend Checklist (what needs to be done)

#### CRITICAL (Để MVP hoạt động):
- [ ] **Daily Presence API**: GET /api/v1/attendance/daily-presence
  - [ ] Query logic: aggregate recognition_events by person + work_date
  - [ ] Include first/last snapshot media asset IDs
  - [ ] Support department filtering + child departments
  - [ ] Calculate status (present/late/absent)
  - [ ] Pagination

- [ ] **Presigned URL API**: GET /api/v1/media-assets/{media_asset_id}/presigned-url
  - [ ] Generate presigned URL from MinIO
  - [ ] Set expiration time
  - [ ] Return URL + metadata

- [ ] **Update Unknown Event**: PATCH /api/v1/unknown-events/{event_id}
  - [ ] Update review_status, notes
  - [ ] Soft delete support if needed

- [ ] **Update Spoof Alert**: PATCH /api/v1/spoof-alert-events/{event_id}
  - [ ] Update review_status, notes
  - [ ] Soft delete support if needed

#### NICE TO HAVE:
- [ ] **Presence Statistics API**: GET /api/v1/attendance/presence-statistics
  - [ ] Calculate present_days, late_days, absent_days
  - [ ] Support date range + department filtering
  - [ ] Pagination

---

### Frontend Checklist (what needs to be done)

#### CRITICAL:
- [ ] Integrate with Daily Presence API → `/attendance` page
- [ ] Implement Presigned URL loading → Event dialogs, Attendance snapshots
- [ ] Add Update UI for Unknown/Spoof events (review_status toggle)
- [ ] WebSocket realtime connection → Dashboard event feed
- [ ] Catch-up logic after disconnect

#### NICE TO HAVE:
- [ ] Statistics page using Presence Statistics API
- [ ] Advanced filtering (department hierarchy)

---

## 📊 SUMMARY TABLE

| API Endpoint | Method | Priority | Status | Est. Effort |
|---|---|---|---|---|
| Daily Presence | GET | 🔴 CRITICAL | ⏳ New | 1-2 days |
| Presigned URL | GET | 🔴 CRITICAL | ⏳ New | 0.5 days |
| Update Unknown Event | PATCH | 🔴 CRITICAL | ⏳ New | 2 hours |
| Update Spoof Alert | PATCH | 🔴 CRITICAL | ⏳ New | 2 hours |
| Presence Statistics | GET | 🟡 NICE | ⏳ New | 1-2 days |
| **All Others** | - | ✅ DONE | ✅ Ready | - |

---

## 💡 RECOMMENDATION

### Cho Backend Team:
1. **Week 1**: Implement 4 critical APIs (Daily Presence, Presigned URL, 2x PATCH)
2. **Week 2**: (Optional) Presence Statistics API

### Cho Frontend Team:
1. **Week 1**: 
   - Integrate REST APIs (all list/detail endpoints)
   - Implement auth flow
   - Connect `/attendance` page with Daily Presence API

2. **Week 2**:
   - WebSocket realtime integration
   - Presigned URL loading for snapshots
   - Event detail dialogs

3. **Week 3**:
   - Polish UI/UX
   - Error handling
   - Loading states

---

## 📎 REFERENCE DOCS

- Backend integration: [frontend_backend_integration.md](frontend_backend_integration.md)
- API upgrade notes: [backend_api_upgrade_notes.md](backend_api_upgrade_notes.md)
- Frontend current state: [frontend_current_state.md](frontend_current_state.md)
- Backend overall status: [backend_overall_status.md](backend_overall_status.md)

---

**Generated**: 07/05/2026  
**Last Updated**: 07/05/2026
