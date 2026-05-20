"use client";

import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Eye,
  FileText,
  ImageIcon,
  Loader2,
  Printer,
  Search,
  Users,
  UserX,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListTableAccent } from "@/components/data/list-table-accent";
import { useTheme } from "@/components/theme/theme-provider";
import { Input } from "@/components/ui/input";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import {
  buildAttendanceApiRange,
  getAttendanceBoundaryValues,
  getDefaultAttendanceRange,
  normalizeAttendanceDate,
  normalizeAttendanceRange,
} from "@/lib/filter-policy";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { AttendanceEvent, Department, FilterPolicy, PageResult, Person } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";

const LATE_AFTER_HOUR = 8;
const LATE_AFTER_MINUTE = 15;

type PersonWithDepartment = Person & { department_name: string };
type PresenceStatus = "present" | "late" | "absent";
type PresenceStatusFilter = "all" | PresenceStatus;
type PresenceReportRow = {
  person: PersonWithDepartment;
  present_days: number;
  late_days: number;
  absent_days: number;
  total_recognitions: number;
};
type PresenceRow = {
  person: PersonWithDepartment;
  first_event: AttendanceEvent | null;
  last_event: AttendanceEvent | null;
  first_seen_at: string | null;
  last_seen_at: string | null;
  recognition_count: number;
  status: PresenceStatus;
};
type EmployeePresenceReportRow = {
  date: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  recognition_count: number;
  status: PresenceStatus;
};

