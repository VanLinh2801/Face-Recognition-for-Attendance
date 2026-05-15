import type {
  DashboardHealthComponent,
  DashboardLatestEventItem,
  EventFeedItem,
  RealtimeBusinessEvent,
  RealtimeRecognitionBusinessEvent,
} from "@/lib/types";

export function getLocalWorkDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildLocalDayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const now = new Date();
  const end = new Date(Math.min(endOfDay.getTime(), now.getTime()));
  const safeStart = start.getTime() <= end.getTime() ? start : new Date(end);

  return {
    fromAt: safeStart.toISOString(),
    toAt: end.toISOString(),
  };
}

export function mapEventFeedItemToDashboardLatestEvent(item: EventFeedItem): DashboardLatestEventItem | null {
  if (item.type === "recognition") {
    return {
      id: item.id,
      filterType: "recognition",
      eventType: "recognition_event.detected",
      occurredAt: item.occurred_at,
      title: "Recognition",
      subject: item.person_name ?? "Camera event",
      score: item.score,
      channel: "events.business",
      dedupeKey: item.id,
    };
  }

  if (item.type === "unknown") {
    return {
      id: item.id,
      filterType: "unknown",
      eventType: "unknown_event.detected",
      occurredAt: item.occurred_at,
      title: "Unknown",
      subject: item.person_name ?? "Camera event",
      score: item.spoof_score ?? item.score,
      channel: "events.business",
      dedupeKey: item.id,
    };
  }

  if (item.type === "spoof") {
    return {
      id: item.id,
      filterType: "spoof",
      eventType: "spoof_alert.detected",
      occurredAt: item.occurred_at,
      title: "Spoof alert",
      subject: item.person_name ?? "Camera event",
      score: item.spoof_score ?? item.score,
      channel: "events.business",
      dedupeKey: item.id,
    };
  }

  return null;
}

export function mapRealtimeBusinessEventToDashboardLatestEvent(
  event: RealtimeBusinessEvent | RealtimeRecognitionBusinessEvent,
): DashboardLatestEventItem | null {
  if (event.event_type === "recognition_event.detected") {
    return {
      id: event.dedupe_key ?? `${event.event_type}:${event.occurred_at}`,
      filterType: "recognition",
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      title: "Recognition",
      subject: event.payload.full_name ?? "Camera event",
      score: event.payload.match_score,
      channel: "events.business",
      dedupeKey: event.dedupe_key,
    };
  }

  if (event.event_type === "unknown_event.detected") {
    return {
      id: event.payload.id,
      filterType: "unknown",
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      title: "Unknown",
      subject: event.payload.track_id ?? "Camera event",
      score: event.payload.spoof_score ?? event.payload.match_score,
      channel: "events.business",
      dedupeKey: event.dedupe_key,
    };
  }

  if (event.event_type === "spoof_alert.detected") {
    return {
      id: event.payload.id,
      filterType: "spoof",
      eventType: event.event_type,
      occurredAt: event.occurred_at,
      title: "Spoof alert",
      subject: event.payload.person_name ?? "Camera event",
      score: event.payload.spoof_score,
      channel: "events.business",
      dedupeKey: event.dedupe_key,
    };
  }

  return null;
}

export function mergeDashboardLatestEvents(
  currentItems: DashboardLatestEventItem[],
  incomingItems: DashboardLatestEventItem[],
  maxItems = 20,
) {
  const knownKeys = new Set(currentItems.map(getDashboardLatestEventKey));
  const nextItems = [...currentItems];

  for (const item of incomingItems) {
    const key = getDashboardLatestEventKey(item);
    if (knownKeys.has(key)) continue;
    knownKeys.add(key);
    nextItems.push(item);
  }

  return nextItems
    .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime())
    .slice(0, maxItems);
}

export function getDashboardLatestEventKey(item: DashboardLatestEventItem) {
  return item.id || `${item.eventType}:${item.dedupeKey ?? item.occurredAt}`;
}

export function getHealthBadgeVariant(component: DashboardHealthComponent): "success" | "warning" | "danger" | "dark" {
  switch (component.status) {
    case "healthy":
      return "success";
    case "degraded":
      return "warning";
    case "offline":
      return "danger";
    default:
      return "dark";
  }
}
