"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DepartmentDetailView } from "@/components/departments/department-detail-view";
import { PageAmbientWave } from "@/components/data/page-ambient-wave";
import { PageHeader } from "@/components/data/page-header";
import { useTheme } from "@/components/theme/theme-provider";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { Department, PageResult, Person } from "@/lib/types";

type DepartmentPerson = Person & { department_name: string };

export default function DepartmentDetailPage() {
  const t = useTranslations();
  const { theme } = useTheme();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const departmentId = params.id;
  const [department, setDepartment] = useState<Department | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [persons, setPersons] = useState<DepartmentPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const glassCardClass =
    theme === "dark"
      ? "border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
      : "border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl";

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
            department_name: person.department_id ? departmentMap.get(person.department_id) ?? t("common.unknown") : t("common.notAssigned"),
          })),
        );
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? getTranslatedBackendError(t, err, "departments") : t("errors.system.requestFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadDepartmentDetail();

    return () => {
      cancelled = true;
    };
  }, [departmentId, router, t]);

  const parentName = useMemo(() => {
    if (!department?.parent_id) return t("common.notAssigned");
    return departments.find((item) => item.id === department.parent_id)?.name ?? t("common.unknown");
  }, [department, departments, t]);

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
      <PageHeader
        title={department?.name ?? t("departments.page.title")}
        description={department ? `${department.code} · ${t("departments.list.parent")}: ${parentName}` : t("departments.page.detailLoadingDescription")}
      />
      <div className="relative z-10 space-y-4 p-6">
        <Link href="/departments" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground-soft)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" />
          {t("departments.page.backToList")}
        </Link>

        {loading ? (
          <div className={`rounded-lg p-6 text-sm text-slate-500 ${glassCardClass}`}>{t("departments.page.detailLoading")}</div>
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
