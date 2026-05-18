"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Fingerprint,
  ImageUp,
  Save,
  Search,
  UploadCloud,
  UserPlus,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/data/page-header";
import { PersonStatusBadge } from "@/components/data/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import { validatePersonProfileFields } from "@/lib/person-validation";
import type { CreatePersonRegistrationResponse, Department, FaceRegistration, Person } from "@/lib/types";
import { useOutsideClick } from "@/lib/use-outside-click";

const DEFAULT_JOINED_AT = "2026-05-06";
const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const SUCCESS_REDIRECT_DELAY_MS = 1500;
const REGISTRATION_POLL_INTERVAL_MS = 2000;
const REGISTRATION_POLL_TIMEOUT_MS = 60000;

type PersonStatusValue = Exclude<Person["status"], "inactive">;
type DepartmentListResponse = {
  items: Department[];
};
type CreatePersonResponse = {
  id: string;
};
type ToastState = {
  title: string;
  description: string;
  variant: "success" | "danger" | "info";
} | null;

export default function NewPersonPage() {
  const router = useRouter();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinedAt, setJoinedAt] = useState(DEFAULT_JOINED_AT);
  const [status, setStatus] = useState<PersonStatusValue>("active");
  const [notes, setNotes] = useState("");
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [registrationPreviewUrl, setRegistrationPreviewUrl] = useState<string | null>(null);
  const [registrationNotes, setRegistrationNotes] = useState("");
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [employeeCodeError, setEmployeeCodeError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [processingMessage, setProcessingMessage] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    let isMounted = true;
    async function loadDepartments() {
      setLoadingDepartments(true);
      try {
        const data = await apiFetch<DepartmentListResponse>("/departments?is_active=true", { withAuth: true });
        if (!isMounted) return;
        setDepartments(data.items.filter((department) => department.is_active));
      } catch (err) {
        if (!isMounted) return;
        const message = err instanceof ApiError ? err.message : "Không tải được danh sách phòng ban.";
        setError(message);
      } finally {
        if (isMounted) setLoadingDepartments(false);
      }
    }
    void loadDepartments();
    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    return () => {
      if (registrationPreviewUrl) {
        URL.revokeObjectURL(registrationPreviewUrl);
      }
    };
  }, [registrationPreviewUrl]);

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), toast.variant === "info" ? 1800 : 3500);
    const removeTimer = window.setTimeout(() => setToast(null), toast.variant === "info" ? 2150 : 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  function showToast(nextToast: NonNullable<ToastState>) {
    setToast(nextToast);
    setToastVisible(true);
  }

  function closeToast() {
    setToastVisible(false);
    window.setTimeout(() => setToast(null), 300);
  }

  function handleRegistrationFileChange(file: File | null) {
    if (registrationPreviewUrl) {
      URL.revokeObjectURL(registrationPreviewUrl);
    }

    if (!file) {
      setRegistrationFile(null);
      setRegistrationPreviewUrl(null);
      return;
    }

    if (!allowedImageTypes.has(file.type)) {
      setRegistrationFile(null);
      setRegistrationPreviewUrl(null);
      setError("Vui lòng chọn file JPG hoặc PNG cho ảnh đăng ký khuôn mặt.");
      return;
    }

    setError("");
    setRegistrationFile(file);
    setRegistrationPreviewUrl(URL.createObjectURL(file));
  }

  async function waitForRegistrationCompletion(personId: string, registrationId: string) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < REGISTRATION_POLL_TIMEOUT_MS) {
      const registration = await apiFetch<FaceRegistration>(`/persons/${personId}/registrations/${registrationId}`, {
        withAuth: true,
      });

      if (registration.registration_status === "indexed") {
        return registration;
      }
      if (registration.registration_status === "failed") {
        const failureReason = registration.validation_notes?.trim();
        throw new Error(
          failureReason && failureReason.length > 0
            ? translateFailureReason(failureReason)
            : "Đăng ký khuôn mặt thất bại sau khi hệ thống xử lý ảnh.",
        );
      }

      await new Promise((resolve) => window.setTimeout(resolve, REGISTRATION_POLL_INTERVAL_MS));
    }

    throw new Error("Hệ thống xử lý quá thời gian chờ. Nhân sự đã được tạo, nhưng đăng ký khuôn mặt chưa hoàn tất.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEmployeeCodeError("");
    setEmailError("");
    setPhoneError("");
    setSuccess("");

    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    const validationError = validatePersonProfileFields({ email, phone, joinedAt });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      const normalizedEmployeeCode = employeeCode.trim();
      const payload = {
        employee_code: normalizedEmployeeCode,
        full_name: fullName.trim(),
        department_id: departmentId || null,
        title: title.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        joined_at: joinedAt || null,
        notes: notes.trim() || null,
      };
      const createdPerson = await apiFetch<CreatePersonResponse>("/persons", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify(payload),
      });

      if (registrationFile) {
        const formData = new FormData();
        formData.append("file", registrationFile);
        formData.append("requested_by_person_id", createdPerson.id);
        if (registrationNotes.trim()) formData.append("notes", registrationNotes.trim());

        await apiFetch(`/persons/${createdPerson.id}/registrations/upload`, {
          method: "POST",
          withAuth: true,
          body: formData,
        });
      }

      setSuccess(registrationFile ? "Tạo nhân sự và gửi đăng ký khuôn mặt thành công." : "Tạo nhân sự thành công.");
      await new Promise((resolve) => window.setTimeout(resolve, SUCCESS_REDIRECT_DELAY_MS));
      router.push("/persons");
    } catch (err) {
      const duplicateField = getDuplicatePersonField(err);
      if (duplicateField === "employee_code") {
        setEmployeeCodeError("Mã nhân viên đã tồn tại. Vui lòng nhập mã khác.");
        setError("Mã nhân viên đã tồn tại. Vui lòng kiểm tra lại.");
      } else if (duplicateField === "email") {
        setEmailError("Email đã được sử dụng bởi nhân viên khác.");
        setError("Email đã tồn tại. Vui lòng kiểm tra lại.");
      } else if (duplicateField === "phone") {
        setPhoneError("Số điện thoại đã được sử dụng bởi nhân viên khác.");
        setError("Số điện thoại đã tồn tại. Vui lòng kiểm tra lại.");
      } else {
        setError(err instanceof ApiError ? err.message : "Không thể tạo nhân sự.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  void handleSubmit;

  async function handleSubmitWithRegistrationPolling(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEmployeeCodeError("");
    setEmailError("");
    setPhoneError("");
    setProcessingMessage("");
    setSuccess("");

    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    const validationError = validatePersonProfileFields({ email, phone, joinedAt });
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    let personCreated = false;
    try {
      const normalizedEmployeeCode = employeeCode.trim();
      const payload = {
        employee_code: normalizedEmployeeCode,
        full_name: fullName.trim(),
        department_id: departmentId || null,
        title: title.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status,
        joined_at: joinedAt || null,
        notes: notes.trim() || null,
      };
      const createdPerson = await apiFetch<CreatePersonResponse>("/persons", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify(payload),
      });
      personCreated = true;

      if (registrationFile) {
        const formData = new FormData();
        formData.append("file", registrationFile);
        formData.append("requested_by_person_id", createdPerson.id);
        if (registrationNotes.trim()) formData.append("notes", registrationNotes.trim());

        const uploadResponse = await apiFetch<CreatePersonRegistrationResponse>(`/persons/${createdPerson.id}/registrations/upload`, {
          method: "POST",
          withAuth: true,
          body: formData,
        });

        setProcessingMessage("Nhân sự đã được tạo. Đang xử lý ảnh đăng ký khuôn mặt...");
        showToast({
          title: "Đang xử lý đăng ký khuôn mặt",
          description: "Ảnh đã được gửi sang pipeline và AI service để xử lý.",
          variant: "info",
        });
        await waitForRegistrationCompletion(createdPerson.id, uploadResponse.registration.id);
        setProcessingMessage("");
        setSuccess("Tạo nhân sự và đăng ký khuôn mặt thành công.");
        showToast({
          title: "Tạo nhân sự thành công",
          description: "Đăng ký khuôn mặt đã xử lý xong và sẵn sàng sử dụng.",
          variant: "success",
        });
      } else {
        setSuccess("Tạo nhân sự thành công.");
        showToast({
          title: "Tạo nhân sự thành công",
          description: "Hồ sơ nhân sự đã được lưu thành công.",
          variant: "success",
        });
      }

      await new Promise((resolve) => window.setTimeout(resolve, SUCCESS_REDIRECT_DELAY_MS));
      router.push("/persons");
    } catch (err) {
      setProcessingMessage("");
      const duplicateField = getDuplicatePersonField(err);
      if (duplicateField === "employee_code") {
        setEmployeeCodeError("Mã nhân viên đã tồn tại. Vui lòng nhập mã khác.");
        setError("Mã nhân viên đã tồn tại. Vui lòng kiểm tra lại.");
        showToast({
          title: "Tạo nhân sự thất bại",
          description: "Mã nhân viên đã tồn tại. Vui lòng kiểm tra lại.",
          variant: "danger",
        });
      } else if (duplicateField === "email") {
        setEmailError("Email đã được sử dụng bởi nhân viên khác.");
        setError("Email đã tồn tại. Vui lòng kiểm tra lại.");
        showToast({
          title: "Tạo nhân sự thất bại",
          description: "Email đã tồn tại. Vui lòng kiểm tra lại.",
          variant: "danger",
        });
      } else if (duplicateField === "phone") {
        setPhoneError("Số điện thoại đã được sử dụng bởi nhân viên khác.");
        setError("Số điện thoại đã tồn tại. Vui lòng kiểm tra lại.");
        showToast({
          title: "Tạo nhân sự thất bại",
          description: "Số điện thoại đã tồn tại. Vui lòng kiểm tra lại.",
          variant: "danger",
        });
      } else {
        const fallbackMessage = registrationFile
          ? "Nhân sự đã được tạo, nhưng đăng ký khuôn mặt thất bại. Hãy mở hồ sơ nhân sự hoặc dùng Thêm face để thử lại."
          : "Không thể tạo nhân sự.";
        const rawMessage = err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallbackMessage;
        const localizedMessage = translateFailureReason(rawMessage);
        const finalMessage = registrationFile && personCreated
          ? `Nhân sự đã được tạo, nhưng đăng ký khuôn mặt thất bại. ${localizedMessage}`
          : localizedMessage;
        setError(finalMessage);
        showToast({
          title: registrationFile && personCreated ? "Đăng ký khuôn mặt thất bại" : "Tạo nhân sự thất bại",
          description: finalMessage,
          variant: "danger",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Thêm nhân sự" description="" />

      <div className="mx-auto max-w-7xl space-y-4 p-6">
        <Link
          href="/persons"
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại danh sách
        </Link>

        <form className="space-y-4" onSubmit={handleSubmitWithRegistrationPolling}>
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                  <UserPlus className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <CardTitle>Thông tin nhân sự</CardTitle>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Mã nhân viên</span>
                  <Input
                    value={employeeCode}
                    onChange={(event) => {
                      setEmployeeCode(event.target.value);
                      setEmployeeCodeError("");
                    }}
                    placeholder="EMP006"
                    required
                    aria-invalid={employeeCodeError ? true : undefined}
                    className={employeeCodeError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {employeeCodeError ? <div className="text-xs font-medium text-red-700">{employeeCodeError}</div> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Họ tên</span>
                  <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyen Van F" required />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Phòng ban</span>
                  <DepartmentTreeSelect departments={departments} value={departmentId} onChange={setDepartmentId} />
                  {loadingDepartments ? <div className="text-xs text-slate-500">Đang tải phòng ban...</div> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Chức danh</span>
                  <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Engineer" />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Email</span>
                  <Input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError("");
                    }}
                    type="email"
                    placeholder="employee@example.com"
                    aria-invalid={emailError ? true : undefined}
                    className={emailError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {emailError ? <div className="text-xs font-medium text-red-700">{emailError}</div> : null}
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Điện thoại</span>
                  <Input
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setPhoneError("");
                    }}
                    placeholder="0900000000"
                    aria-invalid={phoneError ? true : undefined}
                    className={phoneError ? "border-red-300 focus:border-red-400 focus:ring-red-100" : undefined}
                  />
                  {phoneError ? <div className="text-xs font-medium text-red-700">{phoneError}</div> : null}
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium">Ngày vào làm</span>
                  <DatePicker value={joinedAt} onChange={setJoinedAt} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium">Trạng thái</span>
                  <StatusSelect value={status} onChange={setStatus} />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú hồ sơ</span>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ghi chú nội bộ cho hồ sơ nhân sự" />
              </label>
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
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <label className="grid min-h-[280px] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400 hover:bg-white">
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={(event) => handleRegistrationFileChange(event.target.files?.[0] ?? null)}
                />
                <div className="w-full">
                  {registrationPreviewUrl ? (
                    <div className="space-y-4">
                      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <Image
                          src={registrationPreviewUrl}
                          alt={registrationFile?.name ?? "Ảnh đăng ký khuôn mặt"}
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                      <div className="text-base font-semibold">{registrationFile?.name}</div>
                      <div className="text-sm text-slate-500">
                        {registrationFile?.type} · {registrationFile ? (registrationFile.size / 1024).toFixed(1) : "0.0"} KB
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                        <ImageUp className="h-7 w-7 text-slate-500" />
                      </div>
                      <div className="mt-4 text-base font-semibold">Chọn hoặc kéo ảnh khuôn mặt</div>
                      <div className="mt-1 text-sm text-slate-500">Không chọn ảnh thì hệ thống chỉ tạo nhân sự.</div>
                    </div>
                  )}
                  <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                    <UploadCloud className="h-4 w-4" />
                    {registrationPreviewUrl ? "Đổi ảnh" : "Chọn ảnh"}
                  </div>
                </div>
              </label>

              {registrationFile ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">Tên file gốc</span>
                    <Input value={registrationFile.name} readOnly />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">MIME type</span>
                    <Input value={registrationFile.type || "application/octet-stream"} readOnly />
                  </label>
                </div>
              ) : null}

              <label className="block space-y-2">
                <span className="text-sm font-medium">Ghi chú đăng ký khuôn mặt</span>
                <Textarea
                  value={registrationNotes}
                  onChange={(event) => setRegistrationNotes(event.target.value)}
                  placeholder="Nhập ghi chú nếu cần"
                />
              </label>
            </CardContent>
          </Card>
        </div>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {processingMessage ? (
          <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">{processingMessage}</div>
        ) : null}
        {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={submitting || loadingDepartments}>
            <Save className="h-4 w-4" />
            {submitting ? "Đang lưu..." : "Lưu nhân sự + đăng ký khuôn mặt"}
          </Button>
          <Link
            href="/persons"
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Hủy
          </Link>
        </div>
        </form>
      </div>

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={
            toast.variant === "success"
              ? `fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-emerald-200 bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${toastVisible ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0"}`
              : toast.variant === "info"
                ? `fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-sky-200 bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${toastVisible ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0"}`
                : `fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-red-200 bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${toastVisible ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0"}`
          }
        >
          <div className="flex items-start gap-3">
            <div
              className={
                toast.variant === "success"
                  ? "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500"
                  : toast.variant === "info"
                    ? "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500"
                    : "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"
              }
            />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-950">{toast.title}</div>
              <div className="mt-1 text-slate-600">{toast.description}</div>
            </div>
            <button
              type="button"
              onClick={closeToast}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900"
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

function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(value));
  const selectedDate = parseDate(value);
  const days = calendarDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" });

  useOutsideClick(containerRef, open, () => setOpen(false));

  function shiftMonth(offset: number) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarSearch className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="truncate font-medium text-slate-800">{formatDateLabel(value)}</span>
        </span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-80 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold capitalize text-slate-950">{monthLabel}</div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase text-slate-400">
              {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dateValue = toDateValue(day);
                const inMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();
                const selected = sameDay(day, selectedDate);

                return (
                  <button
                    key={dateValue}
                    type="button"
                    onClick={() => {
                      onChange(dateValue);
                      setOpen(false);
                    }}
                    className={
                      selected
                        ? "grid h-9 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white"
                        : inMonth
                          ? "grid h-9 place-items-center rounded-md text-sm font-medium text-slate-700 hover:bg-slate-100"
                          : "grid h-9 place-items-center rounded-md text-sm text-slate-300 hover:bg-slate-50"
                    }
                  >
                    {day.getUTCDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DepartmentTreeSelect({
  departments,
  value,
  onChange,
}: {
  departments: Department[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(departments.filter((department) => department.parent_id === null).map((department) => department.id)),
  );

  const selectedDepartment = departments.find((department) => department.id === value);
  const selectedLabel = selectedDepartment ? `${selectedDepartment.code} · ${selectedDepartment.name}` : "Chưa chọn phòng ban";
  const normalizedQuery = query.trim().toLowerCase();

  useOutsideClick(containerRef, open, () => setOpen(false));

  function toggleDepartment(departmentId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(departmentId)) next.delete(departmentId);
      else next.add(departmentId);
      return next;
    });
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="truncate">{selectedLabel}</span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-[360px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm phòng ban"
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 text-sm focus:border-transparent focus:ring-0"
              />
            </div>
          </div>

          <div className="thin-scrollbar max-h-80 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={value === "" ? "flex w-full items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <Building2 className="h-4 w-4" />
              Chưa chọn phòng ban
            </button>

            <div className="mt-1 space-y-1">
              {departments
                .filter((department) => department.parent_id === null)
                .map((department) => (
                  <DepartmentTreeOption
                    key={department.id}
                    department={department}
                    departments={departments}
                    selectedId={value}
                    depth={0}
                    expandedIds={expandedIds}
                    query={normalizedQuery}
                    onToggle={toggleDepartment}
                    onSelect={(departmentId) => {
                      onChange(departmentId);
                      setOpen(false);
                    }}
                  />
                ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: PersonStatusValue;
  onChange: (value: PersonStatusValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const options: PersonStatusValue[] = ["active", "resigned"];

  useOutsideClick(containerRef, open, () => setOpen(false));

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm outline-none transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
      >
        <span className="flex min-w-0 items-center gap-2">
          <PersonStatusBadge status={value} />
        </span>
        <ChevronRight className={open ? "h-4 w-4 rotate-90 text-slate-500 transition-transform" : "h-4 w-4 text-slate-500 transition-transform"} />
      </button>

      {open ? (
        <div className="absolute left-0 top-11 z-30 w-full overflow-hidden rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
          {options.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={value === option ? "flex w-full items-center rounded-md bg-slate-950 px-3 py-2 text-left text-sm font-medium text-white" : "flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-slate-50"}
            >
              <PersonStatusBadge status={option} />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DepartmentTreeOption({
  department,
  departments,
  selectedId,
  depth,
  expandedIds,
  query,
  onToggle,
  onSelect,
}: {
  department: Department;
  departments: Department[];
  selectedId: string;
  depth: number;
  expandedIds: Set<string>;
  query: string;
  onToggle: (departmentId: string) => void;
  onSelect: (departmentId: string) => void;
}) {
  const children = departments.filter((item) => item.parent_id === department.id);
  const expanded = expandedIds.has(department.id);
  const hasChildren = children.length > 0;
  const matchesQuery =
    query.length === 0 ||
    department.name.toLowerCase().includes(query) ||
    department.code.toLowerCase().includes(query) ||
    children.some((child) => child.name.toLowerCase().includes(query) || child.code.toLowerCase().includes(query));

  if (!matchesQuery) return null;

  return (
    <div>
      <div
        className={selectedId === department.id ? "flex items-center gap-2 rounded-md bg-slate-950 px-2 py-2 text-sm font-medium text-white" : "flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-slate-50"}
        style={{ paddingLeft: 8 + depth * 18 }}
      >
        <button
          type="button"
          disabled={!hasChildren}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(department.id);
          }}
          className="grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-slate-200 disabled:opacity-30 disabled:hover:bg-transparent"
          aria-label={expanded ? `Thu gọn ${department.name}` : `Mở rộng ${department.name}`}
        >
          <ChevronRight className={expanded ? "h-4 w-4 rotate-90 transition-transform" : "h-4 w-4 transition-transform"} />
        </button>
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2 text-left" onClick={() => onSelect(department.id)}>
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate">{department.code} · {department.name}</span>
        </button>
      </div>
      {expanded || query.length > 0
        ? children.map((child) => (
            <DepartmentTreeOption
              key={child.id}
              department={child}
              departments={departments}
              selectedId={selectedId}
              depth={depth + 1}
              expandedIds={expandedIds}
              query={query}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))
        : null}
    </div>
  );
}

function parseDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function monthStart(value: string) {
  const date = parseDate(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function calendarDays(month: Date) {
  const firstDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const startOffset = (firstDay.getUTCDay() + 6) % 7;
  const cursor = new Date(firstDay);
  cursor.setUTCDate(firstDay.getUTCDate() - startOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(cursor);
    day.setUTCDate(cursor.getUTCDate() + index);
    return day;
  });
}

function toDateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sameDay(a: Date, b: Date) {
  return toDateValue(a) === toDateValue(b);
}

function formatDateLabel(value: string) {
  return parseDate(value).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function getDuplicatePersonField(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const message = error.message.toLowerCase();
  const details = getErrorDetailsText(error.details).toLowerCase();

  if (error.code !== "validation_error") return null;
  if (
    message.includes("employee_code already exists") ||
    message.includes("employee code already exists") ||
    details.includes("employee_code")
  ) {
    return "employee_code";
  }
  if (message.includes("email already exists") || details.includes("email")) {
    return "email";
  }
  if (message.includes("phone already exists") || details.includes("phone")) {
    return "phone";
  }
  return null;
}

function translateFailureReason(message: string) {
  const normalized = message.trim();
  const lowered = normalized.toLowerCase();

  if (lowered.includes("multiple faces detected")) return "Ảnh có nhiều khuôn mặt. Vui lòng chọn ảnh chỉ có một người.";
  if (lowered.includes("no face detected")) return "Không phát hiện được khuôn mặt trong ảnh. Vui lòng chọn ảnh rõ mặt hơn.";
  if (lowered.includes("face too small")) return "Khuôn mặt trong ảnh quá nhỏ. Vui lòng chọn ảnh gần hơn.";
  if (lowered.includes("blur")) return "Ảnh bị mờ. Vui lòng chọn ảnh rõ nét hơn.";
  if (lowered.includes("low light")) return "Ảnh quá tối. Vui lòng chọn ảnh đủ sáng hơn.";
  if (lowered.includes("spoof")) return "Hệ thống nghi ngờ ảnh không phải khuôn mặt thật hợp lệ.";
  if (lowered.includes("embedding failed")) return "Hệ thống không tạo được đặc trưng khuôn mặt từ ảnh đã tải lên.";
  if (lowered.includes("image is empty")) return "Ảnh tải lên bị trống.";
  if (lowered.includes("too large")) return "Ảnh tải lên quá lớn.";
  if (lowered.includes("unsupported image type")) return "Định dạng ảnh không được hỗ trợ. Vui lòng chọn JPG hoặc PNG.";
  if (lowered.includes("timeout")) return "Hệ thống xử lý quá thời gian chờ.";
  if (lowered.includes("person not found")) return "Không tìm thấy nhân sự để đăng ký khuôn mặt.";
  if (lowered.includes("registration not found")) return "Không tìm thấy bản đăng ký khuôn mặt.";
  if (lowered.includes("bucket name is required")) return "Thiếu thông tin bucket lưu ảnh.";
  if (lowered.includes("request failed")) return "Yêu cầu thất bại. Vui lòng thử lại.";

  return normalized;
}

function getErrorDetailsText(details: unknown) {
  if (details == null) return "";
  if (typeof details === "string") return details;
  try {
    return JSON.stringify(details);
  } catch {
    return "";
  }
}
