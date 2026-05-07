"use client";

import Link from "next/link";
import { Building2, ChevronRight, Eye, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  const [departments, setDepartments] = useState<Department[]>(initialDepartments);
  const [draft, setDraft] = useState<DepartmentDraft | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const draftDialog = useDialogTransition(draft);
  const deleteDialog = useDialogTransition(deleteTarget);
  const visibleDraft = draftDialog.value;
  const visibleDeleteTarget = deleteDialog.value;

  const activeDepartments = useMemo(() => departments.filter((department) => department.is_active), [departments]);

  function getDepartmentName(id: string | null) {
    if (!id) return "Không trực thuộc";
    return departments.find((department) => department.id === id)?.name ?? "Không xác định";
  }

  function openCreateDialog() {
    setDraft(emptyDraft());
  }

  function openEditDialog(department: Department) {
    setDraft({
      id: department.id,
      code: department.code,
      name: department.name,
      parent_id: department.parent_id,
      is_active: department.is_active,
    });
  }

  function saveDraft() {
    if (!draft) return;
    const now = new Date().toISOString();

    if (draft.id) {
      const updatedDepartment: Department = {
        id: draft.id,
        code: draft.code,
        name: draft.name,
        parent_id: draft.parent_id,
        is_active: draft.is_active,
        created_at: departments.find((department) => department.id === draft.id)?.created_at ?? now,
        updated_at: now,
      };

      setDepartments((current) =>
        current.map((department) =>
          department.id === draft.id
            ? {
                ...department,
                ...updatedDepartment,
              }
            : department,
        ),
      );

    } else {
      setDepartments((current) => [
        ...current,
        {
          id: `dep-${Date.now()}`,
          code: draft.code || "NEW",
          name: draft.name || "New department",
          parent_id: draft.parent_id,
          is_active: draft.is_active,
          created_at: now,
          updated_at: now,
        },
      ]);
    }

    setDraft(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setDepartments((current) => current.filter((department) => department.id !== deleteTarget.id));
    setDeleteTarget(null);
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
              <div className="text-sm font-medium">Danh sách phòng ban</div>
              <div className="mt-1 text-sm text-slate-500">
                {departments.length} phòng ban · {activeDepartments.length} đang hoạt động
              </div>
            </div>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              Thêm phòng ban
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Phòng ban</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] table-fixed text-left text-sm">
                <thead className="text-xs uppercase text-slate-500">
                  <tr className="border-b border-slate-200">
                    <th className="w-16 py-3">STT</th>
                    <th className="w-28">Mã</th>
                    <th>Tên phòng ban</th>
                    <th className="w-48">Trực thuộc</th>
                    <th className="w-28">Trạng thái</th>
                    <th className="w-40 text-right">Action</th>
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
                          {department.is_active ? "active" : "inactive"}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/departments/${department.id}`}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                            aria-label={`Xem ${department.name}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <Button variant="outline" size="icon" aria-label={`Sửa ${department.name}`} onClick={() => openEditDialog(department)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="icon" aria-label={`Xóa ${department.name}`} onClick={() => setDeleteTarget(department)}>
                            <Trash2 className="h-4 w-4 text-red-700" />
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
                  <h2 className="text-lg font-semibold">{visibleDraft.id ? "Sửa phòng ban" : "Thêm phòng ban"}</h2>
                  <p className="mt-1 text-sm text-slate-500">Form mock theo contract departments.</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDraft(null)} aria-label="Đóng dialog phòng ban">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã phòng ban</span>
                  <Input value={visibleDraft.code} onChange={(event) => setDraft({ ...visibleDraft, code: event.target.value })} placeholder="ENG" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Tên phòng ban</span>
                  <Input value={visibleDraft.name} onChange={(event) => setDraft({ ...visibleDraft, name: event.target.value })} placeholder="Engineering" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trực thuộc</span>
                  <DepartmentTreeSelect
                    departments={parentCandidates()}
                    value={visibleDraft.parent_id ?? ""}
                    onChange={(value) => setDraft({ ...visibleDraft, parent_id: value || null })}
                  />
                  {visibleDraft.id ? (
                    <span className="text-xs text-slate-500">
                      Không thể chọn chính phòng ban này hoặc phòng ban con/cháu làm trực thuộc.
                    </span>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <DepartmentStatusSelect
                    value={visibleDraft.is_active}
                    onChange={(value) => setDraft({ ...visibleDraft, is_active: value })}
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button variant="outline" onClick={() => setDraft(null)}>Hủy</Button>
              <Button onClick={saveDraft}>
                <Save className="h-4 w-4" />
                Lưu
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
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Xóa phòng ban?</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Bạn có chắc muốn xóa {visibleDeleteTarget.name}? Thao tác này chỉ xóa dữ liệu mock trên giao diện hiện tại.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
              <Button variant="danger" onClick={confirmDelete}>
                <Trash2 className="h-4 w-4" />
                Xác nhận xóa
              </Button>
            </div>
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
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-[80] w-[360px] max-w-[calc(100vw-3rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
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

