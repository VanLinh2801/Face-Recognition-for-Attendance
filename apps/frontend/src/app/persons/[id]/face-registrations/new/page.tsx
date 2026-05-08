import { PageHeader } from "@/components/data/page-header";
import { FaceRegistrationForm } from "@/components/persons/face-registration-form";
import { getDepartmentName, getPerson } from "@/lib/mock-repository";

export default async function NewPersonFaceRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = getPerson(id);

  return (
    <div>
      <PageHeader
        title="Đăng ký khuôn mặt"
        description={`${person.full_name} · ${person.employee_code} · ${getDepartmentName(person.department_id)}`}
      />
      <FaceRegistrationForm person={person} />
    </div>
  );
}
