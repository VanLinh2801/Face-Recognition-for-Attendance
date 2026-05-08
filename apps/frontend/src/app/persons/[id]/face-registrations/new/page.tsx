"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Fingerprint, ImageUp, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import type { CreatePersonRegistrationResponse, Department, MediaAsset, PageResult, Person } from "@/lib/types";

const allowedImageTypes = new Set(["image/jpeg", "image/png"]);

type ToastState = {
  title: string;
  description: string;
  variant: "success" | "danger";
} | null;

export default function NewPersonFaceRegistrationPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const personId = params.id;
  const [person, setPerson] = useState<Person | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("register from admin panel");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }

    let cancelled = false;

    async function loadRegistrationContext() {
      setLoading(true);
      setError(null);

      try {
        const [personData, departmentsPage] = await Promise.all([
          apiFetch<Person>(`/persons/${personId}`, { withAuth: true }),
          apiFetch<PageResult<Department>>("/departments?page=1&page_size=100", { withAuth: true }),
        ]);

        if (cancelled) return;

        setPerson(personData);
        setDepartments(departmentsPage.items);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Không thể tải thông tin nhân sự.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRegistrationContext();

    return () => {
      cancelled = true;
    };
  }, [personId, router]);

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), 3500);
    const removeTimer = window.setTimeout(() => setToast(null), 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  const departmentName = useMemo(() => {
    if (!person?.department_id) return "Không trực thuộc";
    return departments.find((department) => department.id === person.department_id)?.name ?? "Không xác định";
  }, [departments, person]);

  function showToast(nextToast: NonNullable<ToastState>) {
    setToast(nextToast);
    setToastVisible(true);
  }

  function closeToast() {
    setToastVisible(false);
    window.setTimeout(() => setToast(null), 300);
  }

  function handleFileChange(file: File | null) {
    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (!allowedImageTypes.has(file.type)) {
      setSelectedFile(null);
      showToast({
        title: "Ảnh không hợp lệ",
        description: "Vui lòng chọn file JPG hoặc PNG.",
        variant: "danger",
      });
      return;
    }

    setSelectedFile(file);
  }

  async function submitRegistration() {
    if (!person) return;

    if (!selectedFile) {
      showToast({
        title: "Chưa chọn ảnh",
        description: "Vui lòng chọn một ảnh JPG hoặc PNG trước khi đăng ký.",
        variant: "danger",
      });
      return;
    }

    if (!allowedImageTypes.has(selectedFile.type)) {
      showToast({
        title: "Ảnh không hợp lệ",
        description: "Vui lòng chọn file JPG hoặc PNG.",
        variant: "danger",
      });
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("asset_type", "registration_face");
      formData.append("uploaded_by_person_id", person.id);

      const mediaAsset = await apiFetch<MediaAsset>("/media-assets/upload", {
        method: "POST",
        withAuth: true,
        body: formData,
      });

      await apiFetch<CreatePersonRegistrationResponse>(`/persons/${person.id}/registrations`, {
        method: "POST",
        withAuth: true,
        body: JSON.stringify({
          requested_by_person_id: person.id,
          source_media_asset: {
            storage_provider: mediaAsset.storage_provider,
            bucket_name: mediaAsset.bucket_name,
            object_key: mediaAsset.object_key,
            original_filename: mediaAsset.original_filename,
            mime_type: mediaAsset.mime_type,
            file_size: mediaAsset.file_size,
            checksum: mediaAsset.checksum,
            asset_type: mediaAsset.asset_type,
          },
          notes: notes.trim() || null,
        }),
      });

      showToast({
        title: "Đăng ký khuôn mặt thành công",
        description: "Ảnh đã được upload và registration đã được tạo.",
        variant: "success",
      });
      window.setTimeout(() => router.push(`/persons/${person.id}`), 700);
    } catch (err) {
      showToast({
        title: "Đăng ký khuôn mặt thất bại",
        description: err instanceof ApiError ? err.message : "Không thể tạo đăng ký khuôn mặt. Vui lòng thử lại.",
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Đăng ký khuôn mặt"
        description={person ? `Tạo face registration cho ${person.full_name}.` : "Đang tải thông tin nhân sự."}
      />

      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <Link href={person ? `/persons/${person.id}` : "/persons"} className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
          Quay lại chi tiết nhân sự
        </Link>

        {loading ? (
          <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">Đang tải thông tin nhân sự...</div>
        ) : null}

        {!loading && error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : null}

        {!loading && !error && person ? (
          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Nhân sự đã chọn</CardTitle>
                <CardDescription>URL đã chứa person_id nên không cần tìm lại người đăng ký.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid aspect-square place-items-center rounded-lg bg-slate-100 text-5xl font-semibold text-slate-400">
                  {person.full_name.split(" ").slice(-1)[0]?.[0] ?? "?"}
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Mã nhân viên</span><span className="font-mono text-xs">{person.employee_code}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Họ tên</span><span className="font-medium">{person.full_name}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-slate-500">Phòng ban</span><span>{departmentName}</span></div>
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
                    <CardDescription>Upload ảnh lên media assets rồi tạo registration cho nhân sự.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <label className="grid min-h-[280px] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400 hover:bg-white">
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    className="sr-only"
                    onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
                  />
                  <div>
                    <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                      <ImageUp className="h-7 w-7 text-slate-500" />
                    </div>
                    <div className="mt-4 text-base font-semibold">Chọn ảnh khuôn mặt</div>
                    <div className="mt-1 text-sm text-slate-500">JPG/PNG, một người, rõ mặt, đủ sáng.</div>
                    <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                      <UploadCloud className="h-4 w-4" />
                      Chọn ảnh
                    </div>
                    {selectedFile ? (
                      <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                        <div className="font-medium text-slate-900">{selectedFile.name}</div>
                        <div>{selectedFile.type} · {(selectedFile.size / 1024).toFixed(1)} KB</div>
                      </div>
                    ) : null}
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">Ghi chú</span>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
                </label>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span>Hệ thống sẽ upload ảnh trước, sau đó tạo registration từ media asset vừa nhận.</span>
                  </div>
                  <Button onClick={submitRegistration} disabled={submitting}>
                    <Fingerprint className="h-4 w-4" />
                    {submitting ? "Đang đăng ký..." : "Gửi đăng ký"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : null}
      </div>

      {toast ? (
        <div
          className={`fixed bottom-5 right-5 z-[90] w-[min(420px,calc(100vw-2.5rem))] rounded-lg border bg-white p-4 shadow-xl transition-all duration-300 ${
            toastVisible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
          } ${toast.variant === "danger" ? "border-red-200" : "border-emerald-200"}`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className={toast.variant === "danger" ? "font-semibold text-red-800" : "font-semibold text-emerald-800"}>
                {toast.title}
              </div>
              <div className="mt-1 text-sm text-slate-600">{toast.description}</div>
            </div>
            <button
              type="button"
              onClick={closeToast}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              aria-label="Đóng thông báo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
