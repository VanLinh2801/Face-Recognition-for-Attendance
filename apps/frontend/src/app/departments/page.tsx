import { PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { listDepartments } from "@/lib/mock-repository";

export default function DepartmentsPage() {
  const departments = listDepartments().items;

  return (
    <div>
      <PageHeader title="Phòng ban" description="CRUD-style UI mock cho departments endpoint." action="Tạo phòng ban" />
      <div className="grid gap-4 p-6 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader><CardTitle>Department form</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Input placeholder="Code" defaultValue="ENG" />
            <Input placeholder="Name" defaultValue="Engineering" />
            <Input placeholder="Parent ID" />
            <Button className="w-full">Lưu mock</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Departments</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200"><th className="py-3">Code</th><th>Name</th><th>Parent</th><th>Status</th></tr>
              </thead>
              <tbody>
                {departments.map((department) => (
                  <tr key={department.id} className="border-b border-slate-100">
                    <td className="py-3 font-mono text-xs">{department.code}</td>
                    <td className="font-medium">{department.name}</td>
                    <td>{department.parent_id ?? "N/A"}</td>
                    <td><Badge variant={department.is_active ? "success" : "default"}>{department.is_active ? "active" : "inactive"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
