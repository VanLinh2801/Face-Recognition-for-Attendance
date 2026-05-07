"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  ImageUp,
  Save,
  Search,
  UploadCloud,
  UserPlus,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import { validatePersonProfileFields } from "@/lib/person-validation";
import type { Department, Person } from "@/lib/types";
import { useOutsideClick } from "@/lib/use-outside-click";

const DEFAULT_JOINED_AT = "2026-05-06";
type PersonStatusValue = Person["status"];
type DepartmentListResponse = {
  items: Department[];
};
type CreatePersonResponse = {
  id: string;
};

export default function NewPersonPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinedAt, setJoinedAt] = useState(DEFAULT_JOINED_AT);
  const [status, setStatus] = useState<PersonStatusValue>("active");
  const [notes, setNotes] = useState("");
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [employeeCodeError, setEmployeeCodeError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    let isMounted = true;
    async function loadDepartments() {
      setLoadingDepartments(true);
      try {
        const data = await apiFetch<DepartmentListResponse>("/departments?is_active=true", { withAuth: true });
        if (!isMounted) return;
        setDepartments(data.items.filter((department) => department.is_active));
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof ApiError ? err.message : "Không tải được danh sách phòng ban.";
        setError(message);
      } finally {
        if (isMounted) setLoadingDepartments(false);
      }
    }
    void loadDepartments();
    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEmployeeCodeError("");
    setEmailError("");
    setPhoneError("");
    setSuccess("");

    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    const validationError = validatePersonProfileFields({ email, phone, joinedAt });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmployeeCode = employeeCode.trim();
      const payload = {
        employee_code: normalizedEmployeeCode,
        full_name: fullName.trim(),
        department_id: departmentId || null,
        title: title.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        joined_at: joinedAt || null,
        notes: notes.trim() || null,
      };
      const created = await apiFetch<CreatePersonResponse>("/persons", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify(payload),
      });
      setSuccess("Tạo nhân sự thành công.");
      router.push(`/persons/${created.id}`);
    } catch (err) {
      const duplicateField = getDuplicatePersonField(err);
      if (duplicateField === "employee_code") {
        setEmployeeCodeError("Mã nhân viên đã tồn tại. Vui lòng nhập mã khác.");
        setError("Mã nhân viên đã tồn tại. Vui lòng kiểm tra lại.");
      } else if (duplicateField === "email") {
        setEmailError("Email đã được sử dụng bởi nhân viên khác.");
        setError("Email đã tồn tại. Vui lòng kiểm tra lại.");
      } else if (duplicateField === "phone") {
        setPhoneError("Số điện thoại đã được sử dụng bởi nhân viên khác.");
        setError("Số điện thoại đã tồn tại. Vui lòng kiểm tra lại.");
      } else {
        setError(err instanceof ApiError ? err.message : "Không thể tạo nhân sự.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Thêm nhân sự" description="" />

      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link
          href="/persons"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>

        <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <UserPlus className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle>Thông tin nhân sự</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã nhân viên</span>
                  <Input
                    value={employeeCode}
                    onChange={(event) => {
                      setEmployeeCode(event.target.value);
                      setEmployeeCodeError("");
                    }}
                    placeholder="EMP006"
                    required
                    aria-invalid={employeeCodeError ? true : undefined}
                    className={employeeCodeError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {employeeCodeError ? <div className="text-xs font-medium text-red-700">{employeeCodeError}</div> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Họ tên</span>
                  <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyen Van F" required />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Phòng ban</span>
                  <DepartmentTreeSelect departments={departments} value={departmentId} onChange={setDepartmentId} />
                  {loadingDepartments ? <div className="text-xs text-slate-500">Đang tải phòng ban...</div> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Chức danh</span>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Engineer" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <Input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError("");
                    }}
                    type="email"
                    placeholder="employee@example.com"
                    aria-invalid={emailError ? true : undefined}
                    className={emailError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {emailError ? <div className="text-xs font-medium text-red-700">{emailError}</div> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Điện thoại</span>
                  <Input
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setPhoneError("");
                    }}
                    placeholder="0900000000"
                    aria-invalid={phoneError ? true : undefined}
                    className={phoneError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {phoneError ? <div className="text-xs font-medium text-red-700">{phoneError}</div> : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ngày vào làm</span>
                  <DatePicker value={joinedAt} onChange={setJoinedAt} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <StatusSelect value={status} onChange={setStatus} />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú hồ sơ</span>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ghi chú nội bộ cho hồ sơ nhân sự" />
              </label>
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
                  <span className="text-sm font-medium">Object key</span>
                  <Input defaultValue="registrations/raw/EMP006.jpg" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú đăng ký khuôn mặt</span>
                <Textarea defaultValue="register from admin panel" />
              </label>
            </CardContent>
          </Card>
        </div>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting || loadingDepartments}>
            <Save className="h-4 w-4" />
            {submitting ? "Đang lưu..." : "Lưu nhân sự + đăng ký khuôn mặt"}
          </Button>
          <Link
            href="/persons"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Hủy
          </Link>
        </div>
        </form>
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));
  const selectedDate = parseDate(value);
  const days = calendarDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" });

  useOutsideClick(containerRef, open, () => setOpen(false));

  function shiftMonth(offset: number) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }

  return (
    <div ref={containerRef} className="relative">
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : "Chưa chọn phòng ban";
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

function StatusSelect({
  value,
  onChange,
}: {
  value: PersonStatusValue;
  onChange: (value: PersonStatusValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options: PersonStatusValue[] = ["active", "inactive", "resigned"];

  useOutsideClick(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PersonStatusBadge status={value} />
        </span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={value === option ? "flex w-full items-center rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <PersonStatusBadge status={option} />
            </button>
          ))}
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

function getDuplicatePersonField(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const message = error.message.toLowerCase();
  const details = getErrorDetailsText(error.details).toLowerCase();

  if (error.code !== "validation_error") return null;
  if (
    message.includes("employee_code already exists") ||
    message.includes("employee code already exists") ||
    details.includes("employee_code")
  ) {
    return "employee_code";
  }
  if (message.includes("email already exists") || details.includes("email")) {
    return "email";
  }
  if (message.includes("phone already exists") || details.includes("phone")) {
    return "phone";
  }
  return null;
}

function getErrorDetailsText(details: unknown) {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
}
