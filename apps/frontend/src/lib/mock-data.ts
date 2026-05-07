import type {
  AttendanceEvent,
  DailySummary,
  Department,
  FaceRegistration,
  MediaAsset,
  Person,
  RecognitionEvent,
  RealtimeEvent,
  SpoofAlertEvent,
  UnknownEvent,
} from "@/lib/types";

export const departments: Department[] = [
  { id: "dep-eng", code: "ENG", name: "Engineering", parent_id: null, is_active: true, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "dep-ops", code: "OPS", name: "Operations", parent_id: null, is_active: true, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "dep-hr", code: "HR", name: "Human Resources", parent_id: "dep-ops", is_active: true, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "dep-sec", code: "SEC", name: "Security", parent_id: "dep-ops", is_active: false, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "dep-ai", code: "AI", name: "AI Platform", parent_id: "dep-eng", is_active: true, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "dep-web", code: "WEB", name: "Frontend Web", parent_id: "dep-eng", is_active: true, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "dep-camera", code: "CAM", name: "Camera Operations", parent_id: "dep-ops", is_active: true, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "dep-model", code: "MODEL", name: "Model Research", parent_id: "dep-ai", is_active: true, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
];

export const persons: Person[] = [
  { id: "person-1", employee_code: "EMP001", full_name: "Nguyen Van A", department_id: "dep-ai", title: "AI Engineer", email: "a@example.com", phone: "0900000001", status: "active", joined_at: "2026-01-01", notes: "Core recognition team", created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "person-2", employee_code: "EMP002", full_name: "Tran Thi B", department_id: "dep-ops", title: "Shift Lead", email: "b@example.com", phone: "0900000002", status: "active", joined_at: "2026-01-15", notes: null, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "person-3", employee_code: "EMP003", full_name: "Le Minh C", department_id: "dep-hr", title: "HR Specialist", email: "c@example.com", phone: "0900000003", status: "inactive", joined_at: "2026-02-01", notes: "On leave", created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "person-4", employee_code: "EMP004", full_name: "Pham Quoc D", department_id: "dep-camera", title: "Security Officer", email: "d@example.com", phone: "0900000004", status: "active", joined_at: "2026-02-20", notes: null, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "person-5", employee_code: "EMP005", full_name: "Hoang Lan E", department_id: "dep-web", title: "Frontend Engineer", email: "e@example.com", phone: "0900000005", status: "resigned", joined_at: "2025-11-12", notes: null, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "person-6", employee_code: "EMP006", full_name: "Do Thanh F", department_id: "dep-model", title: "ML Researcher", email: "f@example.com", phone: "0900000006", status: "active", joined_at: "2026-03-01", notes: "Embedding experiments", created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
  { id: "person-7", employee_code: "EMP007", full_name: "Vu Mai G", department_id: "dep-sec", title: "Security Supervisor", email: "g@example.com", phone: "0900000007", status: "active", joined_at: "2026-03-10", notes: null, created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:00:00Z" },
];

export const registrations: FaceRegistration[] = [
  { id: "reg-1", person_id: "person-1", source_media_asset_id: "asset-1", face_image_media_asset_id: "asset-5", registration_status: "indexed", validation_notes: null, embedding_model: "arcface", embedding_version: "v1", is_active: true, indexed_at: "2026-05-06T06:10:00Z", created_at: "2026-05-06T06:00:00Z", updated_at: "2026-05-06T06:10:00Z" },
  { id: "reg-2", person_id: "person-2", source_media_asset_id: "asset-2", face_image_media_asset_id: "asset-6", registration_status: "validated", validation_notes: "Face quality accepted", embedding_model: null, embedding_version: null, is_active: true, indexed_at: null, created_at: "2026-05-06T06:12:00Z", updated_at: "2026-05-06T06:14:00Z" },
  { id: "reg-3", person_id: "person-4", source_media_asset_id: "asset-3", face_image_media_asset_id: null, registration_status: "pending", validation_notes: null, embedding_model: null, embedding_version: null, is_active: true, indexed_at: null, created_at: "2026-05-06T06:30:00Z", updated_at: "2026-05-06T06:30:00Z" },
  { id: "reg-4", person_id: "person-3", source_media_asset_id: "asset-4", face_image_media_asset_id: null, registration_status: "failed", validation_notes: "Multiple faces detected", embedding_model: null, embedding_version: null, is_active: false, indexed_at: null, created_at: "2026-05-06T06:40:00Z", updated_at: "2026-05-06T06:42:00Z" },
];

export const attendanceEvents: AttendanceEvent[] = [
  { id: "att-1", person_id: "person-1", person_full_name: "Nguyen Van A", snapshot_media_asset_id: "asset-9", recognized_at: "2026-05-06T08:01:00Z", event_direction: "entry", match_score: 0.96, spoof_score: 0.01, event_source: "ai_service", is_valid: true },
  { id: "att-2", person_id: "person-2", person_full_name: "Tran Thi B", snapshot_media_asset_id: "asset-10", recognized_at: "2026-05-06T08:04:00Z", event_direction: "entry", match_score: 0.94, spoof_score: 0.02, event_source: "ai_service", is_valid: true },
  { id: "att-3", person_id: "person-4", person_full_name: "Pham Quoc D", snapshot_media_asset_id: "asset-11", recognized_at: "2026-05-06T08:18:00Z", event_direction: "entry", match_score: 0.91, spoof_score: 0.03, event_source: "ai_service", is_valid: true },
  { id: "att-4", person_id: "person-1", person_full_name: "Nguyen Van A", snapshot_media_asset_id: "asset-12", recognized_at: "2026-05-06T12:02:00Z", event_direction: "exit", match_score: 0.95, spoof_score: 0.01, event_source: "ai_service", is_valid: true },
  { id: "att-5", person_id: "person-2", person_full_name: "Tran Thi B", snapshot_media_asset_id: "asset-13", recognized_at: "2026-05-06T17:45:00Z", event_direction: "exit", match_score: 0.93, spoof_score: 0.02, event_source: "ai_service", is_valid: true },
];

export const recognitionEvents: RecognitionEvent[] = attendanceEvents.map((event, index) => ({
  id: `rec-${index + 1}`,
  person_id: event.person_id,
  face_registration_id: `reg-${Math.min(index + 1, 3)}`,
  snapshot_media_asset_id: event.snapshot_media_asset_id ?? null,
  recognized_at: event.recognized_at,
  event_direction: event.event_direction,
  match_score: event.match_score,
  spoof_score: event.spoof_score,
  event_source: event.event_source,
  raw_payload: {},
  is_valid: event.is_valid,
  invalid_reason: null,
  created_at: event.recognized_at,
}));

export const unknownEvents: UnknownEvent[] = [
  { id: "unk-1", snapshot_media_asset_id: null, detected_at: "2026-05-06T09:22:00Z", event_direction: "entry", match_score: null, spoof_score: 0.04, event_source: "ai_service", raw_payload: {}, review_status: "new", notes: null, created_at: "2026-05-06T09:22:00Z", updated_at: "2026-05-06T09:22:00Z" },
  { id: "unk-2", snapshot_media_asset_id: null, detected_at: "2026-05-06T10:10:00Z", event_direction: "entry", match_score: null, spoof_score: 0.07, event_source: "ai_service", raw_payload: {}, review_status: "reviewed", notes: "Visitor confirmed", created_at: "2026-05-06T10:10:00Z", updated_at: "2026-05-06T10:21:00Z" },
  { id: "unk-3", snapshot_media_asset_id: null, detected_at: "2026-05-06T13:15:00Z", event_direction: "exit", match_score: null, spoof_score: 0.05, event_source: "ai_service", raw_payload: {}, review_status: "ignored", notes: "Camera test", created_at: "2026-05-06T13:15:00Z", updated_at: "2026-05-06T13:25:00Z" },
];

export const spoofAlertEvents: SpoofAlertEvent[] = [
  { id: "spoof-1", person_id: null, snapshot_media_asset_id: null, detected_at: "2026-05-06T11:05:00Z", spoof_score: 0.97, event_source: "pipeline", raw_payload: {}, severity: "high", review_status: "new", notes: "Possible replay attack", created_at: "2026-05-06T11:05:00Z", updated_at: "2026-05-06T11:05:00Z" },
  { id: "spoof-2", person_id: "person-4", snapshot_media_asset_id: null, detected_at: "2026-05-06T14:32:00Z", spoof_score: 0.72, event_source: "pipeline", raw_payload: {}, severity: "medium", review_status: "reviewed", notes: "Low light false positive", created_at: "2026-05-06T14:32:00Z", updated_at: "2026-05-06T14:44:00Z" },
];

function snapshotPreview(name: string, time: string) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="640" height="420" viewBox="0 0 640 420">
      <defs>
        <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="#0f172a"/>
          <stop offset="0.56" stop-color="#334155"/>
          <stop offset="1" stop-color="#64748b"/>
        </linearGradient>
      </defs>
      <rect width="640" height="420" fill="url(#bg)"/>
      <rect x="224" y="72" width="192" height="192" rx="96" fill="#e2e8f0"/>
      <circle cx="320" cy="156" r="48" fill="#94a3b8"/>
      <path d="M240 262c22-48 138-48 160 0v22H240z" fill="#94a3b8"/>
      <rect x="24" y="24" width="176" height="32" rx="8" fill="#16a34a"/>
      <text x="40" y="46" fill="#ffffff" font-family="Arial, sans-serif" font-size="16" font-weight="700">MINIO SNAPSHOT</text>
      <text x="320" y="330" fill="#ffffff" font-family="Arial, sans-serif" font-size="28" font-weight="700" text-anchor="middle">${name}</text>
      <text x="320" y="365" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="18" text-anchor="middle">${time} - camera gate 01</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const mediaAssets: MediaAsset[] = [
  { id: "asset-1", storage_provider: "minio", bucket_name: "attendance", object_key: "registrations/raw/emp001.jpg", original_filename: "emp001.jpg", mime_type: "image/jpeg", file_size: 142312, checksum: null, asset_type: "registration_face", uploaded_by_person_id: null, created_at: "2026-05-06T06:00:00Z" },
  { id: "asset-2", storage_provider: "minio", bucket_name: "attendance", object_key: "registrations/raw/emp002.jpg", original_filename: "emp002.jpg", mime_type: "image/jpeg", file_size: 134991, checksum: null, asset_type: "registration_face", uploaded_by_person_id: null, created_at: "2026-05-06T06:12:00Z" },
  { id: "asset-3", storage_provider: "minio", bucket_name: "attendance", object_key: "registrations/raw/emp004.jpg", original_filename: "emp004.jpg", mime_type: "image/jpeg", file_size: 122441, checksum: null, asset_type: "registration_face", uploaded_by_person_id: null, created_at: "2026-05-06T06:30:00Z" },
  { id: "asset-7", storage_provider: "minio", bucket_name: "attendance", object_key: "snapshots/unknown/unk-1.jpg", original_filename: "unknown-1.jpg", mime_type: "image/jpeg", file_size: 199440, checksum: null, asset_type: "unknown_snapshot", uploaded_by_person_id: null, created_at: "2026-05-06T09:22:00Z" },
  { id: "asset-8", storage_provider: "minio", bucket_name: "attendance", object_key: "snapshots/spoof/spoof-1.jpg", original_filename: "spoof-1.jpg", mime_type: "image/jpeg", file_size: 211008, checksum: null, asset_type: "spoof_snapshot", uploaded_by_person_id: null, created_at: "2026-05-06T11:05:00Z" },
  { id: "asset-9", storage_provider: "minio", bucket_name: "attendance", object_key: "snapshots/recognition/person-1/2026-05-06T080100Z.jpg", original_filename: "person-1-first-seen.jpg", mime_type: "image/jpeg", file_size: 188421, checksum: null, preview_url: snapshotPreview("Nguyen Van A", "08:01"), asset_type: "recognition_snapshot", uploaded_by_person_id: null, created_at: "2026-05-06T08:01:00Z" },
  { id: "asset-10", storage_provider: "minio", bucket_name: "attendance", object_key: "snapshots/recognition/person-2/2026-05-06T080400Z.jpg", original_filename: "person-2-first-seen.jpg", mime_type: "image/jpeg", file_size: 176332, checksum: null, preview_url: snapshotPreview("Tran Thi B", "08:04"), asset_type: "recognition_snapshot", uploaded_by_person_id: null, created_at: "2026-05-06T08:04:00Z" },
  { id: "asset-11", storage_provider: "minio", bucket_name: "attendance", object_key: "snapshots/recognition/person-4/2026-05-06T081800Z.jpg", original_filename: "person-4-first-seen.jpg", mime_type: "image/jpeg", file_size: 181904, checksum: null, preview_url: snapshotPreview("Pham Quoc D", "08:18"), asset_type: "recognition_snapshot", uploaded_by_person_id: null, created_at: "2026-05-06T08:18:00Z" },
  { id: "asset-12", storage_provider: "minio", bucket_name: "attendance", object_key: "snapshots/recognition/person-1/2026-05-06T120200Z.jpg", original_filename: "person-1-last-seen.jpg", mime_type: "image/jpeg", file_size: 190112, checksum: null, preview_url: snapshotPreview("Nguyen Van A", "12:02"), asset_type: "recognition_snapshot", uploaded_by_person_id: null, created_at: "2026-05-06T12:02:00Z" },
  { id: "asset-13", storage_provider: "minio", bucket_name: "attendance", object_key: "snapshots/recognition/person-2/2026-05-06T174500Z.jpg", original_filename: "person-2-last-seen.jpg", mime_type: "image/jpeg", file_size: 193720, checksum: null, preview_url: snapshotPreview("Tran Thi B", "17:45"), asset_type: "recognition_snapshot", uploaded_by_person_id: null, created_at: "2026-05-06T17:45:00Z" },
];

export const dailySummary: DailySummary = {
  work_date: "2026-05-06",
  total_events: 128,
  unique_persons: 74,
  total_entries: 68,
  total_exits: 60,
};

export const hourlyStats = [
  { hour: "07:00", events: 18, entries: 18, exits: 0, alerts: 0 },
  { hour: "08:00", events: 44, entries: 43, exits: 1, alerts: 1 },
  { hour: "09:00", events: 16, entries: 12, exits: 4, alerts: 1 },
  { hour: "10:00", events: 9, entries: 5, exits: 4, alerts: 0 },
  { hour: "11:00", events: 7, entries: 2, exits: 5, alerts: 1 },
  { hour: "12:00", events: 13, entries: 1, exits: 12, alerts: 0 },
  { hour: "13:00", events: 8, entries: 6, exits: 2, alerts: 1 },
  { hour: "14:00", events: 6, entries: 4, exits: 2, alerts: 1 },
  { hour: "17:00", events: 31, entries: 0, exits: 31, alerts: 0 },
];

export const realtimeEvents: RealtimeEvent[] = [
  { channel: "events.business", event_type: "spoof_alert.detected", occurred_at: "2026-05-06T14:32:00Z", correlation_id: "corr-5", dedupe_key: "spoof-2", payload: { severity: "medium", spoof_score: 0.72 }, metadata: { producer: "pipeline" } },
  { channel: "events.business", event_type: "recognition_event.detected", occurred_at: "2026-05-06T12:02:00Z", correlation_id: "corr-4", dedupe_key: "rec-4", payload: { full_name: "Nguyen Van A", match_score: 0.95 }, metadata: { producer: "ai_service" } },
  { channel: "events.business", event_type: "unknown_event.detected", occurred_at: "2026-05-06T10:10:00Z", correlation_id: "corr-3", dedupe_key: "unk-2", payload: { review_status: "reviewed" }, metadata: { producer: "ai_service" } },
  { channel: "events.business", event_type: "spoof_alert.detected", occurred_at: "2026-05-06T11:05:00Z", correlation_id: "corr-2", dedupe_key: "spoof-1", payload: { severity: "high", spoof_score: 0.97 }, metadata: { producer: "pipeline" } },
  { channel: "events.business", event_type: "recognition_event.detected", occurred_at: "2026-05-06T08:04:00Z", correlation_id: "corr-1", dedupe_key: "rec-2", payload: { full_name: "Tran Thi B", match_score: 0.94 }, metadata: { producer: "ai_service" } },
];
