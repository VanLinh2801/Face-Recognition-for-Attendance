# 📊 FRONTEND API STATUS OVERVIEW

**Generated**: 07/05/2026

---

## 🎯 EXECUTIVE SUMMARY

Frontend cần **47 API endpoints** để hoạt động đầy đủ.

| Status | Count | Detail |
|--------|-------|--------|
| ✅ **Ready** | **41** | Đã implement trong backend, sẵn sàng dùng |
| ⏳ **Needed** | **4** | Cần implement urgently cho MVP |
| ❌ **Missing** | **0** | Không thiếu endpoint nào, chỉ cần thêm các field |

**Kết luận**: Backend infrastructure rất vững, chỉ cần thêm **4 endpoints** là frontend có thể integrate được 100%.

---

## 📋 BREAKDOWN BY CATEGORY

### ✅ AUTHENTICATION (4/4 - READY)
```
✅ Login, Refresh, Logout, GetMe
```

### ✅ PERSONS (6/6 - READY)
```
✅ List, Create, Get, Update, Delete, Bulk Delete
```

### ✅ FACE REGISTRATIONS (5/5 - READY)
```
✅ Create, List, Get, Delete, + Internal webhook
```

### ✅ DEPARTMENTS (5/5 - READY)
```
✅ List, Create, Get, Update, Delete
```

### ✅ RECOGNITION EVENTS (3/3 - READY)
```
✅ List, Get Detail, (no update/delete - immutable)
```

### ✅ UNKNOWN EVENTS (2/3 - PARTIALLY READY)
```
✅ List, Get Detail
⏳ Update (mark reviewed/ignored) - NEEDED
```

### ✅ SPOOF ALERTS (2/3 - PARTIALLY READY)
```
✅ List, Get Detail
⏳ Update (mark reviewed/ignored) - NEEDED
```

### ✅ ATTENDANCE EXCEPTIONS (6/6 - READY)
```
✅ Create, List, Get, Update, Delete, Bulk Delete
```

### ⏳ ATTENDANCE MODULE (3/5 - PARTIALLY READY)
```
✅ List Events, Get Event Detail
⏳ Daily Presence - NEEDED (CRITICAL)
⏳ Presence Statistics - NEEDED (Nice to have)
```

### ⏳ MEDIA ASSETS (2/3 - PARTIALLY READY)
```
✅ List
⏳ Get Presigned URL - NEEDED (CRITICAL)
```

### ✅ REALTIME (2/2 - READY)
```
✅ WebSocket realtime
✅ Catch-up after disconnect
```

---

## 🔴 CRITICAL APIs TO ADD (4 items)

### 1️⃣ DAILY PRESENCE - `/api/v1/attendance/daily-presence`
```
GET /api/v1/attendance/daily-presence?work_date=2026-05-07&department_id=...
```
**Why**: Frontend `/attendance` page needs this to show who attended, who is late, who is absent  
**Effort**: 1-2 days  
**Blocker**: Blocks MVP attendance functionality  

### 2️⃣ PRESIGNED URL - `/api/v1/media-assets/{id}/presigned-url`
```
GET /api/v1/media-assets/{media_asset_id}/presigned-url
```
**Why**: Frontend needs to display ảnh snapshot từ MinIO  
**Effort**: 0.5 day  
**Blocker**: Blocks event detail dialogs, attendance snapshots  

### 3️⃣ UPDATE UNKNOWN EVENT - `PATCH /api/v1/unknown-events/{id}`
```
PATCH /api/v1/unknown-events/{event_id}
```
**Why**: Frontend `/events` page needs to mark unknown events as reviewed/ignored  
**Effort**: 2 hours  
**Blocker**: Blocks event management  

### 4️⃣ UPDATE SPOOF ALERT - `PATCH /api/v1/spoof-alert-events/{id}`
```
PATCH /api/v1/spoof-alert-events/{event_id}
```
**Why**: Frontend `/events` page needs to mark spoof alerts as reviewed/ignored  
**Effort**: 2 hours  
**Blocker**: Blocks event management  

---

## 📈 IMPLEMENTATION ROADMAP

### Backend Priorities

#### Week 1 (URGENT)
- [ ] Daily Presence API (1-2 days)
- [ ] Presigned URL API (0.5 day)
- [ ] Update Unknown Event (2 hours)
- [ ] Update Spoof Alert (2 hours)
- [ ] Testing all 4 endpoints (0.5 day)
- **Total**: ~2.5 days

#### Week 2 (NICE TO HAVE)
- [ ] Presence Statistics API (1-2 days)
- [ ] Additional testing & hardening

