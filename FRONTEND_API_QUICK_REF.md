# 🚀 FRONTEND API QUICK REFERENCE
**Cho Frontend Dev** - Tất cả endpoint cần dùng để integrate backend

---

## 📌 PAGES & REQUIRED ENDPOINTS

### 🔐 Login Page (`/login`)
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/auth/me
```

---

### 📊 Dashboard (`/` và `/dashboard`)
```
WS     /api/ws/v1/realtime?channels=events.business,stream.overlay,stream.health
GET    /api/ws/v1/realtime/catchup?channel=events.business&since_timestamp=...&limit=100
GET    /api/v1/attendance/summary/daily?work_date=...
GET    /api/v1/departments                    (for department filter)
GET    /api/v1/persons                        (for person list)
```

**Realtime Event Types**:
- `recognition_event.detected` → Hiển thị recognition event
- `unknown_event.detected` → Hiển thị unknown person
- `spoof_alert.detected` → Hiển thị spoof alert
- `registration_processing.completed` → Cập nhật registration status
- `frame_analysis.updated` → Update overlay
- `stream.health.updated` → Update health status

**Media Loading**:
```
GET    /api/v1/media-assets/{asset_id}/presigned-url    (để load ảnh snapshot)
```

---

### 👥 Persons Page (`/persons`)
```
GET    /api/v1/persons?page=1&page_size=20&status=active
GET    /api/v1/departments                              (cho department dropdown)
POST   /api/v1/persons                                  (create)
GET    /api/v1/persons/{person_id}                      (get detail)
PATCH  /api/v1/persons/{person_id}                      (update)
DELETE /api/v1/persons/{person_id}                      (delete)
POST   /api/v1/persons/bulk-delete                      (bulk delete)
```

---

### ➕ Add Person Page (`/persons/new`)
```
POST   /api/v1/persons                                  (create person)
POST   /api/v1/persons/{person_id}/registrations        (register face)
GET    /api/v1/media-assets                             (list uploaded media)
GET    /api/v1/media-assets/{asset_id}/presigned-url    (load ảnh)
```

**Form submit flow**:
1. Upload ảnh → get file metadata
2. POST /persons → create person
3. POST /persons/{id}/registrations → register face
4. Poll GET /persons/{id}/registrations → monitor status (pending → validated → indexed)
5. Or listen WebSocket `registration_processing.completed`

---

### 👤 Person Detail Page (`/persons/[id]`)
```
GET    /api/v1/persons/{person_id}
GET    /api/v1/persons/{person_id}/registrations
GET    /api/v1/departments                        (để show department name)
PATCH  /api/v1/persons/{person_id}               (edit)
DELETE /api/v1/persons/{person_id}               (delete)
```

---

### 📸 Face Registration Page (`/persons/[id]/face-registrations/new`)
```
POST   /api/v1/persons/{person_id}/registrations        (create)
GET    /api/v1/persons/{person_id}/registrations        (monitor status)
WS     /api/ws/v1/realtime?channels=events.business    (listen registration_processing.completed)
GET    /api/v1/media-assets/{asset_id}/presigned-url    (preview)
```

---

### 📝 Attendance Page (`/attendance`)
```
GET    /api/v1/attendance/daily-presence?work_date=2026-05-06&department_id=...&include_child_departments=true
GET    /api/v1/departments                          (cho department filter)
GET    /api/v1/media-assets/{asset_id}/presigned-url    (load first/last snapshot)
GET    /api/v1/attendance/presence-statistics?from_date=...&to_date=...  (optional - stats)
```

**Table columns từ daily-presence**:
- person_full_name
- department_name
- first_seen_at
- last_seen_at
- recognition_count
- status (present/late/absent)
- action: view first/last snapshot

---

### 🎭 Events Page (`/events`)
```
GET    /api/v1/recognition-events?page=1&page_size=20&from_at=...&to_at=...     (Recognition tab)
GET    /api/v1/unknown-events?page=1&page_size=20&from_at=...&to_at=...         (Unknown tab)
GET    /api/v1/spoof-alert-events?page=1&page_size=20&from_at=...&to_at=...     (Spoof tab)
GET    /api/v1/media-assets/{asset_id}/presigned-url                            (load snapshot)
PATCH  /api/v1/unknown-events/{event_id}                                        (mark reviewed/ignored)
PATCH  /api/v1/spoof-alert-events/{event_id}                                    (mark reviewed/ignored)
WS     /api/ws/v1/realtime                                                       (realtime events)
```

**Event Detail Dialog**:
- Recognition: show person, match_score, registration, snapshot
- Unknown: show detection info, spoof_score, snapshot, allow mark as reviewed
- Spoof: show severity, spoof_score, person (if known), snapshot, allow mark as reviewed

---

### 🏢 Departments Page (`/departments`)
```
GET    /api/v1/departments?page=1&page_size=100
POST   /api/v1/departments                        (create)
GET    /api/v1/departments/{department_id}        (get detail)
PATCH  /api/v1/departments/{department_id}        (update)
DELETE /api/v1/departments/{department_id}        (delete)
```

**Hierarchical View**:
- Build tree từ parent_id
- Show all departments with parent reference
- Support expand/collapse per node
- Double-click node → go to department detail page

---

### 📁 Media Assets Page (`/media-assets`)
```
GET    /api/v1/media-assets?page=1&page_size=20&asset_type=...&from_at=...&to_at=...
GET    /api/v1/media-assets/{asset_id}/presigned-url    (load image)
```

---

## 🔑 KEY FEATURES BY ENDPOINT

### Authentication Flow
```javascript
// 1. Login
POST /api/v1/auth/login
→ Response: { access_token, refresh_token, expires_in }

