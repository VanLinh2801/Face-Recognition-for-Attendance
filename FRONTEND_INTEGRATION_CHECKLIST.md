# ✅ FRONTEND INTEGRATION CHECKLIST
**For Frontend Dev** - Page-by-page API requirements & implementation checklist

---

## 🔐 PAGE 1: LOGIN PAGE

**Route**: `/login` and `/logout`

### APIs Needed
```
POST   /api/v1/auth/login              ✅ Ready
POST   /api/v1/auth/refresh            ✅ Ready
POST   /api/v1/auth/logout             ✅ Ready
GET    /api/v1/auth/me                 ✅ Ready
```

### Frontend Tasks
- [ ] Create login form (username, password)
- [ ] POST /auth/login on submit
- [ ] Store access_token + refresh_token securely
- [ ] Redirect to dashboard on success
- [ ] Handle errors gracefully
- [ ] Implement token refresh logic (auto-refresh before expiry)
- [ ] Add logout button (POST /auth/logout)
- [ ] Add "current user" display (GET /auth/me)
- [ ] Protect routes - redirect to login if no token

### Estimated Effort
⏱️ **2-3 days** (including auth interceptor, token refresh, protected routes)

---

## 📊 PAGE 2: DASHBOARD

**Route**: `/` and `/dashboard`

### APIs Needed
```
✅ WS     /api/ws/v1/realtime                        Ready
✅ GET    /api/ws/v1/realtime/catchup                Ready
✅ GET    /api/v1/attendance/summary/daily           Ready
✅ GET    /api/v1/departments                        Ready
✅ GET    /api/v1/persons                            Ready
```

### Frontend Tasks
- [ ] Display live camera feed (placeholder for now)
- [ ] Show latest events in sidebar (connected to WebSocket)
- [ ] Implement WebSocket connection
  - [ ] Connect with auth token
  - [ ] Subscribe to `events.business`, `stream.overlay`, `stream.health`
  - [ ] Handle reconnect + catch-up logic
- [ ] Render event cards in realtime
- [ ] Display stat cards (total events, unique persons, entries/exits)
- [ ] Show system health status
- [ ] Handle WebSocket disconnect/reconnect gracefully

### Estimated Effort
⏱️ **4-5 days** (WebSocket integration, realtime event handling, UI polish)

---

## 👥 PAGE 3: PERSONS LIST PAGE

**Route**: `/persons`

### APIs Needed
```
✅ GET    /api/v1/persons?page=1&page_size=20&status=active      Ready
✅ GET    /api/v1/departments                                     Ready
```

### Frontend Tasks
- [ ] Fetch persons list with pagination
- [ ] Fetch departments (for filter + department name display)
- [ ] Render table with columns:
  - STT (sequential number, not employee_code)
  - Full Name
  - Department (name)
  - Title
  - Status badge
  - Actions (edit, add face, delete)
- [ ] Add filtering:
  - [ ] By status (active/inactive/resigned)
  - [ ] By department (with hierarchy support)
- [ ] Add search by name/employee_code
- [ ] Implement multi-select with checkboxes
- [ ] "Add Person" button → goto `/persons/new`
- [ ] "Select All" header checkbox
- [ ] Bulk delete with confirmation dialog
- [ ] Row actions dropdown:
  - [ ] View detail → `/persons/[id]`
  - [ ] Add face → `/persons/[id]/face-registrations/new`
  - [ ] Edit → show modal or goto edit page
  - [ ] Delete → confirm dialog

### Estimated Effort
⏱️ **3-4 days** (table, filters, actions, modals)

---

## ➕ PAGE 4: ADD PERSON PAGE

**Route**: `/persons/new`

### APIs Needed
```
✅ POST   /api/v1/persons                           Ready
✅ POST   /api/v1/persons/{person_id}/registrations Ready
✅ GET    /api/v1/media-assets                      Ready
⏳ GET    /api/v1/media-assets/{asset_id}/presigned-url  NEEDED
```

