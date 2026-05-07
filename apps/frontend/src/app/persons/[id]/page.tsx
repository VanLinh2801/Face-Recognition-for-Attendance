import { PageHeader } from "@/components/data/page-header";
import { DirectionBadge, PersonStatusBadge, RegistrationStatusBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDepartmentName, getPerson, listAttendanceEvents, listRegistrations } from "@/lib/mock-repository";
import { formatDateTime, percent } from "@/lib/utils";

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = getPerson(id);
  const registrations = listRegistrations(person.id).items;
  const attendance = listAttendanceEvents(person.id).items;

  return (
    <div>
      <PageHeader title={person.full_name} description={`${person.employee_code} · ${getDepartmentName(person.department_id)}`} action="Cập nhật hồ sơ" />
      <div className="grid gap-4 p-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid aspect-square place-items-center rounded-lg bg-slate-100 text-5xl font-semibold text-slate-400">
              {person.full_name.split(" ").slice(-1)[0][0]}
            </div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><PersonStatusBadge status={person.status} /></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Title</span><span>{person.title}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Email</span><span>{person.email}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Phone</span><span>{person.phone}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Joined</span><span>{person.joined_at}</span></div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Face registrations</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              {registrations.map((registration) => (
                <div key={registration.id} className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-500">{registration.id}</span>
                    <RegistrationStatusBadge status={registration.registration_status} />
                  </div>
                  <div className="grid aspect-video place-items-center rounded-md bg-slate-100 text-sm text-slate-500">Face crop preview</div>
                  <div className="mt-3 space-y-1 text-sm">
                    <div>Model: {registration.embedding_model ?? "N/A"}</div>
                    <div>Version: {registration.embedding_version ?? "N/A"}</div>
                    <div>Indexed: {registration.indexed_at ? formatDateTime(registration.indexed_at) : "Pending"}</div>
                  </div>
                </div>
              ))}
              {registrations.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">No registrations.</div> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Attendance history</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-200"><th className="py-3">Time</th><th>Direction</th><th>Match</th><th>Spoof</th><th>Valid</th></tr>
                  </thead>
                  <tbody>
                    {attendance.map((event) => (
                      <tr key={event.id} className="border-b border-slate-100">
                        <td className="py-3 font-mono text-xs">{formatDateTime(event.recognized_at)}</td>
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
            <CardHeader><CardTitle>Notes</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600">{person.notes ?? "No notes recorded."}</CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
