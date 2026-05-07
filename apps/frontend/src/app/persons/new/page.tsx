import Link from "next/link";
import { ArrowLeft, CheckCircle2, Fingerprint, ImageUp, Save, UploadCloud, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { listDepartments } from "@/lib/mock-repository";

export default function NewPersonPage() {
  const departments = listDepartments().items.filter((department) => department.is_active);

  return (
    <div>
      <PageHeader
        title="Thêm nhân sự"
        description="Tạo hồ sơ person và gửi ảnh đăng ký khuôn mặt trong cùng một màn hình."
      />

      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link
          href="/persons"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <UserPlus className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle>Thông tin nhân sự</CardTitle>
                  <CardDescription>Dữ liệu ở phần này map vào bảng persons.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã nhân viên</span>
                  <Input placeholder="EMP006" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Họ tên</span>
                  <Input placeholder="Nguyen Van F" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Phòng ban</span>
                  <Select defaultValue="">
                    <option value="">Chưa chọn phòng ban</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.code} · {department.name}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Chức danh</span>
                  <Input placeholder="Engineer" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <Input type="email" placeholder="employee@example.com" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Điện thoại</span>
                  <Input placeholder="0900000000" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ngày vào làm</span>
                  <Input type="date" defaultValue="2026-05-06" />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <Select defaultValue="active">
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="resigned">resigned</option>
                  </Select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú hồ sơ</span>
                <Textarea placeholder="Ghi chú nội bộ cho hồ sơ nhân sự" />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Save className="h-4 w-4 text-slate-500" />
                  Person payload preview
                </div>
                <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`{
  "employee_code": "EMP006",
  "full_name": "Nguyen Van F",
  "department_id": null,
  "title": "Engineer",
  "email": "employee@example.com",
  "phone": "0900000000",
  "joined_at": "2026-05-06",
  "notes": null
}`}
                </pre>
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
                  <CardDescription>Ảnh ở phần này tạo media asset và face registration cho nhân sự mới.</CardDescription>
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
                  <div className="mt-1 text-sm text-slate-500">JPG/PNG, nên dùng ảnh rõ mặt, một người, đủ sáng.</div>
                  <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                    <UploadCloud className="h-4 w-4" />
                    Chọn ảnh
                  </div>
                </div>
              </label>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Tên file gốc</span>
                  <Input placeholder="employee-face.jpg" />
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
                  <Input defaultValue="registrations/raw/EMP006.jpg" />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú đăng ký khuôn mặt</span>
                <Textarea defaultValue="register from admin panel" />
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["1", "Tạo person", "POST /api/v1/persons"],
                  ["2", "Upload ảnh", "MinIO/media asset"],
                  ["3", "Tạo registration", "POST /persons/{id}/registrations"],
                ].map(([step, title, description]) => (
                  <div key={step} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex items-center gap-2">
                      <div className="grid h-6 w-6 place-items-center rounded-full bg-slate-950 text-xs font-semibold text-white">{step}</div>
                      <div className="text-sm font-medium">{title}</div>
                    </div>
                    <div className="mt-2 text-xs text-slate-500">{description}</div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Fingerprint className="h-4 w-4 text-slate-500" />
                  Registration payload preview
                </div>
                <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`{
  "requested_by_person_id": "admin-person-id",
  "source_media_asset": {
    "storage_provider": "minio",
    "bucket_name": "attendance",
    "object_key": "registrations/raw/EMP006.jpg",
    "original_filename": "employee-face.jpg",
    "mime_type": "image/jpeg",
    "file_size": 123456,
    "checksum": null,
    "asset_type": "registration_face"
  },
  "notes": "register from admin panel"
}`}
                </pre>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 text-sm text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
              <span>
                V1 là mock UI. Khi nối backend, submit sẽ tạo person trước, upload ảnh/media asset, rồi tạo registration cho person vừa tạo.
              </span>
            </div>
            <div className="flex gap-2">
              <Button>
                <Save className="h-4 w-4" />
                Lưu nhân sự + đăng ký khuôn mặt
              </Button>
              <Link
                href="/persons"
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Hủy
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