export function AttendancePresenceView({
  persons,
  departments,
  filterPolicy,
}: {
  persons: PersonWithDepartment[];
  departments: Department[];
  filterPolicy: FilterPolicy;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { theme } = useTheme();
  const defaultRange = useMemo(() => getDefaultAttendanceRange(filterPolicy), [filterPolicy]);
  const attendanceBoundaries = useMemo(() => getAttendanceBoundaryValues(filterPolicy), [filterPolicy]);
  const [departmentId, setDepartmentId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PresenceStatusFilter>("all");
  const [personSearch, setPersonSearch] = useState("");
  const [workDate, setWorkDate] = useState(defaultRange.workDate);
  const [events, setEvents] = useState<AttendanceEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [page, setPage] = useState(1);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFromDate, setReportFromDate] = useState(defaultRange.reportFromDate);
  const [reportToDate, setReportToDate] = useState(defaultRange.reportToDate);
  const [reportDepartmentId, setReportDepartmentId] = useState("all");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportRows, setReportRows] = useState<PresenceReportRow[] | null>(null);
  const [selectedPresenceRow, setSelectedPresenceRow] = useState<PresenceRow | null>(null);
  const [employeeReportPerson, setEmployeeReportPerson] = useState<PersonWithDepartment | null>(null);
  const reportDialog = useDialogTransition(reportDialogOpen ? true : null);
  const presenceDialog = useDialogTransition(selectedPresenceRow);
  const employeeReportDialog = useDialogTransition(employeeReportPerson);
  const visiblePresenceRow = presenceDialog.value;
  const visibleEmployeeReportPerson = employeeReportDialog.value;
  const pageSize = 5;
  const normalizedReportRange = useMemo(
    () => normalizeAttendanceRange({ fromDate: reportFromDate, toDate: reportToDate }, filterPolicy, "from"),
    [filterPolicy, reportFromDate, reportToDate],
  );

  useEffect(() => {
    let mounted = true;

    async function loadEvents() {
      setEventsLoading(true);
      setEventsError("");
      try {
        const apiRange = buildAttendanceApiRange(filterPolicy, { fromDate: workDate, toDate: workDate });
        if (!apiRange) return;
        const response = await apiFetch<PageResult<AttendanceEvent>>(
          `/attendance/events?page=1&page_size=100&from_at=${encodeURIComponent(apiRange.fromAt)}&to_at=${encodeURIComponent(apiRange.toAt)}`,
          { withAuth: true },
        );
        if (!mounted) return;
        setEvents(response.items.filter((event) => event.is_valid));
      } catch (err) {
        if (!mounted) return;
        setEventsError(err instanceof ApiError ? getTranslatedBackendError(t, err, "attendance") : t("errors.system.requestFailed"));
      } finally {
        if (mounted) setEventsLoading(false);
      }
    }

    void loadEvents();
    return () => {
      mounted = false;
    };
  }, [filterPolicy, t, workDate]);

  const departmentScopeIds = useMemo(() => getDepartmentScopeIds(departmentId, departments), [departmentId, departments]);
  const reportDepartmentScopeIds = useMemo(() => getDepartmentScopeIds(reportDepartmentId, departments), [reportDepartmentId, departments]);
  const normalizedSearch = personSearch.trim().toLowerCase();

  const scopedPersons = persons.filter((person) => {
    const departmentMatches = !departmentScopeIds || (person.department_id ? departmentScopeIds.has(person.department_id) : false);
    const searchMatches = person.full_name.toLowerCase().includes(normalizedSearch);
    return departmentMatches && searchMatches;
  });

  const reportScopedPersons = persons.filter((person) => {
    const departmentMatches = !reportDepartmentScopeIds || (person.department_id ? reportDepartmentScopeIds.has(person.department_id) : false);
    const searchMatches = person.full_name.toLowerCase().includes(normalizedSearch);
    return departmentMatches && searchMatches;
  });

  const presenceRows: PresenceRow[] = scopedPersons
    .map((person) => {
      const personEvents = events
        .filter((event) => event.person_id === person.id && event.recognized_at.slice(0, 10) === workDate)
        .sort((a, b) => new Date(a.recognized_at).getTime() - new Date(b.recognized_at).getTime());
      const firstEvent = personEvents[0] ?? null;
      const lastEvent = personEvents.at(-1) ?? null;
      const lateThreshold = new Date(
        `${workDate}T${String(LATE_AFTER_HOUR).padStart(2, "0")}:${String(LATE_AFTER_MINUTE).padStart(2, "0")}:00Z`,
      );
      const status: PresenceStatus = !firstEvent
        ? "absent"
        : new Date(firstEvent.recognized_at).getTime() > lateThreshold.getTime()
          ? "late"
          : "present";

      return {
        person,
        first_event: firstEvent,
        last_event: lastEvent,
        first_seen_at: firstEvent?.recognized_at ?? null,
        last_seen_at: lastEvent?.recognized_at ?? null,
        recognition_count: personEvents.length,
        status,
      };
    })
    .filter((row) => statusFilter === "all" || row.status === statusFilter);

  const presentCount = presenceRows.filter((row) => row.status === "present" || row.status === "late").length;
  const lateCount = presenceRows.filter((row) => row.status === "late").length;
  const absentCount = presenceRows.filter((row) => row.status === "absent").length;
  const totalRecognitions = presenceRows.reduce((sum, row) => sum + row.recognition_count, 0);
  const totalPages = Math.max(1, Math.ceil(presenceRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = presenceRows.slice((safePage - 1) * pageSize, safePage * pageSize);
  const pageRangeStart = presenceRows.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const pageRangeEnd = presenceRows.length === 0 ? 0 : Math.min(safePage * pageSize, presenceRows.length);
  const paginationPages = getVisiblePageNumbers(safePage, totalPages);

  const summaryCards: Array<{ label: string; value: number; icon: LucideIcon; iconClassName: string; iconShellClassName: string }> = [
    {
      label: t("attendance.summary.present"),
      value: presentCount,
      icon: Users,
      iconClassName: "text-white",
      iconShellClassName: "bg-emerald-600 ring-1 ring-emerald-700/40 dark:bg-emerald-500 dark:ring-emerald-300/20",
    },
    {
      label: t("attendance.summary.late"),
      value: lateCount,
      icon: Clock,
      iconClassName: "text-white",
      iconShellClassName: "bg-orange-500 ring-1 ring-orange-700/35 dark:bg-orange-400 dark:ring-orange-200/20",
    },
    {
      label: t("attendance.summary.absent"),
      value: absentCount,
      icon: UserX,
      iconClassName: "text-white",
      iconShellClassName: "bg-rose-600 ring-1 ring-rose-800/35 dark:bg-rose-500 dark:ring-rose-200/20",
    },
    {
      label: t("attendance.summary.recognitions"),
      value: totalRecognitions,
      icon: Eye,
      iconClassName: "text-white",
      iconShellClassName: "bg-blue-600 ring-1 ring-blue-800/35 dark:bg-blue-500 dark:ring-blue-200/20",
    },
  ];

  async function handleGenerateReport() {
    if (!normalizedReportRange) return;
    setReportLoading(true);
    setReportError("");
    setReportRows(null);

    try {
      const apiRange = buildAttendanceApiRange(filterPolicy, normalizedReportRange);
      if (!apiRange) return;
      const response = await apiFetch<PageResult<AttendanceEvent>>(
        `/attendance/events?page=1&page_size=100&from_at=${encodeURIComponent(apiRange.fromAt)}&to_at=${encodeURIComponent(apiRange.toAt)}`,
        { withAuth: true },
      );
      setReportRows(buildPresenceReport(reportScopedPersons, response.items, apiRange.fromDate, apiRange.toDate));
    } catch (err) {
      setReportError(err instanceof ApiError ? getTranslatedBackendError(t, err, "attendance") : t("errors.system.requestFailed"));
      setReportRows(buildPresenceReport(reportScopedPersons, [], normalizedReportRange.fromDate, normalizedReportRange.toDate));
    } finally {
      setReportLoading(false);
    }
  }

  function handlePrintReport() {
    if (!reportRows) return;
    const selectedDepartment = departments.find((department) => department.id === reportDepartmentId);
    const departmentLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : t("attendance.filters.allDepartments");
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    const rowsHtml = reportRows
      .map(
        (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.person.full_name)}</td>
            <td>${escapeHtml(row.person.department_name || t("common.notAssigned"))}</td>
            <td>${row.present_days}</td>
            <td>${row.late_days}</td>
            <td>${row.absent_days}</td>
            <td>${row.total_recognitions}</td>
          </tr>
        `,
      )
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(t("attendance.report.printTitle"))}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            .meta { color: #475569; margin-bottom: 24px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 11px; color: #64748b; }
            td:nth-child(1), td:nth-child(n+4) { text-align: center; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(t("attendance.report.printTitle"))}</h1>
          <div class="meta">
            ${escapeHtml(t("attendance.report.printRange"))}: ${escapeHtml(reportFromDate)} - ${escapeHtml(reportToDate)}<br />
            ${escapeHtml(t("attendance.report.printDepartment"))}: ${escapeHtml(departmentLabel)}<br />
            ${escapeHtml(t("attendance.report.printHeadcount"))}: ${reportRows.length}
          </div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t("attendance.report.index"))}</th>
                <th>${escapeHtml(t("attendance.report.person"))}</th>
                <th>${escapeHtml(t("attendance.report.departmentColumn"))}</th>
                <th>${escapeHtml(t("attendance.report.presentDays"))}</th>
                <th>${escapeHtml(t("attendance.report.lateDays"))}</th>
                <th>${escapeHtml(t("attendance.report.absentDays"))}</th>
                <th>${escapeHtml(t("attendance.report.recognitions"))}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex justify-end">
        <Button className="ui-button-link ui-button-link-primary" onClick={() => setReportDialogOpen(true)}>
          <CalendarSearch className="h-4 w-4" />
          {t("attendance.filters.generateReport")}
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, iconClassName, iconShellClassName }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-xl shadow-sm ${iconShellClassName}`}>
                <Icon className={`h-5 w-5 ${iconClassName}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card
        className={
          theme === "dark"
            ? "relative z-20 border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
            : "relative z-20 border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl"
        }
      >
        <CardContent>
          <div className="grid items-center gap-3 xl:grid-cols-[minmax(220px,0.8fr)_190px_260px_170px]">
            <Input
              value={personSearch}
              onChange={(event) => {
                setPersonSearch(event.target.value);
                setPage(1);
              }}
              placeholder={t("attendance.filters.personSearchPlaceholder")}
            />
            <DatePicker
              value={workDate}
              minDate={attendanceBoundaries.minAttendanceDate}
              maxDate={attendanceBoundaries.maxAttendanceDate}
              onChange={(value) => {
                setWorkDate(normalizeAttendanceDate(value, filterPolicy));
                setPage(1);
              }}
            />
            <DepartmentTreeSelect departments={departments} value={departmentId} onChange={(value) => {
              setDepartmentId(value);
              setPage(1);
            }} />
            <StatusFilterSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
          </div>
          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {t("attendance.filters.retentionHint", { days: filterPolicy.retention_days })}
          </div>
        </CardContent>
      </Card>

      <Card className="relative z-10 list-table-corner-accent">
        <ListTableAccent />
        <CardHeader>
          <CardTitle>{t("attendance.table.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{t("attendance.table.loading")}</div>
          ) : null}
          {eventsError ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{eventsError}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-14 py-3">{t("attendance.table.index")}</th>
                  <th>{t("attendance.table.person")}</th>
                  <th className="w-44">{t("attendance.table.department")}</th>
                  <th className="w-40">{t("attendance.table.firstSeen")}</th>
                  <th className="w-40">{t("attendance.table.lastSeen")}</th>
                  <th className="w-32">{t("attendance.table.recognitionCount")}</th>
                  <th className="w-28">{t("attendance.table.status")}</th>
                  <th className="w-44 text-right">{t("attendance.table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={row.person.id} className="border-b border-slate-100">
                    <td className="py-3 font-mono text-xs text-slate-500">{(safePage - 1) * pageSize + index + 1}</td>
                    <td className="truncate pr-4 font-medium">{row.person.full_name}</td>
                    <td className="truncate pr-4">{row.person.department_name || t("common.notAssigned")}</td>
                    <td className="font-mono text-xs text-slate-500">{row.first_seen_at ? formatTimeLocalized(row.first_seen_at, locale) : t("attendance.table.na")}</td>
                    <td className="font-mono text-xs text-slate-500">{row.last_seen_at ? formatTimeLocalized(row.last_seen_at, locale) : t("attendance.table.na")}</td>
                    <td>{row.recognition_count}</td>
                    <td><PresenceStatusBadge status={row.status} /></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setEmployeeReportPerson(row.person)}>
                          <FileText className="h-4 w-4" />
                          {t("attendance.table.report")}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedPresenceRow(row)}>
                          <Eye className="h-4 w-4" />
                          {t("attendance.table.view")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!eventsLoading && !eventsError && pagedRows.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {t("attendance.table.empty")}
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>{t("attendance.table.pageSummary", { page: safePage, totalPages, records: presenceRows.length })} - {pageRangeStart}-{pageRangeEnd}</span>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage(1)}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {paginationPages.map((pageNumber) => (
                <Button
                  key={pageNumber}
                  variant={pageNumber === safePage ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === safePage ? "page" : undefined}
                >
                  {pageNumber}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage >= totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safePage >= totalPages}
                onClick={() => setPage(totalPages)}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportDialog.value ? (
        <DialogPortal>
          <div
            className={`fixed inset-0 z-[120] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm ${dialogOverlayClass(reportDialog.visible)}`}
            onMouseDown={() => setReportDialogOpen(false)}
          >
            <div
              className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] text-[var(--foreground)] shadow-[var(--shadow-md)] ${dialogPanelClass(reportDialog.visible)}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
                <div>
                  <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("attendance.report.title")}</h2>
                  <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--foreground-soft)]">{t("attendance.report.description")}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setReportDialogOpen(false)} aria-label={t("attendance.report.close")}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

            <div className="thin-scrollbar flex-1 space-y-6 overflow-y-auto bg-[var(--background-muted)] p-6">
              <section className="rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-5 shadow-[var(--shadow-sm)]">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-end">
                  <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
                    {t("attendance.report.fromDate")}
                    <DatePicker
                      value={reportFromDate}
                      minDate={attendanceBoundaries.minAttendanceDate}
                      maxDate={attendanceBoundaries.maxAttendanceDate}
                      onChange={(value) => {
                        const nextRange = normalizeAttendanceRange({ fromDate: value, toDate: reportToDate }, filterPolicy, "from");
                        if (!nextRange) return;
                        setReportFromDate(nextRange.fromDate);
                        setReportToDate(nextRange.toDate);
                      }}
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
                    {t("attendance.report.toDate")}
                    <DatePicker
                      value={reportToDate}
                      minDate={attendanceBoundaries.minAttendanceDate}
                      maxDate={attendanceBoundaries.maxAttendanceDate}
                      onChange={(value) => {
                        const nextRange = normalizeAttendanceRange({ fromDate: reportFromDate, toDate: value }, filterPolicy, "to");
                        if (!nextRange) return;
                        setReportFromDate(nextRange.fromDate);
                        setReportToDate(nextRange.toDate);
                      }}
                    />
                  </label>
                  <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
                    {t("attendance.report.department")}
                    <DepartmentTreeSelect departments={departments} value={reportDepartmentId} onChange={setReportDepartmentId} />
                  </label>
                  <Button
                    className="ui-button-link ui-button-link-primary w-full lg:w-auto"
                    onClick={() => void handleGenerateReport()}
                    disabled={reportLoading}
                  >
                    {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSearch className="h-4 w-4" />}
                    {reportLoading ? t("attendance.report.generating") : t("attendance.report.generate")}
                  </Button>
                </div>
              </section>

              {reportError ? (
                <div className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">{reportError}</div>
              ) : null}

              <section className="list-table-corner-accent overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-[var(--shadow-sm)]">
                <ListTableAccent />
                <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-medium text-[var(--foreground)]">{t("attendance.report.resultTitle")}</div>
                  <Button variant="outline" size="sm" onClick={handlePrintReport} disabled={!reportRows || reportRows.length === 0}>
                    <Printer className="h-4 w-4" />
                    {t("attendance.report.print")}
                  </Button>
                </div>
                <div className="overflow-x-auto px-5 pb-5 pt-2">
                  {reportRows && reportRows.length > 0 ? (
                    <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                      <thead className="text-xs uppercase text-[var(--foreground-soft)]">
                        <tr className="border-b border-[var(--border)]">
                          <th className="w-12 py-3">{t("attendance.report.index")}</th>
                          <th>{t("attendance.report.person")}</th>
                          <th className="w-40">{t("attendance.report.departmentColumn")}</th>
                          <th className="w-24">{t("attendance.report.presentDays")}</th>
                          <th className="w-24">{t("attendance.report.lateDays")}</th>
                          <th className="w-24">{t("attendance.report.absentDays")}</th>
                          <th className="w-28">{t("attendance.report.recognitions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportRows.map((row, index) => (
                          <tr key={row.person.id} className="border-b border-[var(--border)]/60">
                            <td className="py-3 font-mono text-xs text-[var(--foreground-muted)]">{index + 1}</td>
                            <td className="truncate pr-4 font-medium text-[var(--foreground)]">{row.person.full_name}</td>
                            <td className="truncate pr-4 text-[var(--foreground-soft)]">{row.person.department_name || t("common.notAssigned")}</td>
                            <td>{row.present_days}</td>
                            <td>{row.late_days}</td>
                            <td>{row.absent_days}</td>
                            <td>{row.total_recognitions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--foreground-soft)]">
                      {t("attendance.report.empty")}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="flex justify-end border-t border-[var(--border)] bg-[var(--background-elevated)] px-6 py-4">
              <Button variant="outline" onClick={() => setReportDialogOpen(false)}>
                {t("attendance.report.cancel")}
              </Button>
            </div>
            </div>
          </div>
        </DialogPortal>
      ) : null}

      {visiblePresenceRow ? (
        <PresenceDetailDialog row={visiblePresenceRow} workDate={workDate} visible={presenceDialog.visible} onClose={() => setSelectedPresenceRow(null)} />
      ) : null}
      {visibleEmployeeReportPerson ? (
        <EmployeeAttendanceReportDialog
          key={visibleEmployeeReportPerson.id}
          person={visibleEmployeeReportPerson}
          filterPolicy={filterPolicy}
          visible={employeeReportDialog.visible}
          defaultFromDate={defaultRange.reportFromDate}
          defaultToDate={defaultRange.reportToDate}
          onClose={() => setEmployeeReportPerson(null)}
        />
      ) : null}
    </div>
  );
}

function EmployeeAttendanceReportDialog({
  person,
  filterPolicy,
  visible,
  defaultFromDate,
  defaultToDate,
  onClose,
}: {
  person: PersonWithDepartment;
  filterPolicy: FilterPolicy;
  visible: boolean;
  defaultFromDate: string;
  defaultToDate: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const attendanceBoundaries = useMemo(() => getAttendanceBoundaryValues(filterPolicy), [filterPolicy]);
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<EmployeePresenceReportRow[] | null>(null);
  const normalizedRange = useMemo(
    () => normalizeAttendanceRange({ fromDate, toDate }, filterPolicy, "from"),
    [filterPolicy, fromDate, toDate],
  );

  async function handleGenerate() {
    if (!normalizedRange) return;
    setLoading(true);
    setError("");
    setRows(null);

    try {
      const apiRange = buildAttendanceApiRange(filterPolicy, normalizedRange);
      if (!apiRange) return;
      const events = await fetchAllPersonAttendanceEvents(person.id, apiRange.fromAt, apiRange.toAt);
      setRows(buildEmployeePresenceReport(events, apiRange.fromDate, apiRange.toDate));
    } catch (err) {
      setError(err instanceof ApiError ? getTranslatedBackendError(t, err, "attendance") : t("errors.system.requestFailed"));
      setRows(buildEmployeePresenceReport([], normalizedRange.fromDate, normalizedRange.toDate));
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    if (!rows || rows.length === 0) return;
    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    const rowsHtml = rows
      .map(
        (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(formatDateLocalized(row.date, locale))}</td>
            <td>${escapeHtml(t(`attendance.status.${row.status}`))}</td>
            <td>${escapeHtml(row.first_seen_at ? formatTimeLocalized(row.first_seen_at, locale) : t("attendance.table.na"))}</td>
            <td>${escapeHtml(row.last_seen_at ? formatTimeLocalized(row.last_seen_at, locale) : t("attendance.table.na"))}</td>
            <td>${row.recognition_count}</td>
          </tr>
        `,
      )
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${escapeHtml(t("attendance.employeeReport.printTitle"))}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #0f172a; margin: 32px; }
            h1 { margin: 0 0 8px; font-size: 24px; }
            .meta { color: #475569; margin-bottom: 24px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
            th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
            th { background: #f8fafc; text-transform: uppercase; font-size: 11px; color: #64748b; }
            td:nth-child(1), td:nth-child(6) { text-align: center; }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(t("attendance.employeeReport.printTitle"))}</h1>
          <div class="meta">
            ${escapeHtml(t("attendance.employeeReport.employee"))}: ${escapeHtml(person.full_name)}<br />
            ${escapeHtml(t("attendance.employeeReport.employeeCode"))}: ${escapeHtml(person.employee_code)}<br />
            ${escapeHtml(t("attendance.employeeReport.department"))}: ${escapeHtml(person.department_name || t("common.notAssigned"))}<br />
            ${escapeHtml(t("attendance.employeeReport.printRange"))}: ${escapeHtml(fromDate)} - ${escapeHtml(toDate)}
          </div>
          <table>
            <thead>
              <tr>
                <th>${escapeHtml(t("attendance.employeeReport.index"))}</th>
                <th>${escapeHtml(t("attendance.employeeReport.date"))}</th>
                <th>${escapeHtml(t("attendance.employeeReport.status"))}</th>
                <th>${escapeHtml(t("attendance.employeeReport.firstSeen"))}</th>
                <th>${escapeHtml(t("attendance.employeeReport.lastSeen"))}</th>
                <th>${escapeHtml(t("attendance.employeeReport.recognitionCount"))}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  return (
    <DialogPortal>
      <div className={`fixed inset-0 z-[120] grid place-items-center bg-[var(--overlay)] p-4 backdrop-blur-sm ${dialogOverlayClass(visible)}`} onMouseDown={onClose}>
        <div
          className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] text-[var(--foreground)] shadow-[var(--shadow-md)] ${dialogPanelClass(visible)}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">{t("attendance.employeeReport.title")}</h2>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[var(--foreground-soft)]">{t("attendance.employeeReport.description")}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("attendance.employeeReport.close")}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="thin-scrollbar flex-1 space-y-6 overflow-y-auto bg-[var(--background-muted)] p-6">
          <section className="rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-5 shadow-[var(--shadow-sm)]">
            <div className="grid gap-3 sm:grid-cols-3">
              <DetailItem label={t("attendance.employeeReport.employee")} value={person.full_name} tone="themed" />
              <DetailItem label={t("attendance.employeeReport.employeeCode")} value={person.employee_code} tone="themed" />
              <DetailItem label={t("attendance.employeeReport.department")} value={person.department_name || t("common.notAssigned")} tone="themed" />
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] p-5 shadow-[var(--shadow-sm)]">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
                {t("attendance.employeeReport.fromDate")}
                <DatePicker
                  value={fromDate}
                  minDate={attendanceBoundaries.minAttendanceDate}
                  maxDate={attendanceBoundaries.maxAttendanceDate}
                  onChange={(value) => {
                    const nextRange = normalizeAttendanceRange({ fromDate: value, toDate }, filterPolicy, "from");
                    if (!nextRange) return;
                    setFromDate(nextRange.fromDate);
                    setToDate(nextRange.toDate);
                  }}
                />
              </label>
              <label className="space-y-2 text-sm font-medium text-[var(--foreground)]">
                {t("attendance.employeeReport.toDate")}
                <DatePicker
                  value={toDate}
                  minDate={attendanceBoundaries.minAttendanceDate}
                  maxDate={attendanceBoundaries.maxAttendanceDate}
                  onChange={(value) => {
                    const nextRange = normalizeAttendanceRange({ fromDate, toDate: value }, filterPolicy, "to");
                    if (!nextRange) return;
                    setFromDate(nextRange.fromDate);
                    setToDate(nextRange.toDate);
                  }}
                />
              </label>
              <Button className="ui-button-link ui-button-link-primary w-full lg:w-auto" onClick={() => void handleGenerate()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSearch className="h-4 w-4" />}
                {loading ? t("attendance.employeeReport.generating") : t("attendance.employeeReport.generate")}
              </Button>
            </div>
          </section>

          {error ? (
            <div className="rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">{error}</div>
          ) : null}

          <section className="list-table-corner-accent overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background-elevated)] shadow-[var(--shadow-sm)]">
            <ListTableAccent />
            <div className="flex flex-col gap-3 border-b border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="font-medium text-[var(--foreground)]">{t("attendance.employeeReport.resultTitle")}</div>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={!rows || rows.length === 0}>
                <Printer className="h-4 w-4" />
                {t("attendance.employeeReport.print")}
              </Button>
            </div>
            <div className="overflow-x-auto px-5 pb-5 pt-2">
              {rows && rows.length > 0 ? (
                <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                  <thead className="text-xs uppercase text-[var(--foreground-soft)]">
                    <tr className="border-b border-[var(--border)]">
                      <th className="w-12 py-3">{t("attendance.employeeReport.index")}</th>
                      <th className="w-32">{t("attendance.employeeReport.date")}</th>
                      <th className="w-28">{t("attendance.employeeReport.status")}</th>
                      <th>{t("attendance.employeeReport.firstSeen")}</th>
                      <th>{t("attendance.employeeReport.lastSeen")}</th>
                      <th className="w-28">{t("attendance.employeeReport.recognitionCount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.date} className="border-b border-[var(--border)]/60">
                        <td className="py-3 font-mono text-xs text-[var(--foreground-muted)]">{index + 1}</td>
                        <td className="font-medium text-[var(--foreground)]">{formatDateLocalized(row.date, locale)}</td>
                        <td><PresenceStatusBadge status={row.status} /></td>
                        <td className="font-mono text-xs text-[var(--foreground-soft)]">{row.first_seen_at ? formatTimeLocalized(row.first_seen_at, locale) : t("attendance.table.na")}</td>
                        <td className="font-mono text-xs text-[var(--foreground-soft)]">{row.last_seen_at ? formatTimeLocalized(row.last_seen_at, locale) : t("attendance.table.na")}</td>
                        <td>{row.recognition_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="rounded-lg border border-dashed border-[var(--border-strong)] px-6 py-10 text-center text-sm text-[var(--foreground-soft)]">
                  {t("attendance.employeeReport.empty")}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex justify-end border-t border-[var(--border)] bg-[var(--background-elevated)] px-6 py-4">
          <Button variant="outline" onClick={onClose}>
            {t("attendance.employeeReport.cancel")}
          </Button>
        </div>
        </div>
      </div>
    </DialogPortal>
  );
}

function PresenceDetailDialog({
  row,
  workDate,
  visible,
  onClose,
}: {
  row: PresenceRow;
  workDate: string;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const person = row.person;
  const threshold = `${String(LATE_AFTER_HOUR).padStart(2, "0")}:${String(LATE_AFTER_MINUTE).padStart(2, "0")}`;

  return (
    <DialogPortal>
      <div className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(visible)}`} onMouseDown={onClose}>
        <div
          className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(visible)}`}
          onMouseDown={(event) => event.stopPropagation()}
        >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">{t("attendance.dialog.heading")}</h2>
              <PresenceStatusBadge status={row.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">{t("attendance.dialog.description", { date: formatDateLocalized(workDate, locale) })}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("attendance.dialog.closeDetails")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="thin-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          <section className="grid gap-4 md:grid-cols-2">
            <SnapshotPanel title={t("attendance.dialog.firstSnapshot")} event={row.first_event} />
            <SnapshotPanel title={t("attendance.dialog.lastSnapshot")} event={row.last_event} />
          </section>

          <div className="space-y-4">
            <div>
              <div className="font-semibold text-slate-950">{person.full_name}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">{person.employee_code}</div>
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <DetailItem label={t("attendance.dialog.department")} value={person.department_name || t("common.notAssigned")} />
              <DetailItem label={t("attendance.dialog.position")} value={person.title || t("common.unknown")} />
              <DetailItem label={t("attendance.dialog.email")} value={person.email || t("common.unknown")} />
              <DetailItem label={t("attendance.dialog.phone")} value={person.phone || t("common.unknown")} />
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <DetailItem label={t("attendance.dialog.firstSeen")} value={row.first_seen_at ? formatTimeLocalized(row.first_seen_at, locale) : t("attendance.table.na")} />
              <DetailItem label={t("attendance.dialog.lastSeen")} value={row.last_seen_at ? formatTimeLocalized(row.last_seen_at, locale) : t("attendance.table.na")} />
              <DetailItem label={t("attendance.dialog.recognitionCount")} value={String(row.recognition_count)} />
            </section>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              {t("attendance.dialog.statusHint", { time: threshold })}
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 p-5">
          <Button onClick={onClose}>{t("attendance.dialog.close")}</Button>
        </div>
        </div>
      </div>
    </DialogPortal>
  );
}

function SnapshotPanel({
  title,
  event,
}: {
  title: string;
  event: AttendanceEvent | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const assetId = event?.snapshot_media_asset_id ?? null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const token = getAccessToken();
    if (!assetId || !token) return;

    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(`/api/v1/media-assets/${assetId}/content`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        setPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(blob);
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : t("attendance.dialog.imageLoadFailed"));
      }
    }

    void load();
    return () => controller.abort();
  }, [assetId, t]);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 font-medium text-slate-950">
          <ImageIcon className="h-4 w-4 text-slate-500" />
          {title}
        </div>
        <span className="font-mono text-xs text-slate-500">{event ? formatTimeLocalized(event.recognized_at, locale) : t("attendance.table.na")}</span>
      </div>

      {assetId && !previewUrl && !error ? (
        <div className="grid aspect-video place-items-center p-6 text-center text-sm text-slate-500">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("attendance.dialog.loadingImage")}
          </div>
        </div>
      ) : previewUrl ? (
        <div className="relative aspect-video bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt={title} className="h-full w-full object-cover" />
        </div>
      ) : (
        <div className="grid aspect-video place-items-center p-6 text-center text-sm text-slate-500">
          {error ?? (assetId ? t("attendance.dialog.imageLoadFailed") : t("attendance.dialog.noSnapshot"))}
        </div>
      )}
    </div>
  );
}

