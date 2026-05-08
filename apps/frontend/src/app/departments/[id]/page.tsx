"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DepartmentDetailView } from "@/components/departments/department-detail-view";
import { PageHeader } from "@/components/data/page-header";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import type { Department, PageResult, Person } from "@/lib/types";

type DepartmentPerson = Person & { department_name: string };

export default function DepartmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const departmentId = params.id;
  const [department, setDepartment] = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [persons, setPersons] = useState<DepartmentPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function loadDepartmentDetail() {
      setLoading(true);
      setError(null);

      try {
        const [departmentData, departmentsPage, personsPage] = await Promise.all([
          apiFetch<Department>(`/departments/${departmentId}`, { withAuth: true }),
          apiFetch<PageResult<Department>>("/departments?page=1&page_size=100", { withAuth: true }),
          apiFetch<PageResult<Person>>(
            `/departments/${departmentId}/persons?include_descendants=true&page=1&page_size=100`,
            { withAuth: true },
          ),
        ]);

        if (cancelled) return;

        const departmentMap = new Map(departmentsPage.items.map((item) => [item.id, item.name]));
        setDepartment(departmentData);
        setDepartments(departmentsPage.items);
        setPersons(
          personsPage.items.map((person) => ({
            ...person,
            department_name: person.department_id ? departmentMap.get(person.department_id) ?? "Không xác định" : "Không trực thuộc",
          })),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Không thể tải dữ liệu phòng ban.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDepartmentDetail();

    return () => {
      cancelled = true;
    };
  }, [departmentId, router]);

  const parentName = useMemo(() => {
    if (!department?.parent_id) return "Không trực thuộc";
    return departments.find((item) => item.id === department.parent_id)?.name ?? "Không xác định";
  }, [department, departments]);

  return (
    <div>
      <PageHeader
        title={department?.name ?? "Phòng ban"}
        description={department ? `${department.code} · Trực thuộc: ${parentName}` : "Đang tải dữ liệu phòng ban."}
      />
      <div className="space-y-4 p-6">
        <Link href="/departments" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách phòng ban
        </Link>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải dữ liệu phòng ban...</div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : null}

        {!loading && !error && department ? (
          <DepartmentDetailView
            department={department}
            departments={departments}
            persons={persons}
            onDepartmentUpdated={(updatedDepartment) => {
              setDepartment(updatedDepartment);
              setDepartments((current) =>
                current.map((item) => (item.id === updatedDepartment.id ? updatedDepartment : item)),
              );
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
