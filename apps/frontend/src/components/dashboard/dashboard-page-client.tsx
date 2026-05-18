"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, AlertTriangle, ShieldAlert, Users } from "lucide-react";
import { ReviewStatusBadge, SeverityBadge } from "@/components/data/status-badge";
import { ListTableAccent } from "@/components/data/list-table-accent";
import { CameraView } from "@/components/dashboard/camera-view";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { LatestEvents } from "@/components/dashboard/latest-events";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimeBusinessEvents } from "@/hooks/useRealtimeBusinessEvents";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import {
  buildLocalDayRange,
  getHealthBadgeVariant,
  getLocalWorkDate,
  mapEventFeedItemToDashboardLatestEvent,
  mapRealtimeBusinessEventToDashboardLatestEvent,
  mergeDashboardLatestEvents,
} from "@/lib/dashboard-data";
import type {
  AttendanceEvent,
  AttendanceHourlyStatsResponse,
  DashboardHealthResponse,
  DashboardLatestEventItem,
  DailySummary,
  EventFeedListResponse,
  PageResult,
  RealtimeBusinessEvent,
  SpoofAlertEvent,
  UnknownEvent,
} from "@/lib/types";
import { formatDateTime, percent } from "@/lib/utils";

const ATTENDANCE_WIDGET_PAGE_SIZE = 10;
const REVIEW_WIDGET_PAGE_SIZE = 5;
const LATEST_EVENTS_PAGE_SIZE = 20;

