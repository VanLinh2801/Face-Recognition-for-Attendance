# 🔍 EVENT MATCHING AUDIT REPORT

**Date**: 07/05/2026  
**Scope**: Verify event contract alignment between Backend, Pipeline, and AI Service

---

## 📋 SUMMARY

✅ **Overall Status**: Event contracts are **well-defined** and **mostly aligned**

| Aspect | Status | Notes |
|--------|--------|-------|
| **Event Schemas** | ✅ Defined | All 6 events have JSON schemas |
| **Backend Consumer** | ✅ Ready | Registered handlers for all events |
| **Contract Validation** | ✅ Implemented | JsonSchema validator configured |
| **Stream Names** | ⏳ PARTIAL | Need to verify producer stream names |
| **AI Service Producer** | ⏳ UNCLEAR | Need to verify emit logic |
| **Pipeline Producer** | ⏳ UNCLEAR | Need to verify emit logic |

---

## 🔄 EVENT FLOW ANALYSIS

### 1️⃣ RECOGNITION EVENT FLOW

```
Pipeline → recognition.requested → AI Service
                                ↓
                          recognition_event.detected
                                ↓
                           ai_backend stream
                                ↓
                          Backend Consumer
```

#### Event Schema ✅
```json
{
  "event_name": "recognition_event.detected",
  "event_version": "1.0.0",
  "producer": "ai_service",
  "payload": {
    "stream_id": "string",
    "frame_id": "string",
    "frame_sequence": "integer",
    "track_id": "string",
    "person_id": "uuid",
    "face_registration_id": "uuid",
    "recognized_at": "date-time",
    "event_direction": "entry|exit|unknown",
    "match_score": "number|null",
    "spoof_score": "number|null",
    "event_source": "string (default: ai_service)",
    "dedupe_key": "string",
    "snapshot_media_asset": "media_asset_ref|null"
  }
}
```

#### Backend Consumer ✅
- **Handler**: `BackendEventHandlers.handle_recognition_event()`
- **Stream**: `redis_stream_ai_events` = `"ai_backend"`
- **Validation**: ✅ Schema registered in `ContractValidator`
- **Processing**: 
  - Calls `IngestRecognitionEventUseCase`
  - Checks idempotency (message_id + dedupe_key)
  - Publishes to realtime channel `events.business`
  - Returns success if PROCESSED/DUPLICATE/IGNORED

#### ⚠️ POTENTIAL ISSUES
- **Location**: AI Service emit logic not verified
  - Need to check if AI service properly constructs `dedupe_key`
  - Need to check if `person_id` and `face_registration_id` are always populated
  - Need to check if `snapshot_media_asset` is correctly referenced

---

### 2️⃣ UNKNOWN EVENT FLOW

```
Pipeline → recognition.requested → AI Service
                                ↓
                          unknown_event.detected
                                ↓
                           ai_backend stream
                                ↓
                          Backend Consumer
```

#### Event Schema ✅
```json
{
  "event_name": "unknown_event.detected",
  "event_version": "1.0.0",
  "producer": "ai_service",
  "payload": {
    "stream_id": "string",
    "frame_id": "string",
    "frame_sequence": "integer",
    "track_id": "string",
    "detected_at": "date-time",
    "event_direction": "entry|exit|unknown",
    "match_score": "number|null",
    "spoof_score": "number|null",
    "event_source": "string (default: ai_service)",
    "dedupe_key": "string",
    "review_status": "new|reviewed|ignored",
    "notes": "string|null",
    "snapshot_media_asset": "media_asset_ref|null"
  }
}
```

#### Backend Consumer ✅
- **Handler**: `BackendEventHandlers.handle_unknown_event()`
- **Stream**: `redis_stream_ai_events` = `"ai_backend"`
- **Validation**: ✅ Schema registered in `ContractValidator`
- **Processing**: 
  - Calls `IngestUnknownEventUseCase`
  - Publishes to realtime channel `events.business` if PROCESSED

#### ⚠️ POTENTIAL ISSUES
- **review_status**: Must be initialized to `"new"` by AI service
- **snapshot_media_asset**: Should be populated for display
- Same as recognition event above

---

### 3️⃣ SPOOF ALERT EVENT FLOW

```
Pipeline (detection) → spoof_alert.detected
                            ↓
                    pipeline.backend.events stream
                            ↓
                     Backend Consumer
```