// 2. Store tokens
localStorage.setItem('access_token', access_token)
localStorage.setItem('refresh_token', refresh_token)

// 3. Use token in all requests
Authorization: Bearer {access_token}

// 4. On 401 Unauthorized
POST /api/v1/auth/refresh
→ Get new access_token

// 5. Logout
POST /api/v1/auth/logout
→ Clear tokens, redirect to login
```

### Pagination
```
Query: ?page=1&page_size=20

Response:
{
  items: [...],
  total: 100,
  page: 1,
  page_size: 20
}
```

### Date Filter
```
Query: ?from_at=2026-05-01T00:00:00Z&to_at=2026-05-07T23:59:59Z
```

### Realtime WebSocket
```javascript
// Connect
const ws = new WebSocket(
  `wss://localhost:8000/api/ws/v1/realtime?token=${access_token}&channels=events.business,stream.overlay`
)

// Listen
ws.onmessage = (event) => {
  const message = JSON.parse(event.data)
  // {
  //   channel: "events.business",
  //   event_type: "recognition_event.detected",
  //   occurred_at: "2026-05-06T06:00:00Z",
  //   payload: {...},
  //   metadata: {...}
  // }
}

// Subscribe to channel
ws.send(JSON.stringify({
  action: 'subscribe',
  channel: 'stream.overlay'
}))

// Unsubscribe
ws.send(JSON.stringify({
  action: 'unsubscribe',
  channel: 'stream.overlay'
}))
```

### Catch-up After Reconnect
```javascript
// 1. Store last event timestamp
lastEventTimestamp = event.occurred_at

// 2. On reconnect
const response = await fetch(
  `/api/ws/v1/realtime/catchup?channel=events.business&since_timestamp=${lastEventTimestamp}&limit=100`,
  {
    headers: { Authorization: `Bearer ${token}` }
  }
)

// 3. Process missed events
const { items } = await response.json()
items.forEach(event => renderEvent(event))

// 4. Connect WebSocket for live
```

### Media Image Loading
```javascript
// Get presigned URL
const response = await fetch(
  `/api/v1/media-assets/${assetId}/presigned-url`,
  {
    headers: { Authorization: `Bearer ${token}` }
  }
)

const { url, expires_at } = await response.json()

// Use URL directly
<img src={url} alt="snapshot" />

// URL expires at: expires_at (usually 1 hour)
```

---

## 📋 API ERROR HANDLING

### Standard Error Response
```json
{
  "code": "validation_error",
  "message": "employee_code already exists",
  "details": {
    "employee_code": "EMP001"
  }
}
```

### Common Error Codes
```
validation_error    - Input validation failed
not_found          - Resource not found (404)
conflict           - Conflict (e.g., duplicate) (409)
unauthorized       - Auth failed (401)
forbidden          - Permission denied (403)
internal_error     - Server error (500)
```

### Status Codes
```
200 - OK
201 - Created
204 - No Content (for DELETE/successful PATCH)
400 - Bad Request (validation error)
401 - Unauthorized (auth failed)
403 - Forbidden (permission denied)
404 - Not Found
409 - Conflict (duplicate)
500 - Internal Server Error
```

---

## 🔄 DATA RELATIONSHIPS

```
Person
├── belongs_to → Department
├── has_many → FaceRegistrations
├── has_many → RecognitionEvents
├── has_many → SpoofAlertEvents
└── has_many → AttendanceExceptions

FaceRegistration
├── belongs_to → Person
├── has_one → MediaAsset (source)
└── has_one → MediaAsset (face_crop)

RecognitionEvent
├── belongs_to → Person
├── belongs_to → FaceRegistration
└── has_one → MediaAsset (snapshot)

UnknownEvent
└── has_one → MediaAsset (snapshot)

SpoofAlertEvent
├── belongs_to → Person (optional)
└── has_one → MediaAsset (snapshot)

MediaAsset
└── used_by → various events/registrations

Department
└── has_many → Persons (children)
└── parent_id → Department (parent)
```

---

## 🎯 IMPLEMENTATION PRIORITY

### Phase 1 (Week 1) - MVP Core
- [ ] Auth pages + flow
- [ ] Persons list/create/edit/delete
- [ ] Departments CRUD
- [ ] Face registrations (create + monitor)
- [ ] Attendance daily presence
- [ ] Events list (Recognition/Unknown/Spoof)
- [ ] REST API integration for all above

### Phase 2 (Week 2) - Realtime + Polish
- [ ] WebSocket integration
- [ ] Catch-up logic
- [ ] Presigned URL for images
- [ ] Event detail dialogs
- [ ] Unknown/Spoof event update (mark reviewed)
- [ ] Dashboard realtime

### Phase 3 (Week 3) - Statistics + Hardening
- [ ] Attendance statistics (optional)
- [ ] Error handling + loading states
- [ ] Accessibility review
- [ ] Performance optimization

---

## 📌 NOTES FOR FRONTEND DEV

1. **Token Management**: Store in secure place (localStorage hoặc cookie HTTP-only)
2. **Auto-refresh**: Implement token refresh before expiry
3. **Error Handling**: Show user-friendly messages, log errors
4. **Loading States**: Show spinners during API calls
5. **Pagination**: Implement lazy-loading hoặc paginator
6. **Date Formatting**: Use ISO 8601 for API, format for UI display
7. **Realtime**: Use WebSocket for live events, fallback to polling if needed
8. **Images**: Use presigned URLs, handle 404/expired URLs gracefully
9. **Offline**: Cache data locally, sync on reconnect
10. **Testing**: Mock API responses for development

---

**Last Updated**: 07/05/2026  
**API Version**: v1  
**Base URL**: `http://localhost:8000` (local) or `http://localhost:18000` (Docker)
