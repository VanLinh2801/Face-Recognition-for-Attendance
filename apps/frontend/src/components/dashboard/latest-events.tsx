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
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-slate-800 bg-slate-950 text-white lg:w-[360px]">
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Latest events</h2>
          <Badge variant="dark">Live feed</Badge>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-md bg-slate-900 p-1 text-xs text-slate-300">
          {FILTER_ITEMS.map((item) => (
            <button
              key={item.value}
              className={
                activeFilter === item.value
                  ? "rounded bg-white px-2 py-1 text-slate-950"
                  : "rounded px-2 py-1 hover:bg-slate-800"
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
        {loading ? <div className="text-sm text-slate-400">Loading dashboard events...</div> : null}
        {!loading && error ? <div className="text-sm text-red-300">{error}</div> : null}
        {!loading && !error && visibleEvents.length === 0 ? (
          <div className="text-sm text-slate-400">No events for the selected filter.</div>
        ) : null}
        {!loading && !error && visibleEvents.map((event) => {
          const meta = eventMeta(event.eventType);
          const Icon = meta.icon;
          return (
            <div key={`${event.eventType}-${event.id}`} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-800">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="font-mono text-xs text-slate-400">{formatTime(event.occurredAt)}</span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{event.subject}</div>
                  <div className="mt-1 text-xs text-slate-400">
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
