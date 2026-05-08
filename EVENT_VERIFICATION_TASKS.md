# 🎯 EVENT VERIFICATION ACTION PLAN

**Date**: 07/05/2026  
**Owner**: Backend/Pipeline/AI Team Leads  
**Deadline**: Before MVP release

---

## 🔴 BLOCKING VERIFICATION TASKS

### TASK 1: Verify Pipeline Stream Configuration
**Priority**: 🔴 **CRITICAL**  
**Effort**: 30 minutes  
**Owner**: Pipeline Team

**Action Items**:
```python
# Check: apps/pipeline/app/config.py or similar
# Look for:
  REDIS_STREAM_BACKEND = "pipeline.backend.events"  # Correct ✓
  REDIS_STREAM_AI = "pipeline_ai"                   # Where AI reads from
  
# Questions to answer:
  1. What stream does Pipeline publish spoof_alert.detected to?
     Expected: "pipeline.backend.events"
     
  2. What stream does Pipeline publish frame_analysis.updated to?
     Expected: "pipeline.backend.events"
     
  3. What stream does Pipeline publish registration_input.validated to?
     Expected: "pipeline.backend.events" (but Backend reads from ai_backend?)
     
  4. Are stream names correctly configured?
```

**Verification**:
```bash
# Run Pipeline and check logs for:
# "Publishing event_name=spoof_alert.detected to stream=???"
# Compare with: REDIS_STREAM_PIPELINE_EVENTS = "pipeline.backend.events"
```

**Success Criteria**:
- [ ] All 3 event types published to correct stream
- [ ] Stream names match Backend consumer config
- [ ] Timestamps in ISO 8601 format
- [ ] All required payload fields present

---

### TASK 2: Verify AI Service Stream Configuration  
**Priority**: 🔴 **CRITICAL**  
**Effort**: 30 minutes  
**Owner**: AI Service Team

**Action Items**:
```python
# Check: apps/ai_service/app/config.py or similar
# Look for:
  REDIS_STREAM_AI_BACKEND = "ai_backend"  # Publishes to
  REDIS_STREAM_PIPELINE_AI = "pipeline_ai"  # Reads from
  
# Questions to answer:
  1. What stream does AI Service publish recognition_event.detected to?
     Expected: "ai_backend"
     
  2. What stream does AI Service publish unknown_event.detected to?
     Expected: "ai_backend"
     
  3. What stream does AI Service publish registration_processing.completed to?
     Expected: "ai_backend"
     
  4. Are stream names correctly configured?
```

**Verification**:
```bash
# Run AI Service and check logs for:
# "Publishing event_name=recognition_event.detected to stream=???"
# Compare with: REDIS_STREAM_AI_EVENTS = "ai_backend"
```

**Success Criteria**:
- [ ] All 3 event types published to "ai_backend" stream
- [ ] Stream names match Backend consumer config
- [ ] Timestamps in ISO 8601 format
- [ ] All required payload fields present

---

### TASK 3: Review & Verify Dedupe Key Generation
**Priority**: 🔴 **CRITICAL**  
**Effort**: 1-2 hours  
**Owner**: AI Service Team + Pipeline Team

**Action Items**:

#### For AI Service (recognition_event.detected):
```python
# Pseudocode - verify implementation matches schema

def emit_recognition_event(person_id, track_id, frame_sequence):
    dedupe_key = f"recognition:{person_id}:{track_id}"  # Example
    # Or could be: f"recognition:{frame_id}:{track_id}"
    
    # MUST be unique per: person + frame + track
    # Used by Backend to prevent duplicate processing within throttle window
    
    # Verify:
    # 1. dedupe_key is always generated (never null/empty)
    # 2. dedupe_key is unique for the combination being tracked
    # 3. dedupe_key is consistent across retries
```

#### For AI Service (unknown_event.detected):
```python
def emit_unknown_event(track_id, frame_sequence):
    dedupe_key = f"unknown:{track_id}:{frame_sequence}"  # Example
    
    # Verify: dedupe_key prevents duplicate unknown events per track
```

#### For Pipeline (spoof_alert.detected):
```python
def emit_spoof_alert(track_id, frame_sequence, spoof_score):
    dedupe_key = f"spoof:{track_id}:{frame_sequence}"  # Example
    
    # Verify: dedupe_key prevents duplicate spoof alerts per track
```

