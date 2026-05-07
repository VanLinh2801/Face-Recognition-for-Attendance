import Link from "next/link";
import { ArrowLeft, CheckCircle2, Fingerprint, ImageUp, UploadCloud } from "lucide-react";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { getDepartmentName, getPerson } from "@/lib/mock-repository";

export default async function NewPersonFaceRegistrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = getPerson(id);

  return (
    <div>
      <PageHeader title="Đăng ký khuôn mặt" description={`Tạo face registration cho ${person.full_name}.`} />

      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Link href="/persons" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách nhân sự
        </Link>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Nhân sự đã chọn</CardTitle>
              <CardDescription>Không cần tìm kiếm lại người đăng ký vì URL đã có person_id.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid aspect-square place-items-center rounded-lg bg-slate-100 text-5xl font-semibold text-slate-400">
                {person.full_name.split(" ").slice(-1)[0][0]}
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between gap-3"><span className="text-slate-500">Mã nhân viên</span><span className="font-mono text-xs">{person.employee_code}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Họ tên</span><span className="font-medium">{person.full_name}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Phòng ban</span><span>{getDepartmentName(person.department_id)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-slate-500">Chức danh</span><span>{person.title}</span></div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <Fingerprint className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle>Ảnh đăng ký khuôn mặt</CardTitle>
                  <CardDescription>Flow mock cho POST /api/v1/persons/{`{person_id}`}/registrations.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="grid min-h-[280px] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400 hover:bg-white">
                <input type="file" accept="image/png,image/jpeg" className="sr-only" />
                <div>
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                    <ImageUp className="h-7 w-7 text-slate-500" />
                  </div>
                  <div className="mt-4 text-base font-semibold">Chọn hoặc kéo ảnh khuôn mặt</div>
                  <div className="mt-1 text-sm text-slate-500">JPG/PNG, một người, rõ mặt, đủ sáng.</div>
                  <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                    <UploadCloud className="h-4 w-4" />
                    Chọn ảnh
                  </div>
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Tên file gốc</span>
                  <Input placeholder={`${person.employee_code.toLowerCase()}-face.jpg`} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">MIME type</span>
                  <Select defaultValue="image/jpeg">
                    <option value="image/jpeg">image/jpeg</option>
                    <option value="image/png">image/png</option>
                  </Select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Bucket</span>
                  <Input defaultValue="attendance" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Object key mock</span>
                  <Input defaultValue={`registrations/raw/${person.employee_code}.jpg`} />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú</span>
                <Textarea defaultValue="register from admin panel" />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Fingerprint className="h-4 w-4 text-slate-500" />
                  Registration payload preview
                </div>
                <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`POST /api/v1/persons/${person.id}/registrations

{
  "requested_by_person_id": "admin-person-id",
  "source_media_asset": {
    "storage_provider": "minio",
    "bucket_name": "attendance",
    "object_key": "registrations/raw/${person.employee_code}.jpg",
    "original_filename": "${person.employee_code.toLowerCase()}-face.jpg",
    "mime_type": "image/jpeg",
    "file_size": 123456,
    "checksum": null,
    "asset_type": "registration_face"
  },
  "notes": "register from admin panel"
}`}
                </pre>
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-2 text-sm text-slate-600">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  <span>V1 là mock UI. Khi nối backend, submit sẽ upload media asset rồi tạo registration cho person này.</span>
                </div>
                <Button>
                  <Fingerprint className="h-4 w-4" />
                  Gửi đăng ký mock
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
