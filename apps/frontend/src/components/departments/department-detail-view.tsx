"use client";

import { useRouter } from "next/navigation";
import { Building2, ChevronRight, Eye, MoreHorizontal, Pencil, Trash2, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Department, Person } from "@/lib/types";

export function DepartmentDetailView({
  department,
  departments,
  persons,
}: {
  department: Department;
  departments: Department[];
  persons: Array<Person & { department_name: string }>;
}) {
  const router = useRouter();
  const [departmentPeople, setDepartmentPeople] = useState(persons);
  const [openPersonActionId, setOpenPersonActionId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(Person & { department_name: string }) | null>(null);

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

  function deletePerson(personId: string) {
    setDepartmentPeople((current) => current.filter((person) => person.id !== personId));
    setOpenPersonActionId(null);
    setDeleteTarget(null);
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
            <Button variant="outline" className="mt-2 w-full">
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
                              <div className="relative inline-flex justify-end">
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

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Xóa nhân viên?</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Bạn có chắc muốn xóa {deleteTarget.full_name} khỏi danh sách phòng ban này? Thao tác này chỉ xóa dữ liệu mock trên giao diện hiện tại.
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(null)} aria-label="Đóng xác nhận xóa">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
              <Button variant="danger" onClick={() => deletePerson(deleteTarget.id)}>
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
