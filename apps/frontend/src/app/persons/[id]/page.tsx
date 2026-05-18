"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useParams } from "next/navigation";
import { ArrowLeft, Pencil, Save, X } from "lucide-react";
import { ListTableAccent } from "@/components/data/list-table-accent";
import { PageAmbientWave } from "@/components/data/page-ambient-wave";
import { PageHeader } from "@/components/data/page-header";
import { DirectionBadge, PersonStatusBadge } from "@/components/data/status-badge";
import { PersonFaceRegistrations } from "@/components/persons/person-face-registrations";
import { DatePicker, DepartmentTreeSelect, PersonStatusSelect, type EditablePersonStatus } from "@/components/persons/persons-table";
import { useTheme } from "@/components/theme/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getLatestIndexedProfileAssetId } from "@/lib/person-profile-image";
import { validatePersonProfileFields } from "@/lib/person-validation";
import { useCachedMediaAsset } from "@/lib/use-cached-media-asset";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import type { AttendanceEvent, Department, FaceRegistration, PageResult, Person } from "@/lib/types";

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
  const t = useTranslations();
  const locale = useLocale();
  const { theme } = useTheme();
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
  const profileImage = useCachedMediaAsset(profileImageAssetId);
  const glassCardClass =
    theme === "dark"
      ? "border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
      : "border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl";

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
        setError(err instanceof ApiError ? err.message : t("persons.detail.loadFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, [personId, t]);

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
    ? departments.find((department) => department.id === person.department_id)?.name ?? t("common.unknown")
    : t("common.notAssigned");

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
        title: t("persons.toast.invalidTitle"),
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
        title: t("persons.toast.updateSuccessTitle"),
        description: t("persons.toast.updateSuccessDescription", { name: updatedPerson.full_name }),
        variant: "success",
      });
    } catch (err) {
      const duplicateField = getDuplicatePersonField(err);
      if (duplicateField === "email") {
        setEditFieldErrors({ email: t("persons.fieldErrors.duplicateEmail") });
      } else if (duplicateField === "phone") {
        setEditFieldErrors({ phone: t("persons.fieldErrors.duplicatePhone") });
      }
      showToast({
        title: t("persons.toast.updateFailedTitle"),
        description: duplicateField === "email"
          ? t("persons.messages.duplicateEmail")
          : duplicateField === "phone"
            ? t("persons.messages.duplicatePhone")
            : err instanceof ApiError
              ? err.message
              : t("persons.toast.updateFailedTitle"),
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-5rem)]">
        <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
        <div className="relative z-10 p-6 text-sm text-slate-600">{t("persons.detail.loading")}</div>
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className="relative min-h-[calc(100vh-5rem)]">
        <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
        <div className="relative z-10 m-6 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error || t("persons.detail.notFound")}</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
      <PageHeader title={t("persons.detail.pageTitle")} description={`${person.full_name} · ${person.employee_code} · ${departmentName}`} />
      <div className="relative z-10 p-6 pb-0">
        <Link href="/persons" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          {t("persons.detail.backToList")}
        </Link>
      </div>
      <div className="relative z-10 grid gap-4 p-6 xl:grid-cols-[360px_1fr]">
        <Card className={glassCardClass}>
          <CardHeader><CardTitle>{t("persons.detail.profileCardTitle")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="relative grid aspect-square overflow-hidden rounded-lg bg-slate-100">
              {profileImage.status === "loading" ? <div className="absolute inset-0 animate-pulse bg-slate-200/70" aria-hidden="true" /> : null}
              <div className="grid h-full w-full place-items-center text-5xl font-semibold text-slate-400">
                {person.full_name.split(" ").slice(-1)[0][0]}
              </div>
              {profileImage.src ? (
                <Image
                  src={profileImage.src}
                  alt={`${t("persons.detail.profileCardTitle")} ${person.full_name}`}
                  width={640}
                  height={640}
                  unoptimized
                  className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200 opacity-100"
                />
              ) : null}
            </div>
            <div className="flex items-center justify-between"><span className="text-slate-500">{t("persons.detail.status")}</span><PersonStatusBadge status={person.status} /></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">{t("persons.detail.title")}</span><span>{person.title || t("common.unknown")}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">{t("persons.detail.email")}</span><span>{person.email || t("common.unknown")}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">{t("persons.detail.phone")}</span><span>{person.phone || t("common.unknown")}</span></div>
            <div className="flex items-center justify-between"><span className="text-slate-500">{t("persons.detail.joined")}</span><span>{person.joined_at || t("common.unknown")}</span></div>
            <div className="pt-3">
              <Button type="button" onClick={openEditForm} className="ui-button-link ui-button-link-primary h-12 w-full gap-3 text-base">
                <Pencil className="h-5 w-5" />
                {t("persons.detail.updateAction")}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <PersonFaceRegistrations personId={person.id} initialRegistrations={registrations} />

          <Card className={`list-table-corner-accent ${glassCardClass}`}>
            <ListTableAccent />
            <CardHeader><CardTitle>{t("persons.detail.attendanceHistory")}</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr className="border-b border-slate-200">
                      <th className="py-3">{t("persons.detail.time")}</th>
                      <th>{t("persons.detail.direction")}</th>
                      <th>{t("persons.detail.match")}</th>
                      <th>{t("persons.detail.spoof")}</th>
                      <th>{t("persons.detail.validity")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.map((event) => (
                      <tr key={event.id} className="border-b border-slate-100">
                        <td className="py-3 font-mono text-xs">{formatDateTimeLocalized(event.recognized_at, locale)}</td>
                        <td><DirectionBadge direction={event.event_direction} /></td>
                        <td>{formatPercent(event.match_score)}</td>
                        <td>{formatPercent(event.spoof_score)}</td>
                        <td><Badge variant={event.is_valid ? "success" : "danger"}>{event.is_valid ? t("persons.detail.valid") : t("persons.detail.invalid")}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className={glassCardClass}>
            <CardHeader><CardTitle>{t("persons.detail.notes")}</CardTitle></CardHeader>
            <CardContent className="text-sm text-slate-600">{person.notes ?? t("persons.detail.noNotes")}</CardContent>
          </Card>
        </div>
      </div>

      {visibleEditForm ? (
        <div
          className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(editDialog.visible)}`}
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
                <h2 className="text-lg font-semibold">{t("persons.detail.editTitle")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("persons.detail.editDescription")}</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeEditForm} disabled={saving} aria-label={t("persons.detail.closeEdit")}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-visible p-5">
              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.employeeCode")}</span>
                  <Input value={person.employee_code} disabled className="bg-slate-50 text-slate-500" />
                  <div className="text-xs text-slate-500">{t("persons.editDialog.employeeCodeHint")}</div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.fullName")}</span>
                  <Input value={visibleEditForm.full_name} onChange={(event) => updateEditForm("full_name", event.target.value)} required />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.department")}</span>
                  <DepartmentTreeSelect departments={departments} value={visibleEditForm.department_id} onChange={(value) => updateEditForm("department_id", value)} rootValue="" rootLabel={t("persons.table.noDepartmentSelected")} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.title")}</span>
                  <Input value={visibleEditForm.title} onChange={(event) => updateEditForm("title", event.target.value)} />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.email")}</span>
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
                  <span className="text-sm font-medium">{t("persons.editDialog.phone")}</span>
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
                  <span className="text-sm font-medium">{t("persons.editDialog.joinedAt")}</span>
                  <DatePicker value={visibleEditForm.joined_at} onChange={(value) => updateEditForm("joined_at", value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.table.status")}</span>
                  <PersonStatusSelect value={visibleEditForm.status} onChange={(value) => updateEditForm("status", value)} />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("persons.editDialog.notes")}</span>
                <Textarea value={visibleEditForm.notes} onChange={(event) => updateEditForm("notes", event.target.value)} />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button type="button" variant="outline" onClick={closeEditForm} disabled={saving}>{t("common.cancel")}</Button>
              <Button className="ui-button-link ui-button-link-primary" type="submit" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? t("persons.detail.saving") : t("persons.detail.save")}
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
            <div className={toast.variant === "success" ? "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" : "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-950">{toast.title}</div>
              <div className="mt-1 text-slate-600">{toast.description}</div>
            </div>
            <button type="button" onClick={closeToast} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={t("persons.toast.close")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function formatDateTimeLocalized(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number | null | undefined) {
  if (value == null) return "N/A";
  return `${Math.round(value * 100)}%`;
}

function getDuplicatePersonField(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const message = error.message.toLowerCase();
  const details = getErrorDetailsText(error.details).toLowerCase();

  if (error.code !== "validation_error") return null;
  if (message.includes("email already exists") || details.includes("email")) return "email";
  if (message.includes("phone already exists") || details.includes("phone")) return "phone";
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
