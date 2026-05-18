"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { AttendancePresenceView } from "@/components/attendance/attendance-presence-view";
import { PageAmbientWave } from "@/components/data/page-ambient-wave";
import { PageHeader } from "@/components/data/page-header";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getFilterPolicy } from "@/lib/filter-policy";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { Department, FilterPolicy, PageResult, Person } from "@/lib/types";

type PersonWithDepartment = Person & { department_name: string };

export default function AttendancePage() {
  const t = useTranslations();
  const [persons, setPersons] = useState<PersonWithDepartment[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filterPolicy, setFilterPolicy] = useState<FilterPolicy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [personsResponse, departmentsResponse, policy] = await Promise.all([
          apiFetch<PageResult<Person>>("/persons?page=1&page_size=100", { withAuth: true }),
          apiFetch<PageResult<Department>>("/departments?page=1&page_size=100", { withAuth: true }),
          getFilterPolicy(),
        ]);
        if (!mounted) return;

        setPersons(
          personsResponse.items
            .filter((person) => person.status === "active")
            .map((person) => {
              const department = departmentsResponse.items.find((item) => item.id === person.department_id);
              return { ...person, department_name: department?.name ?? t("common.notAssigned") };
            }),
        );
        setDepartments(departmentsResponse.items);
        setFilterPolicy(policy);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? getTranslatedBackendError(t, err, "attendance") : t("errors.system.requestFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, [t]);

  if (loading) {
    return (
      <div className="relative min-h-[calc(100vh-5rem)]">
        <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
        <PageHeader title={t("attendance.page.title")} description={t("attendance.page.description")} />
        <div className="relative z-10 flex items-center justify-center p-12 text-slate-500">{t("attendance.page.loading")}</div>
      </div>
    );
  }

  if (error || !filterPolicy) {
    return (
      <div className="relative min-h-[calc(100vh-5rem)]">
        <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
        <PageHeader title={t("attendance.page.title")} description={t("attendance.page.description")} />
        <div className="relative z-10 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error || t("attendance.page.missingFilterPolicy")}</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
      <PageHeader title={t("attendance.page.title")} description={t("attendance.page.description")} />
      <div className="relative z-10">
        <AttendancePresenceView persons={persons} departments={departments} filterPolicy={filterPolicy} />
      </div>
    </div>
  );
}
