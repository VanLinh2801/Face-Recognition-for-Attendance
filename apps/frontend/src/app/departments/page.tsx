"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { DepartmentsManager } from "@/components/departments/departments-manager";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import type { Department, PageResult } from "@/lib/types";

export default function DepartmentsPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    let isMounted = true;

    async function loadDepartments() {
      setLoading(true);
      setError("");
      try {
        const response = await apiFetch<PageResult<Department>>("/departments?page=1&page_size=100", { withAuth: true });
        if (!isMounted) return;
        setDepartments(response.items);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof ApiError ? err.message : "Không tải được danh sách phòng ban.");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadDepartments();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <div>
      <PageHeader title="Phòng ban" description="Quản lý danh sách phòng ban và quan hệ trực thuộc." />
      <div className="p-6">
        {loading ? <div className="rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-500">Đang tải phòng ban...</div> : null}
        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}
        {!loading && !error ? <DepartmentsManager initialDepartments={departments} /> : null}
      </div>
    </div>
  );
}
