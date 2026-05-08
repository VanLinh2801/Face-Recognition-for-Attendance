"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { DirectionBadge, PersonStatusBadge } from "@/components/data/status-badge";
import { PersonFaceRegistrations } from "@/components/persons/person-face-registrations";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDepartmentName, getPerson, listAttendanceEvents, listRegistrations } from "@/lib/mock-repository";
import type { Person } from "@/lib/types";
import { formatDateTime, percent } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [person, setPerson] = useState<Person>(() => getPerson(id));
  const [error, setError] = useState<string | null>(null);
  const registrations = listRegistrations(person.id).items;
  const attendance = listAttendanceEvents(person.id).items;

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) return;

    const controller = new AbortController();
    async function loadPerson() {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/persons/${id}`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message ?? data?.detail ?? `HTTP ${res.status}`);
        setPerson(data as Person);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Failed to load person");
      }
    }

    void loadPerson();
    return () => controller.abort();
  }, [id]);

  return (
    <div>
      <PageHeader title={person.full_name} description={`${person.employee_code} · ${getDepartmentName(person.department_id)}`} action="Cập nhật hồ sơ" />
      <div className="grid gap-4 p-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {error ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-800">{error}</div> : null}
            <div className="grid aspect-square place-items-center rounded-lg bg-slate-100 text-5xl font-semibold text-slate-400">
              {person.full_name.split(" ").slice(-1)[0][0]}
            </div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><PersonStatusBadge status={person.status} /></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Title</span><span>{person.title ?? "N/A"}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Email</span><span>{person.email ?? "N/A"}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Phone</span><span>{person.phone ?? "N/A"}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Joined</span><span>{person.joined_at ?? "N/A"}</span></div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <PersonFaceRegistrations personId={person.id} initialRegistrations={registrations} />

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
                    {attendance.length === 0 ? (
                      <tr><td colSpan={5} className="py-6 text-center text-slate-500">No attendance events.</td></tr>
                    ) : null}
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
