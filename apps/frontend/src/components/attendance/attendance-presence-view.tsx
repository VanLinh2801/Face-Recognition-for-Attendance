"use client";

import Image from "next/image";
import { Building2, CalendarSearch, ChevronLeft, ChevronRight, Clock, Eye, ImageIcon, Loader2, Printer, Search, Users, UserX, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AttendanceEvent, Department, MediaAsset, Person } from "@/lib/types";
import { formatTime } from "@/lib/utils";

const WORK_DATE = "2026-05-06";
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

export function AttendancePresenceView({
  events,
  persons,
  departments,
  mediaAssets,
}: {
  events: AttendanceEvent[];
  persons: PersonWithDepartment[];
  departments: Department[];
  mediaAssets: MediaAsset[];
}) {
  const [departmentId, setDepartmentId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PresenceStatusFilter>("all");
  const [personSearch, setPersonSearch] = useState("");
  const [workDate, setWorkDate] = useState(WORK_DATE);
  const [page, setPage] = useState(1);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [reportFromDate, setReportFromDate] = useState("2026-05-01");
  const [reportToDate, setReportToDate] = useState(WORK_DATE);
  const [reportDepartmentId, setReportDepartmentId] = useState("all");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportRows, setReportRows] = useState<PresenceReportRow[] | null>(null);
  const [selectedPresenceRow, setSelectedPresenceRow] = useState<PresenceRow | null>(null);
  const pageSize = 5;

  const departmentScopeIds = useMemo(() => getDepartmentScopeIds(departmentId, departments), [departmentId, departments]);
  const reportDepartmentScopeIds = useMemo(() => getDepartmentScopeIds(reportDepartmentId, departments), [reportDepartmentId, departments]);

  const scopedPersons = persons.filter((person) => {
    const departmentMatches = !departmentScopeIds || (person.department_id ? departmentScopeIds.has(person.department_id) : false);
    const searchMatches = person.full_name.toLowerCase().includes(personSearch.trim().toLowerCase());
    return departmentMatches && searchMatches;
  });

  const reportScopedPersons = persons.filter((person) => {
    const departmentMatches = !reportDepartmentScopeIds || (person.department_id ? reportDepartmentScopeIds.has(person.department_id) : false);
    const searchMatches = person.full_name.toLowerCase().includes(personSearch.trim().toLowerCase());
    return departmentMatches && searchMatches;
  });

  const presenceRows: PresenceRow[] = scopedPersons.map((person) => {
    const personEvents = events
      .filter((event) => event.person_id === person.id && event.recognized_at.slice(0, 10) === workDate)
      .sort((a, b) => new Date(a.recognized_at).getTime() - new Date(b.recognized_at).getTime());
    const firstEvent = personEvents[0] ?? null;
    const lastEvent = personEvents.at(-1) ?? null;
    const lateThreshold = new Date(`${workDate}T${String(LATE_AFTER_HOUR).padStart(2, "0")}:${String(LATE_AFTER_MINUTE).padStart(2, "0")}:00Z`);
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
  }).filter((row) => statusFilter === "all" || row.status === statusFilter);

  const presentCount = presenceRows.filter((row) => row.status === "present" || row.status === "late").length;
  const lateCount = presenceRows.filter((row) => row.status === "late").length;
  const absentCount = presenceRows.filter((row) => row.status === "absent").length;
  const totalRecognitions = presenceRows.reduce((sum, row) => sum + row.recognition_count, 0);
  const totalPages = Math.max(1, Math.ceil(presenceRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pagedRows = presenceRows.slice((safePage - 1) * pageSize, safePage * pageSize);

  const summaryCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Có mặt", value: presentCount, icon: Users },
    { label: "Đi muộn", value: lateCount, icon: Clock },
    { label: "Chưa ghi nhận", value: absentCount, icon: UserX },
    { label: "Lượt nhận diện", value: totalRecognitions, icon: Eye },
  ];

  function handleGenerateReport() {
    setReportLoading(true);
    setReportRows(null);

    window.setTimeout(() => {
      setReportRows(buildPresenceReport(reportScopedPersons, events, reportFromDate, reportToDate));
      setReportLoading(false);
    }, 450);
  }

  function handlePrintReport() {
    if (!reportRows) return;

    const selectedDepartment = departments.find((department) => department.id === reportDepartmentId);
    const departmentLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : "Tất cả phòng ban";
    const rowsHtml = reportRows
      .map(
        (row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td>${escapeHtml(row.person.full_name)}</td>
            <td>${escapeHtml(row.person.department_name)}</td>
            <td>${row.present_days}</td>
            <td>${row.late_days}</td>
            <td>${row.absent_days}</td>
            <td>${row.total_recognitions}</td>
          </tr>
        `,
      )
      .join("");

    const printWindow = window.open("", "_blank", "width=1100,height=800");
    if (!printWindow) return;

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Report chấm công</title>
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
          <h1>Report chấm công</h1>
          <div class="meta">
            Khoảng thời gian: ${escapeHtml(reportFromDate)} đến ${escapeHtml(reportToDate)}<br />
            Phòng ban: ${escapeHtml(departmentLabel)}<br />
            Số nhân viên: ${reportRows.length}
          </div>
          <table>
            <thead>
              <tr>
                <th>STT</th>
                <th>Nhân viên</th>
                <th>Phòng ban</th>
                <th>Đi làm</th>
                <th>Đi muộn</th>
                <th>Vắng mặt</th>
                <th>Nhận diện</th>
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
        <Button onClick={() => setReportDialogOpen(true)}>
          <CalendarSearch className="h-4 w-4" />
          Tạo report
        </Button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-md bg-slate-100">
                <Icon className="h-5 w-5 text-slate-600" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent>
          <div className="grid items-center gap-3 xl:grid-cols-[minmax(220px,0.8fr)_190px_260px_170px]">
            <Input
              value={personSearch}
              onChange={(event) => {
                setPersonSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Tìm theo tên nhân viên"
            />
            <DatePicker
              value={workDate}
              onChange={(value) => {
                setWorkDate(value);
                setPage(1);
              }}
            />
            <DepartmentTreeSelect
              departments={departments}
              value={departmentId}
              onChange={(value) => {
                setDepartmentId(value);
                setPage(1);
              }}
            />
            <StatusFilterSelect
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Daily presence</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-14 py-3">STT</th>
                  <th>Nhân viên</th>
                  <th className="w-44">Phòng ban</th>
                  <th className="w-40">First seen</th>
                  <th className="w-40">Last seen</th>
                  <th className="w-32">Số lần</th>
                  <th className="w-28">Trạng thái</th>
                  <th className="w-28 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, index) => (
                  <tr key={row.person.id} className="border-b border-slate-100">
                    <td className="py-3 font-mono text-xs text-slate-500">{(safePage - 1) * pageSize + index + 1}</td>
                    <td className="truncate pr-4 font-medium">{row.person.full_name}</td>
                    <td className="truncate pr-4">{row.person.department_name}</td>
                    <td className="font-mono text-xs text-slate-500">{row.first_seen_at ? formatTime(row.first_seen_at) : "N/A"}</td>
                    <td className="font-mono text-xs text-slate-500">{row.last_seen_at ? formatTime(row.last_seen_at) : "N/A"}</td>
                    <td>{row.recognition_count}</td>
                    <td><PresenceStatusBadge status={row.status} /></td>
                    <td className="text-right">
                      <Button variant="outline" size="sm" onClick={() => setSelectedPresenceRow(row)}>
                        <Eye className="h-4 w-4" />
                        Xem
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>
              Page {safePage}/{totalPages} · {presenceRows.length} records
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={safePage === totalPages}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                className="inline-flex h-8 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportDialogOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-5xl rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">Tạo report chấm công</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Thống kê theo tên nhân viên đang tìm kiếm và phòng ban được chọn trong report. Phòng ban con luôn được bao gồm.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReportDialogOpen(false)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Đóng report"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-3 md:grid-cols-[1fr_1fr_1.25fr_auto] md:items-end">
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  Ngày bắt đầu
                  <DatePicker value={reportFromDate} onChange={setReportFromDate} />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  Ngày kết thúc
                  <DatePicker value={reportToDate} onChange={setReportToDate} />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-slate-700">
                  Phòng ban
                  <DepartmentTreeSelect departments={departments} value={reportDepartmentId} onChange={setReportDepartmentId} />
                </label>
                <Button onClick={handleGenerateReport} disabled={reportLoading || reportFromDate > reportToDate}>
                  {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarSearch className="h-4 w-4" />}
                  Thống kê
                </Button>
              </div>

              {reportRows ? (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handlePrintReport}>
                    <Printer className="h-4 w-4" />
                    In report
                  </Button>
                </div>
              ) : null}

              {reportFromDate > reportToDate ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
                </div>
              ) : null}

              <div className="max-h-[58vh] overflow-y-auto rounded-md border border-slate-200">
                <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="w-14 px-4 py-3">STT</th>
                      <th>Nhân viên</th>
                      <th className="w-44">Phòng ban</th>
                      <th className="w-28">Đi làm</th>
                      <th className="w-28">Đi muộn</th>
                      <th className="w-28">Vắng mặt</th>
                      <th className="w-32">Nhận diện</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                          Đang query dữ liệu thống kê...
                        </td>
                      </tr>
                    ) : reportRows ? (
                      reportRows.map((row, index) => (
                        <tr key={row.person.id} className="border-b border-slate-100 last:border-0">
                          <td className="px-4 py-3 font-mono text-xs text-slate-500">{index + 1}</td>
                          <td className="truncate pr-4 font-medium">{row.person.full_name}</td>
                          <td className="truncate pr-4">{row.person.department_name}</td>
                          <td className="font-semibold text-emerald-700">{row.present_days}</td>
                          <td className="font-semibold text-amber-700">{row.late_days}</td>
                          <td className="font-semibold text-slate-700">{row.absent_days}</td>
                          <td>{row.total_recognitions}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-sm text-slate-500">
                          Chọn khoảng ngày rồi bấm Thống kê để xem kết quả.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {selectedPresenceRow ? (
        <PresenceDetailDialog row={selectedPresenceRow} workDate={workDate} mediaAssets={mediaAssets} onClose={() => setSelectedPresenceRow(null)} />
      ) : null}

    </div>
  );
}

function PresenceDetailDialog({
  row,
  workDate,
  mediaAssets,
  onClose,
}: {
  row: PresenceRow;
  workDate: string;
  mediaAssets: MediaAsset[];
  onClose: () => void;
}) {
  const person = row.person;
  const firstAsset = getEventSnapshotAsset(row.first_event, mediaAssets);
  const lastAsset = getEventSnapshotAsset(row.last_event, mediaAssets);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-950">Chi tiết chấm công</h2>
              <PresenceStatusBadge status={row.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500">Thông tin xuất hiện trong ngày {workDate}.</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Đóng chi tiết chấm công">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="thin-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
          <section className="grid gap-4 md:grid-cols-2">
            <SnapshotPanel title="Ảnh lần đầu xuất hiện" event={row.first_event} asset={firstAsset} />
            <SnapshotPanel title="Ảnh lần cuối xuất hiện" event={row.last_event} asset={lastAsset} />
          </section>

          <div className="space-y-4">
            <div>
              <div className="font-semibold text-slate-950">{person.full_name}</div>
              <div className="mt-1 font-mono text-xs text-slate-500">{person.employee_code}</div>
            </div>

            <section className="grid gap-3 sm:grid-cols-2">
              <DetailItem label="Phòng ban" value={person.department_name} />
              <DetailItem label="Chức danh" value={person.title} />
              <DetailItem label="Email" value={person.email} />
              <DetailItem label="Số điện thoại" value={person.phone} />
            </section>

            <section className="grid gap-3 sm:grid-cols-3">
              <DetailItem label="Lần đầu xuất hiện" value={row.first_seen_at ? formatTime(row.first_seen_at) : "N/A"} />
              <DetailItem label="Lần cuối xuất hiện" value={row.last_seen_at ? formatTime(row.last_seen_at) : "N/A"} />
              <DetailItem label="Số lần nhận diện" value={String(row.recognition_count)} />
            </section>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Trạng thái được tính theo lần đầu xuất hiện so với mốc {String(LATE_AFTER_HOUR).padStart(2, "0")}:{String(LATE_AFTER_MINUTE).padStart(2, "0")}.
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 p-5">
          <Button onClick={onClose}>Đóng</Button>
        </div>
      </div>
    </div>
  );
}

function SnapshotPanel({
  title,
  event,
  asset,
}: {
  title: string;
  event: AttendanceEvent | null;
  asset: MediaAsset | null;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2 font-medium text-slate-950">
          <ImageIcon className="h-4 w-4 text-slate-500" />
          {title}
        </div>
        <span className="font-mono text-xs text-slate-500">{event ? formatTime(event.recognized_at) : "N/A"}</span>
      </div>

      {asset ? (
        <div>
          <div className="relative aspect-video bg-slate-100">
            {asset.preview_url ? (
              <Image
                src={asset.preview_url}
                alt={`${title} - ${asset.original_filename}`}
                fill
                sizes="(min-width: 768px) 480px, 100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="grid h-full place-items-center p-6 text-center text-sm text-slate-500">
                Chưa có URL ảnh từ backend cho media asset này.
              </div>
            )}
          </div>
          <div className="space-y-1 border-t border-slate-200 p-3 text-xs">
            <div className="font-medium text-slate-900">{asset.original_filename}</div>
            <div className="font-mono text-slate-500">bucket: {asset.bucket_name}</div>
            <div className="truncate font-mono text-slate-500">object: {asset.object_key}</div>
            <div className="text-slate-500">{asset.mime_type} · {Math.round(asset.file_size / 1024)} KB</div>
          </div>
        </div>
      ) : (
        <div className="grid aspect-video place-items-center p-6 text-center text-sm text-slate-500">
          Chưa có snapshot media asset cho lần xuất hiện này.
        </div>
      )}
    </div>
  );
}

function getEventSnapshotAsset(event: AttendanceEvent | null, mediaAssets: MediaAsset[]) {
  if (!event?.snapshot_media_asset_id) return null;
  return mediaAssets.find((asset) => asset.id === event.snapshot_media_asset_id) ?? null;
}

function PresenceStatusBadge({ status }: { status: string }) {
  if (status === "present") return <Badge variant="success">present</Badge>;
  if (status === "late") return <Badge variant="warning">late</Badge>;
  return <Badge variant="default">absent</Badge>;
}

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: PresenceStatusFilter;
  onChange: (value: PresenceStatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: Array<{ value: PresenceStatusFilter; label: string }> = [
    { value: "all", label: "Tất cả" },
    { value: "present", label: "present" },
    { value: "late", label: "late" },
    { value: "absent", label: "absent" },
  ];
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption.value === "all" ? (
            <span className="truncate font-medium text-slate-700">{selectedOption.label}</span>
          ) : (
            <PresenceStatusBadge status={selectedOption.value} />
          )}
        </span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={value === option.value ? "flex w-full items-center rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              {option.value === "all" ? (
                <span>Tất cả trạng thái</span>
              ) : (
                <PresenceStatusBadge status={option.value} />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
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

      const lateThreshold = new Date(`${date}T${String(LATE_AFTER_HOUR).padStart(2, "0")}:${String(LATE_AFTER_MINUTE).padStart(2, "0")}:00Z`);
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
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));
  const selectedDate = parseDate(value);
  const days = calendarDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" });

  function shiftMonth(offset: number) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarSearch className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate font-medium text-slate-800">{formatDateLabel(value)}</span>
        </span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold capitalize text-slate-950">{monthLabel}</div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase text-slate-400">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dateValue = toDateValue(day);
                const inMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();
                const selected = sameDay(day, selectedDate);

                return (
                  <button
                    key={dateValue}
                    type="button"
                    onClick={() => {
                      onChange(dateValue);
                      setOpen(false);
                    }}
                    className={
                      selected
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

function formatDateLabel(value: string) {
  return parseDate(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : "Tất cả phòng ban";
  const normalizedQuery = query.trim().toLowerCase();

  function toggleDepartment(departmentId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm phòng ban"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
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
              className={value === "all" ? "flex w-full items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <Building2 className="h-4 w-4" />
              Tất cả phòng ban
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
        className={selectedId === department.id ? "flex items-center gap-2 rounded-md bg-slate-950 px-2 py-2 text-sm font-medium text-white" : "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50"}
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
          aria-label={expanded ? `Thu gọn ${department.name}` : `Mở rộng ${department.name}`}
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
