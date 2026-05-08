"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, CheckCircle2, FileImage, ImageUp, Loader2, Save, UploadCloud, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import type { Person } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

type SubmitState = "idle" | "submitting" | "submitted" | "failed";

type RegistrationResponse = {
  registration?: {
    id: string;
    registration_status: string;
  };
  correlation_id?: string;
};

export default function NewPersonPage() {
  const router = useRouter();
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinedAt, setJoinedAt] = useState("");
  const [personNotes, setPersonNotes] = useState("");
  const [registrationNotes, setRegistrationNotes] = useState("register from admin panel");
  const [bucketName, setBucketName] = useState("attendance");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [createdPerson, setCreatedPerson] = useState<Person | null>(null);
  const [registration, setRegistration] = useState<RegistrationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const personPayload = useMemo(
    () => ({
      employee_code: employeeCode.trim(),
      full_name: fullName.trim(),
      department_id: null,
      title: title.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
      joined_at: joinedAt || null,
      notes: personNotes.trim() || null,
    }),
    [employeeCode, fullName, title, email, phone, joinedAt, personNotes],
  );

  const canSubmit = Boolean(employeeCode.trim() && fullName.trim());

  function onFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextFile ? URL.createObjectURL(nextFile) : null;
    });
  }

  async function readJsonError(response: Response) {
    const data = await response.json().catch(() => null);
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail)) return data.detail.map((item: { msg?: string }) => item.msg).filter(Boolean).join(", ");
    if (typeof data?.message === "string") return data.message;
    return `HTTP ${response.status}`;
  }

  async function submit() {
    if (!canSubmit || submitState === "submitting") return;
    setSubmitState("submitting");
    setError(null);
    setCreatedPerson(null);
    setRegistration(null);

    try {
      const token = window.localStorage.getItem("access_token");
      const headers = {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      };

      const personResponse = await fetch(`${API_BASE}/api/v1/persons`, {
        method: "POST",
        headers,
        body: JSON.stringify(personPayload),
      });
      if (!personResponse.ok) throw new Error(await readJsonError(personResponse));
      const person = (await personResponse.json()) as Person;
      setCreatedPerson(person);

      if (file) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("requested_by_person_id", person.id);
        formData.append("bucket_name", bucketName);
        if (registrationNotes.trim()) formData.append("notes", registrationNotes.trim());

        const registrationResponse = await fetch(`${API_BASE}/api/v1/persons/${person.id}/registrations/upload`, {
          method: "POST",
          headers: token ? { authorization: `Bearer ${token}` } : undefined,
          body: formData,
        });
        if (!registrationResponse.ok) throw new Error(await readJsonError(registrationResponse));
        setRegistration((await registrationResponse.json()) as RegistrationResponse);
      }

      setSubmitState("submitted");
      window.setTimeout(() => router.push(`/persons/${person.id}`), 900);
    } catch (err) {
      setSubmitState("failed");
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Thêm nhân sự"
        description="Tạo hồ sơ nhân sự thật trên backend và có thể gửi luôn ảnh đăng ký khuôn mặt."
      />

      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link href="/persons" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
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
                  <CardDescription>Phần này gọi `POST /api/v1/persons`.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Mã nhân viên" value={employeeCode} onChange={setEmployeeCode} placeholder="EMP100" required />
                <Field label="Họ tên" value={fullName} onChange={setFullName} placeholder="Nguyen Van A" required />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Chức danh" value={title} onChange={setTitle} placeholder="Engineer" />
                <Field label="Email" value={email} onChange={setEmail} placeholder="employee@example.com" type="email" />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Điện thoại" value={phone} onChange={setPhone} placeholder="0900000000" />
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ngày vào làm</span>
                  <Input type="date" value={joinedAt} onChange={(event) => setJoinedAt(event.target.value)} />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú hồ sơ</span>
                <Textarea value={personNotes} onChange={(event) => setPersonNotes(event.target.value)} />
              </label>

              <pre className="thin-scrollbar max-h-72 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`POST ${API_BASE}/api/v1/persons\n\n${JSON.stringify(personPayload, null, 2)}`}
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <ImageUp className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle>Ảnh đăng ký khuôn mặt</CardTitle>
                  <CardDescription>Phần này gọi endpoint upload sau khi person được tạo.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="grid min-h-[320px] cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-slate-400 hover:bg-white">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                />
                {previewUrl ? (
                  <Image
                    src={previewUrl}
                    alt="Registration preview"
                    width={640}
                    height={420}
                    unoptimized
                    className="h-full max-h-[420px] w-full object-contain"
                    style={{ width: "100%", height: "auto" }}
                  />
                ) : (
                  <div className="p-6">
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                      <UploadCloud className="h-7 w-7 text-slate-500" />
                    </div>
                    <div className="mt-4 text-base font-semibold">Chọn ảnh khuôn mặt</div>
                    <div className="mt-1 text-sm text-slate-500">JPG/PNG, một người, rõ mặt.</div>
                  </div>
                )}
              </label>

              {file ? (
                <div className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <FileImage className="h-4 w-4 text-slate-500" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">{formatBytes(file.size)}</div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Bucket" value={bucketName} onChange={setBucketName} placeholder="attendance" />
                <label className="space-y-2">
                  <span className="text-sm font-medium">MIME type</span>
                  <Input value={file?.type ?? "image/jpeg"} readOnly />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú đăng ký</span>
                <Textarea value={registrationNotes} onChange={(event) => setRegistrationNotes(event.target.value)} />
              </label>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Không chọn ảnh thì hệ thống chỉ tạo nhân sự. Có ảnh thì backend sẽ upload MinIO và kích hoạt pipeline đăng ký face.
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-h-6 text-sm">
              {submitState === "submitted" ? (
                <span className="inline-flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Đã tạo {createdPerson?.employee_code}. Registration: {registration?.registration?.registration_status ?? "không gửi ảnh"}
                </span>
              ) : error ? (
                <span className="inline-flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </span>
              ) : (
                <span className="text-slate-600">Dữ liệu sẽ được ghi vào backend thật, không dùng mock.</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button disabled={!canSubmit || submitState === "submitting"} onClick={submit}>
                {submitState === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
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

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="text-red-600"> *</span> : null}
      </span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
