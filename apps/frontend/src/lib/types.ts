export type Status = "active" | "inactive" | "resigned";
export type EventDirection = "entry" | "exit";
export type ReviewStatus = "new" | "reviewed" | "ignored";
export type RegistrationStatus = "pending" | "validated" | "indexed" | "failed";
export type Severity = "low" | "medium" | "high";

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type Person = {
  id: string;
  employee_code: string;
  full_name: string;
  department_id: string | null;
  title: string;
  email: string;
  phone: string;
  status: Status;
  joined_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Department = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type FaceRegistration = {
  id: string;
  person_id: string;
  source_media_asset_id: string;
  face_image_media_asset_id: string | null;
  registration_status: RegistrationStatus;
  validation_notes: string | null;
  embedding_model: string | null;
  embedding_version: string | null;
  is_active: boolean;
  indexed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceEvent = {
  id: string;
  person_id: string;
  person_full_name: string;
  recognized_at: string;
  event_direction: EventDirection;
  match_score: number;
  spoof_score: number;
  event_source: string;
  is_valid: boolean;
};

export type RecognitionEvent = {
  id: string;
  person_id: string;
  face_registration_id: string;
  snapshot_media_asset_id: string | null;
  recognized_at: string;
  event_direction: EventDirection;
  match_score: number;
  spoof_score: number;
  event_source: string;
  raw_payload: Record<string, unknown>;
  is_valid: boolean;
  invalid_reason: string | null;
  created_at: string;
};

export type UnknownEvent = {
  id: string;
  snapshot_media_asset_id: string | null;
  detected_at: string;
  event_direction: EventDirection;
  match_score: number | null;
  spoof_score: number;
  event_source: string;
  raw_payload: Record<string, unknown>;
  review_status: ReviewStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SpoofAlertEvent = {
  id: string;
  person_id: string | null;
  snapshot_media_asset_id: string | null;
  detected_at: string;
  spoof_score: number;
  event_source: string;
  raw_payload: Record<string, unknown>;
  severity: Severity;
  review_status: ReviewStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MediaAsset = {
  id: string;
  storage_provider: "minio";
  bucket_name: string;
  object_key: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  checksum: string | null;
  asset_type:
    | "registration_face"
    | "recognition_snapshot"
    | "unknown_snapshot"
    | "spoof_snapshot"
    | "face_crop";
  uploaded_by_person_id: string | null;
  created_at: string;
};

export type RealtimeEvent = {
  channel: "events.business" | "stream.overlay" | "stream.health";
  event_type:
    | "recognition_event.detected"
    | "unknown_event.detected"
    | "spoof_alert.detected"
    | "registration_processing.completed"
    | "registration_input.validated"
    | "frame_analysis.updated"
    | "stream.health.updated";
  occurred_at: string;
  correlation_id: string;
  dedupe_key: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type DailySummary = {
  work_date: string;
  total_events: number;
  unique_persons: number;
  total_entries: number;
  total_exits: number;
};