#### Event Schema ✅
```json
{
  "event_name": "spoof_alert.detected",
  "event_version": "1.0.0",
  "producer": "pipeline",
  "payload": {
    "stream_id": "string",
    "frame_id": "string",
    "frame_sequence": "integer",
    "track_id": "string",
    "person_id": "uuid|null",
    "detected_at": "date-time",
    "spoof_score": "number",
    "severity": "low|medium|high",
    "event_source": "string (default: pipeline)",
    "dedupe_key": "string",
    "review_status": "new|reviewed|ignored",
    "notes": "string|null",
    "snapshot_media_asset": "media_asset_ref|null"
  }
}
```

#### Backend Consumer ✅
- **Handler**: `BackendEventHandlers.handle_spoof_alert()`
- **Stream**: `redis_stream_pipeline_events` = `"pipeline.backend.events"`
- **Validation**: ✅ Schema registered in `ContractValidator`
- **Processing**: 
  - Calls `IngestSpoofAlertEventUseCase`
  - Publishes to realtime channel `events.business`

#### ⚠️ POTENTIAL ISSUES
- **review_status**: Must be initialized to `"new"` by Pipeline
- **severity**: How is this calculated? Need to verify logic in Pipeline
- **person_id**: Can be null if spoof detected on unknown person

---

### 4️⃣ REGISTRATION PROCESSING COMPLETED FLOW

```
Backend → registration.requested → pipeline_backend stream
                                        ↓
                                   Pipeline (forward to AI)
                                        ↓
                         registration.requested → pipeline_ai stream
                                        ↓
                                   AI Service (process)
                                        ↓
                      registration_processing.completed
                                        ↓
                                  ai_backend stream
                                        ↓
                                Backend Consumer
```

#### Event Schema ✅
```json
{
  "event_name": "registration_processing.completed",
  "event_version": "1.0.0",
  "producer": "ai_service",
  "payload": {
    "person_id": "uuid",
    "registration_id": "uuid",
    "status": "pending|validated|indexed|failed",
    "failure_code": "string|null",
    "failure_message": "string|null",
    "validation_notes": "string|null",
    "embedding_model": "string|null",
    "embedding_version": "string|null",
    "indexed_at": "date-time|null",
    "face_image_media_asset": "media_asset_ref|null",
    "source_media_asset_id": "uuid|null",
    "event_source": "string"
  }
}
```

#### Backend Consumer ✅
- **Handler**: `BackendEventHandlers.handle_registration_processing_completed()`
- **Stream**: `redis_stream_ai_events` = `"ai_backend"`
- **Validation**: ✅ Schema registered in `ContractValidator`
- **Processing**: 
  - Calls `CompleteFaceRegistrationUseCase`
  - Updates registration status in DB
  - Publishes to realtime channel `events.business`

#### ⚠️ POTENTIAL ISSUES
- **status values**: Must match exactly (pending/validated/indexed/failed)
- **embedding_model + embedding_version**: Only populated when status = indexed
- Need to verify AI service emits this with correct structure

---

### 5️⃣ FRAME ANALYSIS UPDATED FLOW

```
Pipeline → frame_analysis.updated
                ↓
        pipeline.backend.events stream
                ↓
         Backend Consumer
                ↓
     Publish to realtime (stream.overlay)
```

#### Event Schema ⏳
- **Location**: `packages/contracts/pipeline_backend/frame_analysis.updated.v1.schema.json`
- **Producer**: `pipeline`
- **Status**: Defined but content not reviewed

#### Backend Consumer ✅
- **Handler**: `BackendEventHandlers.handle_frame_analysis_updated()`
- **Processing**: Publishes directly to realtime channel `stream.overlay`

---

### 6️⃣ REGISTRATION INPUT VALIDATED FLOW

```
Backend → registration.requested → pipeline_backend stream
                                        ↓
                                   Pipeline (validate)
                                        ↓
                      registration_input.validated
                                        ↓
                                  ai_backend stream
                                        ↓
                                Backend Consumer
```

#### Event Schema ✅
- **Location**: `packages/contracts/pipeline_backend/registration_input_validated.v1.schema.json`
- **Producer**: `pipeline`

