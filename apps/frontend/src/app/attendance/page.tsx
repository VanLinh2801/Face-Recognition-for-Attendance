import { PageHeader } from "@/components/data/page-header";
import { DirectionBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { getDailySummary, listAttendanceEvents, listPersons } from "@/lib/mock-repository";
import { formatDateTime, percent } from "@/lib/utils";

export default function AttendancePage() {
  const summary = getDailySummary();
  const events = listAttendanceEvents().items;
  const persons = listPersons().items;

  return (
    <div>
      <PageHeader title="Chấm công" description="Theo dõi attendance events, summary theo ngày và trạng thái hợp lệ." />
      <div className="space-y-4 p-6">
        <section className="grid gap-4 md:grid-cols-4">
          {[
            ["Total", summary.total_events],
            ["Unique persons", summary.unique_persons],
            ["Entries", summary.total_entries],
            ["Exits", summary.total_exits],
          ].map(([label, value]) => (
            <Card key={label}>
              <CardContent>
                <div className="text-2xl font-semibold">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </CardContent>
            </Card>
          ))}
        </section>

        <Card>
          <CardContent className="grid gap-3 md:grid-cols-[180px_1fr_180px]">
            <Input type="date" defaultValue={summary.work_date} />
            <Select defaultValue="all">
              <option value="all">Tất cả nhân sự</option>
              {persons.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
            </Select>
            <Select defaultValue="all">
              <option value="all">entry + exit</option>
              <option value="entry">entry</option>
              <option value="exit">exit</option>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Attendance events</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200"><th className="py-3">Person</th><th>Recognized at</th><th>Direction</th><th>Match</th><th>Spoof</th><th>Source</th><th>Valid</th></tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id} className="border-b border-slate-100">
                      <td className="py-3 font-medium">{event.person_full_name}</td>
                      <td className="font-mono text-xs text-slate-500">{formatDateTime(event.recognized_at)}</td>
                      <td><DirectionBadge direction={event.event_direction} /></td>
                      <td>{percent(event.match_score)}</td>
                      <td>{percent(event.spoof_score)}</td>
                      <td>{event.event_source}</td>
                      <td><Badge variant={event.is_valid ? "success" : "danger"}>{event.is_valid ? "valid" : "invalid"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
