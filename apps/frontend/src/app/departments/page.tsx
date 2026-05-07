import { PageHeader } from "@/components/data/page-header";
import { DepartmentsManager } from "@/components/departments/departments-manager";
import { listDepartments } from "@/lib/mock-repository";

export default function DepartmentsPage() {
  const departments = listDepartments().items;

  return (
    <div>
      <PageHeader title="Phòng ban" description="Quản lý danh sách phòng ban và quan hệ trực thuộc." />
      <div className="p-6">
        <DepartmentsManager initialDepartments={departments} />
      </div>
    </div>
  );
}
