"use client";

import Link from "next/link";
import Image from "next/image";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  FileImage,
  Fingerprint,
  ImageUp,
  Loader2,
  Radio,
  RotateCcw,
  Send,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { RegistrationStatusBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Person, RegistrationStatus } from "@/lib/types";

type SubmitState = "idle" | "submitting" | "submitted" | "failed";

type RegistrationResponse = {
  registration?: {
    id: string;
    registration_status: RegistrationStatus;
    validation_notes: string | null;
    created_at: string;
  };
  stream_id?: string;
  message_id?: string;
  correlation_id?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export function FaceRegistrationForm({ person }: { person: Person }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [bucketName, setBucketName] = useState("attendance");
  const [originalFilename, setOriginalFilename] = useState(`${person.employee_code.toLowerCase()}-face.jpg`);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [requestedByPersonId, setRequestedByPersonId] = useState(person.id);
  const [notes, setNotes] = useState("register from admin panel");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [response, setResponse] = useState<RegistrationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileSize = file?.size ?? 0;
  const payload = useMemo(
    () => ({
      requested_by_person_id: requestedByPersonId,
      bucket_name: bucketName,
      file: originalFilename,
      mime_type: mimeType,
      file_size: fileSize,
      notes: notes.trim() ? notes : null,
    }),
    [bucketName, fileSize, mimeType, notes, originalFilename, requestedByPersonId],
  );
  const payloadText = JSON.stringify(payload, null, 2);
  const canSubmit = Boolean(file && bucketName.trim() && requestedByPersonId.trim());

  function onFileChange(nextFile: File | null) {
    setFile(nextFile);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return nextFile ? URL.createObjectURL(nextFile) : null;
    });
    if (!nextFile) return;
    setOriginalFilename(nextFile.name);
    setMimeType(nextFile.type || "image/jpeg");
  }

  async function copyPayload() {
    await navigator.clipboard.writeText(payloadText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  async function submitRegistration() {
    if (!canSubmit) return;
    setSubmitState("submitting");
    setError(null);
    setResponse(null);

    try {
      const token = window.localStorage.getItem("access_token");
      const formData = new FormData();
      formData.append("file", file as File);
      formData.append("requested_by_person_id", requestedByPersonId);
      formData.append("bucket_name", bucketName);
      if (notes.trim()) formData.append("notes", notes.trim());

      const res = await fetch(`${API_BASE}/api/v1/persons/${person.id}/registrations/upload`, {
        method: "POST",
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message ?? data?.detail ?? `HTTP ${res.status}`);
      }
      setResponse(data);
      setSubmitState("submitted");
    } catch (err) {
      setSubmitState("failed");
      setError(err instanceof Error ? err.message : "Submit failed");
    }
  }

  function resetForm() {
    setSubmitState("idle");
    setResponse(null);
    setError(null);
  }

  const currentStatus = response?.registration?.registration_status ?? (submitState === "submitted" ? "pending" : null);

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/persons/${person.id}`} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          Quay lại hồ sơ nhân sự
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant="info">pipeline crop</Badge>
          <Badge variant="default">AI index</Badge>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Nhân sự</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid aspect-square place-items-center rounded-lg bg-slate-100 text-5xl font-semibold text-slate-400">
              {person.full_name.split(" ").slice(-1)[0][0]}
            </div>
            <div className="space-y-3 text-sm">
              <InfoRow label="Mã nhân viên" value={person.employee_code} mono />
              <InfoRow label="Họ tên" value={person.full_name} />
              <InfoRow label="Chức danh" value={person.title ?? "N/A"} />
              <InfoRow label="Email" value={person.email ?? "N/A"} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <Fingerprint className="h-5 w-5 text-slate-600" />
                </div>
                <CardTitle>Đăng ký khuôn mặt</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 lg:grid-cols-[minmax(280px,0.9fr)_1fr]">
              <div className="space-y-4">
                <label className="block">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
                  />
                  <div className="grid min-h-[320px] cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 text-center transition hover:border-slate-400 hover:bg-white">
                    {previewUrl ? (
                      <Image
                        src={previewUrl}
                        alt="Registration source preview"
                        width={640}
                        height={420}
                        unoptimized
                        className="h-full max-h-[420px] w-full object-contain"
                      />
                    ) : (
                      <div className="p-6">
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                          <ImageUp className="h-7 w-7 text-slate-500" />
                        </div>
                        <div className="mt-4 text-base font-semibold">Chọn ảnh nguồn</div>
                        <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                          <UploadCloud className="h-4 w-4" />
                          Chọn ảnh
                        </div>
                      </div>
                    )}
                  </div>
                </label>
                {file ? (
                  <div className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-center gap-2 font-medium">
                      <FileImage className="h-4 w-4 text-slate-500" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                      <span>{mimeType}</span>
                      <span className="text-right">{formatBytes(file.size)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Bucket</span>
                    <Input value={bucketName} onChange={(event) => setBucketName(event.target.value)} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">MIME type</span>
                    <Select value={mimeType} onChange={(event) => setMimeType(event.target.value)}>
                      <option value="image/jpeg">image/jpeg</option>
                      <option value="image/png">image/png</option>
                    </Select>
                  </label>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                  Backend uploads the selected file to MinIO and generates the object key automatically.
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tên file gốc</span>
                    <Input value={originalFilename} onChange={(event) => setOriginalFilename(event.target.value)} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Người yêu cầu</span>
                    <Input value={requestedByPersonId} onChange={(event) => setRequestedByPersonId(event.target.value)} />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Ghi chú</span>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>

                <div className="grid gap-3 md:grid-cols-3">
                  <FlowStep icon={Clock3} label="pending" active={submitState !== "idle"} />
                  <FlowStep icon={Radio} label="validated" active={currentStatus === "validated" || currentStatus === "indexed"} />
                  <FlowStep icon={CheckCircle2} label="indexed" active={currentStatus === "indexed"} />
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-h-6 text-sm">
                    {currentStatus ? <RegistrationStatusBadge status={currentStatus} /> : <span className="text-slate-500">Chưa gửi</span>}
                    {response?.correlation_id ? <span className="ml-2 font-mono text-xs text-slate-500">{response.correlation_id}</span> : null}
                    {error ? (
                      <span className="inline-flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4" />
                        {error}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {submitState !== "idle" ? (
                      <Button variant="outline" onClick={resetForm}>
                        <RotateCcw className="h-4 w-4" />
                        Reset
                      </Button>
                    ) : null}
                    <Button className="ui-button-link ui-button-link-primary" disabled={!canSubmit || submitState === "submitting"} onClick={submitRegistration}>
                      {submitState === "submitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Gửi đăng ký
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Payload</CardTitle>
                <Button variant="outline" size="sm" onClick={copyPayload}>
                  <Copy className="h-4 w-4" />
                  {copied ? "Đã copy" : "Copy"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <pre className="thin-scrollbar max-h-[360px] overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">
{`POST ${API_BASE}/api/v1/persons/${person.id}/registrations/upload\nContent-Type: multipart/form-data\n\n${payloadText}`}
              </pre>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={cn("truncate text-right font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}

function FlowStep({
  icon: Icon,
  label,
  active,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2 rounded-lg border p-3 text-sm", active ? "border-slate-300 bg-slate-50 text-slate-950" : "border-slate-200 text-slate-400")}>
      <Icon className="h-4 w-4" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
