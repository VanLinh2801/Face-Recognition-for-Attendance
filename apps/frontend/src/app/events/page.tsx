import { AlertTriangle, Radio, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/data/page-header";
import { DirectionBadge, ReviewStatusBadge, SeverityBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import {
  getPersonName,
  listRecognitionEvents,
  listSpoofAlertEvents,
  listUnknownEvents,
} from "@/lib/mock-repository";
import { formatDateTime, percent } from "@/lib/utils";

export default function EventsPage() {
  const recognitionEvents = listRecognitionEvents().items;
  const unknownEvents = listUnknownEvents().items;
  const spoofAlerts = listSpoofAlertEvents().items;

  const totals = [
    { label: "Recognition", value: recognitionEvents.length, icon: Radio, variant: "success" as const },
    { label: "Unknown", value: unknownEvents.length, icon: AlertTriangle, variant: "warning" as const },
    { label: "Spoof alerts", value: spoofAlerts.length, icon: ShieldAlert, variant: "danger" as const },
  ];

  return (
    <div>
      <PageHeader
        title="Sự kiện"
        description="Một trang duy nhất cho recognition events, unknown events và spoof alerts."
      />
      <div className="space-y-4 p-6">
        <section className="grid gap-4 md:grid-cols-3">
          {totals.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold">{item.value}</div>
                    <div className="text-sm text-slate-500">{item.label}</div>
                  </div>
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-slate-100">
                    <Icon className="h-5 w-5 text-slate-600" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card>
          <CardContent className="grid gap-3 md:grid-cols-[220px_220px_1fr]">
            <Select defaultValue="all">
              <option value="all">Tất cả loại sự kiện</option>
              <option value="recognition">Recognition</option>
              <option value="unknown">Unknown</option>
              <option value="spoof">Spoof alert</option>
            </Select>
            <Select defaultValue="all">
              <option value="all">Tất cả trạng thái</option>
              <option value="valid">valid</option>
              <option value="new">new</option>
              <option value="reviewed">reviewed</option>
              <option value="ignored">ignored</option>
            </Select>
            <div className="flex items-center text-sm text-slate-500">
              Filter đang ở mức mock UI; khi nối backend sẽ map sang query params tương ứng.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recognition events</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="py-3">ID</th><th>Recognized at</th><th>Direction</th><th>Match</th><th>Spoof</th><th>Source</th><th>Valid</th>
                  </tr>
                </thead>
                <tbody>
                  {recognitionEvents.map((event) => (
                    <tr key={event.id} className="border-b border-slate-100">
                      <td className="py-3 font-mono text-xs">{event.id}</td>
                      <td className="font-mono text-xs text-slate-500">{formatDateTime(event.recognized_at)}</td>
                      <td><DirectionBadge direction={event.event_direction} /></td>
                      <td>{percent(event.match_score)}</td>
                      <td>{percent(event.spoof_score)}</td>
                      <td>{event.event_source}</td>
                      <td><Badge variant={event.is_valid ? "success" : "danger"}>{event.is_valid ? "valid" : event.invalid_reason}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Unknown events</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-200"><th className="py-3">Detected at</th><th>Direction</th><th>Spoof</th><th>Source</th><th>Status</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {unknownEvents.map((event) => (
                      <tr key={event.id} className="border-b border-slate-100">
                        <td className="py-3 font-mono text-xs text-slate-500">{formatDateTime(event.detected_at)}</td>
                        <td><DirectionBadge direction={event.event_direction} /></td>
                        <td>{percent(event.spoof_score)}</td>
                        <td>{event.event_source}</td>
                        <td><ReviewStatusBadge status={event.review_status} /></td>
                        <td>{event.notes ?? "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Spoof alerts</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-200"><th className="py-3">Detected at</th><th>Person</th><th>Score</th><th>Severity</th><th>Status</th><th>Notes</th></tr>
                  </thead>
                  <tbody>
                    {spoofAlerts.map((event) => (
                      <tr key={event.id} className="border-b border-slate-100">
                        <td className="py-3 font-mono text-xs text-slate-500">{formatDateTime(event.detected_at)}</td>
                        <td>{getPersonName(event.person_id)}</td>
                        <td>{percent(event.spoof_score)}</td>
                        <td><SeverityBadge severity={event.severity} /></td>
                        <td><ReviewStatusBadge status={event.review_status} /></td>
                        <td>{event.notes ?? "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
