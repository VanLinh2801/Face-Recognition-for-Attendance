"use client";

import Link from "next/link";
import { Eye, MoreHorizontal, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import type { Department, Person } from "@/lib/types";

type PersonRow = Person & {
  department_name: string;
};

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
  const allSelected = persons.length > 0 && selectedIds.size === persons.length;

  const selectedCount = selectedIds.size;
  const selectedText = useMemo(() => {
    if (selectedCount === 0) return `${persons.length} records`;
    return `${selectedCount}/${persons.length} selected`;
  }, [persons.length, selectedCount]);

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? new Set(persons.map((person) => person.id)) : new Set());
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
    const ids = Array.from(selectedIds);
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
        <CardContent className="grid gap-3 md:grid-cols-[1fr_180px_220px_auto]">
          <Input placeholder="Tìm theo tên hoặc mã nhân viên" />
          <Select defaultValue="all">
            <option value="all">Tất cả trạng thái</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="resigned">resigned</option>
          </Select>
          <Select defaultValue="all">
            <option value="all">Tất cả phòng ban</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </Select>
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
                {persons.map((person, index) => (
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