### Frontend Priorities

#### Week 1
- [ ] Auth integration (login/logout flow)
- [ ] Persons CRUD pages
- [ ] Departments CRUD pages
- [ ] Face registration create + monitor
- [ ] Attendance daily presence page
- [ ] Events list page
- **Total**: ~5 days

#### Week 2
- [ ] WebSocket integration
- [ ] Event detail dialogs
- [ ] Realtime catch-up
- [ ] Image loading with presigned URLs
- **Total**: ~3 days

#### Week 3
- [ ] Dashboard polish
- [ ] Error handling
- [ ] Loading states
- [ ] Optional: Statistics page

---

## 📊 CURRENT API COVERAGE

### Frontend Pages vs Available APIs

| Page | Required APIs | Available | Complete |
|------|---|---|---|
| `/login` | Auth (4) | 4/4 | ✅ |
| `/` (Dashboard) | WS, Summary, Departments, Persons | 3/4 | ⏳ |
| `/persons` | Persons, Departments | 6/6 | ✅ |
| `/persons/new` | Persons, Registrations, Media | 5/5 | ✅ |
| `/persons/[id]` | Persons, Registrations, Departments | 6/6 | ✅ |
| `/persons/[id]/face-registrations/new` | Registrations, Media | 4/4 | ✅ |
| `/attendance` | Daily Presence, Departments, Media | 1/4 | ⏳ |
| `/events` | All events, Media, Updates | 5/7 | ⏳ |
| `/departments` | Departments | 5/5 | ✅ |
| `/media-assets` | Media Assets, Media URLs | 1/2 | ⏳ |

**Overall Coverage**: 36/47 (77%)  
**Blocking MVP**: 4 endpoints  

---

## 🎯 MVP DEFINITION

### MVP Features (Minimum Viable Product)
✅ **Can do with current APIs**:
- Login/authentication
- Person management (CRUD)
- Department management (CRUD)
- Face registration (create + monitor)
- Recognition events list
- Unknown events list
- Spoof alerts list
- Event detail viewing

⏳ **Need 4 new APIs**:
- Daily attendance presence (✅ CRITICAL)
- Mark unknown/spoof as reviewed (✅ CRITICAL)
- Image snapshot display (✅ CRITICAL)

❌ **Can't do in MVP**:
- Real-time live updates (WebSocket ready, but frontend not integrated)
- Attendance statistics (nice to have, not critical)
- Advanced filtering (can add gradually)

### MVP Completion Estimate
- Backend new APIs: **2-3 days**
- Frontend integration: **5-7 days**
- Testing & polish: **2-3 days**
- **Total**: **10-12 days** (~2 weeks)

---

## 💡 RECOMMENDATIONS

### For Backend Team
1. **Priority 1**: Implement 4 critical APIs ASAP
2. **Priority 2**: Write integration tests for new APIs
3. **Priority 3**: Update API documentation
4. **Bonus**: Implement statistics API (phase 2)

### For Frontend Team
1. **Priority 1**: Wait for 4 critical APIs, then start integration
2. **Priority 2**: Build auth flow + REST client first
3. **Priority 3**: Integrate page by page (persons → attendance → events)
4. **Priority 4**: Add realtime (WebSocket)

### For Product/PM
1. **MVP timeline**: 2 weeks (backend + frontend)
2. **Refinement timeline**: +2 weeks (realtime, polish, testing)
3. **Go-live ready**: 4-5 weeks total

---

## 📎 REFERENCE FILES

- **Detailed API spec**: [FRONTEND_API_AUDIT.md](FRONTEND_API_AUDIT.md)
- **Quick reference**: [FRONTEND_API_QUICK_REF.md](FRONTEND_API_QUICK_REF.md)
- **Backend notes**: [docs/backend_api_upgrade_notes.md](docs/backend_api_upgrade_notes.md)
- **Backend status**: [docs/backend_overall_status.md](docs/backend_overall_status.md)
- **Frontend status**: [docs/frontend_current_state.md](docs/frontend_current_state.md)
- **Integration guide**: [docs/frontend_backend_integration.md](docs/frontend_backend_integration.md)

---

## 🏁 CONCLUSION

**Status**: Frontend has **77% API coverage** needed for MVP.  
**Blocker**: 4 critical endpoints need to be implemented.  
**Timeline**: With parallel work, MVP can be ready in **2-3 weeks**.  
**Risk Level**: 🟢 **LOW** - Backend is solid, just need final 4 endpoints.

---

**Generated by**: Copilot  
**Date**: 07/05/2026  
**Next Review**: After 4 critical APIs are implemented
