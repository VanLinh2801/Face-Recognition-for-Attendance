export type Status = "active" | "inactive" | "resigned";
export type EventDirection = "entry" | "exit" | "unknown";
export type ReviewStatus = "new" | "reviewed" | "ignored";
export type RegistrationStatus = "pending" | "validated" | "indexed" | "failed";
export type Severity = "low" | "medium" | "high";
export type EventFeedType = "recognition" | "unknown" | "spoof";

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

export type CreatePersonRegistrationResponse = {
  registration: FaceRegistration;
  stream_id: string;
  message_id: string;
  correlation_id: string;
};

export type AttendanceEvent = {
  id: string;
  person_id: string;
  person_full_name: string;
  snapshot_media_asset_id?: string | null;
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
  preview_url?: string | null;
  asset_type:
    | "registration_face"
    | "recognition_snapshot"
    | "unknown_snapshot"
    | "spoof_snapshot"
    | "face_crop";
  uploaded_by_person_id: string | null;
  created_at: string;
};

export type EventFeedItem = {
  id: string;
  type: EventFeedType;
  occurred_at: string;
  person_id: string | null;
  person_name: string | null;
  direction: EventDirection | null;
  score: number | null;
  spoof_score: number | null;
  source: string;
  status: string;
  severity: Severity | null;
  review_status: ReviewStatus | null;
  snapshot_media_asset_id: string | null;
  raw_payload: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
};

export type EventFeedListResponse = PageResult<EventFeedItem>;

export type FilterPolicy = {
  server_now: string;
  retention_days: number;
  events: {
    max_future_hours: number;
  };
  attendance: {
    max_future_days: number;
  };
};

