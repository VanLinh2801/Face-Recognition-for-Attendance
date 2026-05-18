"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { PersonsTable } from "@/components/persons/persons-table";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { Department, PageResult, Person } from "@/lib/types";

type PersonRow = Person & {
  department_name: string;
};

export default function PersonsPage() {
  const t = useTranslations();
  const [persons, setPersons] = useState<Person[]>([]);
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
          apiFetch<PageResult<Department>>("/departments?page=1&page_size=100&is_active=true", { withAuth: true }),
        ]);
        if (!mounted) return;
        setPersons(personsResponse.items);
        setDepartments(departmentsResponse.items);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof ApiError ? getTranslatedBackendError(t, err, "persons") : t("errors.system.requestFailed"));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadData();
    return () => {
      mounted = false;
    };
  }, [t]);

  const personRows: PersonRow[] = useMemo(() => {
    const departmentMap = new Map(departments.map((department) => [department.id, department.name]));
    return persons.map((person) => ({
      ...person,
      department_name: person.department_id ? departmentMap.get(person.department_id) ?? t("common.unknown") : t("common.notAssigned"),
    }));
  }, [departments, persons, t]);

  return (
    <div>
      <PageHeader
        title={t("persons.page.title")}
        description={t("persons.page.description")}
      />
      <div className="space-y-4 p-6">
        <div className="flex justify-end">
          <Link
            href="/persons/new"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Plus className="h-4 w-4" />
            {t("persons.page.addAction")}
          </Link>
        </div>
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {loading ? <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">{t("persons.page.loading")}</div> : null}
        {!loading ? <PersonsTable persons={personRows} departments={departments} /> : null}
      </div>
    </div>
  );
}
