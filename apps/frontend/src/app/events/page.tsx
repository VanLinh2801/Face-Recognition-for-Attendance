import { EventsReviewCenter } from "@/components/events/events-review-center";
import { PageHeader } from "@/components/data/page-header";
import {
  getPersonName,
  listMediaAssets,
  listRecognitionEvents,
  listSpoofAlertEvents,
  listUnknownEvents,
} from "@/lib/mock-repository";

export default function EventsPage() {
  const recognitionEvents = listRecognitionEvents().items;
  const unknownEvents = listUnknownEvents().items;
  const spoofAlerts = listSpoofAlertEvents().items;
  const mediaAssets = listMediaAssets().items;

  const rows = [
    ...recognitionEvents.map((event) => ({
      id: event.id,
      type: "recognition" as const,
      label: "Recognition",
      occurred_at: event.recognized_at,
      person_name: getPersonName(event.person_id),
      person_id: event.person_id,
      direction: event.event_direction,
      score: event.match_score,
      spoof_score: event.spoof_score,
      source: event.event_source,
      status: event.is_valid ? "valid" : (event.invalid_reason ?? "invalid"),
      severity: null,
      review_status: null,
      media: mediaAssets.filter((asset) => asset.asset_type === "recognition_snapshot").slice(0, 1),
      raw_payload: event.raw_payload,
      metadata: {
        face_registration_id: event.face_registration_id,
        snapshot_media_asset_id: event.snapshot_media_asset_id,
        created_at: event.created_at,
      },
    })),
    ...unknownEvents.map((event) => ({
      id: event.id,
      type: "unknown" as const,
      label: "Unknown",
      occurred_at: event.detected_at,
      person_name: "Unknown",
      person_id: null,
      direction: event.event_direction,
      score: event.match_score,
      spoof_score: event.spoof_score,
      source: event.event_source,
      status: event.review_status,
      severity: null,
      review_status: event.review_status,
      media: mediaAssets.filter((asset) => asset.asset_type === "unknown_snapshot").slice(0, 1),
      raw_payload: event.raw_payload,
      metadata: {
        snapshot_media_asset_id: event.snapshot_media_asset_id,
        notes: event.notes,
        created_at: event.created_at,
        updated_at: event.updated_at,
      },
    })),
    ...spoofAlerts.map((event) => ({
      id: event.id,
      type: "spoof" as const,
      label: "Spoof alert",
      occurred_at: event.detected_at,
      person_name: getPersonName(event.person_id),
      person_id: event.person_id,
      direction: null,
      score: event.spoof_score,
      spoof_score: event.spoof_score,
      source: event.event_source,
      status: event.review_status,
      severity: event.severity,
      review_status: event.review_status,
      media: mediaAssets.filter((asset) => asset.asset_type === "spoof_snapshot").slice(0, 1),
      raw_payload: event.raw_payload,
      metadata: {
        snapshot_media_asset_id: event.snapshot_media_asset_id,
        notes: event.notes,
        created_at: event.created_at,
        updated_at: event.updated_at,
      },
    })),
  ].sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime());

  return (
    <div>
      <PageHeader
        title="Sự kiện"
        description="Review recognition, unknown và spoof alerts trong một bảng thống nhất."
      />
      <EventsReviewCenter rows={rows} />
    </div>
  );
}