export type UpdateEventReviewRequest = {
  review_status?: ReviewStatus | null;
  notes?: string | null;
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
  correlation_id: string | null;
  dedupe_key: string | null;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type NotificationKind = "unknown" | "spoof";

export type DailySummary = {
  work_date: string;
  total_events: number;
  unique_persons: number;
  total_entries: number;
  total_exits: number;
  unknown_count: number;
  spoof_alert_count: number;
};

export type AttendanceHourlyStatItem = {
  hour: string;
  events: number;
  entries: number;
  exits: number;
  alerts: number;
};

export type AttendanceHourlyStatsResponse = {
  work_date: string;
  items: AttendanceHourlyStatItem[];
};

export type DashboardHealthComponent = {
  status: "healthy" | "degraded" | "offline" | "unknown";
  label: string;
  last_updated_at: string | null;
  details: {
    fps?: number | null;
    latency_ms?: number | null;
    stream_id?: string | null;
    camera_name?: string | null;
    source_online?: boolean | null;
    database_ready?: boolean | null;
    active_connections?: number | null;
    sent_messages?: number | null;
    dropped_messages?: number | null;
    disconnect_slow_client?: number | null;
  };
};

export type DashboardHealthResponse = {
  backend: DashboardHealthComponent;
  realtime_ws: DashboardHealthComponent;
  stream: DashboardHealthComponent;
  camera_source: DashboardHealthComponent;
};

export type CurrentUser = {
  id: string;
  username: string;
  is_active: boolean;
  last_login_at: string | null;
};

export type DashboardLatestEventFilter = "all" | "recognition" | "unknown" | "spoof";

export type DashboardLatestEventItem = {
  id: string;
  filterType: Exclude<DashboardLatestEventFilter, "all">;
  eventType:
    | "recognition_event.detected"
    | "unknown_event.detected"
    | "spoof_alert.detected"
    | "registration_processing.completed";
  occurredAt: string;
  title: string;
  subject: string;
  score: number | null;
  channel: "events.business";
  dedupeKey: string | null;
};

// Overlay types for realtime bounding box
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TrackingState = "new" | "tracking" | "lost";
export type AnalysisStatus = "detected" | "spoof" | "low_quality" | "ignored";

export type OverlayTrack = {
  track_id: string;
  bbox: BoundingBox;
  tracking_state: TrackingState;
  analysis_status: AnalysisStatus;
  display_label?: string;
};

export type FrameOverlayPayload = {
  stream_id: string;
  frame_id: string;
  frame_sequence: number;
  captured_at: string;
  presentation_ts_ms: number;
  frame_width: number;
  frame_height: number;
  tracks: OverlayTrack[];
};

export type FrameOverlayEvent = {
  channel: "stream.overlay";
  event_type: "frame_analysis.updated";
  occurred_at: string;
  correlation_id: string | null;
  dedupe_key: string | null;
  payload: FrameOverlayPayload;
  metadata: Record<string, unknown>;
};

export type WebSocketConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

export type OverlayRenderBox = {
  track_id: string;
  left: string;
  top: string;
  width: string;
  height: string;
  color: string;
  label: string;
  tracking_state: TrackingState;
  analysis_status: AnalysisStatus;
  expiresAt: number;
};

// Recognition event với bbox cho overlay
export type RealtimeRecognitionPayload = {
  stream_id: string;
  frame_id: string;
  frame_sequence: number;
  track_id: string;
  person_id: string;
  face_registration_id: string;
  recognized_at: string;
  event_direction: "entry" | "exit" | "unknown";
  match_score: number;
  spoof_score: number;
  event_source: string;
  dedupe_key: string;
  snapshot_media_asset: Record<string, unknown> | null;
  bbox: BoundingBox | null;
  // Enriched by backend before WS push
  full_name: string | null;
  employee_code: string | null;
};

export type RealtimeUnknownDetectedPayload = {
  id: string;
  detected_at: string;
  event_direction: "entry" | "exit" | "unknown";
  match_score: number | null;
  spoof_score: number | null;
  event_source: string;
  review_status: ReviewStatus;
  notes: string | null;
  snapshot_media_asset_id: string | null;
  track_id: string | null;
  dedupe_key: string | null;
};

export type RealtimeSpoofDetectedPayload = {
  id: string;
  person_id: string | null;
  person_name: string | null;
  detected_at: string;
  spoof_score: number;
  severity: Severity;
  event_source: string;
  review_status: ReviewStatus;
  notes: string | null;
  snapshot_media_asset_id: string | null;
  track_id: string | null;
  dedupe_key: string | null;
};

export type RecognitionOverlayEvent = {
  channel: "events.business";
  event_type: "recognition_event.detected";
  occurred_at: string;
  correlation_id: string | null;
  dedupe_key: string | null;
  payload: RealtimeRecognitionPayload;
  metadata: Record<string, unknown>;
};

export type RealtimeUnknownDetectedEvent = {
  channel: "events.business";
  event_type: "unknown_event.detected";
  occurred_at: string;
  correlation_id: string | null;
  dedupe_key: string | null;
  payload: RealtimeUnknownDetectedPayload;
  metadata: Record<string, unknown>;
};

export type RealtimeSpoofDetectedEvent = {
  channel: "events.business";
  event_type: "spoof_alert.detected";
  occurred_at: string;
  correlation_id: string | null;
  dedupe_key: string | null;
  payload: RealtimeSpoofDetectedPayload;
  metadata: Record<string, unknown>;
};

export type RealtimeRecognitionBusinessEvent = {
  channel: "events.business";
  event_type: "recognition_event.detected";
  occurred_at: string;
  correlation_id: string | null;
  dedupe_key: string | null;
  payload: RealtimeRecognitionPayload;
  metadata: Record<string, unknown>;
};

export type RealtimeBusinessEvent =
  | RealtimeRecognitionBusinessEvent
  | RealtimeUnknownDetectedEvent
  | RealtimeSpoofDetectedEvent;

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  occurredAt: string;
  severity: Severity | null;
  score: number | null;
  snapshotMediaAssetId: string | null;
  eventId: string;
  read: boolean;
  sourceEvent: RealtimeBusinessEvent;
};