### Frontend Tasks
- [ ] Create two-step form:
  1. Personal info section (name, code, dept, title, email, phone, join date, notes)
  2. Face registration section (upload image + register)
- [ ] Personal info form:
  - [ ] Text inputs for basic fields
  - [ ] Department dropdown (GET /departments)
  - [ ] Status dropdown
  - [ ] Validation
  - [ ] Save person → POST /persons
- [ ] Face registration:
  - [ ] File upload input
  - [ ] Upload to MinIO or through backend
  - [ ] Show preview after upload
  - [ ] Create registration → POST /registrations
  - [ ] Monitor registration status:
    - pending → validated → indexed
  - [ ] Show error if face validation fails
- [ ] Success message
- [ ] Redirect to person detail page

### Estimated Effort
⏱️ **3-4 days** (form validation, file upload, status monitoring)

---

## 👤 PAGE 5: PERSON DETAIL PAGE

**Route**: `/persons/[id]`

### APIs Needed
```
✅ GET    /api/v1/persons/{person_id}                    Ready
✅ GET    /api/v1/persons/{person_id}/registrations      Ready
✅ PATCH  /api/v1/persons/{person_id}                    Ready
✅ DELETE /api/v1/persons/{person_id}                    Ready
✅ GET    /api/v1/departments                             Ready
⏳ GET    /api/v1/media-assets/{asset_id}/presigned-url  NEEDED
```

### Frontend Tasks
- [ ] Load person detail (GET /persons/{id})
- [ ] Load registrations (GET /persons/{id}/registrations)
- [ ] Display personal info in read/edit mode
- [ ] Display registrations table:
  - Columns: Registration Date, Status, Model Version, Indexed At, Actions
  - Actions: View, Delete
- [ ] Edit button → toggle edit mode or modal
- [ ] Edit form:
  - [ ] Same fields as add person (except employee_code - read only)
  - [ ] Department dropdown (GET /departments)
  - [ ] Save → PATCH /persons/{id}
- [ ] Delete button → confirm dialog → DELETE /persons/{id}
- [ ] "Add Face Registration" button → goto `/persons/[id]/face-registrations/new`
- [ ] Show face image preview (with presigned-url when available)
- [ ] Breadcrumb navigation

### Estimated Effort
⏱️ **2-3 days** (edit mode, registrations display, image preview)

---

## 📸 PAGE 6: FACE REGISTRATION PAGE

**Route**: `/persons/[id]/face-registrations/new`

### APIs Needed
```
✅ POST   /api/v1/persons/{person_id}/registrations        Ready
✅ GET    /api/v1/persons/{person_id}/registrations        Ready
✅ WS     /api/ws/v1/realtime                              Ready
⏳ GET    /api/v1/media-assets/{asset_id}/presigned-url    NEEDED
```

### Frontend Tasks
- [ ] Show person name and employee code at top
- [ ] File upload area
  - [ ] Drag & drop support
  - [ ] File browser
  - [ ] Validation (only images, max size)
  - [ ] Preview
- [ ] Upload handling:
  - [ ] Show upload progress
  - [ ] Create registration → POST /registrations
  - [ ] Get registration object with status
- [ ] Status monitoring:
  - [ ] Poll GET /registrations periodically
  - [ ] Or listen to WebSocket `registration_processing.completed` event
  - [ ] Show status: pending → validated → indexed
  - [ ] Show error if failed
  - [ ] Auto-hide on success
- [ ] Success message with "Go Back" button
- [ ] Loading state during upload + processing

### Estimated Effort
⏱️ **2-3 days** (file upload, polling/WebSocket, status display)

---

## 📝 PAGE 7: ATTENDANCE PAGE

**Route**: `/attendance`

### APIs Needed
```
⏳ GET    /api/v1/attendance/daily-presence?work_date=...        NEEDED (CRITICAL)
✅ GET    /api/v1/departments                                     Ready
✅ GET    /api/v1/attendance/summary/daily                        Ready
⏳ GET    /api/v1/media-assets/{asset_id}/presigned-url          NEEDED
⏳ GET    /api/v1/attendance/presence-statistics                  NEEDED (Optional)
```

