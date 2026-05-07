import { AttendancePresenceView } from "@/components/attendance/attendance-presence-view";
import { PageHeader } from "@/components/data/page-header";
import { getDepartmentName, listAttendanceEvents, listDepartments, listMediaAssets, listPersons } from "@/lib/mock-repository";

export default function AttendancePage() {
  const events = listAttendanceEvents().items.filter((event) => event.is_valid);
  const departments = listDepartments().items;
  const mediaAssets = listMediaAssets().items;
  const persons = listPersons().items
    .filter((person) => person.status === "active")
    .map((person) => ({
      ...person,
      department_name: getDepartmentName(person.department_id),
    }));

  return (
    <div>
      <PageHeader
        title="Chấm công"
        description="Check-in only / daily presence cho hệ thống 1 camera."
      />
      <AttendancePresenceView events={events} persons={persons} departments={departments} mediaAssets={mediaAssets} />
    </div>
  );
}