**Verification**:
```bash
# Send same frame twice to Pipeline, verify dedupe_key is identical
# Check Backend logs for idempotency detection
```

**Success Criteria**:
- [ ] Dedupe key logic documented
- [ ] Dedupe key never null/empty
- [ ] Dedupe key consistent across retries
- [ ] Backend correctly detects duplicates

---

### TASK 4: Verify Event Payload Compliance
**Priority**: 🟠 **HIGH**  
**Effort**: 2-3 hours  
**Owner**: All Teams

**Action Items**:

#### For AI Service - recognition_event.detected:
```json
{
  "stream_id": "string",              // ✓ Always
  "frame_id": "string",               // ✓ Always
  "frame_sequence": integer,          // ✓ Always
  "track_id": "string",               // ✓ Always
  "person_id": "uuid",                // ✓ Must match person in DB
  "face_registration_id": "uuid",     // ✓ Must match registration in DB
  "recognized_at": "ISO-8601",        // ✓ Timezone aware
  "event_direction": "entry|exit|unknown",  // ✓ Must be one of these
  "match_score": number|null,         // ✓ 0.0-1.0 or null
  "spoof_score": number|null,         // ✓ 0.0-1.0 or null
  "event_source": "string",           // ✓ Default: "ai_service"
  "dedupe_key": "string",             // ✓ Non-empty unique key
  "snapshot_media_asset": media_asset_ref|null  // ✓ Optional
}
```

**Test Plan**:
```bash
# 1. Extract sample event from AI Service logs
# 2. Validate against schema: 
#    jsonschema.validate(event, schema)
# 3. Check each field:
#    - person_id exists in persons table
#    - face_registration_id exists in person_face_registrations table
#    - recognized_at is ISO-8601 with timezone
#    - match_score between 0.0 and 1.0
#    - event_direction in [entry, exit, unknown]
#    - snapshot_media_asset references existing asset (if present)
```

#### For AI Service - unknown_event.detected:
```json
{
  "stream_id": "string",
  "frame_id": "string", 
  "frame_sequence": integer,
  "track_id": "string",
  "detected_at": "ISO-8601",
  "event_direction": "entry|exit|unknown",
  "match_score": number|null,
  "spoof_score": number|null,
  "event_source": "string",
  "dedupe_key": "string",
  "review_status": "new|reviewed|ignored",  // MUST be "new" initially
  "notes": "string|null",
  "snapshot_media_asset": media_asset_ref|null
}
```

**Note**: Schema does NOT have `person_id` - is this intentional?

#### For Pipeline - spoof_alert.detected:
```json
{
  "stream_id": "string",
  "frame_id": "string",
  "frame_sequence": integer,
  "track_id": "string",
  "person_id": "uuid|null",            // Can be null
  "detected_at": "ISO-8601",
  "spoof_score": number,               // Must be 0.0-1.0
  "severity": "low|medium|high",       // How is this determined?
  "review_status": "new|reviewed|ignored",  // MUST be "new" initially
  "event_source": "string",
  "dedupe_key": "string",
  "notes": "string|null",
  "snapshot_media_asset": media_asset_ref|null
}
```

**Verification Script**:
```python
# tools/verify_events.py
import json
from jsonschema import validate, ValidationError

def verify_event(event_dict, schema_path):
    with open(schema_path) as f:
        schema = json.load(f)
    try:
        validate(instance=event_dict, schema=schema)
        return True, "Valid"
    except ValidationError as e:
        return False, str(e)

# Usage:
event = {"event_name": "recognition_event.detected", ...}
valid, msg = verify_event(event, "packages/contracts/ai_backend/recognition_event_detected.v1.schema.json")
```

---

### TASK 5: Test End-to-End Event Flow
**Priority**: 🟠 **HIGH**  
**Effort**: 3-4 hours  
**Owner**: Integration Test Team

**Test Scenario**: Single face recognition
```
1. Pipeline captures frame with face
2. Pipeline sends recognition.requested to AI Service
3. AI Service processes and sends recognition_event.detected to Backend
4. Backend validates and ingests
5. Frontend receives realtime event via WebSocket

Expected Flow:
  Pipeline (frame) → AI Service (recognition_event.detected) → Backend → Frontend
  
Verification Points:
  ✓ Event arrives with correct structure
  ✓ All required fields present
  ✓ Schema validation passes
  ✓ Idempotency key prevents duplicates
  ✓ Database record created
  ✓ Realtime event published
  ✓ Frontend receives via WebSocket
```