### Frontend Tasks
- [ ] Date picker (select work_date)
- [ ] Department filter dropdown
  - [ ] Hierarchical view option
  - [ ] "Include child departments" toggle
- [ ] Fetch daily-presence data
- [ ] Display presence table:
  - Columns: STT, Full Name, Department, First Seen, Last Seen, Recognition Count, Status, Actions
  - Status badge: present (green), late (yellow), absent (red)
  - Actions: View first snapshot, View last snapshot
- [ ] Snapshot modal:
  - [ ] Show full-size image
  - [ ] Get presigned URL → GET /media-assets/{id}/presigned-url
  - [ ] Display with timestamp
- [ ] Summary stats (total, present, late, absent)
- [ ] Optional: Statistics tab (if time allows)
  - [ ] Date range filter
  - [ ] Statistics table: present_days, late_days, absent_days
  - [ ] Chart visualization

### Estimated Effort
⏱️ **3-4 days** (table, filtering, snapshots, optional statistics)

---

## 🎭 PAGE 8: EVENTS PAGE

**Route**: `/events`

### APIs Needed
```
✅ GET    /api/v1/recognition-events?page=1&page_size=20&from_at=...&to_at=...    Ready
✅ GET    /api/v1/unknown-events?page=1&page_size=20&from_at=...&to_at=...        Ready
✅ GET    /api/v1/spoof-alert-events?page=1&page_size=20&from_at=...&to_at=...    Ready
⏳ PATCH  /api/v1/unknown-events/{event_id}                                        NEEDED
⏳ PATCH  /api/v1/spoof-alert-events/{event_id}                                    NEEDED
⏳ GET    /api/v1/media-assets/{asset_id}/presigned-url                           NEEDED
✅ WS     /api/ws/v1/realtime                                                       Ready
```

### Frontend Tasks
- [ ] Tab navigation: All / Recognition / Unknown / Spoof
- [ ] Time range filter (from_at, to_at)
- [ ] For each event type, render table:
  - Recognition: Person, Time, Match Score, Direction, Actions
  - Unknown: Time, Spoof Score, Direction, Status, Actions
  - Spoof: Time, Severity, Person (if known), Status, Actions
- [ ] Row action: Click to open detail dialog
- [ ] Detail dialog:
  - [ ] Show full event info
  - [ ] Display snapshot (with presigned URL)
  - [ ] For Unknown/Spoof: 
    - [ ] Show review_status (new/reviewed/ignored)
    - [ ] Add button to mark as reviewed/ignored
    - [ ] Add notes input
    - [ ] PATCH endpoint on submit
- [ ] Real-time integration:
  - [ ] Connect WebSocket
  - [ ] Listen to `recognition_event.detected`, `unknown_event.detected`, `spoof_alert.detected`
  - [ ] New events appear at top of list
  - [ ] Badge count on tabs
- [ ] Pagination
- [ ] Loading states

### Estimated Effort
⏱️ **4-5 days** (tabs, filtering, dialogs, realtime, updates)

---

## 🏢 PAGE 9: DEPARTMENTS PAGE

**Route**: `/departments`

### APIs Needed
```
✅ GET    /api/v1/departments?page=1&page_size=100    Ready
✅ POST   /api/v1/departments                          Ready
✅ GET    /api/v1/departments/{department_id}          Ready
✅ PATCH  /api/v1/departments/{department_id}          Ready
✅ DELETE /api/v1/departments/{department_id}          Ready
```

### Frontend Tasks
- [ ] Display departments in two views:
  1. Table view (for list management)
  2. Hierarchical tree view (for organization structure)
- [ ] Table view:
  - Columns: STT, Code, Name, Parent (trực thuộc), Active Status, Actions
  - Actions: View detail, Edit, Delete
  - Multi-select + bulk delete (optional)