export function DashboardPageClient() {
  const router = useRouter();
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [hourlyStats, setHourlyStats] = useState<AttendanceHourlyStatsResponse["items"]>([]);
  const [attendance, setAttendance] = useState<AttendanceEvent[]>([]);
  const [unknown, setUnknown] = useState<UnknownEvent[]>([]);
  const [spoof, setSpoof] = useState<SpoofAlertEvent[]>([]);
  const [health, setHealth] = useState<DashboardHealthResponse | null>(null);
  const [latestEvents, setLatestEvents] = useState<DashboardLatestEventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestEventsLoading, setLatestEventsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [latestEventsError, setLatestEventsError] = useState("");
  const [latestEventsCursor, setLatestEventsCursor] = useState<string | null>(null);

  const token = getAccessToken();

  const loadDashboard = useCallback(async () => {
    const authToken = getAccessToken();
    if (!authToken) {
      router.push("/login");
      return;
    }

    setLoading(true);
    setLatestEventsLoading(true);
    setPageError("");
    setLatestEventsError("");

    const workDate = getLocalWorkDate();
    const dayRange = buildLocalDayRange();
    const latestParams = new URLSearchParams({
      type: "all",
      page: "1",
      page_size: String(LATEST_EVENTS_PAGE_SIZE),
      from_at: dayRange.fromAt,
      to_at: dayRange.toAt,
    });
    const attendanceParams = new URLSearchParams({
      page: "1",
      page_size: String(ATTENDANCE_WIDGET_PAGE_SIZE),
      from_at: dayRange.fromAt,
      to_at: dayRange.toAt,
    });
    const unknownParams = new URLSearchParams({
      page: "1",
      page_size: String(REVIEW_WIDGET_PAGE_SIZE),
      review_status: "new",
    });
    const spoofParams = new URLSearchParams({
      page: "1",
      page_size: String(REVIEW_WIDGET_PAGE_SIZE),
      review_status: "new",
    });

    const [
      summaryResult,
      hourlyStatsResult,
      attendanceResult,
      unknownResult,
      spoofResult,
      healthResult,
      latestEventsResult,
    ] = await Promise.allSettled([
      apiFetch<DailySummary>(`/attendance/summary/daily?work_date=${workDate}`, { withAuth: true }),
      apiFetch<AttendanceHourlyStatsResponse>(`/attendance/hourly-stats?work_date=${workDate}`, { withAuth: true }),
      apiFetch<PageResult<AttendanceEvent>>(`/attendance/events?${attendanceParams.toString()}`, { withAuth: true }),
      apiFetch<PageResult<UnknownEvent>>(`/unknown-events?${unknownParams.toString()}`, { withAuth: true }),
      apiFetch<PageResult<SpoofAlertEvent>>(`/spoof-alert-events?${spoofParams.toString()}`, { withAuth: true }),
      apiFetch<DashboardHealthResponse>("/system/dashboard-health", { withAuth: true }),
      apiFetch<EventFeedListResponse>(`/events?${latestParams.toString()}`, { withAuth: true }),
    ]);

    if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
    if (hourlyStatsResult.status === "fulfilled") setHourlyStats(hourlyStatsResult.value.items);
    if (attendanceResult.status === "fulfilled") setAttendance(attendanceResult.value.items);
    if (unknownResult.status === "fulfilled") setUnknown(unknownResult.value.items);
    if (spoofResult.status === "fulfilled") setSpoof(spoofResult.value.items);
    if (healthResult.status === "fulfilled") setHealth(healthResult.value);

    if (latestEventsResult.status === "fulfilled") {
      const items = latestEventsResult.value.items
        .map(mapEventFeedItemToDashboardLatestEvent)
        .filter((item): item is DashboardLatestEventItem => item !== null);
      setLatestEvents(items);
      setLatestEventsCursor(items[0]?.occurredAt ?? null);
      setLatestEventsLoading(false);
    } else {
      setLatestEvents([]);
      setLatestEventsError(extractErrorMessage(latestEventsResult.reason, "Failed to load latest events."));
      setLatestEventsLoading(false);
    }

    const criticalResults = [
      summaryResult,
      hourlyStatsResult,
      attendanceResult,
      unknownResult,
      spoofResult,
      healthResult,
    ];
    if (criticalResults.some((result) => result.status === "rejected")) {
      setPageError("Some dashboard widgets could not be loaded. Showing available data.");
    }

    setLoading(false);
  }, [router]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  const appendRealtimeEvents = useCallback((events: RealtimeBusinessEvent[]) => {
    const items = events
      .map(mapRealtimeBusinessEventToDashboardLatestEvent)
      .filter((item): item is DashboardLatestEventItem => item !== null);
    if (items.length === 0) return;
    setLatestEvents((currentItems) => mergeDashboardLatestEvents(currentItems, items, LATEST_EVENTS_PAGE_SIZE));
  }, []);

  useRealtimeBusinessEvents({
    token,
    enabled: Boolean(token),
    initialSinceTimestamp: latestEventsCursor,
    onLiveEvents: appendRealtimeEvents,
    onCatchupEvents: appendRealtimeEvents,
    onCursorChange: setLatestEventsCursor,
  });

  const stats = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Total events", value: summary.total_events, icon: Activity },
      { label: "Unique persons", value: summary.unique_persons, icon: Users },
      { label: "Unknown", value: summary.unknown_count, icon: AlertTriangle },
      { label: "Spoof alerts", value: summary.spoof_alert_count, icon: ShieldAlert },
    ];
  }, [summary]);

  const healthRows = useMemo(() => {
    if (!health) return [];
    return [
      { label: "Backend", component: health.backend },
      { label: "Realtime WS", component: health.realtime_ws },
      { label: "Stream", component: health.stream },
      { label: "Camera source", component: health.camera_source },
    ];
  }, [health]);

  return (
    <div>
      <div className="flex h-[calc(100vh-4rem)] min-h-[620px] flex-col lg:flex-row">
        <CameraView />
        <LatestEvents events={latestEvents} loading={latestEventsLoading} error={latestEventsError} />
      </div>

      <div className="space-y-6 p-6">
        {pageError ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {pageError}
          </div>
        ) : null}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {loading && stats.length === 0
            ? Array.from({ length: 4 }).map((_, index) => (
                <Card key={`skeleton-${index}`}>
                  <CardContent className="h-[88px] animate-pulse rounded-lg bg-slate-100" />
                </Card>
              ))
            : stats.map((stat) => {
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

        <DashboardCharts data={hourlyStats} />

        <section className="grid gap-4 xl:grid-cols-3">
          <Card className="list-table-corner-accent xl:col-span-2">
            <ListTableAccent />
            <CardHeader>
              <CardTitle>Recent attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {attendance.length === 0 && loading ? <div className="text-sm text-slate-500">Loading attendance...</div> : null}
              {attendance.length === 0 && !loading ? <div className="text-sm text-slate-500">No attendance events today.</div> : null}
              {attendance.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="text-xs uppercase text-slate-500">
                      <tr className="border-b border-slate-200">
                        <th className="py-3">Person</th>
                        <th>Time</th>
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
                          <td>{percent(event.match_score)}</td>
                          <td>{percent(event.spoof_score)}</td>
                          <td><Badge variant={event.is_valid ? "success" : "danger"}>{event.is_valid ? "valid" : "invalid"}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>System health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {healthRows.length === 0 && loading ? <div className="text-sm text-slate-500">Loading system health...</div> : null}
              {healthRows.length === 0 && !loading ? <div className="text-sm text-slate-500">System health unavailable.</div> : null}
              {healthRows.map((item) => (
                <div key={item.label} className="space-y-2 rounded-md border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">{item.label}</span>
                    <Badge variant={getHealthBadgeVariant(item.component)}>{item.component.label}</Badge>
                  </div>
                  {typeof item.component.details.fps === "number" || typeof item.component.details.latency_ms === "number" ? (
                    <div className="text-xs text-slate-500">
                      {typeof item.component.details.fps === "number" ? `FPS ${item.component.details.fps}` : "FPS N/A"} ·{" "}
                      {typeof item.component.details.latency_ms === "number"
                        ? `${item.component.details.latency_ms} ms`
                        : "Latency N/A"}
                    </div>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Unknown events needing review</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {unknown.length === 0 && loading ? <div className="text-sm text-slate-500">Loading unknown events...</div> : null}
              {unknown.length === 0 && !loading ? <div className="text-sm text-slate-500">No unknown events need review.</div> : null}
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
              {spoof.length === 0 && loading ? <div className="text-sm text-slate-500">Loading spoof alerts...</div> : null}
              {spoof.length === 0 && !loading ? <div className="text-sm text-slate-500">No spoof alerts need review.</div> : null}
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

function extractErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}
