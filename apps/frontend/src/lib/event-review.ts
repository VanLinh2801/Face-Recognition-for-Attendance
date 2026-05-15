import { apiFetch } from "@/lib/api-client";
import type { EventFeedItem, EventFeedType, ReviewStatus, UpdateEventReviewRequest } from "@/lib/types";

export function normalizeEventReviewStatus(status: ReviewStatus | null | undefined): ReviewStatus | null {
  if (!status) return null;
  return status === "ignored" ? "reviewed" : status;
}

export function canReviewEventType(type: EventFeedType) {
  return type === "unknown" || type === "spoof";
}

export function canReviewEvent(event: Pick<EventFeedItem, "type">) {
  return canReviewEventType(event.type);
}

export function isEventPendingReview(event: Pick<EventFeedItem, "type" | "review_status">) {
  return canReviewEvent(event) && normalizeEventReviewStatus(event.review_status) === "new";
}

export async function markEventAsReviewed(event: Pick<EventFeedItem, "id" | "type">) {
  const path = getReviewPath(event.type, event.id);
  await apiFetch(path, {
    method: "PATCH",
    withAuth: true,
    body: JSON.stringify({
      review_status: "reviewed",
    } satisfies UpdateEventReviewRequest),
  });
}

function getReviewPath(type: EventFeedType, eventId: string) {
  if (type === "unknown") {
    return `/unknown-events/${eventId}`;
  }
  if (type === "spoof") {
    return `/spoof-alert-events/${eventId}`;
  }
  throw new Error(`Event type "${type}" does not support review updates.`);
}