**Test Code**:
```python
# tests/integration/test_event_flow.py

import asyncio
from unittest.mock import Mock
from app.infrastructure.integrations.contract_validator import ContractValidator
from app.infrastructure.integrations.redis_event_consumer import RedisEventConsumer

@pytest.mark.asyncio
async def test_recognition_event_flow():
    """Test full flow: Pipeline → AI → Backend → Frontend"""
    
    # Setup
    validator = ContractValidator()
    events_received = []
    
    async def capture_event(envelope, payload):
        events_received.append(envelope)
        return True
    
    # 1. Create fake event from AI Service
    fake_event = {
        "event_name": "recognition_event.detected",
        "event_version": "1.0.0",
        "message_id": "uuid-1",
        "correlation_id": "uuid-2",
        "producer": "ai_service",
        "occurred_at": "2026-05-07T10:00:00Z",
        "payload": {
            "stream_id": "stream-1",
            "frame_id": "frame-1",
            "frame_sequence": 100,
            "track_id": "track-1",
            "person_id": "person-1",
            "face_registration_id": "reg-1",
            "recognized_at": "2026-05-07T10:00:00Z",
            "event_direction": "entry",
            "match_score": 0.95,
            "spoof_score": 0.02,
            "event_source": "ai_service",
            "dedupe_key": "recognition:person-1:track-1"
        }
    }
    
    # 2. Validate against schema
    try:
        validator.validate(fake_event)
        assert True
    except Exception as e:
        assert False, f"Validation failed: {e}"
    
    # 3. Process with handler
    # ... (actual handler processing)
    
    # 4. Verify stored in DB
    # ... (database checks)
    
    # 5. Verify realtime event published
    # ... (WebSocket checks)
```

**Success Criteria**:
- [ ] Event passes schema validation
- [ ] Handler processes without error
- [ ] Database record created correctly
- [ ] Realtime event published
- [ ] Frontend can retrieve event

---

## 🟡 MEDIUM PRIORITY TASKS

### TASK 6: Review Stream Health Event Structure
**Priority**: 🟡 **MEDIUM**  
**Effort**: 30 minutes  
**Owner**: Pipeline Team

```json
// What does stream.health.updated look like?
// Currently marked as PASSTHROUGH (no validation)

{
  "event_name": "stream.health.updated",
  "event_version": "1.0.0",
  "producer": "pipeline",
  "occurred_at": "ISO-8601",
  "payload": {
    // What fields should be here?
    // stream_id, fps, latency, frame_count, ...?
  }
}
```

**Action**: Define and document schema, add validation

---

### TASK 7: Document Person ID Handling
**Priority**: 🟡 **MEDIUM**  
**Effort**: 1 hour  
**Owner**: AI Service Team

**Issue**: 
- Unknown events don't have `person_id` in schema
- But Backend tries to create unknown_event records
- How should person_id be handled in this case?

**Options**:
1. Add `person_id` to unknown_event schema (even if null)
2. Backend generates/tracks person_id separately
3. Unknown events never have person_id (just leave null in DB)

**Action**: Clarify intent and update schema if needed

---

## 📋 COMPLETION CHECKLIST

- [ ] **TASK 1**: Pipeline stream names verified
- [ ] **TASK 2**: AI Service stream names verified  
- [ ] **TASK 3**: Dedupe key generation reviewed
- [ ] **TASK 4**: Event payload compliance verified
- [ ] **TASK 5**: End-to-end event flow tested
- [ ] **TASK 6**: Stream health event documented
- [ ] **TASK 7**: Person ID handling clarified

**Go/No-Go Criteria**: ✅ All critical tasks (1-5) completed

---

## 📞 ESCALATION CONTACTS

If you find issues:

| Issue | Contact | Slack |
|-------|---------|-------|
| Pipeline events | @pipeline-lead | #backend-integration |
| AI events | @ai-lead | #backend-integration |
| Backend consumer | @backend-lead | #backend-integration |
| Schema conflicts | @arch-lead | #architecture |

---

**Last Updated**: 07/05/2026  
**Status**: 🔴 **PENDING VERIFICATION**  
**Next Review**: After all tasks completed
