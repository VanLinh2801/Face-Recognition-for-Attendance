"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { DashboardLatestEventFilter, DashboardLatestEventItem } from "@/lib/types";
import { formatTime, percent } from "@/lib/utils";

function eventMeta(eventType: DashboardLatestEventItem["eventType"]) {
  if (eventType === "spoof_alert.detected") return { label: "Spoof alert", icon: ShieldAlert, variant: "danger" as const };
  if (eventType === "unknown_event.detected") return { label: "Unknown", icon: AlertTriangle, variant: "warning" as const };
  if (eventType === "registration_processing.completed") return { label: "Registration", icon: Fingerprint, variant: "info" as const };
  return { label: "Recognition", icon: CheckCircle2, variant: "success" as const };
}

const FILTER_ITEMS: Array<{ label: string; value: DashboardLatestEventFilter }> = [
  { label: "All", value: "all" },
  { label: "Rec", value: "recognition" },
  { label: "Unknown", value: "unknown" },
  { label: "Spoof", value: "spoof" },
];

export function LatestEvents({
  events,
  loading = false,
  error = "",
}: {
  events: DashboardLatestEventItem[];
  loading?: boolean;
  error?: string;
}) {
  const [activeFilter, setActiveFilter] = useState<DashboardLatestEventFilter>("all");

  const visibleEvents = useMemo(() => {
    if (activeFilter === "all") return events;
    return events.filter((event) => event.filterType === activeFilter);
  }, [activeFilter, events]);

  return (
    <aside
      className="flex h-full min-h-0 w-full flex-col lg:w-[360px]"
      style={{
        borderLeft: "1px solid var(--border)",
        background: "linear-gradient(180deg, var(--background-panel) 0%, var(--background) 100%)",
        color: "var(--foreground)",
      }}
    >
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Latest events</h2>
          <Badge variant="dark">Live feed</Badge>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-md bg-[var(--background-muted)] p-1 text-xs text-[var(--foreground-soft)]">
          {FILTER_ITEMS.map((item) => (
            <button
              key={item.value}
              className={
                activeFilter === item.value
                  ? "rounded bg-[var(--background-elevated)] px-2 py-1 text-[var(--foreground)] shadow-[var(--shadow-sm)]"
                  : "rounded px-2 py-1 hover:bg-[var(--background-panel)] hover:text-[var(--foreground)]"
              }
              onClick={() => setActiveFilter(item.value)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? <div className="text-sm text-[var(--foreground-muted)]">Loading dashboard events...</div> : null}
        {!loading && error ? <div className="text-sm text-[var(--danger)]">{error}</div> : null}
        {!loading && !error && visibleEvents.length === 0 ? (
          <div className="text-sm text-[var(--foreground-muted)]">No events for the selected filter.</div>
        ) : null}
        {!loading && !error && visibleEvents.map((event) => {
          const meta = eventMeta(event.eventType);
          const Icon = meta.icon;
          return (
            <div
              key={`${event.eventType}-${event.id}`}
              className="rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-3 shadow-[var(--shadow-sm)]"
            >
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--background-muted)] text-[var(--foreground-soft)]">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="font-mono text-xs text-[var(--foreground-muted)]">{formatTime(event.occurredAt)}</span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium text-[var(--foreground)]">{event.subject}</div>
                  <div className="mt-1 text-xs text-[var(--foreground-muted)]">
                    {event.channel} · score {percent(event.score)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
