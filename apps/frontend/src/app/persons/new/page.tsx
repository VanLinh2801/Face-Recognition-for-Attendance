"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CalendarSearch,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  ImageUp,
  Save,
  Search,
  UploadCloud,
  UserPlus,
} from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { listDepartments } from "@/lib/mock-repository";
import type { Department } from "@/lib/types";

const DEFAULT_JOINED_AT = "2026-05-06";

export default function NewPersonPage() {
  const departments = listDepartments().items.filter((department) => department.is_active);
  const [departmentId, setDepartmentId] = useState("");
  const [joinedAt, setJoinedAt] = useState(DEFAULT_JOINED_AT);
  const departmentPayloadValue = departmentId ? `"${departmentId}"` : "null";

  return (
    <div>
      <PageHeader
        title="Thêm nhân sự"
        description="Tạo hồ sơ person và gửi ảnh đăng ký khuôn mặt trong cùng một màn hình."
      />

      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link
          href="/persons"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <UserPlus className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle>Thông tin nhân sự</CardTitle>
                  <CardDescription>Dữ liệu ở phần này map vào bảng persons.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã nhân viên</span>
                  <Input placeholder="EMP006" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Họ tên</span>
                  <Input placeholder="Nguyen Van F" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Phòng ban</span>
                  <DepartmentTreeSelect departments={departments} value={departmentId} onChange={setDepartmentId} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Chức danh</span>
                  <Input placeholder="Engineer" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <Input type="email" placeholder="employee@example.com" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Điện thoại</span>
                  <Input placeholder="0900000000" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ngày vào làm</span>
                  <DatePicker value={joinedAt} onChange={setJoinedAt} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <Select defaultValue="active">
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="resigned">resigned</option>
                  </Select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú hồ sơ</span>
                <Textarea placeholder="Ghi chú nội bộ cho hồ sơ nhân sự" />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Save className="h-4 w-4 text-slate-500" />
                  Person payload preview
                </div>
                <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`{
  "employee_code": "EMP006",
  "full_name": "Nguyen Van F",
  "department_id": ${departmentPayloadValue},
  "title": "Engineer",
  "email": "employee@example.com",
  "phone": "0900000000",
  "joined_at": "${joinedAt}",
  "notes": null
}`}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <Fingerprint className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle>Ảnh đăng ký khuôn mặt</CardTitle>
                  <CardDescription>Ảnh ở phần này tạo media asset và face registration cho nhân sự mới.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="grid min-h-[280px] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400 hover:bg-white">
                <input type="file" accept="image/png,image/jpeg" className="sr-only" />
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <ImageUp className="h-7 w-7 text-slate-500" />
                  </div>
                  <div className="mt-4 text-base font-semibold">Chọn hoặc kéo ảnh khuôn mặt</div>
                  <div className="mt-1 text-sm text-slate-500">JPG/PNG, nên dùng ảnh rõ mặt, một người, đủ sáng.</div>
                  <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                    <UploadCloud className="h-4 w-4" />
                    Chọn ảnh
                  </div>
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Tên file gốc</span>
                  <Input placeholder="employee-face.jpg" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">MIME type</span>
                  <Select defaultValue="image/jpeg">
                    <option value="image/jpeg">image/jpeg</option>
                    <option value="image/png">image/png</option>
                  </Select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Bucket</span>
                  <Input defaultValue="attendance" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Object key mock</span>
                  <Input defaultValue="registrations/raw/EMP006.jpg" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú đăng ký khuôn mặt</span>
                <Textarea defaultValue="register from admin panel" />
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["1", "Tạo person", "POST /api/v1/persons"],
                  ["2", "Upload ảnh", "MinIO/media asset"],
                  ["3", "Tạo registration", "POST /persons/{id}/registrations"],
                ].map(([step, title, description]) => (
                  <div key={step} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-xs font-semibold text-white">{step}</div>
                      <div className="text-sm font-medium">{title}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{description}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Fingerprint className="h-4 w-4 text-slate-500" />
                  Registration payload preview
                </div>
                <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`{
  "requested_by_person_id": "admin-person-id",
  "source_media_asset": {
    "storage_provider": "minio",
    "bucket_name": "attendance",
    "object_key": "registrations/raw/EMP006.jpg",
    "original_filename": "employee-face.jpg",
    "mime_type": "image/jpeg",
    "file_size": 123456,
    "checksum": null,
    "asset_type": "registration_face"
  },
  "notes": "register from admin panel"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>
                V1 là mock UI. Khi nối backend, submit sẽ tạo person trước, upload ảnh/media asset, rồi tạo registration cho person vừa tạo.
              </span>
            </div>
            <div className="flex gap-2">
              <Button>
                <Save className="h-4 w-4" />
                Lưu nhân sự + đăng ký khuôn mặt
              </Button>
              <Link
                href="/persons"
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Hủy
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
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
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : "Chưa chọn phòng ban";
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
                onChange("");
                setOpen(false);
              }}
              className={value === "" ? "flex w-full items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <Building2 className="h-4 w-4" />
              Chưa chọn phòng ban
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
