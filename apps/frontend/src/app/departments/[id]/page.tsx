import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DepartmentDetailView } from "@/components/departments/department-detail-view";
import { PageHeader } from "@/components/data/page-header";
import { getDepartmentName, listDepartments, listPersons } from "@/lib/mock-repository";

export default async function DepartmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const departments = listDepartments().items;
  const department = departments.find((item) => item.id === id) ?? departments[0];
  const persons = listPersons().items.map((person) => ({
    ...person,
    department_name: getDepartmentName(person.department_id),
  }));

  return (
    <div>
      <PageHeader
        title={department.name}
        description={`${department.code} · Trực thuộc: ${getDepartmentName(department.parent_id)}`}
      />
      <div className="space-y-4 p-6">
        <Link
          href="/departments"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách phòng ban
        </Link>
        <DepartmentDetailView department={department} departments={departments} persons={persons} />
      </div>
    </div>
  );
}