#### Backend Consumer ✅
- **Handler**: `BackendEventHandlers.handle_registration_input_validated()`
- **Stream**: `redis_stream_ai_events` = `"ai_backend"` (?)
- **Note**: Confusing - should this be in pipeline_backend stream instead?

#### ⚠️ CRITICAL ISSUE
- **Stream mismatch**: This event is from `pipeline` (producer) but consumed from `redis_stream_ai_events`
  - Should be consumed from `redis_stream_pipeline_events` instead?
  - Verify actual stream name in config

---

## 🔐 REDIS STREAM NAMES

### Backend Consumer Configuration
```python
redis_stream_ai_events = "ai_backend"              # AI Service → Backend
redis_stream_pipeline_events = "pipeline.backend.events"  # Pipeline → Backend
```

### Events per Stream

#### ✅ Stream: `ai_backend`
1. `recognition_event.detected` ✅
2. `unknown_event.detected` ✅
3. `registration_processing.completed` ✅
4. `registration_input.validated` ⚠️ (producer=pipeline, should be in pipeline_backend stream?)

#### ✅ Stream: `pipeline.backend.events`
1. `spoof_alert.detected` ✅
2. `frame_analysis.updated` ✅
3. `registration_input.validated` ⚠️ (duplicated?)

### Backend Output Stream
```python
redis_stream_backend_pipeline = "pipeline_backend"  # Backend → Pipeline
```

**Usage**: For sending `registration.requested` events to Pipeline/AI

---

## 🎯 HANDLER REGISTRATION CHECK

✅ **All handlers registered correctly**:

```python
consumer.register_handler("recognition_event.detected", handlers.handle_recognition_event)
consumer.register_handler("unknown_event.detected", handlers.handle_unknown_event)
consumer.register_handler("spoof_alert.detected", handlers.handle_spoof_alert)
consumer.register_handler("frame_analysis.updated", handlers.handle_frame_analysis_updated)
consumer.register_handler("stream.health.updated", handlers.handle_stream_health_updated)
consumer.register_handler("registration_processing.completed", handlers.handle_registration_processing_completed)
consumer.register_handler("registration_input.validated", handlers.handle_registration_input_validated)
```

---

## ✅ CONTRACT VALIDATION CHECK

✅ **All contracts registered in validator**:

```python
EVENT_SCHEMA_PATHS = {
    "recognition_event.detected": "ai_backend/recognition_event_detected.v1.schema.json",
    "unknown_event.detected": "ai_backend/unknown_event_detected.v1.schema.json",
    "spoof_alert.detected": "pipeline_backend/spoof_alert_detected.v1.schema.json",
    "frame_analysis.updated": "pipeline_backend/frame_analysis.updated.v1.schema.json",
    "registration_processing.completed": "ai_backend/registration_processing_completed.v1.schema.json",
    "registration_input.validated": "pipeline_backend/registration_input_validated.v1.schema.json",
}

PASSTHROUGH_EVENTS = {"stream.health.updated"}
```

---

## 🔴 CRITICAL ISSUES FOUND

### Issue #1: Stream Name Confusion ⚠️
**Problem**: `registration_input.validated` 
- **Producer**: `pipeline` (in schema)
- **Expected stream**: `pipeline.backend.events`
- **Config location**: `ContractValidator.EVENT_SCHEMA_PATHS` references `pipeline_backend/` folder
- **Current consumer**: Listens to both `ai_backend` AND `pipeline.backend.events`

**Recommendation**: Verify which stream this event is actually published to by Pipeline

### Issue #2: Stream Health Events ⏳
**Problem**: `stream.health.updated`
- **Marked as**: `PASSTHROUGH_EVENTS` (no validation)
- **Handler**: Exists and publishes to `stream.health` realtime channel
- **Schema**: Not validated

**Recommendation**: Define schema for this event or document why it's passthrough

### Issue #3: Missing Pipeline/AI Implementation ❌
**Problem**: Backend consumer is ready, but actual emit logic in Pipeline/AI not reviewed
- Unknown: How `dedupe_key` is generated in AI service
- Unknown: How `person_id` is populated in Unknown events
- Unknown: How `severity` is calculated for spoof alerts
- Unknown: How `registration_input.validated` is emitted by Pipeline

**Recommendation**: Review Pipeline and AI service emit implementations

---

## ✅ WHAT'S WORKING

