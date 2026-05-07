import { Activity, AlertTriangle, CheckCircle2, Radio, ShieldAlert, Users } from "lucide-react";
import { CameraView } from "@/components/dashboard/camera-view";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { LatestEvents } from "@/components/dashboard/latest-events";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DirectionBadge, ReviewStatusBadge, SeverityBadge } from "@/components/data/status-badge";
import {
  getDailySummary,
  getHourlyStats,
  listAttendanceEvents,
  listLatestEvents,
  listSpoofAlertEvents,
  listUnknownEvents,
} from "@/lib/mock-repository";
import { formatDateTime, percent } from "@/lib/utils";

export default function DashboardPage() {
  const summary = getDailySummary();
  const latestEvents = listLatestEvents();
  const attendance = listAttendanceEvents().items;
  const unknown = listUnknownEvents().items;
  const spoof = listSpoofAlertEvents().items;

  const stats = [
    { label: "Total events", value: summary.total_events, icon: Activity },
    { label: "Unique persons", value: summary.unique_persons, icon: Users },
    { label: "Entries", value: summary.total_entries, icon: CheckCircle2 },
    { label: "Exits", value: summary.total_exits, icon: Radio },
    { label: "Unknown", value: unknown.length, icon: AlertTriangle },
    { label: "Spoof alerts", value: spoof.length, icon: ShieldAlert },
  ];

  return (
    <div>
      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] flex-col lg:flex-row">
        <CameraView />
        <LatestEvents events={latestEvents} />
      </div>

      <div className="space-y-6 p-6">
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardContent className="flex items-center gap-4">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100 text-slate-700">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-2xl font-semibold">{stat.value}</div>
                    <div className="text-sm text-slate-500">{stat.label}</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <DashboardCharts data={getHourlyStats()} />

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Recent attendance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-3">Person</th>
                      <th>Time</th>
                      <th>Direction</th>
                      <th>Match</th>
                      <th>Spoof</th>
                      <th>Valid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((event) => (
                      <tr key={event.id} className="border-b border-slate-100">
                        <td className="py-3 font-medium">{event.person_full_name}</td>
                        <td className="font-mono text-xs text-slate-500">{formatDateTime(event.recognized_at)}</td>
                        <td><DirectionBadge direction={event.event_direction} /></td>
                        <td>{percent(event.match_score)}</td>
                        <td>{percent(event.spoof_score)}</td>
                        <td><Badge variant={event.is_valid ? "success" : "danger"}>{event.is_valid ? "valid" : "invalid"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                ["Backend", "ready", "success"],
                ["Realtime WS", "mock connected", "info"],
                ["Stream", "healthy", "success"],
                ["Camera source", "online", "success"],
              ].map(([label, value, variant]) => (
                <div key={label} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                  <span className="text-sm text-slate-600">{label}</span>
                  <Badge variant={variant as "success" | "info"}>{value}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Unknown events needing review</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {unknown.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{formatDateTime(event.detected_at)}</div>
                    <div className="mt-1 text-sm">Direction: {event.event_direction}</div>
                  </div>
                  <ReviewStatusBadge status={event.review_status} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Spoof alerts</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {spoof.map((event) => (
                <div key={event.id} className="flex items-center justify-between rounded-md border border-slate-100 p-3">
                  <div>
                    <div className="font-mono text-xs text-slate-500">{formatDateTime(event.detected_at)}</div>
                    <div className="mt-1 text-sm">Spoof score: {percent(event.spoof_score)}</div>
                  </div>
                  <SeverityBadge severity={event.severity} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
