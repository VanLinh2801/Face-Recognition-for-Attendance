"use client";

import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Eye, MoreHorizontal, Pencil, Save, Search, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
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

export function DepartmentDetailView({
  department,
  departments,
  persons,
  onDepartmentUpdated,
}: {
  department: Department;
  departments: Department[];
  persons: Array<Person & { department_name: string }>;
  onDepartmentUpdated: (department: Department) => void;
}) {
  const router = useRouter();
  const [deletedPersonIds, setDeletedPersonIds] = useState<Set<string>>(new Set());
  const [openPersonActionId, setOpenPersonActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(Person & { department_name: string }) | null>(null);
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
    if (!id) return "Không trực thuộc";
    return departments.find((item) => item.id === id)?.name ?? "Không xác định";
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
    return departmentPeople.filter((person) => person.department_id ? departmentIds.has(person.department_id) : false);
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
        code: !code ? "Mã phòng ban không được để trống." : undefined,
      });
      showToast({
        title: "Dữ liệu chưa hợp lệ",
        description: !code ? "Mã phòng ban không được để trống." : "Tên phòng ban không được để trống.",
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
        title: "Cập nhật thành công",
        description: `Phòng ban ${updatedDepartment.name} đã được cập nhật.`,
        variant: "success",
      });
    } catch (err) {
      setEditFieldErrors(getDepartmentFieldErrors(err));
      showToast({
        title: "Cập nhật thất bại",
        description: getDepartmentErrorMessage(err),
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
        title: "Xóa nhân viên thành công",
        description: "Nhân viên đã được ẩn khỏi danh sách hiện tại.",
        variant: "success",
      });
    } catch (err) {
      showToast({
        title: "Xóa nhân viên thất bại",
        description: err instanceof ApiError ? err.message : "Không thể xóa nhân viên. Vui lòng thử lại.",
        variant: "danger",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Thông tin phòng ban</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><span className="text-slate-500">Mã</span><span className="font-mono text-xs">{department.code}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Tên</span><span className="font-medium">{department.name}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Trực thuộc</span><span>{getDepartmentName(department.parent_id)}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Trạng thái</span><Badge variant={department.is_active ? "success" : "default"}>{department.is_active ? "active" : "inactive"}</Badge></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Phòng ban con</span><span>{childDepartments(department.id).length}</span></div>
            <div className="flex justify-between gap-3"><span className="text-slate-500">Nhân viên</span><span>{departmentTreePersons(department.id).length}</span></div>
            <Button variant="outline" className="mt-2 w-full" onClick={openEditDialog}>
              <Pencil className="h-4 w-4" />
              Sửa phòng ban
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cây trực thuộc</CardTitle></CardHeader>
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

      <Card>
        <CardHeader><CardTitle>Nhân viên thuộc phòng ban và cấp dưới</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-visible">
                    <table className="w-full table-fixed text-left text-sm">
                      <thead className="text-xs uppercase text-slate-500">
                        <tr className="border-b border-slate-200"><th className="w-12 py-3">STT</th><th>Nhân viên</th><th className="w-[24%]">Phòng ban</th><th className="w-[18%]">Chức danh</th><th className="w-24">Trạng thái</th><th className="w-16 text-right">Action</th></tr>
                      </thead>
                      <tbody>
                        {departmentTreePersons(department.id).map((person, index) => (
                  <tr key={person.id} className="border-b border-slate-100">
                    <td className="py-3 font-mono text-xs text-slate-500">{index + 1}</td>
                            <td className="min-w-0 pr-3">
                              <div className="truncate font-medium">{person.full_name}</div>
                              <div className="truncate text-xs text-slate-500">{person.email}</div>
                              <div className="truncate text-xs text-slate-500">{person.phone}</div>
                            </td>
                            <td className="truncate pr-4">{person.department_name}</td>
                            <td className="truncate pr-4">{person.title}</td>
                            <td><Badge variant={person.status === "active" ? "success" : "default"}>{person.status}</Badge></td>
                            <td className="text-right">
                              <div
                                ref={openPersonActionId === person.id ? personActionMenuRef : undefined}
                                className="relative inline-flex justify-end"
                              >
                                <Button
                                  variant="outline"
                                  size="icon"
                                  aria-label={`Mở action cho ${person.full_name}`}
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
                                      Xem chi tiết
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
            {departmentTreePersons(department.id).length === 0 ? (
              <div className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Chưa có nhân viên thuộc phòng ban này hoặc các phòng ban cấp dưới.
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
      </div>

      {visibleEditDraft ? (
        <div
          className={`fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(editDialog.visible)}`}
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
                  <h2 className="text-lg font-semibold">Sửa phòng ban</h2>
                  <p className="mt-1 text-sm text-slate-500">Cập nhật thông tin phòng ban trực tiếp từ trang chi tiết.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setEditDraft(null)} aria-label="Đóng dialog phòng ban">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã phòng ban</span>
                  <Input
                    value={visibleEditDraft.code}
                    onChange={(event) => {
                      setEditDraft({ ...visibleEditDraft, code: event.target.value });
                      setEditFieldErrors((current) => ({ ...current, code: undefined }));
                    }}
                    placeholder="ENG"
                    aria-invalid={editFieldErrors.code ? true : undefined}
                    className={editFieldErrors.code ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Tên phòng ban</span>
                  <Input
                    value={visibleEditDraft.name}
                    onChange={(event) => setEditDraft({ ...visibleEditDraft, name: event.target.value })}
                    placeholder="Engineering"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trực thuộc</span>
                  <DepartmentTreeSelect
                    departments={parentCandidates()}
                    value={visibleEditDraft.parent_id ?? ""}
                    onChange={(value) => {
                      setEditDraft({ ...visibleEditDraft, parent_id: value || null });
                      setEditFieldErrors((current) => ({ ...current, parent_id: undefined }));
                    }}
                    invalid={Boolean(editFieldErrors.parent_id)}
                  />
                  <span className="text-xs text-slate-500">
                    Không thể chọn chính phòng ban này hoặc phòng ban con/cháu làm trực thuộc.
                  </span>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <DepartmentStatusSelect
                    value={visibleEditDraft.is_active}
                    onChange={(value) => setEditDraft({ ...visibleEditDraft, is_active: value })}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button variant="outline" onClick={() => setEditDraft(null)} disabled={savingDepartment}>
                Hủy
              </Button>
              <Button onClick={saveDepartmentDraft} disabled={savingDepartment}>
                <Save className="h-4 w-4" />
                {savingDepartment ? "Đang lưu..." : "Lưu thay đổi"}
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
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Xóa nhân viên?</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Bạn có chắc muốn xóa {visibleDeleteTarget.full_name}? Thao tác này sẽ gọi API xóa nhân viên ở backend.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(null)} aria-label="Đóng xác nhận xóa">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Hủy
              </Button>
              <Button variant="danger" onClick={() => deletePerson(visibleDeleteTarget.id)} disabled={deleting}>
                <Trash2 className="h-4 w-4" />
                {deleting ? "Đang xóa..." : "Xác nhận xóa"}
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
  const children = departments.filter((item) => item.parent_id === rootId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(children.map((item) => item.id)));

  if (children.length === 0) {
    return <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-500">Không có phòng ban trực thuộc.</div>;
  }

  function toggleDepartment(departmentId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
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
          onToggle={toggleDepartment}
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
  const children = departments.filter((item) => item.parent_id === department.id);
  const hasChildren = children.length > 0;
  const expanded = expandedIds.has(department.id);

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
        style={{ marginLeft: depth * 16 }}
        onDoubleClick={() => onOpenDepartment(department)}
        title="Double click để xem chi tiết phòng ban này"
      >
        <button
          type="button"
          disabled={!hasChildren}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(department.id);
          }}
          aria-label={expanded ? `Thu gọn ${department.name}` : `Mở rộng ${department.name}`}
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
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : "Không trực thuộc";
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
                placeholder="Tìm phòng ban"
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
              Không trực thuộc
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
              <DepartmentStatusBadge active={option.value} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DepartmentStatusBadge({ active }: { active: boolean }) {
  return <Badge variant={active ? "success" : "default"}>{active ? "active" : "inactive"}</Badge>;
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

function getDepartmentFieldErrors(error: unknown): DepartmentFieldErrors {
  if (!(error instanceof ApiError)) return {};

  const text = `${error.message} ${getErrorDetailsText(error.details)}`.toLowerCase();
  return {
    code: text.includes("code") ? "Mã phòng ban đã tồn tại hoặc chưa hợp lệ." : undefined,
    parent_id:
      text.includes("parent") || text.includes("cycle") || text.includes("circular") || text.includes("self")
        ? "Phòng ban trực thuộc không hợp lệ."
        : undefined,
  };
}

function getDepartmentErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return "Không thể lưu phòng ban. Vui lòng thử lại.";

  const text = `${error.message} ${getErrorDetailsText(error.details)}`.toLowerCase();
  if (text.includes("code")) return "Mã phòng ban đã tồn tại. Vui lòng kiểm tra lại.";
  if (text.includes("parent") || text.includes("cycle") || text.includes("circular") || text.includes("self")) {
    return "Phòng ban trực thuộc không hợp lệ. Vui lòng kiểm tra lại.";
  }
  return error.message || "Không thể lưu phòng ban. Vui lòng thử lại.";
}

function getErrorDetailsText(details: unknown): string {
  if (!details) return "";
  if (typeof details === "string") return details;

  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
}

