"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Building2, ChevronRight, Eye, Pencil, Plus, PowerOff, Save, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { normalizeBackendError } from "@/lib/backend-error-normalizer";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { Department } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";

type DepartmentDraft = {
  id?: string;
  code: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
};

type DepartmentFieldErrors = {
  code?: string;
  parent_id?: string;
};

type ToastState = {
  title: string;
  description: string;
  variant: "success" | "danger";
} | null;

function emptyDraft(): DepartmentDraft {
  return {
    code: "",
    name: "",
    parent_id: null,
    is_active: true,
  };
}

export function DepartmentsManager({
  initialDepartments,
}: {
  initialDepartments: Department[];
}) {
  const t = useTranslations();
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [draft, setDraft] = useState<DepartmentDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<DepartmentFieldErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const draftDialog = useDialogTransition(draft);
  const deleteDialog = useDialogTransition(deleteTarget);
  const visibleDraft = draftDialog.value;
  const visibleDeleteTarget = deleteDialog.value;

  const activeDepartments = useMemo(() => departments.filter((department) => department.is_active), [departments]);

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), 3500);
    const removeTimer = window.setTimeout(() => setToast(null), 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  function showToast(nextToast: NonNullable<ToastState>) {
    setToast(nextToast);
    setToastVisible(true);
  }

  function closeToast() {
    setToastVisible(false);
    window.setTimeout(() => setToast(null), 300);
  }

  function getDepartmentName(id: string | null) {
    if (!id) return t("common.notAssigned");
    return departments.find((department) => department.id === id)?.name ?? t("common.unknown");
  }

  function openCreateDialog() {
    setFieldErrors({});
    setDraft(emptyDraft());
  }

  function openEditDialog(department: Department) {
    setFieldErrors({});
    setDraft({
      id: department.id,
      code: department.code,
      name: department.name,
      parent_id: department.parent_id,
      is_active: department.is_active,
    });
  }

  async function saveDraft() {
    if (!draft) return;
    const code = draft.code.trim();
    const name = draft.name.trim();
    if (!code || !name) {
      setFieldErrors({
        code: !code ? t("departments.form.codeRequired") : undefined,
      });
      showToast({
        title: t("departments.toast.invalidTitle"),
        description: !code ? t("departments.form.codeRequired") : t("departments.form.nameRequired"),
        variant: "danger",
      });
      return;
    }

    setSaving(true);
    setFieldErrors({});
    try {
      if (draft.id) {
        const updatedDepartment = await apiFetch<Department>(`/departments/${draft.id}`, {
          method: "PATCH",
          withAuth: true,
          body: JSON.stringify({
            code,
            name,
            parent_id: draft.parent_id,
            is_active: draft.is_active,
          }),
        });

        setDepartments((current) => current.map((department) => (department.id === updatedDepartment.id ? updatedDepartment : department)));
        showToast({
          title: t("departments.toast.updateSuccessTitle"),
          description: t("departments.toast.updateSuccessDescription", { name: updatedDepartment.name }),
          variant: "success",
        });
      } else {
        const createdDepartment = await apiFetch<Department>("/departments", {
          method: "POST",
          withAuth: true,
          body: JSON.stringify({
            code,
            name,
            parent_id: draft.parent_id,
            is_active: draft.is_active,
          }),
        });
        setDepartments((current) => [createdDepartment, ...current]);
        showToast({
          title: t("departments.toast.createSuccessTitle"),
          description: t("departments.toast.createSuccessDescription", { name: createdDepartment.name }),
          variant: "success",
        });
      }
      setDraft(null);
    } catch (err) {
      const nextErrors = getDepartmentFieldErrors(err, t);
      setFieldErrors(nextErrors);
      showToast({
        title: draft.id ? t("departments.toast.updateFailedTitle") : t("departments.toast.createFailedTitle"),
        description: getDepartmentErrorMessage(err, t),
        variant: "danger",
      });
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch<void>(`/departments/${deleteTarget.id}`, {
        method: "DELETE",
        withAuth: true,
      });
      setDepartments((current) =>
        current.map((department) => (department.id === deleteTarget.id ? { ...department, is_active: false } : department)),
      );
      showToast({
        title: t("departments.toast.deactivateSuccessTitle"),
        description: t("departments.toast.deactivateSuccessDescription", { name: deleteTarget.name }),
        variant: "success",
      });
      setDeleteTarget(null);
    } catch (err) {
      showToast({
        title: t("departments.toast.deactivateFailedTitle"),
        description: err instanceof ApiError ? getTranslatedBackendError(t, err, "departments") : t("errors.system.requestFailed"),
        variant: "danger",
      });
    } finally {
      setDeleting(false);
    }
  }

  function descendantDepartmentIds(departmentId: string) {
    const descendants = new Set<string>();
    const visit = (currentId: string) => {
      for (const child of departments.filter((department) => department.parent_id === currentId)) {
        descendants.add(child.id);
        visit(child.id);
      }
    };
    visit(departmentId);
    return descendants;
  }

  function parentCandidates() {
    if (!draft?.id) return departments;
    const descendants = descendantDepartmentIds(draft.id);
    return departments.filter((department) => department.id !== draft.id && !descendants.has(department.id));
  }

  return (
    <>
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">{t("departments.list.summaryTitle")}</div>
              <div className="mt-1 text-sm text-slate-500">
                {t("departments.list.summaryDescription", { total: departments.length, active: activeDepartments.length })}
              </div>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              {t("departments.list.addAction")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("departments.list.tableTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-16 py-3">{t("departments.list.index")}</th>
                    <th className="w-28">{t("departments.list.code")}</th>
                    <th>{t("departments.list.name")}</th>
                    <th className="w-48">{t("departments.list.parent")}</th>
                    <th className="w-28">{t("departments.list.status")}</th>
                    <th className="w-40 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((department, index) => (
                    <tr key={department.id} className="border-b border-slate-100">
                      <td className="py-3 font-mono text-xs text-slate-500">{index + 1}</td>
                      <td className="font-mono text-xs">{department.code}</td>
                      <td className="truncate pr-4 font-medium">{department.name}</td>
                      <td className="truncate pr-4">{getDepartmentName(department.parent_id)}</td>
                      <td>
                        <Badge variant={department.is_active ? "success" : "default"}>
                          {department.is_active ? t("common.status.active") : t("common.status.inactive")}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/departments/${department.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                            aria-label={t("departments.list.view", { name: department.name })}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Button variant="outline" size="icon" aria-label={t("departments.list.edit", { name: department.name })} onClick={() => openEditDialog(department)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={department.is_active ? t("departments.list.deactivate", { name: department.name }) : t("departments.list.deactivated")}
                            title={department.is_active ? t("departments.list.deactivate", { name: department.name }) : t("departments.list.deactivated")}
                            disabled={!department.is_active}
                            onClick={() => setDeleteTarget(department)}
                          >
                            <PowerOff className={department.is_active ? "h-4 w-4 text-amber-700" : "h-4 w-4 text-slate-400 opacity-60"} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {visibleDraft ? (
        <div
          className={`fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(draftDialog.visible)}`}
          onMouseDown={() => setDraft(null)}
        >
          <div
            className={`w-full max-w-xl overflow-visible rounded-lg bg-white shadow-2xl ${dialogPanelClass(draftDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{visibleDraft.id ? t("departments.form.editTitle") : t("departments.form.createTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t("departments.form.createDescription")}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDraft(null)} aria-label={t("departments.form.close")}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.code")}</span>
                  <Input
                    value={visibleDraft.code}
                    onChange={(event) => {
                      setDraft({ ...visibleDraft, code: event.target.value });
                      setFieldErrors((current) => ({ ...current, code: undefined }));
                    }}
                    placeholder={t("departments.form.codePlaceholder")}
                    aria-invalid={fieldErrors.code ? true : undefined}
                    className={fieldErrors.code ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.name")}</span>
                  <Input value={visibleDraft.name} onChange={(event) => setDraft({ ...visibleDraft, name: event.target.value })} placeholder={t("departments.form.namePlaceholder")} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.parent")}</span>
                  <DepartmentTreeSelect
                    departments={parentCandidates()}
                    value={visibleDraft.parent_id ?? ""}
                    onChange={(value) => {
                      setDraft({ ...visibleDraft, parent_id: value || null });
                      setFieldErrors((current) => ({ ...current, parent_id: undefined }));
                    }}
                    invalid={Boolean(fieldErrors.parent_id)}
                  />
                  {visibleDraft.id ? (
                    <span className="text-xs text-slate-500">
                      {t("departments.form.invalidParentHint")}
                    </span>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.status")}</span>
                  <DepartmentStatusSelect
                    value={visibleDraft.is_active}
                    onChange={(value) => setDraft({ ...visibleDraft, is_active: value })}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>{t("common.cancel")}</Button>
              <Button onClick={saveDraft} disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? t("departments.form.saving") : t("departments.form.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}


      {visibleDeleteTarget ? (
        <div
          className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(deleteDialog.visible)}`}
          onMouseDown={() => setDeleteTarget(null)}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(deleteDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
                  <PowerOff className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("departments.deleteDialog.title")}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {t("departments.deleteDialog.description", { name: visibleDeleteTarget.name })}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t("common.cancel")}
              </Button>
              <Button variant="default" onClick={confirmDelete} disabled={deleting}>
                <PowerOff className="h-4 w-4" />
                {deleting ? t("departments.deleteDialog.processing") : t("departments.deleteDialog.confirm")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-[90] w-[min(420px,calc(100vw-2.5rem))] rounded-lg border bg-white p-4 shadow-xl transition-all duration-300 ${
            toastVisible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
          } ${toast.variant === "danger" ? "border-red-200" : "border-emerald-200"}`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className={toast.variant === "danger" ? "font-semibold text-red-800" : "font-semibold text-emerald-800"}>
                {toast.title}
              </div>
              <div className="mt-1 text-sm text-slate-600">{toast.description}</div>
            </div>
            <button
              type="button"
              onClick={closeToast}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              aria-label={t("departments.toast.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DepartmentTreeSelect({
  departments,
  value,
  onChange,
  invalid = false,
}: {
  departments: Department[];
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : t("departments.form.noParent");
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

  const rootDepartments = departments.filter(
    (department) => department.parent_id === null || !departments.some((item) => item.id === department.parent_id),
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:ring-2 ${
          invalid ? "border-red-300 focus:border-red-400 focus:ring-red-100" : "border-slate-200 focus:border-slate-400 focus:ring-slate-100"
        }`}
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-[80] w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("departments.form.searchPlaceholder")}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm focus:border-transparent focus:ring-0"
              />
            </div>
          </div>

          <div className="thin-scrollbar max-h-64 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={value === "" ? "flex w-full items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <Building2 className="h-4 w-4" />
              {t("departments.form.noParent")}
            </button>

            <div className="mt-1 space-y-1">
              {rootDepartments.map((department) => (
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

function DepartmentStatusSelect({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const t = useTranslations("common.status");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = [
    { value: true, label: "active" },
    { value: false, label: "inactive" },
  ];

  useOutsideClick(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          <DepartmentStatusBadge active={value} />
        </span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={value === option.value ? "flex w-full items-center rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              {t(option.label)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DepartmentStatusBadge({ active }: { active: boolean }) {
  const t = useTranslations("common.status");
  return <Badge variant={active ? "success" : "default"}>{active ? t("active") : t("inactive")}</Badge>;
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

function getDepartmentFieldErrors(error: unknown, t: ReturnType<typeof useTranslations>): DepartmentFieldErrors {
  const normalized = normalizeBackendError(error, "departments");
  return {
    code: normalized.key === "departments.codeExists" ? t("departments.fieldErrors.invalidCode") : undefined,
    parent_id:
      normalized.key === "departments.parentNotFound" ||
      normalized.key === "departments.parentCannotBeSelf" ||
      normalized.key === "departments.parentCannotBeDescendant"
        ? t("departments.fieldErrors.invalidParent")
        : undefined,
  };
}

function getDepartmentErrorMessage(error: unknown, t: ReturnType<typeof useTranslations>) {
  const normalized = normalizeBackendError(error, "departments");
  if (normalized.key === "departments.codeExists") return t("departments.messages.duplicateCode");
  if (
    normalized.key === "departments.parentNotFound" ||
    normalized.key === "departments.parentCannotBeSelf" ||
    normalized.key === "departments.parentCannotBeDescendant"
  ) {
    return t("departments.messages.invalidParent");
  }
  return getTranslatedBackendError(t, error, "departments");
}