### Backend Consumer Layer ✅
- ✅ Redis connection + consumer group setup
- ✅ Contract validation with JSON schemas
- ✅ Event routing by handler
- ✅ Idempotency checking (message_id + dedupe_key)
- ✅ Realtime event publishing
- ✅ Graceful shutdown

### Event Envelope Structure ✅
- ✅ Common envelope with required fields
- ✅ Proper producer identification
- ✅ Correlation ID tracking
- ✅ Causation ID for event chains
- ✅ Message ID for idempotency

### Processing Logic ✅
- ✅ Separate handlers for each event type
- ✅ Status tracking (PROCESSED/DUPLICATE/IGNORED)
- ✅ Realtime channel routing
- ✅ Error logging

---

## ⏳ WHAT NEEDS VERIFICATION

### 1. AI Service Event Emission
Need to verify:
- [ ] `recognition_event.detected` payload matches schema exactly
- [ ] `dedupe_key` construction logic
- [ ] `person_id` and `face_registration_id` population
- [ ] Timestamp (`recognized_at`) formatting
- [ ] Media asset reference construction

### 2. Pipeline Service Event Emission
Need to verify:
- [ ] `spoof_alert.detected` payload matches schema exactly
- [ ] `severity` calculation logic
- [ ] `person_id` when available vs. null
- [ ] `review_status` initialization (should be "new")
- [ ] `frame_analysis.updated` payload structure
- [ ] `registration_input.validated` emission logic

### 3. Stream Configuration
Need to verify in .env files:
- [ ] Pipeline publishes to correct stream names
- [ ] AI service publishes to correct stream names
- [ ] Backend consumer reads from correct streams
- [ ] Consumer group setup consistent across services

### 4. Integration Testing
Need to test:
- [ ] End-to-end event flow (Pipeline → AI → Backend)
- [ ] Contract validation catches mismatches
- [ ] Idempotency prevents duplicate processing
- [ ] Realtime events reach frontend

---

## 📊 CHECKLIST FOR IMPLEMENTATION

### Backend (Done ✅)
- [x] Event schemas defined in JSON
- [x] Contract validator implemented
- [x] Consumer configured for 2 streams
- [x] Handlers registered for all events
- [x] Idempotency logic implemented
- [x] Realtime publishing integrated
- [x] Error handling in place

### Pipeline (Need to verify)
- [ ] Event emit logic implemented
- [ ] Schema contract compliance
- [ ] Dedupe key generation
- [ ] Severity calculation
- [ ] Review status initialization
- [ ] Media asset handling
- [ ] Timestamp formatting (ISO 8601)

### AI Service (Need to verify)
- [ ] Event emit logic implemented  
- [ ] Schema contract compliance
- [ ] Person ID tracking
- [ ] Registration ID linking
- [ ] Match score + spoof score included
- [ ] Dedupe key generation
- [ ] Media asset reference

### Integration (Need testing)
- [ ] E2E event flow (face detection → recognition → backend)
- [ ] Contract validation catches errors
- [ ] Duplicate events ignored
- [ ] Realtime events in frontend
- [ ] Error scenarios handled

---

## 🎯 NEXT STEPS

1. **Immediate**: Review Pipeline and AI service emit implementations
2. **Priority**: Verify dedupe_key generation logic
3. **Priority**: Test end-to-end event flow with actual data
4. **Recommended**: Add integration tests for contract validation
5. **Recommended**: Add monitoring for consumer lag + errors

---

## 📎 REFERENCE FILES

### Event Schemas
- `packages/contracts/ai_backend/` - AI → Backend events
- `packages/contracts/pipeline_backend/` - Pipeline → Backend events
- `packages/contracts/pipeline_ai/` - Pipeline → AI requests
- `packages/contracts/common/` - Envelope + media asset ref

### Backend Consumer
- `apps/backend/app/infrastructure/integrations/redis_event_consumer.py`
- `apps/backend/app/infrastructure/integrations/event_handlers.py`
- `apps/backend/app/infrastructure/integrations/contract_validator.py`

### Configuration
- `apps/backend/app/core/config.py` - Stream names + consumer settings

---

**Status**: 🟡 **MOSTLY ALIGNED** - Backend ready, need to verify Pipeline/AI implementations

**Risk Level**: 🟡 **MEDIUM** - Well-designed contracts, but emit logic not yet reviewed

**Recommendation**: Verify Pipeline and AI service implementations before going to production
