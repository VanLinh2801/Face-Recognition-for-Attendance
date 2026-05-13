"use client";

import { useEffect, useState } from "react";
import { AttendancePresenceView } from "@/components/attendance/attendance-presence-view";
import { PageHeader } from "@/components/data/page-header";
import { ApiError, apiFetch } from "@/lib/api-client";
import type { Department, PageResult, Person } from "@/lib/types";

type PersonWithDepartment = Person & { department_name: string };

export default function AttendancePage() {
  const [persons, setPersons] = useState<PersonWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [personsResponse, departmentsResponse] = await Promise.all([
          apiFetch<PageResult<Person>>("/persons?page=1&page_size=100", { withAuth: true }),
          apiFetch<PageResult<Department>>("/departments?page=1&page_size=100", { withAuth: true }),
        ]);
        if (!mounted) return;
        setPersons(
          personsResponse.items
            .filter((person) => person.status === "active")
            .map((person) => {
              const department = departmentsResponse.items.find((d) => d.id === person.department_id);
              return { ...person, department_name: department?.name ?? "N/A" };
            }),
        );
        setDepartments(departmentsResponse.items);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? err.message : "Failed to load data");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Chấm công" description="Check-in only / daily presence cho hệ thống 1 camera." />
        <div className="flex items-center justify-center p-12 text-slate-500">Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader title="Chấm công" description="Check-in only / daily presence cho hệ thống 1 camera." />
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Chấm công" description="Check-in only / daily presence cho hệ thống 1 camera." />
      <AttendancePresenceView persons={persons} departments={departments} />
    </div>
  );
}
