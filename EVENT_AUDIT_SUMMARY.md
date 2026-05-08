# ⚡ EVENT AUDIT - KEY FINDINGS

**Status**: 🟡 **75% ALIGNED** - Backend ready, Pipeline/AI need verification

---

## ✅ WHAT'S WORKING

### Backend Consumer - READY ✅
```
✅ Consumes from 2 Redis Streams:
   • ai_backend (AI Service events)
   • pipeline.backend.events (Pipeline events)

✅ Validates with JSON schemas:
   • 6 event schemas defined
   • Contract validator integrated
   • First validation error logged

✅ Processes events:
   • 7 handlers registered
   • Idempotency: message_id + dedupe_key
   • Status tracking: PROCESSED/DUPLICATE/IGNORED
   • Publishes to realtime channels
```

---

## 🔴 CRITICAL ISSUES

### Issue #1: Stream Name Confusion
```
Event: registration_input.validated
  Producer: pipeline
  Schema folder: pipeline_backend/ ✓
  But consumer reads from: ai_backend??? 
  
Need to verify: Which stream does Pipeline actually emit to?
```

### Issue #2: Dedupe Key Generation
```
Unknown: How AI Service generates dedupe_key for recognition events
Unknown: How Pipeline generates dedupe_key for spoof alerts
These are used for idempotency - CRITICAL

Schema requires: dedupe_key (mandatory string)
```

### Issue #3: Person ID Tracking
```
For unknown_event.detected:
  person_id: NOT IN SCHEMA ❌
  But database model expects it
  
For spoof_alert.detected:
  person_id: OPTIONAL (can be null)
  But when is it populated?
```

---

## 🔍 STREAM CONFIGURATION

### Backend Listener
```
REDIS_STREAM_AI_EVENTS = "ai_backend"
REDIS_STREAM_PIPELINE_EVENTS = "pipeline.backend.events"
```

### Events Routing

| Event | Producer | Stream | Handler | Status |
|-------|----------|--------|---------|--------|
| recognition_event.detected | ai_service | ai_backend | ✅ | ? |
| unknown_event.detected | ai_service | ai_backend | ✅ | ? |
| spoof_alert.detected | pipeline | pipeline.backend.events | ✅ | ? |
| registration_processing.completed | ai_service | ai_backend | ✅ | ? |
| registration_input.validated | pipeline | pipeline.backend.events? | ✅ | ❌ |
| frame_analysis.updated | pipeline | pipeline.backend.events | ✅ | ? |
| stream.health.updated | pipeline? | pipeline.backend.events? | ✅ | ? |

Legend: ? = Need to verify, ❌ = Potential issue

---

## 📋 VERIFICATION CHECKLIST

### Pipeline Service - NEED TO CHECK
```
[ ] Emits spoof_alert.detected with correct structure
[ ] Initializes review_status = "new"
[ ] Calculates severity (low/medium/high)
[ ] Generates dedupe_key for throttling
[ ] Emits frame_analysis.updated payload
[ ] Emits registration_input.validated correctly
[ ] Uses correct stream names
[ ] Formats timestamps as ISO 8601
[ ] Includes all required fields in payload
```

### AI Service - NEED TO CHECK
```
[ ] Emits recognition_event.detected with correct structure
[ ] Generates dedupe_key for throttling
[ ] Populates person_id from match
[ ] Includes face_registration_id
[ ] Includes match_score and spoof_score
[ ] Emits unknown_event.detected for low-score matches
[ ] Initializes review_status = "new"
[ ] Emits registration_processing.completed with status
[ ] Includes embedding_model and embedding_version when indexed
[ ] Formats timestamps as ISO 8601
```

### Integration Testing - NEED TO DO
```
[ ] End-to-end flow: Camera → Pipeline → AI → Backend
[ ] Contract validation catches malformed events
[ ] Duplicate events rejected by idempotency layer
[ ] Realtime events delivered to frontend
[ ] Error events logged and don't crash consumer
[ ] Consumer recovers from transient errors
[ ] All enum values match (entry/exit, low/medium/high, etc.)
```

---

## 🚨 BLOCKING ISSUES

### 1. Unknown Stream for registration_input.validated
**Impact**: Event might not reach backend or might be lost  
**Action**: Verify which stream Pipeline publishes this to

### 2. Unknown Dedupe Key Logic
**Impact**: Duplicate events might not be detected  
**Action**: Review AI and Pipeline dedupe_key generation

### 3. Missing Person ID in Unknown Events
**Impact**: Unknown events might not link to person in DB  
**Action**: Check if person_id should be in schema or populated by backend

---

## 🟢 RECOMMENDATIONS

### Immediate (Before going to production)
1. Review and test actual emit code in Pipeline
2. Review and test actual emit code in AI Service
3. Run contract validation on sample events
4. Verify stream names match configuration
5. Test end-to-end event flow

### Short term
1. Add comprehensive integration tests
2. Add event emission monitoring
3. Add consumer lag monitoring
4. Document dedupe key generation strategy
5. Add health checks for event processing

### Medium term
1. Consider adding event replay capability
2. Add dead-letter queue for validation failures
3. Add metrics/observability for event processing
4. Consider event versioning strategy for future changes

---

## 📊 CONFIDENCE SCORE

| Aspect | Confidence | Notes |
|--------|-----------|-------|
| Backend consumer | 95% ✅ | Well implemented, tested structure |
| Event schemas | 90% ✅ | Properly defined with validation |
| Contract validation | 85% ✅ | JsonSchema validator integrated |
| Handler routing | 90% ✅ | All 7 handlers registered |
| Pipeline emit | 40% ⚠️ | Logic not reviewed |
| AI Service emit | 40% ⚠️ | Logic not reviewed |
| Stream names | 50% ⚠️ | Config unclear, potential mismatch |
| Dedupe key logic | 30% ❌ | Unknown implementation |
| Person ID tracking | 50% ⚠️ | Schema mismatch with DB model |

**Overall**: 🟡 **60% - MEDIUM RISK**

---

## 📞 WHO TO CONTACT

- **Backend Consumer**: ✅ Ready (ask backend team for review)
- **Pipeline emit logic**: ❌ Need to review (ask pipeline team)
- **AI Service emit logic**: ❌ Need to review (ask AI team)
- **Event schema contracts**: ✅ Review complete (in packages/contracts)

---

**Last Updated**: 07/05/2026  
**Reviewed By**: Copilot  
**Status**: 🟡 READY FOR VERIFICATION
