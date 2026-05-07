import { AlertTriangle, CheckCircle2, Fingerprint, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RealtimeEvent } from "@/lib/types";
import { formatTime, percent } from "@/lib/utils";

function eventMeta(eventType: RealtimeEvent["event_type"]) {
  if (eventType === "spoof_alert.detected") return { label: "Spoof alert", icon: ShieldAlert, variant: "danger" as const };
  if (eventType === "unknown_event.detected") return { label: "Unknown", icon: AlertTriangle, variant: "warning" as const };
  if (eventType === "registration_processing.completed") return { label: "Registration", icon: Fingerprint, variant: "info" as const };
  return { label: "Recognition", icon: CheckCircle2, variant: "success" as const };
}

export function LatestEvents({ events }: { events: RealtimeEvent[] }) {
  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-slate-800 bg-slate-950 text-white lg:w-[360px]">
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Latest events</h2>
          <Badge variant="dark">Live feed</Badge>
        </div>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-md bg-slate-900 p-1 text-xs text-slate-300">
          {["All", "Rec", "Unknown", "Spoof"].map((item, index) => (
            <button key={item} className={index === 0 ? "rounded bg-white px-2 py-1 text-slate-950" : "rounded px-2 py-1 hover:bg-slate-800"}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="thin-scrollbar min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {events.map((event) => {
          const meta = eventMeta(event.event_type);
          const Icon = meta.icon;
          const name = typeof event.payload.full_name === "string" ? event.payload.full_name : "Camera event";
          const score =
            typeof event.payload.match_score === "number"
              ? event.payload.match_score
              : typeof event.payload.spoof_score === "number"
                ? event.payload.spoof_score
                : null;
          return (
            <div key={`${event.event_type}-${event.occurred_at}`} className="rounded-lg border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-start gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-slate-800">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="font-mono text-xs text-slate-400">{formatTime(event.occurred_at)}</span>
                  </div>
                  <div className="mt-2 truncate text-sm font-medium">{name}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    {event.channel} · score {percent(score)}
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
