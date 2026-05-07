import { PageHeader } from "@/components/data/page-header";
import { PersonsTable } from "@/components/persons/persons-table";
import { getDepartmentName, listDepartments, listPersons } from "@/lib/mock-repository";

export default function PersonsPage() {
  const persons = listPersons().items.map((person) => ({
    ...person,
    department_name: getDepartmentName(person.department_id),
  }));
  const departments = listDepartments().items;

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        description="Quản lý hồ sơ nhân sự và trạng thái đăng ký khuôn mặt."
        action="Thêm nhân sự"
        actionHref="/persons/new"
      />
      <div className="space-y-4 p-6">
        <PersonsTable persons={persons} departments={departments} />
      </div>
    </div>
  );
}
