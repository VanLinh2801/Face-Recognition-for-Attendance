"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Eye, MoreHorizontal, Pencil, Save, Search, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListTableAccent } from "@/components/data/list-table-accent";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { useTheme } from "@/components/theme/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api-client";
import { normalizeBackendError } from "@/lib/backend-error-normalizer";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { Department, Person } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";

type DepartmentDraft = {
  id: string;
  code: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
};

type DepartmentFieldErrors = {
  code?: string;
  parent_id?: string;
};

type DepartmentPerson = Person & { department_name: string };

export function DepartmentDetailView({
  department,
  departments,
  persons,
  onDepartmentUpdated,
}: {
  department: Department;
  departments: Department[];
  persons: DepartmentPerson[];
  onDepartmentUpdated: (department: Department) => void;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { theme } = useTheme();
  const [deletedPersonIds, setDeletedPersonIds] = useState<Set<string>>(new Set());
  const [openPersonActionId, setOpenPersonActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DepartmentPerson | null>(null);
  const [editDraft, setEditDraft] = useState<DepartmentDraft | null>(null);
  const [editFieldErrors, setEditFieldErrors] = useState<DepartmentFieldErrors>({});
  const [deleting, setDeleting] = useState(false);
  const [savingDepartment, setSavingDepartment] = useState(false);
  const [toast, setToast] = useState<{
    title: string;
    description: string;
    variant: "success" | "danger";
  } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const personActionMenuRef = useRef<HTMLDivElement>(null);
  const editDialog = useDialogTransition(editDraft);
  const deleteDialog = useDialogTransition(deleteTarget);
  const visibleEditDraft = editDialog.value;
  const visibleDeleteTarget = deleteDialog.value;
  const departmentPeople = useMemo(
    () => persons.filter((person) => !deletedPersonIds.has(person.id)),
    [deletedPersonIds, persons],
  );
  const glassCardClass =
    theme === "dark"
      ? "border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
      : "border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl";

  useOutsideClick(personActionMenuRef, openPersonActionId !== null, () => setOpenPersonActionId(null));

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), 3500);
    const removeTimer = window.setTimeout(() => setToast(null), 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  function showToast(nextToast: NonNullable<typeof toast>) {
    setToast(nextToast);
    setToastVisible(true);
  }

  function closeToast() {
    setToastVisible(false);
    window.setTimeout(() => setToast(null), 300);
  }

  function getDepartmentName(id: string | null) {
    if (!id) return t("common.notAssigned");
    return departments.find((item) => item.id === id)?.name ?? t("common.unknown");
  }

  function childDepartments(parentId: string) {
    return departments.filter((item) => item.parent_id === parentId);
  }

  function departmentPersons(departmentId: string) {
    return departmentPeople.filter((person) => person.department_id === departmentId);
  }

  function descendantDepartmentIds(departmentId: string) {
    const ids = new Set<string>([departmentId]);
    const visit = (parentId: string) => {
      for (const child of childDepartments(parentId)) {
        ids.add(child.id);
        visit(child.id);
      }
    };

    visit(departmentId);
    return ids;
  }

  function departmentTreePersons(departmentId: string) {
    const departmentIds = descendantDepartmentIds(departmentId);
    return departmentPeople.filter((person) => (person.department_id ? departmentIds.has(person.department_id) : false));
  }

  function openEditDialog() {
    setEditFieldErrors({});
    setEditDraft({
      id: department.id,
      code: department.code,
      name: department.name,
      parent_id: department.parent_id,
      is_active: department.is_active,
    });
  }

  function parentCandidates() {
    const descendants = descendantDepartmentIds(department.id);
    return departments.filter((item) => item.id !== department.id && !descendants.has(item.id));
  }

  async function saveDepartmentDraft() {
    if (!editDraft) return;

    const code = editDraft.code.trim();
    const name = editDraft.name.trim();
    if (!code || !name) {
      setEditFieldErrors({
        code: !code ? t("departments.form.codeRequired") : undefined,
      });
      showToast({
        title: t("departments.toast.invalidTitle"),
        description: !code ? t("departments.form.codeRequired") : t("departments.form.nameRequired"),
        variant: "danger",
      });
      return;
    }

    setSavingDepartment(true);
    setEditFieldErrors({});
    try {
      const updatedDepartment = await apiFetch<Department>(`/departments/${editDraft.id}`, {
        method: "PATCH",
        withAuth: true,
        body: JSON.stringify({
          code,
          name,
          parent_id: editDraft.parent_id,
          is_active: editDraft.is_active,
        }),
      });

      onDepartmentUpdated(updatedDepartment);
      setEditDraft(null);
      showToast({
        title: t("departments.toast.updateSuccessTitle"),
        description: t("departments.toast.updateSuccessDescription", { name: updatedDepartment.name }),
        variant: "success",
      });
    } catch (err) {
      setEditFieldErrors(getDepartmentFieldErrors(err, t));
      showToast({
        title: t("departments.toast.updateFailedTitle"),
        description: getDepartmentErrorMessage(err, t),
        variant: "danger",
      });
    } finally {
      setSavingDepartment(false);
    }
  }

  async function deletePerson(personId: string) {
    setDeleting(true);
    try {
      await apiFetch<void>(`/persons/${personId}`, {
        method: "DELETE",
        withAuth: true,
      });
      setDeletedPersonIds((current) => new Set(current).add(personId));
      setOpenPersonActionId(null);
      setDeleteTarget(null);
      showToast({
        title: t("departments.toast.personDeleteSuccessTitle"),
        description: t("departments.toast.personDeleteSuccessDescription"),
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: t("departments.toast.personDeleteFailedTitle"),
        description: getTranslatedBackendError(t, err, "persons"),
        variant: "danger",
      });
    } finally {
      setDeleting(false);
    }
  }

  const treePersons = departmentTreePersons(department.id);

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Card className={glassCardClass}>
            <CardHeader>
              <CardTitle>{t("departments.detail.infoTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{t("departments.detail.code")}</span>
                <span className="font-mono text-xs">{department.code}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{t("departments.detail.name")}</span>
                <span className="font-medium">{department.name}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{t("departments.detail.parent")}</span>
                <span>{getDepartmentName(department.parent_id)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{t("departments.detail.status")}</span>
                <DepartmentStatusBadge active={department.is_active} />
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{t("departments.detail.children")}</span>
                <span>{childDepartments(department.id).length}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">{t("departments.detail.persons")}</span>
                <span>{treePersons.length}</span>
              </div>
              <Button className="ui-button-link ui-button-link-primary mt-2 w-full" onClick={openEditDialog}>
                <Pencil className="h-4 w-4" />
                {t("departments.detail.editAction")}
              </Button>
            </CardContent>
          </Card>

          <Card className={glassCardClass}>
            <CardHeader>
              <CardTitle>{t("departments.detail.treeTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <DepartmentTree
                rootId={department.id}
                departments={departments}
                getPersonCount={(departmentId) => departmentPersons(departmentId).length}
                onOpenDepartment={(target) => router.push(`/departments/${target.id}`)}
              />
            </CardContent>
          </Card>
        </div>

        <Card className={`list-table-corner-accent ${glassCardClass}`}>
          <ListTableAccent />
          <CardHeader>
            <CardTitle>{t("departments.detail.personsTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-visible">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-12 py-3">{t("departments.list.index")}</th>
                    <th>{t("departments.detail.person")}</th>
                    <th className="w-[24%]">{t("departments.list.parent")}</th>
                    <th className="w-[18%]">{t("departments.detail.position")}</th>
                    <th className="w-24">{t("departments.detail.status")}</th>
                    <th className="w-16 text-right">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {treePersons.map((person, index) => (
                    <tr key={person.id} className="border-b border-slate-100">
                      <td className="py-3 font-mono text-xs text-slate-500">{index + 1}</td>
                      <td className="min-w-0 pr-3">
                        <div className="truncate font-medium">{person.full_name}</div>
                        <div className="truncate text-xs text-slate-500">{person.email || t("common.unknown")}</div>
                        <div className="truncate text-xs text-slate-500">{person.phone || t("common.unknown")}</div>
                      </td>
                      <td className="truncate pr-4">{person.department_name || t("common.notAssigned")}</td>
                      <td className="truncate pr-4">{person.title || t("common.unknown")}</td>
                      <td>
                        <PersonStatusBadge status={person.status} />
                      </td>
                      <td className="text-right">
                        <div ref={openPersonActionId === person.id ? personActionMenuRef : undefined} className="relative inline-flex justify-end">
                          <Button
                            variant="outline"
                            size="icon"
                            aria-label={t("departments.personActions.open", { name: person.full_name })}
                            onClick={() => setOpenPersonActionId((current) => (current === person.id ? null : person.id))}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {openPersonActionId === person.id ? (
                            <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-left shadow-lg">
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                onClick={() => router.push(`/persons/${person.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                                {t("departments.personActions.viewDetails")}
                              </button>
                              <button
                                type="button"
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  setDeleteTarget(person);
                                  setOpenPersonActionId(null);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                                {t("departments.personActions.delete")}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {treePersons.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  {t("departments.detail.emptyPersons")}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>

      {visibleEditDraft ? (
        <div
          className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(editDialog.visible)}`}
          onMouseDown={() => setEditDraft(null)}
        >
          <div
            className={`w-full max-w-xl overflow-visible rounded-lg bg-white shadow-2xl ${dialogPanelClass(editDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("departments.form.editTitle")}</h2>
                  <p className="mt-1 text-sm text-slate-500">{t("departments.form.editDescription")}</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditDraft(null)} aria-label={t("departments.form.close")}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.code")}</span>
                  <Input
                    value={visibleEditDraft.code}
                    onChange={(event) => {
                      setEditDraft({ ...visibleEditDraft, code: event.target.value });
                      setEditFieldErrors((current) => ({ ...current, code: undefined }));
                    }}
                    placeholder={t("departments.form.codePlaceholder")}
                    aria-invalid={editFieldErrors.code ? true : undefined}
                    className={editFieldErrors.code ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.name")}</span>
                  <Input
                    value={visibleEditDraft.name}
                    onChange={(event) => setEditDraft({ ...visibleEditDraft, name: event.target.value })}
                    placeholder={t("departments.form.namePlaceholder")}
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.parent")}</span>
                  <DepartmentTreeSelect
                    departments={parentCandidates()}
                    value={visibleEditDraft.parent_id ?? ""}
                    onChange={(value) => {
                      setEditDraft({ ...visibleEditDraft, parent_id: value || null });
                      setEditFieldErrors((current) => ({ ...current, parent_id: undefined }));
                    }}
                    invalid={Boolean(editFieldErrors.parent_id)}
                  />
                  <span className="text-xs text-slate-500">{t("departments.form.invalidParentHint")}</span>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("departments.form.status")}</span>
                  <DepartmentStatusSelect
                    value={visibleEditDraft.is_active}
                    onChange={(value) => setEditDraft({ ...visibleEditDraft, is_active: value })}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button variant="outline" onClick={() => setEditDraft(null)} disabled={savingDepartment}>
                {t("common.cancel")}
              </Button>
              <Button className="ui-button-link ui-button-link-primary" onClick={saveDepartmentDraft} disabled={savingDepartment}>
                <Save className="h-4 w-4" />
                {savingDepartment ? t("departments.form.saving") : t("departments.form.saveChanges")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {visibleDeleteTarget ? (
        <div
          className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(deleteDialog.visible)}`}
          onMouseDown={() => setDeleteTarget(null)}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(deleteDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{t("departments.personActions.deleteTitle")}</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    {t("departments.personActions.deleteDescription", { name: visibleDeleteTarget.full_name })}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(null)} aria-label={t("departments.personActions.close")}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" onClick={() => deletePerson(visibleDeleteTarget.id)} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
                {deleting ? t("departments.personActions.deleting") : t("departments.personActions.confirmDelete")}
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

function DepartmentTree({
  rootId,
  departments,
  getPersonCount,
  onOpenDepartment,
}: {
  rootId: string;
  departments: Department[];
  getPersonCount: (departmentId: string) => number;
  onOpenDepartment: (department: Department) => void;
}) {
  const t = useTranslations("departments.detail");
  const children = departments.filter((item) => item.parent_id === rootId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(children.map((item) => item.id)));

  if (children.length === 0) {
    return <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">{t("emptyChildren")}</div>;
  }

  return (
    <div className="space-y-2">
      {children.map((item) => (
        <DepartmentTreeNode
          key={item.id}
          department={item}
          departments={departments}
          getPersonCount={getPersonCount}
          depth={0}
          expandedIds={expandedIds}
          onToggle={(departmentId) =>
            setExpandedIds((current) => {
              const next = new Set(current);
              if (next.has(departmentId)) next.delete(departmentId);
              else next.add(departmentId);
              return next;
            })
          }
          onOpenDepartment={onOpenDepartment}
        />
      ))}
    </div>
  );
}

function DepartmentTreeNode({
  department,
  departments,
  getPersonCount,
  depth,
  expandedIds,
  onToggle,
  onOpenDepartment,
}: {
  department: Department;
  departments: Department[];
  getPersonCount: (departmentId: string) => number;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (departmentId: string) => void;
  onOpenDepartment: (department: Department) => void;
}) {
  const t = useTranslations("departments.detail");
  const children = departments.filter((item) => item.parent_id === department.id);
  const hasChildren = children.length > 0;
  const expanded = expandedIds.has(department.id);

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
        style={{ marginLeft: depth * 16 }}
        onDoubleClick={() => onOpenDepartment(department)}
        title={t("doubleClickHint")}
      >
        <button
          type="button"
          disabled={!hasChildren}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(department.id);
          }}
          aria-label={expanded ? t("collapse", { name: department.name }) : t("expand", { name: department.name })}
          className="grid h-5 w-5 place-items-center rounded text-slate-500 hover:bg-slate-200 disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight className={expanded ? "h-4 w-4 rotate-90 transition-transform" : "h-4 w-4 transition-transform"} />
        </button>
        <Building2 className="h-4 w-4 text-slate-500" />
        <span className="font-medium">{department.name}</span>
        <span className="font-mono text-xs text-slate-500">({department.code})</span>
        <span className="ml-auto inline-flex items-center gap-1 text-xs text-slate-500">
          <UserRound className="h-3.5 w-3.5" />
          {getPersonCount(department.id)}
        </span>
      </div>
      {expanded
        ? children.map((child) => (
            <DepartmentTreeNode
              key={child.id}
              department={child}
              departments={departments}
              getPersonCount={getPersonCount}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onOpenDepartment={onOpenDepartment}
            />
          ))
        : null}
    </div>
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

  const rootDepartments = departments.filter(
    (item) => item.parent_id === null || !departments.some((department) => department.id === item.parent_id),
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`ui-filter-trigger ${invalid ? "ui-filter-trigger-invalid" : ""}`}
      >
        <span className="ui-filter-value">{selectedLabel}</span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
      </button>

      {open ? (
        <div className="ui-filter-panel absolute left-0 top-12 z-[80] w-[360px] max-w-[calc(100vw-3rem)]">
          <div className="border-b border-[var(--border)] p-2">
            <div className="ui-filter-search-shell">
              <Search className="ui-filter-search-icon" />
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
              className={
                value === ""
                  ? "ui-filter-option ui-filter-option-active"
                  : "ui-filter-option"
              }
            >
              <Building2 className="h-4 w-4" />
              {t("departments.form.noParent")}
            </button>

            <div className="mt-1 space-y-1">
              {rootDepartments.map((item) => (
                <DepartmentTreeOption
                  key={item.id}
                  department={item}
                  departments={departments}
                  selectedId={value}
                  depth={0}
                  expandedIds={expandedIds}
                  query={normalizedQuery}
                  onToggle={(departmentId) =>
                    setExpandedIds((current) => {
                      const next = new Set(current);
                      if (next.has(departmentId)) next.delete(departmentId);
                      else next.add(departmentId);
                      return next;
                    })
                  }
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options = [true, false];

  useOutsideClick(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="ui-filter-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          <DepartmentStatusBadge active={value} />
        </span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
      </button>

      {open ? (
        <div className="ui-filter-panel absolute left-0 top-12 z-30 w-full p-1">
          {options.map((option) => (
            <button
              key={option ? "active" : "inactive"}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={
                value === option
                  ? "ui-filter-option ui-filter-option-active"
                  : "ui-filter-option"
              }
            >
              <DepartmentStatusBadge active={option} />
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
  const t = useTranslations("departments.detail");
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
          aria-label={expanded ? t("collapse", { name: department.name }) : t("expand", { name: department.name })}
        >
          <ChevronRight className={expanded ? "h-4 w-4 rotate-90 transition-transform" : "h-4 w-4 transition-transform"} />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(department.id)}>
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {department.code} · {department.name}
          </span>
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