- [ ] Tree view:
  - Expand/collapse nodes
  - Double-click node → go to detail page
  - Show parent relationships
- [ ] "Add Department" button → open dialog
- [ ] Create dialog:
  - Code input
  - Name input
  - Parent department dropdown
  - Active checkbox
  - Save → POST /departments
- [ ] Detail page (/departments/[id]):
  - Show department info
  - Edit button → modal or edit page
  - Delete button → confirm
  - Show child departments (hierarchical)
  - PATCH on save
  - DELETE on delete

### Estimated Effort
⏱️ **2-3 days** (tree view, CRUD dialogs, hierarchical display)

---

## 📁 PAGE 10: MEDIA ASSETS PAGE

**Route**: `/media-assets` (optional - might not be high priority)

### APIs Needed
```
✅ GET    /api/v1/media-assets?page=1&page_size=20&asset_type=...&from_at=...&to_at=...  Ready
⏳ GET    /api/v1/media-assets/{asset_id}/presigned-url                                 NEEDED
```

### Frontend Tasks
- [ ] List media assets with filters:
  - Asset type (registration_face, recognition_snapshot, etc.)
  - Date range
- [ ] Display table:
  - Columns: Filename, Type, Size, Uploaded At, Storage Info
  - Thumbnail preview (with presigned-url)
- [ ] Pagination
- [ ] Optional: Filter by person/event

### Estimated Effort
⏱️ **1-2 days** (low priority for MVP)

---

## 📊 IMPLEMENTATION ORDER (RECOMMENDED)

### Week 1 Priority
1. ✅ **Login page** (2-3 days) - Foundation for everything
2. ✅ **Persons list** (3-4 days) - Core feature
3. ✅ **Add person** (3-4 days) - Core feature

### Week 2 Priority
4. ✅ **Person detail** (2-3 days)
5. ✅ **Face registration** (2-3 days)
6. ⏳ **Attendance** (3-4 days) - Needs Daily Presence API
7. ⏳ **Events** (4-5 days) - Needs Update endpoints

### Week 3 Priority
8. ✅ **Departments** (2-3 days)
9. ⏳ **Dashboard realtime** (4-5 days) - WebSocket integration
10. ✅ **Media assets** (1-2 days) - Optional, low priority

---

## 🚨 BLOCKERS

### Backend must deliver BEFORE Frontend can proceed:
- ⏳ Daily Presence API (blocks Attendance page)
- ⏳ Presigned URL API (blocks image display everywhere)
- ⏳ Update Unknown/Spoof events (blocks event management)

**Estimated wait**: 2-3 days for backend

---

## ✅ DEPLOYMENT CHECKLIST

Before going to production:
- [ ] All endpoints tested with real backend
- [ ] Error handling implemented for all API calls
- [ ] Loading states on all pages
- [ ] Token refresh working correctly
- [ ] WebSocket reconnection working
- [ ] Image loading with fallbacks
- [ ] Pagination working on all list pages
- [ ] Sorting working where applicable
- [ ] Filters working correctly
- [ ] Bulk actions working
- [ ] Form validation on all inputs
- [ ] Date/time formatting correct
- [ ] Responsive design on mobile
- [ ] Accessibility review (WCAG)
- [ ] Performance optimization (lazy loading, memoization)
- [ ] Error boundaries + error messages
- [ ] Logging/monitoring setup

---

## 📞 SUPPORT & REFERENCE

**Questions about APIs?** → See [FRONTEND_API_QUICK_REF.md](FRONTEND_API_QUICK_REF.md)  
**Need detailed specs?** → See [FRONTEND_API_AUDIT.md](FRONTEND_API_AUDIT.md)  
**Backend status?** → See [docs/backend_overall_status.md](docs/backend_overall_status.md)

---

**Last Updated**: 07/05/2026  
**Status**: Ready for frontend dev to start integration after waiting for 4 critical APIs
