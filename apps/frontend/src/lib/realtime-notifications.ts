import type {
  NotificationItem,
  RealtimeBusinessEvent,
  RealtimeSpoofDetectedEvent,
  RealtimeUnknownDetectedEvent,
} from "@/lib/types";

const FOCUS_WINDOW_MS = 30 * 60 * 1000;

export function isRealtimeBusinessEvent(value: unknown): value is RealtimeBusinessEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RealtimeBusinessEvent>;
  return (
    candidate.channel === "events.business" &&
    (candidate.event_type === "recognition_event.detected" ||
      candidate.event_type === "unknown_event.detected" ||
      candidate.event_type === "spoof_alert.detected") &&
    typeof candidate.occurred_at === "string"
  );
}

export function toNotificationItem(event: RealtimeBusinessEvent): NotificationItem | null {
  if (event.event_type === "recognition_event.detected") {
    return null;
  }
  if (event.event_type === "unknown_event.detected") {
    return toUnknownNotification(event);
  }
  return toSpoofNotification(event);
}

export function mergeNotificationItems(
  currentItems: NotificationItem[],
  incomingItems: NotificationItem[],
) {
  const knownIds = new Set(currentItems.map(getNotificationDeduplicationKey));
  const appendedItems: NotificationItem[] = [];

  for (const item of incomingItems) {
    const dedupeKey = getNotificationDeduplicationKey(item);
    if (knownIds.has(dedupeKey)) {
      continue;
    }
    knownIds.add(dedupeKey);
    appendedItems.push(item);
  }

  const mergedItems = [...appendedItems, ...currentItems]
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, 50);

  return { items: mergedItems, appendedItems };
}

export function buildNotificationHref(item: NotificationItem) {
  const params = new URLSearchParams({
    type: item.kind,
    eventId: item.eventId,
    focusTime: item.occurredAt,
  });
  return `/events?${params.toString()}`;
}

export function getNotificationDeduplicationKey(item: NotificationItem) {
  if (item.eventId) {
    return item.eventId;
  }
  return `${item.sourceEvent.event_type}:${item.sourceEvent.dedupe_key ?? item.occurredAt}`;
}

export function buildFocusRange(focusTime: string) {
  const focusDate = new Date(focusTime);
  const fromDate = new Date(focusDate.getTime() - FOCUS_WINDOW_MS);
  const toDate = new Date(focusDate.getTime() + FOCUS_WINDOW_MS);

  return {
    fromTime: toLocalDateTimeValue(fromDate),
    toTime: toLocalDateTimeValue(toDate),
  };
}

function toUnknownNotification(event: RealtimeUnknownDetectedEvent): NotificationItem {
  const score = event.payload.spoof_score ?? event.payload.match_score ?? null;
  const message = [
    event.payload.track_id ? `Track ${event.payload.track_id}` : "Camera event",
    event.payload.event_source,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    id: `unknown:${event.payload.id}`,
    kind: "unknown",
    title: "Unknown person detected",
    message,
    occurredAt: event.occurred_at,
    severity: null,
    score,
    snapshotMediaAssetId: event.payload.snapshot_media_asset_id,
    eventId: event.payload.id,
    read: false,
    sourceEvent: event,
  };
}

function toSpoofNotification(event: RealtimeSpoofDetectedEvent): NotificationItem {
  const personPart = event.payload.person_name ?? "Camera event";
  const message = [personPart, event.payload.event_source].filter(Boolean).join(" · ");

  return {
    id: `spoof:${event.payload.id}`,
    kind: "spoof",
    title: "Spoof alert detected",
    message,
    occurredAt: event.occurred_at,
    severity: event.payload.severity,
    score: event.payload.spoof_score,
    snapshotMediaAssetId: event.payload.snapshot_media_asset_id,
    eventId: event.payload.id,
    read: false,
    sourceEvent: event,
  };
}

function toLocalDateTimeValue(date: Date) {
  return [
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  ].join("T");
}