function PresenceStatusBadge({ status }: { status: PresenceStatus }) {
  const t = useTranslations("attendance.status");
  if (status === "present") return <Badge variant="success">{t("present")}</Badge>;
  if (status === "late") return <Badge variant="warning">{t("late")}</Badge>;
  return <Badge variant="default">{t("absent")}</Badge>;
}

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: PresenceStatusFilter;
  onChange: (value: PresenceStatusFilter) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options: Array<{ value: PresenceStatusFilter; label: string }> = [
    { value: "all", label: t("attendance.filters.allStatuses") },
    { value: "present", label: t("attendance.status.present") },
    { value: "late", label: t("attendance.status.late") },
    { value: "absent", label: t("attendance.status.absent") },
  ];
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useOutsideClick(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ui-filter-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption.value === "all" ? <span className="ui-filter-value">{selectedOption.label}</span> : <PresenceStatusBadge status={selectedOption.value} />}
        </span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
      </button>

      {open ? (
        <div className="ui-filter-panel absolute left-0 top-12 z-30 w-full p-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={value === option.value ? "ui-filter-option ui-filter-option-active" : "ui-filter-option"}
            >
              {option.value === "all" ? <span className="ui-filter-value">{t("attendance.filters.allStatuses")}</span> : <PresenceStatusBadge status={option.value} />}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailItem({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "themed" }) {
  if (tone === "themed") {
    return (
      <div className="rounded-md border border-[var(--border)] bg-[var(--background-elevated)] p-3">
        <div className="text-xs text-[var(--foreground-soft)]">{label}</div>
        <div className="mt-1 truncate text-sm font-medium text-[var(--foreground)]">{value}</div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-slate-950">{value}</div>
    </div>
  );
}

function buildPresenceReport(
  persons: PersonWithDepartment[],
  events: AttendanceEvent[],
  fromDate: string,
  toDate: string,
): PresenceReportRow[] {
  const reportDates = getDateRange(fromDate, toDate);

  return persons.map((person) => {
    const dailyStatuses = reportDates.map((date) => {
      const personEvents = events
        .filter((event) => event.person_id === person.id && event.recognized_at.slice(0, 10) === date)
        .sort((a, b) => new Date(a.recognized_at).getTime() - new Date(b.recognized_at).getTime());

      if (personEvents.length === 0) {
        return { status: "absent" as PresenceStatus, recognition_count: 0 };
      }

      const lateThreshold = new Date(
        `${date}T${String(LATE_AFTER_HOUR).padStart(2, "0")}:${String(LATE_AFTER_MINUTE).padStart(2, "0")}:00Z`,
      );
      const status = new Date(personEvents[0].recognized_at).getTime() > lateThreshold.getTime() ? "late" : "present";

      return { status: status as PresenceStatus, recognition_count: personEvents.length };
    });

    return {
      person,
      present_days: dailyStatuses.filter((day) => day.status === "present" || day.status === "late").length,
      late_days: dailyStatuses.filter((day) => day.status === "late").length,
      absent_days: dailyStatuses.filter((day) => day.status === "absent").length,
      total_recognitions: dailyStatuses.reduce((sum, day) => sum + day.recognition_count, 0),
    };
  });
}

function buildEmployeePresenceReport(events: AttendanceEvent[], fromDate: string, toDate: string): EmployeePresenceReportRow[] {
  return getDateRange(fromDate, toDate).map((date) => {
    const personEvents = events
      .filter((event) => event.recognized_at.slice(0, 10) === date)
      .sort((a, b) => new Date(a.recognized_at).getTime() - new Date(b.recognized_at).getTime());

    if (personEvents.length === 0) {
      return {
        date,
        first_seen_at: null,
        last_seen_at: null,
        recognition_count: 0,
        status: "absent",
      };
    }

    const firstEvent = personEvents[0];
    const lastEvent = personEvents.at(-1) ?? null;
    const lateThreshold = new Date(
      `${date}T${String(LATE_AFTER_HOUR).padStart(2, "0")}:${String(LATE_AFTER_MINUTE).padStart(2, "0")}:00Z`,
    );

    return {
      date,
      first_seen_at: firstEvent.recognized_at,
      last_seen_at: lastEvent?.recognized_at ?? null,
      recognition_count: personEvents.length,
      status: new Date(firstEvent.recognized_at).getTime() > lateThreshold.getTime() ? "late" : "present",
    };
  });
}

async function fetchAllPersonAttendanceEvents(personId: string, fromAt: string, toAt: string) {
  const pageSize = 100;
  let page = 1;
  let total = 0;
  let fetchedCount = 0;
  const items: AttendanceEvent[] = [];

  do {
    const response = await apiFetch<PageResult<AttendanceEvent>>(
      `/attendance/persons/${personId}/history?page=${page}&page_size=${pageSize}&from_at=${encodeURIComponent(fromAt)}&to_at=${encodeURIComponent(toAt)}`,
      { withAuth: true },
    );
    items.push(...response.items.filter((event) => event.is_valid));
    total = response.total;
    fetchedCount += response.items.length;
    page += 1;
  } while (fetchedCount < total);

  return items;
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5;
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  let startPage = currentPage - Math.floor(maxVisiblePages / 2);
  let endPage = currentPage + Math.floor(maxVisiblePages / 2);

  if (startPage < 1) {
    startPage = 1;
    endPage = maxVisiblePages;
  } else if (endPage > totalPages) {
    endPage = totalPages;
    startPage = totalPages - maxVisiblePages + 1;
  }

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}

function getDateRange(fromDate: string, toDate: string) {
  const dates: string[] = [];
  const cursor = new Date(`${fromDate}T00:00:00Z`);
  const end = new Date(`${toDate}T00:00:00Z`);

  while (cursor.getTime() <= end.getTime()) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function getDepartmentScopeIds(departmentId: string, departments: Department[]) {
  if (departmentId === "all") return null;

  const ids = new Set<string>([departmentId]);
  const visit = (parentId: string) => {
    for (const child of departments.filter((department) => department.parent_id === parentId)) {
      ids.add(child.id);
      visit(child.id);
    }
  };

  visit(departmentId);
  return ids;
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function DatePicker({
  value,
  onChange,
  minDate,
  maxDate,
}: {
  value: string;
  onChange: (value: string) => void;
  minDate?: string;
  maxDate?: string;
}) {
  const t = useTranslations("attendance.filters");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));
  const selectedDate = parseDate(value);
  const days = calendarDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  useOutsideClick(containerRef, open, () => setOpen(false));

  function shiftMonth(offset: number) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ui-filter-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarSearch className="ui-filter-search-icon shrink-0" />
          <span className="ui-filter-value">{formatDateLocalized(value, locale)}</span>
        </span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
      </button>

      {open ? (
        <div className="ui-filter-panel absolute left-0 top-12 z-30 w-80">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={t("previousMonth")}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold capitalize text-slate-950">{monthLabel}</div>
            <button type="button" onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={t("nextMonth")}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase text-slate-400">
              {weekdayKeys.map((day) => <div key={day}>{t(`weekdays.${day}`)}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dateValue = toDateValue(day);
                const inMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();
                const selected = sameDay(day, selectedDate);
                const disabled = (minDate && dateValue < minDate) || (maxDate && dateValue > maxDate);

                return (
                  <button
                    key={dateValue}
                    type="button"
                    disabled={Boolean(disabled)}
                    onClick={() => {
                      onChange(dateValue);
                      setOpen(false);
                    }}
                    className={
                      disabled
                        ? "grid h-9 place-items-center rounded-md text-sm text-slate-300"
                        : selected
                          ? "grid h-9 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white"
                          : inMonth
                            ? "grid h-9 place-items-center rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                            : "grid h-9 place-items-center rounded-md text-sm text-slate-300 hover:bg-slate-50"
                    }
                  >
                    {day.getUTCDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function monthStart(value: string) {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function calendarDays(month: Date) {
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const cursor = new Date(firstDay);
  cursor.setUTCDate(firstDay.getUTCDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(cursor);
    day.setUTCDate(cursor.getUTCDate() + index);
    return day;
  });
}

function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sameDay(a: Date, b: Date) {
  return toDateValue(a) === toDateValue(b);
}

function formatDateLocalized(value: string, locale: string) {
  return parseDate(value).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatTimeLocalized(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function DepartmentTreeSelect({
  departments,
  value,
  onChange,
}: {
  departments: Department[];
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("attendance.filters");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : t("allDepartments");
  const normalizedQuery = query.trim().toLowerCase();

  useOutsideClick(containerRef, open, () => setOpen(false));

  function toggleDepartment(departmentId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ui-filter-trigger"
      >
        <span className="ui-filter-value">{selectedLabel}</span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
      </button>

      {open ? (
        <div className="ui-filter-panel absolute left-0 top-12 z-30 w-[360px]">
          <div className="border-b border-[var(--border)] p-2">
            <div className="ui-filter-search-shell">
              <Search className="ui-filter-search-icon" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("departmentSearchPlaceholder")}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm focus:border-transparent focus:ring-0"
              />
            </div>
          </div>

          <div className="thin-scrollbar max-h-80 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className={value === "all" ? "ui-filter-option ui-filter-option-active" : "ui-filter-option"}
            >
              <Building2 className="h-4 w-4" />
              {t("allDepartments")}
            </button>

            <div className="mt-1 space-y-1">
              {departments
                .filter((department) => department.parent_id === null)
                .map((department) => (
                  <DepartmentTreeOption
                    key={department.id}
                    department={department}
                    departments={departments}
                    selectedId={value}
                    depth={0}
                    expandedIds={expandedIds}
                    query={normalizedQuery}
                    onToggle={toggleDepartment}
                    onSelect={(departmentId) => {
                      onChange(departmentId);
                      setOpen(false);
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DepartmentTreeOption({
  department,
  departments,
  selectedId,
  depth,
  expandedIds,
  query,
  onToggle,
  onSelect,
}: {
  department: Department;
  departments: Department[];
  selectedId: string;
  depth: number;
  expandedIds: Set<string>;
  query: string;
  onToggle: (departmentId: string) => void;
  onSelect: (departmentId: string) => void;
}) {
  const children = departments.filter((item) => item.parent_id === department.id);
  const expanded = expandedIds.has(department.id);
  const hasChildren = children.length > 0;
  const matchesQuery =
    query.length === 0 ||
    department.name.toLowerCase().includes(query) ||
    department.code.toLowerCase().includes(query) ||
    children.some((child) => child.name.toLowerCase().includes(query) || child.code.toLowerCase().includes(query));

  if (!matchesQuery) return null;

  return (
    <div>
      <div
        className={
          selectedId === department.id
            ? "flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background-muted)] px-2 py-2.5 text-sm font-medium text-[var(--foreground)]"
            : "flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm text-[var(--foreground)] hover:bg-[var(--background-panel)]"
        }
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <button
          type="button"
          disabled={!hasChildren}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(department.id);
          }}
          className="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label={expanded ? `Collapse ${department.name}` : `Expand ${department.name}`}
        >
          <ChevronRight className={expanded ? "h-4 w-4 rotate-90 transition-transform" : "h-4 w-4 transition-transform"} />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(department.id)}>
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{department.code} · {department.name}</span>
        </button>
      </div>
      {expanded || query.length > 0
        ? children.map((child) => (
            <DepartmentTreeOption
              key={child.id}
              department={child}
              departments={departments}
              selectedId={selectedId}
              depth={depth + 1}
              expandedIds={expandedIds}
              query={query}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}
