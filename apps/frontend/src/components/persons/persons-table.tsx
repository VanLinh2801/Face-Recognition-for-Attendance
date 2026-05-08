"use client";

import Link from "next/link";
import { Building2, CalendarSearch, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Eye, MoreHorizontal, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { validatePersonProfileFields } from "@/lib/person-validation";
import type { Department, Person } from "@/lib/types";
import { useOutsideClick } from "@/lib/use-outside-click";

type PersonRow = Person & {
  department_name: string;
};

export type EditablePersonStatus = Exclude<Person["status"], "inactive">;
type PersonStatusFilter = "all" | EditablePersonStatus;

type DeleteRequest =
  | {
      type: "single";
      ids: string[];
      title: string;
      description: string;
    }
  | {
      type: "bulk";
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

  const selectedCount = selectedFilteredCount;
  const selectedText = selectedCount === 0 ? "Chưa chọn nhân sự" : `${selectedCount} đã chọn`;

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

  function handleSearchQueryChange(value: string) {
    setSearchQuery(value);
    setCurrentPage(1);
  }

  function handleDepartmentIdChange(value: string) {
    setDepartmentId(value);
    setCurrentPage(1);
  }

  function handleStatusFilterChange(value: PersonStatusFilter) {
    setStatusFilter(value);
    setCurrentPage(1);
  }

  function toggleAll(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const person of paginatedPersons) {
        if (checked) next.add(person.id);
        else next.delete(person.id);
      }
      return next;
    });
  }

  function toggleOne(personId: string, checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(personId);
      } else {
        next.delete(personId);
      }
      return next;
    });
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
        title: "Dữ liệu chưa hợp lệ",
        description: validationError,
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
        departments.find((department) => department.id === updatedPerson.department_id)?.name ?? "No department";

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
      setSavingEdit(false);
    }
  }

  function updateEditingPerson(field: keyof Person, value: string | null) {
    setEditingPerson((current) => {
      if (!current) return current;
      return { ...current, [field]: value };
    });
  }

  function requestDeletePerson(person: PersonRow) {
    setDeleteRequest({
      type: "single",
      ids: [person.id],
      title: "Xóa nhân viên?",
      description: `Bạn có chắc muốn xóa ${person.full_name}? Thao tác này sẽ xóa nhân viên trên backend.`,
    });
    setOpenActionId(null);
  }

  function requestDeleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setDeleteRequest({
      type: "bulk",
      ids,
      title: "Xóa nhân viên đã chọn?",
      description: `Bạn có chắc muốn xóa ${ids.length} nhân viên đã chọn? Thao tác này sẽ xóa dữ liệu trên backend.`,
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
        title: "Xóa thành công",
        description:
          deleteRequest.type === "single"
            ? "Nhân viên đã được xóa khỏi hệ thống."
            : `${deleteRequest.ids.length} nhân viên đã được xóa khỏi hệ thống.`,
        variant: "success",
      });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Không thể xóa nhân viên.";
      showToast({
        title: "Xóa thất bại",
        description: message,
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
            onChange={(event) => handleSearchQueryChange(event.target.value)}
            placeholder="Tìm theo tên hoặc mã nhân viên"
          />
          <StatusFilterSelect value={statusFilter} onChange={handleStatusFilterChange} />
          <DepartmentTreeSelect departments={departments} value={departmentId} onChange={handleDepartmentIdChange} />
          <Button variant="outline" disabled={selectedCount === 0 || deleting} onClick={requestDeleteSelected}>
            <Trash2 className="h-4 w-4" /> Xóa
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
                      aria-label="Chọn tất cả nhân viên"
                      checked={allSelected}
                      onChange={(event) => toggleAll(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </th>
                  <th className="w-12 py-3">STT</th>
                  <th className="w-[18%]">Họ tên</th>
                  <th className="w-[15%]">Phòng ban</th>
                  <th className="w-[15%]">Chức danh</th>
                  <th className="w-[22%]">Liên hệ</th>
                  <th className="w-[11%]">Trạng thái</th>
                  <th className="w-[11%]">Ngày vào</th>
                  <th className="w-14 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPersons.map((person, index) => (
                  <tr key={person.id} className="border-b border-slate-100">
                    <td className="py-3">
                      <input
                        type="checkbox"
                        aria-label={`Chọn ${person.full_name}`}
                        checked={selectedIds.has(person.id)}
                        onChange={(event) => toggleOne(person.id, event.target.checked)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                    </td>
                    <td className="font-mono text-xs text-slate-500">{pageStartIndex + index + 1}</td>
                    <td className="truncate pr-4 font-medium">{person.full_name}</td>
                    <td className="truncate pr-4">{person.department_name}</td>
                    <td className="truncate pr-4">{person.title}</td>
                    <td className="truncate pr-4">
                      <div className="truncate">{person.email}</div>
                      <div className="text-xs text-slate-500">{person.phone}</div>
                    </td>
                    <td><PersonStatusBadge status={person.status} /></td>
                    <td className="truncate">{person.joined_at}</td>
                    <td className="text-right">
                      <div
                        ref={openActionId === person.id ? actionMenuRef : undefined}
                        className="relative inline-flex justify-end"
                      >
                        <Button
                          variant="outline"
                          size="icon"
                          aria-label={`Mở action cho ${person.full_name}`}
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
                              Xem chi tiết
                            </Link>
                            <Link
                              href={`/persons/${person.id}/face-registrations/new`}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                              onClick={() => setOpenActionId(null)}
                            >
                              <Plus className="h-4 w-4" />
                              Thêm face
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
                              Sửa thông tin
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                              onClick={() => requestDeletePerson(person)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Xóa
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
                Không tìm thấy nhân sự phù hợp.
              </div>
            ) : null}
          </div>
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>Hiển thị {pageRangeStart}-{pageRangeEnd}/{filteredPersons.length} nhân sự · {selectedText}</span>
            <div className="flex flex-wrap items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage(1)}
                aria-label="Về trang đầu"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                aria-label="Lùi một trang"
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
                  aria-label={`Đi tới trang ${page}`}
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
                aria-label="Tiến một trang"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={safeCurrentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
                aria-label="Tới trang cuối"
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
                <h2 className="text-lg font-semibold">Sửa thông tin nhân viên</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Chỉ chỉnh thông tin lưu trong bảng persons, không bao gồm face registration.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditingPerson(null)} aria-label="Đóng panel sửa">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-visible p-5">
              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã nhân viên</span>
                  <Input
                    value={visibleEditingPerson.employee_code}
                    disabled
                    className="bg-slate-50 text-slate-500"
                  />
                  <div className="text-xs text-slate-500">Mã nhân viên không được chỉnh sửa từ màn hình này.</div>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Họ tên</span>
                  <Input
                    value={visibleEditingPerson.full_name}
                    onChange={(event) => updateEditingPerson("full_name", event.target.value)}
                  />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Phòng ban</span>
                  <DepartmentTreeSelect
                    departments={departments}
                    value={visibleEditingPerson.department_id ?? ""}
                    onChange={(value) => updateEditingPerson("department_id", value || null)}
                    rootValue=""
                    rootLabel="Chưa chọn phòng ban"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Chức danh</span>
                  <Input
                    value={visibleEditingPerson.title}
                    onChange={(event) => updateEditingPerson("title", event.target.value)}
                  />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <Input
                    type="email"
                    value={visibleEditingPerson.email}
                    onChange={(event) => {
                      updateEditingPerson("email", event.target.value);
                      setEditFieldErrors((current) => ({ ...current, email: undefined }));
                    }}
                    aria-invalid={editFieldErrors.email ? true : undefined}
                    className={editFieldErrors.email ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Điện thoại</span>
                  <Input
                    value={visibleEditingPerson.phone}
                    onChange={(event) => {
                      updateEditingPerson("phone", event.target.value);
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
                    value={visibleEditingPerson.joined_at}
                    onChange={(value) => updateEditingPerson("joined_at", value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <PersonStatusSelect
                    value={visibleEditingPerson.status}
                    onChange={(value) => updateEditingPerson("status", value)}
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú</span>
                <Textarea
                  value={visibleEditingPerson.notes ?? ""}
                  onChange={(event) => updateEditingPerson("notes", event.target.value || null)}
                />
              </label>

            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button variant="outline" onClick={() => setEditingPerson(null)}>Hủy</Button>
              <Button onClick={saveEditingPerson} disabled={savingEdit}>
                <Save className="h-4 w-4" />
                {savingEdit ? "Đang lưu..." : "Lưu thay đổi"}
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
              <Button variant="outline" onClick={() => setDeleteRequest(null)} disabled={deleting}>Hủy</Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
                {deleting ? "Đang xóa..." : "Xác nhận xóa"}
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
              aria-label="Đóng thông báo"
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

export function DatePicker({
  value,
  onChange,
  placement = "bottom",
}: {
  value: string;
  onChange: (value: string) => void;
  placement?: "bottom" | "top";
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
        <div className={placement === "top" ? "absolute bottom-11 left-0 z-[70] w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" : "absolute left-0 top-11 z-[70] w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl"}>
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

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: PersonStatusFilter;
  onChange: (value: PersonStatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options: Array<{ value: PersonStatusFilter; label: string }> = [
    { value: "all", label: "Tất cả" },
    { value: "active", label: "active" },
    { value: "resigned", label: "resigned" },
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
              className={value === option.value ? "flex w-full items-center rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              {option.value === "all" ? (
                <span>Tất cả trạng thái</span>
              ) : (
                <PersonStatusBadge status={option.value} />
              )}
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
  rootLabel = "Tất cả phòng ban",
}: {
  departments: Department[];
  value: string;
  onChange: (value: string) => void;
  rootValue?: string;
  rootLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : rootLabel;
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
                placeholder="Tìm phòng ban"
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
              className={value === rootValue ? "flex w-full items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <Building2 className="h-4 w-4" />
              {rootLabel}
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
