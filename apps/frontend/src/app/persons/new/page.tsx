"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Fingerprint, ImageUp, Save, UploadCloud, UserPlus, X, ArrowLeft } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { PageAmbientWave } from "@/components/data/page-ambient-wave";
import { PageHeader } from "@/components/data/page-header";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { DatePicker, DepartmentTreeSelect, PersonStatusSelect, type EditablePersonStatus } from "@/components/persons/persons-table";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import { validatePersonProfileFields } from "@/lib/person-validation";
import type { CreatePersonRegistrationResponse, Department, FaceRegistration } from "@/lib/types";

const DEFAULT_JOINED_AT = todayValue();
const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const SUCCESS_REDIRECT_DELAY_MS = 1500;
const REGISTRATION_POLL_INTERVAL_MS = 2000;
const REGISTRATION_POLL_TIMEOUT_MS = 60000;

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
  const t = useTranslations();
  const router = useRouter();
  const { theme } = useTheme();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeCode, setEmployeeCode] = useState("");
  const [fullName, setFullName] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [joinedAt, setJoinedAt] = useState(DEFAULT_JOINED_AT);
  const [status, setStatus] = useState<EditablePersonStatus>("active");
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
  const glassCardClass =
    theme === "dark"
      ? "border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
      : "border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl";

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
        setError(err instanceof ApiError ? err.message : t("departments.page.loading"));
      } finally {
        if (isMounted) setLoadingDepartments(false);
      }
    }

    void loadDepartments();
    return () => {
      isMounted = false;
    };
  }, [router, t]);

  useEffect(() => {
    return () => {
      if (registrationPreviewUrl) URL.revokeObjectURL(registrationPreviewUrl);
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
      setError(t("persons.create.invalidImageType"));
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
        throw new Error(failureReason && failureReason.length > 0 ? translateFailureReason(failureReason, t) : t("persons.create.registrationFailedAfterProcessing"));
      }

      await new Promise((resolve) => window.setTimeout(resolve, REGISTRATION_POLL_INTERVAL_MS));
    }

    throw new Error(t("persons.create.processingTimeout"));
  }

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
      const createdPerson = await apiFetch<CreatePersonResponse>("/persons", {
        method: "POST",
        withAuth: true,
        body: JSON.stringify({
          employee_code: employeeCode.trim(),
          full_name: fullName.trim(),
          department_id: departmentId || null,
          title: title.trim() || null,
          email: email.trim() || null,
          phone: phone.trim() || null,
          status,
          joined_at: joinedAt || null,
          notes: notes.trim() || null,
        }),
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

        setProcessingMessage(t("persons.create.processing"));
        showToast({
          title: t("persons.create.processingTitle"),
          description: t("persons.create.processingDescription"),
          variant: "info",
        });

        await waitForRegistrationCompletion(createdPerson.id, uploadResponse.registration.id);

        setProcessingMessage("");
        setSuccess(t("persons.create.successWithFace"));
        showToast({
          title: t("persons.create.saveSuccessTitle"),
          description: t("persons.create.processingCompletedDescription"),
          variant: "success",
        });
      } else {
        setSuccess(t("persons.create.successWithoutFace"));
        showToast({
          title: t("persons.create.saveSuccessTitle"),
          description: t("persons.create.saveSuccessDescription"),
          variant: "success",
        });
      }

      await new Promise((resolve) => window.setTimeout(resolve, SUCCESS_REDIRECT_DELAY_MS));
      router.push("/persons");
    } catch (err) {
      setProcessingMessage("");
      const duplicateField = getDuplicatePersonField(err);
      if (duplicateField === "employee_code") {
        setEmployeeCodeError(t("persons.messages.duplicateEmployeeCode"));
        setError(t("persons.messages.duplicateEmployeeCode"));
        showToast({
          title: t("persons.create.createFailedTitle"),
          description: t("persons.messages.duplicateEmployeeCode"),
          variant: "danger",
        });
      } else if (duplicateField === "email") {
        setEmailError(t("persons.fieldErrors.duplicateEmail"));
        setError(t("persons.messages.duplicateEmail"));
        showToast({
          title: t("persons.create.createFailedTitle"),
          description: t("persons.messages.duplicateEmail"),
          variant: "danger",
        });
      } else if (duplicateField === "phone") {
        setPhoneError(t("persons.fieldErrors.duplicatePhone"));
        setError(t("persons.messages.duplicatePhone"));
        showToast({
          title: t("persons.create.createFailedTitle"),
          description: t("persons.messages.duplicatePhone"),
          variant: "danger",
        });
      } else {
        const fallbackMessage = registrationFile ? t("persons.create.personCreatedRegistrationFailed") : t("persons.create.createFailedTitle");
        const rawMessage = err instanceof ApiError ? err.message : err instanceof Error ? err.message : fallbackMessage;
        const localizedMessage = translateFailureReason(rawMessage, t);
        const finalMessage = registrationFile && personCreated
          ? `${t("persons.create.personCreatedRegistrationFailed")} ${localizedMessage}`
          : localizedMessage;
        setError(finalMessage);
        showToast({
          title: registrationFile && personCreated ? t("persons.create.registrationFailedTitle") : t("persons.create.createFailedTitle"),
          description: finalMessage,
          variant: "danger",
        });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
      <PageHeader title={t("persons.create.pageTitle")} description="" />

      <div className="relative z-10 mx-auto max-w-7xl space-y-4 p-6">
        <Link href="/persons" className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground-soft)] hover:text-[var(--foreground)]">
          <ArrowLeft className="h-4 w-4" />
          {t("persons.create.backToList")}
        </Link>

        <form className="space-y-4" onSubmit={handleSubmitWithRegistrationPolling}>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className={glassCardClass}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                    <UserPlus className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle>{t("persons.create.profileCardTitle")}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{t("persons.create.employeeCode")}</span>
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
                    <span className="text-sm font-medium">{t("persons.create.fullName")}</span>
                    <Input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyen Van F" required />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{t("persons.create.department")}</span>
                    <DepartmentTreeSelect departments={departments} value={departmentId} onChange={setDepartmentId} rootValue="" rootLabel={t("persons.table.noDepartmentSelected")} />
                    {loadingDepartments ? <div className="text-xs text-slate-500">{t("persons.create.loadingDepartments")}</div> : null}
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{t("persons.create.title")}</span>
                    <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Engineer" />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{t("persons.create.email")}</span>
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
                    <span className="text-sm font-medium">{t("persons.create.phone")}</span>
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
                    <span className="text-sm font-medium">{t("persons.create.joinedAt")}</span>
                    <DatePicker value={joinedAt} onChange={setJoinedAt} />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm font-medium">{t("persons.create.status")}</span>
                    <PersonStatusSelect value={status} onChange={setStatus} />
                  </label>
                </div>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">{t("persons.create.profileNotes")}</span>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t("persons.create.profileNotesPlaceholder")} />
                </label>
              </CardContent>
            </Card>

            <Card className={glassCardClass}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                    <Fingerprint className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle>{t("persons.create.registrationCardTitle")}</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <label className="grid min-h-[280px] cursor-pointer place-items-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-slate-400 hover:bg-white">
                  <input type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => handleRegistrationFileChange(event.target.files?.[0] ?? null)} />
                  <div className="w-full">
                    {registrationPreviewUrl ? (
                      <div className="space-y-4">
                        <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <Image src={registrationPreviewUrl} alt={registrationFile?.name ?? t("persons.create.registrationCardTitle")} fill unoptimized className="object-contain" />
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
                        <div className="mt-4 text-base font-semibold">{t("persons.create.selectImageTitle")}</div>
                        <div className="mt-1 text-sm text-slate-500">{t("persons.create.selectImageHint")}</div>
                      </div>
                    )}
                    <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                      <UploadCloud className="h-4 w-4" />
                      {registrationPreviewUrl ? t("persons.create.changeImage") : t("persons.create.selectImage")}
                    </div>
                  </div>
                </label>

                {registrationFile ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2">
                      <span className="text-sm font-medium">{t("persons.create.originalFileName")}</span>
                      <Input value={registrationFile.name} readOnly />
                    </label>
                    <label className="space-y-2">
                      <span className="text-sm font-medium">{t("persons.create.mimeType")}</span>
                      <Input value={registrationFile.type || "application/octet-stream"} readOnly />
                    </label>
                  </div>
                ) : null}

                <label className="block space-y-2">
                  <span className="text-sm font-medium">{t("persons.create.registrationNotes")}</span>
                  <Textarea value={registrationNotes} onChange={(event) => setRegistrationNotes(event.target.value)} placeholder={t("persons.create.registrationNotesPlaceholder")} />
                </label>
              </CardContent>
            </Card>
          </div>

          {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
          {processingMessage ? <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">{processingMessage}</div> : null}
          {success ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div> : null}

          <div className="flex justify-end gap-2">
            <Button className="ui-button-link ui-button-link-primary" type="submit" disabled={submitting || loadingDepartments}>
              <Save className="h-4 w-4" />
              {submitting ? t("persons.create.saving") : t("persons.create.save")}
            </Button>
            <Link href="/persons" className="ui-button-link ui-button-link-outline">
              {t("persons.create.cancel")}
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
            <div className={toast.variant === "success" ? "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" : toast.variant === "info" ? "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" : "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-950">{toast.title}</div>
              <div className="mt-1 text-slate-600">{toast.description}</div>
            </div>
            <button type="button" onClick={closeToast} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={t("persons.create.closeToast")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function todayValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDuplicatePersonField(error: unknown) {
  if (!(error instanceof ApiError)) return null;
  const message = error.message.toLowerCase();
  const details = getErrorDetailsText(error.details).toLowerCase();

  if (error.code !== "validation_error") return null;
  if (message.includes("employee_code already exists") || message.includes("employee code already exists") || details.includes("employee_code")) return "employee_code";
  if (message.includes("email already exists") || details.includes("email")) return "email";
  if (message.includes("phone already exists") || details.includes("phone")) return "phone";
  return null;
}

function translateFailureReason(message: string, t: ReturnType<typeof useTranslations>) {
  const lowered = message.trim().toLowerCase();

  if (lowered.includes("multiple faces detected")) return "Ảnh có nhiều khuôn mặt. Vui lòng chọn ảnh chỉ có một người.";
  if (lowered.includes("no face detected")) return "Không phát hiện được khuôn mặt trong ảnh. Vui lòng chọn ảnh rõ mặt hơn.";
  if (lowered.includes("face too small")) return "Khuôn mặt trong ảnh quá nhỏ. Vui lòng chọn ảnh gần hơn.";
  if (lowered.includes("blur")) return "Ảnh bị mờ. Vui lòng chọn ảnh rõ nét hơn.";
  if (lowered.includes("low light")) return "Ảnh quá tối. Vui lòng chọn ảnh đủ sáng hơn.";
  if (lowered.includes("spoof")) return "Hệ thống nghi ngờ ảnh không phải khuôn mặt thật hợp lệ.";
  if (lowered.includes("embedding failed")) return "Hệ thống không tạo được đặc trưng khuôn mặt từ ảnh đã tải lên.";
  if (lowered.includes("image is empty")) return "Ảnh tải lên bị trống.";
  if (lowered.includes("too large")) return "Ảnh tải lên quá lớn.";
  if (lowered.includes("unsupported image type")) return t("persons.create.invalidImageType");
  if (lowered.includes("timeout")) return t("persons.create.processingTimeout");
  if (lowered.includes("person not found")) return "Không tìm thấy nhân sự để đăng ký khuôn mặt.";
  if (lowered.includes("registration not found")) return "Không tìm thấy bản đăng ký khuôn mặt.";
  if (lowered.includes("bucket name is required")) return "Thiếu thông tin bucket lưu ảnh.";
  if (lowered.includes("request failed")) return t("errors.system.requestFailed");

  return message.trim();
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
