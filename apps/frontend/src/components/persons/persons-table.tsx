"use client";

import Link from "next/link";
import { Building2, ChevronRight, Eye, MoreHorizontal, Pencil, Plus, Save, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { Department, Person } from "@/lib/types";

type PersonRow = Person & {
  department_name: string;
};

type PersonStatusFilter = "all" | Person["status"];

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
  const [departmentId, setDepartmentId] = useState("all");
  const [statusFilter, setStatusFilter] = useState<PersonStatusFilter>("all");
  const departmentScopeIds = useMemo(() => getDepartmentScopeIds(departmentId, departments), [departmentId, departments]);
  const visiblePersons = persons.filter((person) => {
    const departmentMatches = !departmentScopeIds || (person.department_id ? departmentScopeIds.has(person.department_id) : false);
    const statusMatches = statusFilter === "all" || person.status === statusFilter;
    return departmentMatches && statusMatches;
  });
  const selectedVisibleCount = visiblePersons.filter((person) => selectedIds.has(person.id)).length;
  const allSelected = visiblePersons.length > 0 && selectedVisibleCount === visiblePersons.length;

  const selectedCount = selectedVisibleCount;
  const selectedText = useMemo(() => {
    if (selectedCount === 0) return `${visiblePersons.length} records`;
    return `${selectedCount}/${visiblePersons.length} selected`;
  }, [selectedCount, visiblePersons.length]);

  function toggleAll(checked: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const person of visiblePersons) {
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

  function saveEditingPerson() {
    if (!editingPerson) return;
    const departmentName =
      departments.find((department) => department.id === editingPerson.department_id)?.name ?? "No department";

    setPersons((current) =>
      current.map((person) =>
        person.id === editingPerson.id
          ? {
              ...editingPerson,
              department_name: departmentName,
            }
          : person,
      ),
    );
    setEditingPerson(null);
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
      description: `Bạn có chắc muốn xóa ${person.full_name}? Thao tác này chỉ xóa dữ liệu mock trên giao diện hiện tại.`,
    });
    setOpenActionId(null);
  }

  function requestDeleteSelected() {
    const ids = visiblePersons.filter((person) => selectedIds.has(person.id)).map((person) => person.id);
    if (ids.length === 0) return;
    setDeleteRequest({
      type: "bulk",
      ids,
      title: "Xóa nhân viên đã chọn?",
      description: `Bạn có chắc muốn xóa ${ids.length} nhân viên đã chọn? Thao tác này chỉ xóa dữ liệu mock trên giao diện hiện tại.`,
    });
  }

  function confirmDelete() {
    if (!deleteRequest) return;
    const ids = new Set(deleteRequest.ids);
    setPersons((current) => current.filter((person) => !ids.has(person.id)));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of ids) {
        next.delete(id);
      }
      return next;
    });
    setDeleteRequest(null);
  }

  return (
    <>
      <Card>
        <CardContent className="grid gap-3 md:grid-cols-[minmax(240px,0.78fr)_220px_280px_auto]">
          <Input placeholder="Tìm theo tên hoặc mã nhân viên" />
          <StatusFilterSelect value={statusFilter} onChange={setStatusFilter} />
          <DepartmentTreeSelect departments={departments} value={departmentId} onChange={setDepartmentId} />
          <Button variant="outline" disabled={selectedCount === 0} onClick={requestDeleteSelected}>
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
                {visiblePersons.map((person, index) => (
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
                    <td className="font-mono text-xs text-slate-500">{index + 1}</td>
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
                      <div className="relative inline-flex justify-end">
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
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
            <span>Page 1 · {selectedText}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">Previous</Button>
              <Button variant="outline" size="sm">Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {editingPerson ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl">
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

            <div className="thin-scrollbar flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã nhân viên</span>
                  <Input
                    value={editingPerson.employee_code}
                    onChange={(event) => updateEditingPerson("employee_code", event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Họ tên</span>
                  <Input
                    value={editingPerson.full_name}
                    onChange={(event) => updateEditingPerson("full_name", event.target.value)}
                  />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Phòng ban</span>
                  <Select
                    className="w-full"
                    value={editingPerson.department_id ?? ""}
                    onChange={(event) => updateEditingPerson("department_id", event.target.value || null)}
                  >
                    <option value="">Chưa chọn phòng ban</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} · {department.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Chức danh</span>
                  <Input
                    value={editingPerson.title}
                    onChange={(event) => updateEditingPerson("title", event.target.value)}
                  />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <Input
                    type="email"
                    value={editingPerson.email}
                    onChange={(event) => updateEditingPerson("email", event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Điện thoại</span>
                  <Input
                    value={editingPerson.phone}
                    onChange={(event) => updateEditingPerson("phone", event.target.value)}
                  />
                </label>
              </div>

              <div className="grid items-start gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ngày vào làm</span>
                  <Input
                    type="date"
                    value={editingPerson.joined_at}
                    onChange={(event) => updateEditingPerson("joined_at", event.target.value)}
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <Select
                    className="w-full"
                    value={editingPerson.status}
                    onChange={(event) => updateEditingPerson("status", event.target.value)}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="resigned">resigned</option>
                  </Select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú</span>
                <Textarea
                  value={editingPerson.notes ?? ""}
                  onChange={(event) => updateEditingPerson("notes", event.target.value || null)}
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
              <Button variant="outline" onClick={() => setEditingPerson(null)}>Hủy</Button>
              <Button onClick={saveEditingPerson}>
                <Save className="h-4 w-4" />
                Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteRequest ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-lg bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-red-50 text-red-700">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">{deleteRequest.title}</h2>
                  <p className="mt-2 text-sm text-slate-600">{deleteRequest.description}</p>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 p-5">
              <Button variant="outline" onClick={() => setDeleteRequest(null)}>Hủy</Button>
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

function StatusFilterSelect({
  value,
  onChange,
}: {
  value: PersonStatusFilter;
  onChange: (value: PersonStatusFilter) => void;
}) {
  const [open, setOpen] = useState(false);
  const options: Array<{ value: PersonStatusFilter; label: string }> = [
    { value: "all", label: "Tất cả" },
    { value: "active", label: "active" },
    { value: "inactive", label: "inactive" },
    { value: "resigned", label: "resigned" },
  ];
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="relative">
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
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : "Tất cả phòng ban";
  const normalizedQuery = query.trim().toLowerCase();

  function toggleDepartment(departmentId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  }

  return (
    <div className="relative">
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
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm phòng ban"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          <div className="thin-scrollbar max-h-80 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange("all");
                setOpen(false);
              }}
              className={value === "all" ? "flex w-full items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <Building2 className="h-4 w-4" />
              Tất cả phòng ban
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
