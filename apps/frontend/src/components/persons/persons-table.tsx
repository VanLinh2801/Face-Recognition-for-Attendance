"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { createPortal } from "react-dom";
import {
  Building2,
  CalendarSearch,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
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
import { ListTableAccent } from "@/components/data/list-table-accent";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { useTheme } from "@/components/theme/theme-provider";
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
type SortKey = "full_name" | "employee_code" | "department_name" | "title" | "status" | "joined_at";
type SortDirection = "asc" | "desc";
type SortState = {
  key: SortKey;
  direction: SortDirection;
};

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

type ActionMenuPosition = {
  top: number;
  left: number;
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
  const locale = useLocale();
  const { theme } = useTheme();
  const [persons, setPersons] = useState<PersonRow[]>(initialPersons);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingPerson, setEditingPerson] = useState<PersonRow | null>(null);
  const [openActionId, setOpenActionId] = useState<string | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<DeleteRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [departmentId, setDepartmentId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PersonStatusFilter>("all");
  const [sort, setSort] = useState<SortState>({ key: "full_name", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editFieldErrors, setEditFieldErrors] = useState<EditFieldErrors>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [actionMenuPosition, setActionMenuPosition] = useState<ActionMenuPosition | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const editingDialog = useDialogTransition(editingPerson);
  const deleteDialog = useDialogTransition(deleteRequest);
  const visibleEditingPerson = editingDialog.value;
  const visibleDeleteRequest = deleteDialog.value;

  const departmentScopeIds = useMemo(() => getDepartmentScopeIds(departmentId, departments), [departmentId, departments]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredPersons = useMemo(
    () =>
      persons.filter((person) => {
        const searchMatches =
          normalizedSearchQuery.length === 0 ||
          person.full_name.toLowerCase().includes(normalizedSearchQuery) ||
          person.employee_code.toLowerCase().includes(normalizedSearchQuery);
        const departmentMatches = !departmentScopeIds || (person.department_id ? departmentScopeIds.has(person.department_id) : false);
        const statusMatches = statusFilter === "all" || person.status === statusFilter;
        return searchMatches && departmentMatches && statusMatches;
      }),
    [departmentScopeIds, normalizedSearchQuery, persons, statusFilter],
  );
  const sortedPersons = useMemo(() => {
    const nextPersons = [...filteredPersons];
    nextPersons.sort((left, right) => comparePersons(left, right, sort, locale));
    return nextPersons;
  }, [filteredPersons, locale, sort]);
  const totalPages = Math.max(1, Math.ceil(sortedPersons.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const paginatedPersons = sortedPersons.slice(pageStartIndex, pageStartIndex + PAGE_SIZE);
  const selectedFilteredCount = filteredPersons.filter((person) => selectedIds.has(person.id)).length;
  const allSelected = paginatedPersons.length > 0 && paginatedPersons.every((person) => selectedIds.has(person.id));
  const pageRangeStart = sortedPersons.length === 0 ? 0 : pageStartIndex + 1;
  const pageRangeEnd = Math.min(pageStartIndex + paginatedPersons.length, sortedPersons.length);
  const paginationPages = getVisiblePageNumbers(safeCurrentPage, totalPages);

  const selectedText =
    selectedFilteredCount === 0
      ? t("persons.table.selectedNone")
      : t("persons.table.selectedCount", { count: selectedFilteredCount });
  const openActionPerson = openActionId ? paginatedPersons.find((person) => person.id === openActionId) ?? null : null;

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), 3500);
    const removeTimer = window.setTimeout(() => setToast(null), 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  useEffect(() => {
    const currentId = openActionId;
    if (!currentId) {
      setActionMenuPosition(null);
      setActionMenuVisible(false);
      return;
    }

    function updateActionMenuPosition() {
      if (!currentId) return;
      const trigger = actionButtonRefs.current[currentId];
      if (!trigger) {
        setActionMenuPosition(null);
        return;
      }

      const rect = trigger.getBoundingClientRect();
      const menuWidth = 176;
      const margin = 8;
      const nextLeft = Math.min(
        Math.max(margin, rect.right + window.scrollX - menuWidth),
        window.scrollX + window.innerWidth - menuWidth - margin,
      );

      setActionMenuPosition({
        top: rect.bottom + window.scrollY + 8,
        left: nextLeft,
      });
    }

    function handlePointerDown(event: PointerEvent) {
      if (!currentId) return;
      const menu = actionMenuRef.current;
      const trigger = actionButtonRefs.current[currentId];
      const target = event.target as Node;
      if (menu?.contains(target) || trigger?.contains(target)) return;
      setOpenActionId(null);
    }

    updateActionMenuPosition();
    const frame = window.requestAnimationFrame(() => setActionMenuVisible(true));
    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", updateActionMenuPosition);
    window.addEventListener("scroll", updateActionMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", updateActionMenuPosition);
      window.removeEventListener("scroll", updateActionMenuPosition, true);
    };
  }, [openActionId]);

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

  function updateSort(nextKey: SortKey) {
    setSort((current) => ({
      key: nextKey,
      direction: current.key === nextKey && current.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
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
      <Card
        className={
          theme === "dark"
            ? "relative z-20 border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
            : "relative z-20 border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl"
        }
      >
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
          <Button variant="danger" disabled={selectedFilteredCount === 0 || deleting} onClick={requestDeleteSelected}>
            <Trash2 className="h-4 w-4" />
            {t("persons.table.bulkDelete")}
          </Button>
        </CardContent>
      </Card>

      <Card className="relative z-10 list-table-corner-accent list-table-corner-accent-open">
        <ListTableAccent />
        <CardContent>
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full min-w-[1160px] table-fixed text-left text-sm">
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
                  <SortableHeader
                    className="w-[16%]"
                    label={formatColumnLabel(t("persons.table.fullName"), locale)}
                    sortKey="full_name"
                    sort={sort}
                    onSort={updateSort}
                    t={t}
                  />
                  <SortableHeader
                    className="w-[11%]"
                    label={formatColumnLabel(t("persons.table.employeeCode"), locale)}
                    sortKey="employee_code"
                    sort={sort}
                    onSort={updateSort}
                    t={t}
                  />
                  <SortableHeader
                    className="w-[16%]"
                    label={formatColumnLabel(t("persons.table.department"), locale)}
                    sortKey="department_name"
                    sort={sort}
                    onSort={updateSort}
                    t={t}
                  />
                  <SortableHeader
                    className="w-[14%]"
                    label={formatColumnLabel(t("persons.table.title"), locale)}
                    sortKey="title"
                    sort={sort}
                    onSort={updateSort}
                    t={t}
                  />
                  <th className="w-[18%] whitespace-nowrap py-3">{formatColumnLabel(t("persons.table.contact"), locale)}</th>
                  <SortableHeader
                    className="w-[12%]"
                    label={formatColumnLabel(t("persons.table.status"), locale)}
                    sortKey="status"
                    sort={sort}
                    onSort={updateSort}
                    t={t}
                  />
                  <SortableHeader
                    className="w-[9%]"
                    label={formatColumnLabel(t("persons.table.joinedAt"), locale)}
                    sortKey="joined_at"
                    sort={sort}
                    onSort={updateSort}
                    t={t}
                  />
                  <th className="w-24 whitespace-nowrap py-3 text-right">{formatColumnLabel(t("common.actions"), locale)}</th>
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
                    <td className="truncate pr-5 font-medium">{person.full_name}</td>
                    <td className="truncate pr-5 font-mono text-xs text-slate-500">{person.employee_code}</td>
                    <td className="truncate pr-5">{person.department_name || t("common.notAssigned")}</td>
                    <td className="truncate pr-5">{person.title || t("common.unknown")}</td>
                    <td className="truncate pr-5">
                      <div className="truncate">{person.email || t("common.unknown")}</div>
                      <div className="text-xs text-slate-500">{person.phone || t("common.unknown")}</div>
                    </td>
                    <td className="pr-4">
                      <PersonStatusBadge status={person.status} />
                    </td>
                    <td className="truncate pr-4">{person.joined_at}</td>
                    <td className="text-right">
                      <div className="inline-flex justify-end">
                        <Button
                          variant="outline"
                          size="icon"
                          ref={(element) => {
                            actionButtonRefs.current[person.id] = element;
                          }}
                          aria-label={t("persons.table.openActions", { name: person.full_name })}
                          onClick={() => setOpenActionId((current) => (current === person.id ? null : person.id))}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
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

      {openActionPerson && actionMenuPosition
        ? createPortal(
            <div
              ref={actionMenuRef}
              className={`fixed z-[80] w-44 overflow-hidden rounded-md border border-[var(--border)] bg-[var(--background-elevated)] py-1 text-left shadow-lg transition-all duration-150 ease-out ${
                actionMenuVisible ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-[0.98] opacity-0"
              }`}
              style={{ top: actionMenuPosition.top, left: actionMenuPosition.left }}
            >
              <Link
                href={`/persons/${openActionPerson.id}`}
                className={`flex w-full items-center gap-3 px-3 py-2 text-[15px] font-semibold leading-6 text-[var(--foreground-soft)] transition-all duration-150 ease-out hover:bg-[var(--background-panel)] hover:text-[var(--foreground)] ${
                  actionMenuVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
                style={{ transitionDelay: actionMenuVisible ? "20ms" : "0ms" }}
                onClick={() => setOpenActionId(null)}
              >
                <Eye className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{t("persons.table.viewDetails")}</span>
              </Link>
              <Link
                href={`/persons/${openActionPerson.id}/face-registrations/new`}
                className={`flex w-full items-center gap-3 px-3 py-2 text-[15px] font-semibold leading-6 text-[var(--foreground-soft)] transition-all duration-150 ease-out hover:bg-[var(--background-panel)] hover:text-[var(--foreground)] ${
                  actionMenuVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
                style={{ transitionDelay: actionMenuVisible ? "40ms" : "0ms" }}
                onClick={() => setOpenActionId(null)}
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{t("persons.table.addFace")}</span>
              </Link>
              <button
                type="button"
                className={`flex w-full items-center gap-3 bg-transparent px-3 py-2 text-left text-[15px] font-semibold leading-6 text-[var(--foreground-soft)] transition-all duration-150 ease-out hover:bg-[var(--background-panel)] hover:text-[var(--foreground)] ${
                  actionMenuVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
                style={{ transitionDelay: actionMenuVisible ? "60ms" : "0ms" }}
                onClick={() => {
                  setEditingPerson(openActionPerson);
                  setEditFieldErrors({});
                  setOpenActionId(null);
                }}
              >
                <Pencil className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{t("persons.table.edit")}</span>
              </button>
              <button
                type="button"
                className={`flex w-full items-center gap-3 bg-transparent px-3 py-2 text-left text-[15px] font-semibold leading-6 text-[var(--danger)] transition-all duration-150 ease-out hover:bg-[var(--danger-soft)] ${
                  actionMenuVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                }`}
                style={{ transitionDelay: actionMenuVisible ? "80ms" : "0ms" }}
                onClick={() => requestDeletePerson(openActionPerson)}
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="font-semibold">{t("persons.table.delete")}</span>
              </button>
            </div>,
            document.body,
          )
        : null}

      {visibleEditingPerson ? (
        <div
          className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(editingDialog.visible)}`}
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
              <Button className="ui-button-link ui-button-link-primary" onClick={saveEditingPerson} disabled={savingEdit}>
                <Save className="h-4 w-4" />
                {savingEdit ? t("persons.editDialog.saving") : t("persons.editDialog.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {visibleDeleteRequest ? (
        <div
          className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(deleteDialog.visible)}`}
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

function SortableHeader({
  className,
  label,
  sortKey,
  sort,
  onSort,
  t,
}: {
  className?: string;
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (sortKey: SortKey) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const active = sort.key === sortKey;
  const nextDirection = active && sort.direction === "asc" ? "desc" : "asc";
  const ariaSort = active ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
  const ariaLabel =
    nextDirection === "asc"
      ? t("persons.table.sortAscending", { column: label })
      : t("persons.table.sortDescending", { column: label });

  return (
    <th className={className} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={ariaLabel}
        title={ariaLabel}
        className="flex w-full items-center gap-1 py-3 text-left transition hover:text-slate-700"
      >
        <span className="truncate">{label}</span>
        {active ? (
          sort.direction === "asc" ? (
            <ChevronUp className="h-4 w-4 shrink-0 text-slate-700" />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0 text-slate-700" />
          )
        ) : null}
      </button>
    </th>
  );
}

function formatColumnLabel(label: string, locale: string) {
  return label.toLocaleUpperCase(locale);
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

const PERSON_STATUS_SORT_ORDER: Record<Person["status"], number> = {
  active: 0,
  resigned: 1,
  inactive: 2,
};

function comparePersons(left: PersonRow, right: PersonRow, sort: SortState, locale: string) {
  const result = compareBySortKey(left, right, sort.key, sort.direction, locale);
  if (result !== 0) return result;

  const nameResult = compareNullableText(left.full_name, right.full_name, "asc", locale);
  if (nameResult !== 0) return nameResult;

  return left.id.localeCompare(right.id, locale);
}

function compareBySortKey(left: PersonRow, right: PersonRow, key: SortKey, direction: SortDirection, locale: string) {
  switch (key) {
    case "full_name":
      return compareNullableText(left.full_name, right.full_name, direction, locale);
    case "employee_code":
      return compareNullableText(left.employee_code, right.employee_code, direction, locale);
    case "department_name":
      return compareNullableText(left.department_name, right.department_name, direction, locale);
    case "title":
      return compareNullableText(left.title, right.title, direction, locale);
    case "status":
      return compareStatus(left.status, right.status, direction);
    case "joined_at":
      return compareNullableDate(left.joined_at, right.joined_at, direction);
    default:
      return 0;
  }
}

function compareNullableText(left: string | null | undefined, right: string | null | undefined, direction: SortDirection, locale: string) {
  const normalizedLeft = normalizeSortableText(left);
  const normalizedRight = normalizeSortableText(right);
  if (!normalizedLeft && !normalizedRight) return 0;
  if (!normalizedLeft) return 1;
  if (!normalizedRight) return -1;

  const result = normalizedLeft.localeCompare(normalizedRight, locale, { sensitivity: "base" });
  return direction === "asc" ? result : -result;
}

function compareNullableDate(left: string | null | undefined, right: string | null | undefined, direction: SortDirection) {
  const leftTime = toSortableTimestamp(left);
  const rightTime = toSortableTimestamp(right);
  if (leftTime == null && rightTime == null) return 0;
  if (leftTime == null) return 1;
  if (rightTime == null) return -1;

  const result = leftTime - rightTime;
  return direction === "asc" ? result : -result;
}

function compareStatus(left: Person["status"], right: Person["status"], direction: SortDirection) {
  const result = PERSON_STATUS_SORT_ORDER[left] - PERSON_STATUS_SORT_ORDER[right];
  return direction === "asc" ? result : -result;
}

function normalizeSortableText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function toSortableTimestamp(value: string | null | undefined) {
  const normalized = normalizeSortableText(value);
  if (!normalized) return null;

  const timestamp = Date.parse(normalized);
  return Number.isNaN(timestamp) ? null : timestamp;
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
        className="ui-filter-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarSearch className="ui-filter-search-icon shrink-0" />
          <span className="ui-filter-value">{formatDateLabel(value, locale)}</span>
        </span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
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
        className="ui-filter-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PersonStatusBadge status={value} />
        </span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
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
                  ? "ui-filter-option ui-filter-option-active"
                  : "ui-filter-option"
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
        className="ui-filter-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selectedOption.value === "all" ? (
            <span className="ui-filter-value">{selectedOption.label}</span>
          ) : (
            <PersonStatusBadge status={selectedOption.value} />
          )}
        </span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
      </button>

      {open ? (
        <div className="ui-filter-panel absolute left-0 top-12 z-30 w-full p-1.5">
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
                  ? "ui-filter-option ui-filter-option-active"
                  : "ui-filter-option"
              }
            >
              {option.value === "all" ? <span className="ui-filter-value">{t("persons.table.allStatuses")}</span> : <PersonStatusBadge status={option.value} />}
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
                placeholder={t("persons.table.departmentSearchPlaceholder")}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm text-[var(--foreground)] focus:border-transparent focus:ring-0"
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
                  ? "ui-filter-option ui-filter-option-active"
                  : "ui-filter-option"
              }
            >
              <Building2 className="h-4 w-4 text-[var(--foreground-soft)]" />
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
          className="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-[var(--background-panel)] disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label={expanded ? t("collapse", { name: department.name }) : t("expand", { name: department.name })}
        >
          <ChevronRight
            className={
              expanded
                ? "h-4 w-4 rotate-90 text-[var(--foreground-soft)] transition-transform"
                : "h-4 w-4 text-[var(--foreground-soft)] transition-transform"
            }
          />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(department.id)}>
          <Building2 className="h-4 w-4 shrink-0 text-[var(--foreground-soft)]" />
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
