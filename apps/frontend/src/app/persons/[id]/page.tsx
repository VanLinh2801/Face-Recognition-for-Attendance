"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, Save, X } from "lucide-react";
import { PageHeader } from "@/components/data/page-header";
import { DirectionBadge, PersonStatusBadge } from "@/components/data/status-badge";
import { PersonFaceRegistrations } from "@/components/persons/person-face-registrations";
import { DatePicker, DepartmentTreeSelect, PersonStatusSelect, type EditablePersonStatus } from "@/components/persons/persons-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { validatePersonProfileFields } from "@/lib/person-validation";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import type { AttendanceEvent, Department, FaceRegistration, PageResult, Person } from "@/lib/types";
import { formatDateTime, percent } from "@/lib/utils";

type EditPersonForm = {
  full_name: string;
  department_id: string;
  title: string;
  email: string;
  phone: string;
  status: EditablePersonStatus;
  joined_at: string;
  notes: string;
};

type EditFieldErrors = {
  email?: string;
  phone?: string;
};

type ToastState = {
  title: string;
  description: string;
  variant: "success" | "danger";
} | null;

export default function PersonDetailPage() {
  const params = useParams<{ id: string }>();
  const personId = params.id;
  const [person, setPerson] = useState<Person | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [registrations, setRegistrations] = useState<FaceRegistration[]>([]);
  const [attendance, setAttendance] = useState<AttendanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditPersonForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState<EditFieldErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const editDialog = useDialogTransition(editing && editForm ? editForm : null);
  const visibleEditForm = editDialog.value;
  const profileImageAssetId = getLatestIndexedProfileAssetId(registrations);
  const [failedProfileImageAssetId, setFailedProfileImageAssetId] = useState<string | null>(null);

  useEffect(() => {
    if (!personId) return;
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [personData, departmentsData, registrationsData, attendanceData] = await Promise.all([
          apiFetch<Person>(`/persons/${personId}`, { withAuth: true }),
          apiFetch<PageResult<Department>>("/departments?page=1&page_size=100", { withAuth: true }),
          apiFetch<PageResult<FaceRegistration>>(`/persons/${personId}/registrations?page=1&page_size=20`, { withAuth: true }),
          apiFetch<PageResult<AttendanceEvent>>(`/attendance/persons/${personId}/history?page=1&page_size=20`, { withAuth: true }),
        ]);
        if (!mounted) return;
        setPerson(personData);
        setDepartments(departmentsData.items);
        setRegistrations(registrationsData.items);
        setAttendance(attendanceData.items);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Không tải được hồ sơ nhân sự.");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void loadData();
    return () => {
      mounted = false;
    };
  }, [personId]);

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), 3500);
    const removeTimer = window.setTimeout(() => setToast(null), 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  const departmentName = person?.department_id
    ? departments.find((department) => department.id === person.department_id)?.name ?? "Unknown"
    : "No department";

  function openEditForm() {
    if (!person) return;
    setEditForm({
      full_name: person.full_name,
      department_id: person.department_id ?? "",
      title: person.title ?? "",
      email: person.email ?? "",
      phone: person.phone ?? "",
      status: person.status === "inactive" ? "active" : person.status,
      joined_at: person.joined_at ?? "",
      notes: person.notes ?? "",
    });
    setEditFieldErrors({});
    setEditing(true);
  }

  function updateEditForm(field: keyof EditPersonForm, value: string) {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function closeEditForm() {
    setEditing(false);
    setEditForm(null);
    setEditFieldErrors({});
  }

  function showToast(nextToast: NonNullable<ToastState>) {
    setToast(nextToast);
    setToastVisible(true);
  }

  function closeToast() {
    setToastVisible(false);
    window.setTimeout(() => setToast(null), 300);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!person || !editForm) return;

    setEditFieldErrors({});

    const validationError = validatePersonProfileFields({
      email: editForm.email,
      phone: editForm.phone,
      joinedAt: editForm.joined_at,
    });
    if (validationError) {
      showToast({
        title: "Dữ liệu chưa hợp lệ",
        description: validationError,
        variant: "danger",
      });
      return;
    }

    setSaving(true);
    try {
      const updatedPerson = await apiFetch<Person>(`/persons/${person.id}`, {
        method: "PATCH",
        withAuth: true,
        body: JSON.stringify({
          full_name: editForm.full_name.trim(),
          department_id: editForm.department_id || null,
          title: editForm.title.trim() || null,
          email: editForm.email.trim() || null,
          phone: editForm.phone.trim() || null,
          status: editForm.status,
          joined_at: editForm.joined_at || null,
          notes: editForm.notes.trim() || null,
        }),
      });
      setPerson(updatedPerson);
      setEditing(false);
      setEditForm(null);
      showToast({
        title: "Cập nhật thành công",
        description: `Thông tin nhân viên ${updatedPerson.full_name} đã được cập nhật.`,
        variant: "success",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Không thể cập nhật thông tin nhân viên.";
      const duplicateField = getDuplicatePersonField(err);
      if (duplicateField === "email") {
        setEditFieldErrors({ email: "Email đã được sử dụng bởi nhân viên khác." });
      } else if (duplicateField === "phone") {
        setEditFieldErrors({ phone: "Số điện thoại đã được sử dụng bởi nhân viên khác." });
      }
      showToast({
        title: "Cập nhật thất bại",
        description: duplicateField === "email" ? "Email đã tồn tại. Vui lòng kiểm tra lại." : duplicateField === "phone" ? "Số điện thoại đã tồn tại. Vui lòng kiểm tra lại." : message,
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="p-6 text-sm text-slate-600">Đang tải hồ sơ nhân sự...</div>;
  }

  if (error || !person) {
    return <div className="m-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || "Không tìm thấy nhân sự."}</div>;
  }

  return (
    <div>
      <PageHeader
        title="Chi tiết nhân sự"
        description={`${person.full_name} · ${person.employee_code} · ${departmentName}`}
      />
      <div className="p-6 pb-0">
        <Link
          href="/persons"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>
      </div>
      <div className="grid gap-4 p-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid aspect-square overflow-hidden rounded-lg bg-slate-100">
              {profileImageAssetId && profileImageAssetId !== failedProfileImageAssetId ? (
                <Image
                  src={`/api/v1/media-assets/${profileImageAssetId}/content`}
                  alt={`Profile image of ${person.full_name}`}
                  width={640}
                  height={640}
                  unoptimized
                  className="h-full w-full object-cover"
                  onError={() => setFailedProfileImageAssetId(profileImageAssetId)}
                />
              ) : (
                <div className="grid h-full w-full place-items-center text-5xl font-semibold text-slate-400">
                  {person.full_name.split(" ").slice(-1)[0][0]}
                </div>
              )}
            </div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Status</span><PersonStatusBadge status={person.status} /></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Title</span><span>{person.title}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Email</span><span>{person.email}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Phone</span><span>{person.phone}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">Joined</span><span>{person.joined_at}</span></div>
            <div className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={openEditForm}
                className="h-14 w-full gap-4 rounded-lg border-slate-200 text-lg font-medium text-slate-950 hover:bg-slate-50"
              >
                <Pencil className="h-6 w-6" />
                Cập nhật thông tin
              </Button>
            </div>
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

      {visibleEditForm ? (
        <div
          className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(editDialog.visible)}`}
          onMouseDown={() => {
            if (!saving) closeEditForm();
          }}
        >
          <form
            className={`flex max-h-[90vh] w-full max-w-3xl flex-col overflow-visible rounded-lg bg-white shadow-2xl ${dialogPanelClass(editDialog.visible)}`}
            onSubmit={saveProfile}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold">Sửa thông tin nhân viên</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chỉ chỉnh thông tin lưu trong bảng persons, không bao gồm face registration.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeEditForm} disabled={saving} aria-label="Đóng panel sửa">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-visible p-5">
              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã nhân viên</span>
                  <Input value={person.employee_code} disabled className="bg-slate-50 text-slate-500" />
                  <div className="text-xs text-slate-500">Mã nhân viên không được chỉnh sửa từ màn hình này.</div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Họ tên</span>
                  <Input value={visibleEditForm.full_name} onChange={(event) => updateEditForm("full_name", event.target.value)} required />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Phòng ban</span>
                  <DepartmentTreeSelect
                    departments={departments}
                    value={visibleEditForm.department_id}
                    onChange={(value) => updateEditForm("department_id", value)}
                    rootValue=""
                    rootLabel="Chưa chọn phòng ban"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Chức danh</span>
                  <Input value={visibleEditForm.title} onChange={(event) => updateEditForm("title", event.target.value)} />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <Input
                    type="email"
                    value={visibleEditForm.email}
                    onChange={(event) => {
                      updateEditForm("email", event.target.value);
                      setEditFieldErrors((current) => ({ ...current, email: undefined }));
                    }}
                    aria-invalid={editFieldErrors.email ? true : undefined}
                    className={editFieldErrors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Điện thoại</span>
                  <Input
                    value={visibleEditForm.phone}
                    onChange={(event) => {
                      updateEditForm("phone", event.target.value);
                      setEditFieldErrors((current) => ({ ...current, phone: undefined }));
                    }}
                    aria-invalid={editFieldErrors.phone ? true : undefined}
                    className={editFieldErrors.phone ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ngày vào làm</span>
                  <DatePicker
                    value={visibleEditForm.joined_at}
                    onChange={(value) => updateEditForm("joined_at", value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <PersonStatusSelect
                    value={visibleEditForm.status}
                    onChange={(value) => updateEditForm("status", value)}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú</span>
                <Textarea value={visibleEditForm.notes} onChange={(event) => updateEditForm("notes", event.target.value)} />
              </label>

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button type="button" variant="outline" onClick={closeEditForm} disabled={saving}>Hủy</Button>
              <Button type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? "Đang lưu..." : "Lưu thay đổi"}
              </Button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={
            toast.variant === "success"
              ? `fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-emerald-200 bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${toastVisible ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0"}`
              : `fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-red-200 bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${toastVisible ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0"}`
          }
        >
          <div className="flex items-start gap-3">
            <div
              className={
                toast.variant === "success"
                  ? "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                  : "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
              }
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-950">{toast.title}</div>
              <div className="mt-1 text-slate-600">{toast.description}</div>
            </div>
            <button
              type="button"
              onClick={closeToast}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getDuplicatePersonField(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const message = error.message.toLowerCase();
  const details = getErrorDetailsText(error.details).toLowerCase();

  if (error.code !== "validation_error") return null;
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

function getLatestIndexedProfileAssetId(registrations: FaceRegistration[]) {
  return [...registrations]
    .filter(
      (registration) =>
        registration.registration_status === "indexed" &&
        registration.face_image_media_asset_id !== null &&
        registration.indexed_at !== null,
    )
    .sort((left, right) => Date.parse(right.indexed_at ?? "") - Date.parse(left.indexed_at ?? ""))
    .at(0)?.face_image_media_asset_id ?? null;
}
