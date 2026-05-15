"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  Building2,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  MoreHorizontal,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { validatePersonProfileFields } from "@/lib/person-validation";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { Department, Person } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";

type PersonRow = Person & {
  department_name: string;
};

export type EditablePersonStatus = Exclude<Person["status"], "inactive">;
type PersonStatusFilter = "all" | EditablePersonStatus;

type DeleteRequest = {
  type: "single" | "bulk";
  ids: string[];
  title: string;
  description: string;
};

type ToastState = {
  title: string;
  description: string;
  variant: "success" | "danger";
} | null;

type EditFieldErrors = {
  email?: string;
  phone?: string;
};

const PAGE_SIZE = 10;

export function PersonsTable({
  persons: initialPersons,
  departments,
}: {
  persons: PersonRow[];
  departments: Department[];
}) {
  const t = useTranslations();
  const [persons, setPersons] = useState<PersonRow[]>(initialPersons);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PersonStatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState<EditFieldErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const editingDialog = useDialogTransition(editingPerson);
  const deleteDialog = useDialogTransition(deleteRequest);
  const visibleEditingPerson = editingDialog.value;
  const visibleDeleteRequest = deleteDialog.value;

  useOutsideClick(actionMenuRef, openActionId !== null, () => setOpenActionId(null));

  const departmentScopeIds = useMemo(() => getDepartmentScopeIds(departmentId, departments), [departmentId, departments]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredPersons = persons.filter((person) => {
    const searchMatches =
      normalizedSearchQuery.length === 0 ||
      person.full_name.toLowerCase().includes(normalizedSearchQuery) ||
      person.employee_code.toLowerCase().includes(normalizedSearchQuery);
    const departmentMatches = !departmentScopeIds || (person.department_id ? departmentScopeIds.has(person.department_id) : false);
    const statusMatches = statusFilter === "all" || person.status === statusFilter;
    return searchMatches && departmentMatches && statusMatches;
  });
  const totalPages = Math.max(1, Math.ceil(filteredPersons.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedPersons = filteredPersons.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const selectedFilteredCount = filteredPersons.filter((person) => selectedIds.has(person.id)).length;
  const allSelected = paginatedPersons.length > 0 && paginatedPersons.every((person) => selectedIds.has(person.id));
  const pageRangeStart = filteredPersons.length === 0 ? 0 : pageStartIndex + 1;
  const pageRangeEnd = Math.min(pageStartIndex + paginatedPersons.length, filteredPersons.length);
  const paginationPages = getVisiblePageNumbers(safeCurrentPage, totalPages);

  const selectedText =
    selectedFilteredCount === 0
      ? t("persons.table.selectedNone")
      : t("persons.table.selectedCount", { count: selectedFilteredCount });

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

  function updateEditingPerson(field: keyof Person, value: string | null) {
    setEditingPerson((current) => (current ? { ...current, [field]: value } : current));
  }

  async function saveEditingPerson() {
    if (!editingPerson) return;

    const validationError = validatePersonProfileFields({
      email: editingPerson.email,
      phone: editingPerson.phone,
      joinedAt: editingPerson.joined_at,
    });
    if (validationError) {
      showToast({
        title: t("persons.toast.invalidTitle"),
        description: translatePersonValidationMessage(validationError, t),
        variant: "danger",
      });
      return;
    }

    setSavingEdit(true);
    setEditFieldErrors({});

    try {
      const updatedPerson = await apiFetch<Person>(`/persons/${editingPerson.id}`, {
        method: "PATCH",
        withAuth: true,
        body: JSON.stringify({
          full_name: editingPerson.full_name.trim(),
          department_id: editingPerson.department_id,
          title: editingPerson.title?.trim() || null,
          email: editingPerson.email?.trim() || null,
          phone: editingPerson.phone?.trim() || null,
          status: editingPerson.status,
          joined_at: editingPerson.joined_at || null,
          notes: editingPerson.notes?.trim() || null,
        }),
      });
      const departmentName =
        departments.find((department) => department.id === updatedPerson.department_id)?.name ?? t("common.notAssigned");

      setPersons((current) =>
        current.map((person) =>
          person.id === updatedPerson.id
            ? {
                ...updatedPerson,
                department_name: departmentName,
              }
            : person,
        ),
      );
      setEditingPerson(null);
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
        description:
          duplicateField === "email"
            ? t("persons.messages.duplicateEmail")
            : duplicateField === "phone"
              ? t("persons.messages.duplicatePhone")
              : getTranslatedBackendError(t, err, "persons"),
        variant: "danger",
      });
    } finally {
      setSavingEdit(false);
    }
  }

  function requestDeletePerson(person: PersonRow) {
    setDeleteRequest({
      type: "single",
      ids: [person.id],
      title: t("persons.deleteDialog.singleTitle"),
      description: t("persons.deleteDialog.singleDescription", { name: person.full_name }),
    });
    setOpenActionId(null);
  }

  function requestDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleteRequest({
      type: "bulk",
      ids,
      title: t("persons.deleteDialog.bulkTitle"),
      description: t("persons.deleteDialog.bulkDescription", { count: ids.length }),
    });
  }

  async function confirmDelete() {
    if (!deleteRequest) return;
    setDeleting(true);

    try {
      if (deleteRequest.type === "single") {
        await apiFetch<void>(`/persons/${deleteRequest.ids[0]}`, {
          method: "DELETE",
          withAuth: true,
        });
      } else {
        await apiFetch<{ deleted_count: number }>("/persons/bulk-delete", {
          method: "POST",
          withAuth: true,
          body: JSON.stringify({ person_ids: deleteRequest.ids }),
        });
      }

      const ids = new Set(deleteRequest.ids);
      const nextPersons = persons.filter((person) => !ids.has(person.id));
      const nextFilteredPersons = nextPersons.filter((person) => {
        const searchMatches =
          normalizedSearchQuery.length === 0 ||
          person.full_name.toLowerCase().includes(normalizedSearchQuery) ||
          person.employee_code.toLowerCase().includes(normalizedSearchQuery);
        const departmentMatches = !departmentScopeIds || (person.department_id ? departmentScopeIds.has(person.department_id) : false);
        const statusMatches = statusFilter === "all" || person.status === statusFilter;
        return searchMatches && departmentMatches && statusMatches;
      });
      const nextTotalPages = Math.max(1, Math.ceil(nextFilteredPersons.length / PAGE_SIZE));

      setPersons(nextPersons);
      setCurrentPage((page) => Math.min(page, nextTotalPages));
      setSelectedIds((current) => {
        const next = new Set(current);
        for (const id of ids) {
          next.delete(id);
        }
        return next;
      });
      setDeleteRequest(null);
      showToast({
        title: t("persons.toast.deleteSuccessTitle"),
        description:
          deleteRequest.type === "single"
            ? t("persons.toast.deleteSingleSuccessDescription")
            : t("persons.toast.deleteBulkSuccessDescription", { count: deleteRequest.ids.length }),
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: t("persons.toast.deleteFailedTitle"),
        description: getTranslatedBackendError(t, err, "persons"),
        variant: "danger",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(240px,0.78fr)_220px_280px_auto]">
          <Input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder={t("persons.table.searchPlaceholder")}
          />
          <StatusFilterSelect
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
          />
          <DepartmentTreeSelect
            departments={departments}
            value={departmentId}
            onChange={(value) => {
              setDepartmentId(value);
              setCurrentPage(1);
            }}
            rootValue="all"
            rootLabel={t("persons.table.allDepartments")}
          />
          <Button variant="outline" disabled={selectedFilteredCount === 0 || deleting} onClick={requestDeleteSelected}>
            <Trash2 className="h-4 w-4" />
            {t("persons.table.bulkDelete")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="overflow-visible">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-9 py-3">
                    <input
                      type="checkbox"
                      aria-label={t("persons.table.selectAll")}
                      checked={allSelected}
                      onChange={(event) => toggleAllSelection(paginatedPersons, setSelectedIds, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="w-12 py-3">{t("persons.table.index")}</th>
                  <th className="w-[18%]">{t("persons.table.fullName")}</th>
                  <th className="w-[15%]">{t("persons.table.department")}</th>
                  <th className="w-[15%]">{t("persons.table.title")}</th>
                  <th className="w-[22%]">{t("persons.table.contact")}</th>
                  <th className="w-[11%]">{t("persons.table.status")}</th>
                  <th className="w-[11%]">{t("persons.table.joinedAt")}</th>
                  <th className="w-14 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPersons.map((person, index) => (
                  <tr key={person.id} className="border-b border-slate-100">
                    <td className="py-3">
                      <input
                        type="checkbox"
                        aria-label={t("persons.table.selectOne", { name: person.full_name })}
                        checked={selectedIds.has(person.id)}
                        onChange={(event) => toggleSingleSelection(setSelectedIds, person.id, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="font-mono text-xs text-slate-500">{pageStartIndex + index + 1}</td>
                    <td className="truncate pr-4 font-medium">{person.full_name}</td>
                    <td className="truncate pr-4">{person.department_name || t("common.notAssigned")}</td>
                    <td className="truncate pr-4">{person.title || t("common.unknown")}</td>
                    <td className="truncate pr-4">
                      <div className="truncate">{person.email || t("common.unknown")}</div>
                      <div className="text-xs text-slate-500">{person.phone || t("common.unknown")}</div>
                    </td>
                    <td>
                      <PersonStatusBadge status={person.status} />
                    </td>
                    <td className="truncate">{person.joined_at}</td>
                    <td className="text-right">
                      <div ref={openActionId === person.id ? actionMenuRef : undefined} className="relative inline-flex justify-end">
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={t("persons.table.openActions", { name: person.full_name })}
                          onClick={() => setOpenActionId((current) => (current === person.id ? null : person.id))}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                        {openActionId === person.id ? (
                          <div className="absolute right-0 top-10 z-20 w-44 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-left shadow-lg">
                            <Link
                              href={`/persons/${person.id}`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId(null)}
                            >
                              <Eye className="h-4 w-4" />
                              {t("persons.table.viewDetails")}
                            </Link>
                            <Link
                              href={`/persons/${person.id}/face-registrations/new`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId(null)}
                            >
                              <Plus className="h-4 w-4" />
                              {t("persons.table.addFace")}
                            </Link>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => {
                                setEditingPerson(person);
                                setEditFieldErrors({});
                                setOpenActionId(null);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              {t("persons.table.edit")}
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                              onClick={() => requestDeletePerson(person)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {t("persons.table.delete")}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredPersons.length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                {t("persons.table.empty")}
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>
              {t("persons.table.showing", {
                from: pageRangeStart,
                to: pageRangeEnd,
                total: filteredPersons.length,
                selected: selectedText,
              })}
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                aria-label={t("persons.table.firstPage")}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                aria-label={t("persons.table.previousPage")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {paginationPages.map((page) => (
                <Button
                  key={page}
                  variant={page === safeCurrentPage ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setCurrentPage(page)}
                  aria-label={t("persons.table.goToPage", { page })}
                  aria-current={page === safeCurrentPage ? "page" : undefined}
                >
                  {page}
                </Button>
              ))}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                aria-label={t("persons.table.nextPage")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                aria-label={t("persons.table.lastPage")}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {visibleEditingPerson ? (
        <div
          className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(editingDialog.visible)}`}
          onMouseDown={() => setEditingPerson(null)}
        >
          <div
            className={`flex max-h-[90vh] w-full max-w-3xl flex-col overflow-visible rounded-lg bg-white shadow-2xl ${dialogPanelClass(editingDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold">{t("persons.editDialog.title")}</h2>
                <p className="mt-1 text-sm text-slate-500">{t("persons.editDialog.description")}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingPerson(null)} aria-label={t("persons.editDialog.close")}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-visible p-5">
              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.employeeCode")}</span>
                  <Input value={visibleEditingPerson.employee_code} disabled className="bg-slate-50 text-slate-500" />
                  <div className="text-xs text-slate-500">{t("persons.editDialog.employeeCodeHint")}</div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.fullName")}</span>
                  <Input value={visibleEditingPerson.full_name} onChange={(event) => updateEditingPerson("full_name", event.target.value)} />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.department")}</span>
                  <DepartmentTreeSelect
                    departments={departments}
                    value={visibleEditingPerson.department_id ?? ""}
                    onChange={(value) => updateEditingPerson("department_id", value || null)}
                    rootValue=""
                    rootLabel={t("persons.table.noDepartmentSelected")}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.title")}</span>
                  <Input value={visibleEditingPerson.title ?? ""} onChange={(event) => updateEditingPerson("title", event.target.value)} />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.email")}</span>
                  <Input
                    type="email"
                    value={visibleEditingPerson.email ?? ""}
                    onChange={(event) => {
                      updateEditingPerson("email", event.target.value);
                      setEditFieldErrors((current) => ({ ...current, email: undefined }));
                    }}
                    aria-invalid={editFieldErrors.email ? true : undefined}
                    className={editFieldErrors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {editFieldErrors.email ? <div className="text-xs text-red-600">{editFieldErrors.email}</div> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.phone")}</span>
                  <Input
                    value={visibleEditingPerson.phone ?? ""}
                    onChange={(event) => {
                      updateEditingPerson("phone", event.target.value);
                      setEditFieldErrors((current) => ({ ...current, phone: undefined }));
                    }}
                    aria-invalid={editFieldErrors.phone ? true : undefined}
                    className={editFieldErrors.phone ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {editFieldErrors.phone ? <div className="text-xs text-red-600">{editFieldErrors.phone}</div> : null}
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.editDialog.joinedAt")}</span>
                  <DatePicker value={visibleEditingPerson.joined_at} onChange={(value) => updateEditingPerson("joined_at", value)} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">{t("persons.table.status")}</span>
                  <PersonStatusSelect value={visibleEditingPerson.status} onChange={(value) => updateEditingPerson("status", value)} />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">{t("persons.editDialog.notes")}</span>
                <Textarea value={visibleEditingPerson.notes ?? ""} onChange={(event) => updateEditingPerson("notes", event.target.value || null)} />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button variant="outline" onClick={() => setEditingPerson(null)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={saveEditingPerson} disabled={savingEdit}>
                <Save className="h-4 w-4" />
                {savingEdit ? t("persons.editDialog.saving") : t("persons.editDialog.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {visibleDeleteRequest ? (
        <div
          className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(deleteDialog.visible)}`}
          onMouseDown={() => setDeleteRequest(null)}
        >
          <div
            className={`w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(deleteDialog.visible)}`}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{visibleDeleteRequest.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{visibleDeleteRequest.description}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setDeleteRequest(null)} disabled={deleting}>
                {t("common.cancel")}
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
                {deleting ? t("persons.deleteDialog.deleting") : t("persons.deleteDialog.confirm")}
              </Button>
            </div>
          </div>
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
              aria-label={t("persons.toast.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
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

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5;
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const halfWindow = Math.floor(maxVisiblePages / 2);
  let startPage = currentPage - halfWindow;
  let endPage = currentPage + halfWindow;

  if (startPage < 1) {
    startPage = 1;
    endPage = maxVisiblePages;
  } else if (endPage > totalPages) {
    endPage = totalPages;
    startPage = totalPages - maxVisiblePages + 1;
  }

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
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

function translatePersonValidationMessage(message: string, t: ReturnType<typeof useTranslations>) {
  const normalized = message.toLowerCase();
  if (normalized.includes("email")) {
    return t("persons.validation.invalidEmail");
  }
  if (normalized.includes("dien thoai") || normalized.includes("phone")) {
    return t("persons.validation.invalidPhone");
  }
  if (normalized.includes("ngay vao lam") || normalized.includes("joined")) {
    return t("persons.validation.futureJoinedAt");
  }
  return message;
}

function toggleAllSelection(
  paginatedPersons: PersonRow[],
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  checked: boolean,
) {
  setSelectedIds((current) => {
    const next = new Set(current);
    for (const person of paginatedPersons) {
      if (checked) next.add(person.id);
      else next.delete(person.id);
    }
    return next;
  });
}

function toggleSingleSelection(
  setSelectedIds: React.Dispatch<React.SetStateAction<Set<string>>>,
  personId: string,
  checked: boolean,
) {
  setSelectedIds((current) => {
    const next = new Set(current);
    if (checked) next.add(personId);
    else next.delete(personId);
    return next;
  });
}

export function DatePicker({
  value,
  onChange,
  placement = "bottom",
}: {
  value: string;
  onChange: (value: string) => void;
  placement?: "bottom" | "top";
}) {
  const t = useTranslations("persons.datePicker");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));
  const selectedDate = parseDate(value);
  const days = calendarDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  useOutsideClick(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarSearch className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate font-medium text-slate-800">{formatDateLabel(value, locale)}</span>
        </span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div
          className={
            placement === "top"
              ? "absolute bottom-11 left-0 z-[70] w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
              : "absolute left-0 top-11 z-[70] w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"
          }
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1)))}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={t("previousMonth")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold capitalize text-slate-950">{monthLabel}</div>
            <button
              type="button"
              onClick={() => setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1)))}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label={t("nextMonth")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase text-slate-400">
              {weekdayKeys.map((day) => (
                <div key={day}>{t(`weekdays.${day}`)}</div>
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

function formatDateLabel(value: string, locale: string) {
  return parseDate(value).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function PersonStatusSelect({
  value,
  onChange,
}: {
  value: Person["status"];
  onChange: (value: EditablePersonStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options: EditablePersonStatus[] = ["active", "resigned"];

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
              className={
                value === option
                  ? "flex w-full items-center rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white"
                  : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
              }
            >
              <PersonStatusBadge status={option} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: PersonStatusFilter;
  onChange: (value: PersonStatusFilter) => void;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options: Array<{ value: PersonStatusFilter; label: string }> = [
    { value: "all", label: t("persons.table.allStatuses") },
    { value: "active", label: t("common.status.active") },
    { value: "resigned", label: t("common.status.resigned") },
  ];
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useOutsideClick(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption.value === "all" ? (
            <span className="truncate font-medium text-slate-700">{selectedOption.label}</span>
          ) : (
            <PersonStatusBadge status={selectedOption.value} />
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
              className={
                value === option.value
                  ? "flex w-full items-center rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white"
                  : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
              }
            >
              {option.value === "all" ? <span>{t("persons.table.allStatuses")}</span> : <PersonStatusBadge status={option.value} />}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DepartmentTreeSelect({
  departments,
  value,
  onChange,
  rootValue = "all",
  rootLabel,
}: {
  departments: Department[];
  value: string;
  onChange: (value: string) => void;
  rootValue?: string;
  rootLabel?: string;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const fallbackRootLabel = rootLabel ?? t("persons.table.allDepartments");
  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : fallbackRootLabel;
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
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("persons.table.departmentSearchPlaceholder")}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm focus:border-transparent focus:ring-0"
              />
            </div>
          </div>

          <div className="thin-scrollbar max-h-80 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange(rootValue);
                setOpen(false);
              }}
              className={
                value === rootValue
                  ? "flex w-full items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white"
                  : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"
              }
            >
              <Building2 className="h-4 w-4" />
              {fallbackRootLabel}
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
            ? "flex items-center gap-2 rounded-md bg-slate-950 px-2 py-2 text-sm font-medium text-white"
            : "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50"
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
