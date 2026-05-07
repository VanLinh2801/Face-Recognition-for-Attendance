"use client";

import Link from "next/link";
import { Building2, Eye, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import type { Department } from "@/lib/types";

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

      {draft ? (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <Building2 className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{draft.id ? "Sửa phòng ban" : "Thêm phòng ban"}</h2>
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
                  <Input value={draft.code} onChange={(event) => setDraft({ ...draft, code: event.target.value })} placeholder="ENG" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Tên phòng ban</span>
                  <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Engineering" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trực thuộc</span>
                  <Select
                    value={draft.parent_id ?? ""}
                    onChange={(event) => setDraft({ ...draft, parent_id: event.target.value || null })}
                  >
                    <option value="">Không trực thuộc</option>
                    {parentCandidates().map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} · {department.name}
                      </option>
                    ))}
                  </Select>
                  {draft.id ? (
                    <span className="text-xs text-slate-500">
                      Không thể chọn chính phòng ban này hoặc phòng ban con/cháu làm trực thuộc.
                    </span>
                  ) : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <Select
                    value={draft.is_active ? "active" : "inactive"}
                    onChange={(event) => setDraft({ ...draft, is_active: event.target.value === "active" })}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </Select>
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


      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Xóa phòng ban?</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Bạn có chắc muốn xóa {deleteTarget.name}? Thao tác này chỉ xóa dữ liệu mock trên giao diện hiện tại.
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
