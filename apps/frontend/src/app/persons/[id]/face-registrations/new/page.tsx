"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Fingerprint, ImageUp, UploadCloud, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageAmbientWave } from "@/components/data/page-ambient-wave";
import { PageHeader } from "@/components/data/page-header";
import { useTheme } from "@/components/theme/theme-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import { getLatestIndexedProfileAssetId } from "@/lib/person-profile-image";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import { useCachedMediaAsset } from "@/lib/use-cached-media-asset";
import type { CreatePersonRegistrationResponse, Department, FaceRegistration, PageResult, Person } from "@/lib/types";

const allowedImageTypes = new Set(["image/jpeg", "image/png"]);
const REGISTRATION_POLL_INTERVAL_MS = 2000;
const REGISTRATION_POLL_TIMEOUT_MS = 60000;

type ToastState = {
  title: string;
  description: string;
  variant: "success" | "danger" | "info";
} | null;

type Translator = ReturnType<typeof useTranslations>;

export default function NewPersonFaceRegistrationPage() {
  const t = useTranslations();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const personId = params.id;
  const [person, setPerson] = useState<Person | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [registrations, setRegistrations] = useState<FaceRegistration[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreviewUrl, setSelectedFilePreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processingRegistration, setProcessingRegistration] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const profileImageAssetId = getLatestIndexedProfileAssetId(registrations);
  const profileImage = useCachedMediaAsset(profileImageAssetId);
  const glassCardClass =
    theme === "dark"
      ? "border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
      : "border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl";

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
        const [personData, departmentsPage, registrationsPage] = await Promise.all([
          apiFetch<Person>(`/persons/${personId}`, { withAuth: true }),
          apiFetch<PageResult<Department>>("/departments?page=1&page_size=100", { withAuth: true }),
          apiFetch<PageResult<FaceRegistration>>(`/persons/${personId}/registrations?page=1&page_size=20`, { withAuth: true }),
        ]);

        if (cancelled) return;

        setPerson(personData);
        setDepartments(departmentsPage.items);
        setRegistrations(registrationsPage.items);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? getTranslatedBackendError(t, err, "persons") : t("persons.addFace.loadFailed"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadRegistrationContext();

    return () => {
      cancelled = true;
    };
  }, [personId, router, t]);

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), toast.variant === "info" ? 1800 : 3500);
    const removeTimer = window.setTimeout(() => setToast(null), toast.variant === "info" ? 2150 : 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  useEffect(() => {
    return () => {
      if (selectedFilePreviewUrl) {
        URL.revokeObjectURL(selectedFilePreviewUrl);
      }
    };
  }, [selectedFilePreviewUrl]);

  const departmentName = useMemo(() => {
    if (!person?.department_id) return t("common.notAssigned");
    return departments.find((department) => department.id === person.department_id)?.name ?? t("common.unknown");
  }, [departments, person, t]);

  function showToast(nextToast: NonNullable<ToastState>) {
    setToast(nextToast);
    setToastVisible(true);
  }

  function closeToast() {
    setToastVisible(false);
    window.setTimeout(() => setToast(null), 300);
  }

  function handleFileChange(file: File | null) {
    if (selectedFilePreviewUrl) {
      URL.revokeObjectURL(selectedFilePreviewUrl);
    }

    if (!file) {
      setSelectedFile(null);
      setSelectedFilePreviewUrl(null);
      return;
    }

    if (!allowedImageTypes.has(file.type)) {
      setSelectedFile(null);
      setSelectedFilePreviewUrl(null);
      showToast({
        title: t("persons.addFace.invalidImageTitle"),
        description: t("persons.addFace.invalidImageDescription"),
        variant: "danger",
      });
      return;
    }

    setSelectedFile(file);
    setSelectedFilePreviewUrl(URL.createObjectURL(file));
  }

  async function waitForRegistrationCompletion(personIdValue: string, registrationId: string) {
    const startedAt = Date.now();

    while (Date.now() - startedAt < REGISTRATION_POLL_TIMEOUT_MS) {
      const registration = await apiFetch<FaceRegistration>(`/persons/${personIdValue}/registrations/${registrationId}`, {
        withAuth: true,
      });

      if (registration.registration_status === "indexed") {
        return registration;
      }
      if (registration.registration_status === "failed") {
        const failureReason = registration.validation_notes?.trim();
        throw new Error(
          failureReason && failureReason.length > 0
            ? translateFailureReason(failureReason, t)
            : t("persons.addFace.registrationFailedAfterProcessing"),
        );
      }

      await new Promise((resolve) => window.setTimeout(resolve, REGISTRATION_POLL_INTERVAL_MS));
    }

    throw new Error(t("persons.addFace.processingTimeout"));
  }

  async function submitRegistration() {
    if (!person) return;

    if (!selectedFile) {
      showToast({
        title: t("persons.addFace.missingImageTitle"),
        description: t("persons.addFace.missingImageDescription"),
        variant: "danger",
      });
      return;
    }

    if (!allowedImageTypes.has(selectedFile.type)) {
      showToast({
        title: t("persons.addFace.invalidImageTitle"),
        description: t("persons.addFace.invalidImageDescription"),
        variant: "danger",
      });
      return;
    }

    setSubmitting(true);
    setProcessingRegistration(false);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("requested_by_person_id", person.id);
      if (notes.trim()) {
        formData.append("notes", notes.trim());
      }

      const response = await apiFetch<CreatePersonRegistrationResponse>(`/persons/${person.id}/registrations/upload`, {
        method: "POST",
        withAuth: true,
        body: formData,
      });

      setProcessingRegistration(true);
      showToast({
        title: t("persons.addFace.processingTitle"),
        description: t("persons.addFace.processingDescription"),
        variant: "info",
      });

      await waitForRegistrationCompletion(person.id, response.registration.id);

      setProcessingRegistration(false);
      showToast({
        title: t("persons.addFace.successTitle"),
        description: t("persons.addFace.successDescription"),
        variant: "success",
      });
      window.setTimeout(() => router.push(`/persons/${person.id}`), 1500);
    } catch (err) {
      setProcessingRegistration(false);
      showToast({
        title: t("persons.addFace.failedTitle"),
        description: getLocalizedRegistrationError(err, t),
        variant: "danger",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
      <PageHeader
        title={t("persons.addFace.pageTitle")}
        description={
          person
            ? t("persons.addFace.pageDescriptionWithName", { name: person.full_name })
            : t("persons.addFace.pageDescription")
        }
      />

      <div className="relative z-10 mx-auto max-w-6xl space-y-4 p-6">
        <Link
          href={person ? `/persons/${person.id}` : "/persons"}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("persons.addFace.backToDetail")}
        </Link>

        {loading ? <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500">{t("persons.addFace.loading")}</div> : null}

        {!loading && error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
        ) : null}

        {!loading && !error && person ? (
          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <Card className={glassCardClass}>
              <CardHeader>
                <CardTitle>{t("persons.addFace.selectedPersonTitle")}</CardTitle>
                <CardDescription>{t("persons.addFace.selectedPersonDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative grid aspect-square overflow-hidden rounded-lg bg-slate-100">
                  {profileImage.status === "loading" ? <div className="absolute inset-0 animate-pulse bg-slate-200/70" aria-hidden="true" /> : null}
                  <div className="grid h-full w-full place-items-center text-5xl font-semibold text-slate-400">
                    {person.full_name.split(" ").slice(-1)[0]?.[0] ?? "?"}
                  </div>
                  {profileImage.src ? (
                    <Image
                      src={profileImage.src}
                      alt={`${t("persons.addFace.selectedPersonTitle")} ${person.full_name}`}
                      width={640}
                      height={640}
                      unoptimized
                      className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200 opacity-100"
                    />
                  ) : null}
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">{t("persons.addFace.employeeCode")}</span>
                    <span className="font-mono text-xs">{person.employee_code}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">{t("persons.addFace.fullName")}</span>
                    <span className="font-medium">{person.full_name}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">{t("persons.addFace.department")}</span>
                    <span>{departmentName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-slate-500">{t("persons.addFace.title")}</span>
                    <span>{person.title || t("common.unknown")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={glassCardClass}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
                    <Fingerprint className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle>{t("persons.addFace.registrationCardTitle")}</CardTitle>
                    <CardDescription>{t("persons.addFace.registrationCardDescription")}</CardDescription>
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
                  <div className="w-full">
                    {selectedFilePreviewUrl ? (
                      <div className="space-y-4">
                        <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <Image
                            src={selectedFilePreviewUrl}
                            alt={selectedFile?.name ?? t("persons.addFace.imageAlt")}
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                        <div className="text-base font-semibold">{selectedFile?.name}</div>
                        <div className="text-sm text-slate-500">
                          {selectedFile?.type} · {selectedFile ? (selectedFile.size / 1024).toFixed(1) : "0.0"} KB
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
                          <ImageUp className="h-7 w-7 text-slate-500" />
                        </div>
                        <div className="mt-4 text-base font-semibold">{t("persons.addFace.selectImageTitle")}</div>
                        <div className="mt-1 text-sm text-slate-500">{t("persons.addFace.selectImageHint")}</div>
                      </div>
                    )}
                    <div className="mt-4 inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white">
                      <UploadCloud className="h-4 w-4" />
                      {selectedFilePreviewUrl ? t("persons.addFace.changeImage") : t("persons.addFace.selectImage")}
                    </div>
                  </div>
                </label>

                <label className="block space-y-2">
                  <span className="text-sm font-medium">{t("persons.addFace.notes")}</span>
                  <Textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={t("persons.addFace.notesPlaceholder")}
                  />
                </label>

                <div className="flex flex-col gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2 text-sm text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span>{t("persons.addFace.flowHint")}</span>
                  </div>
                  <Button className="ui-button-link ui-button-link-primary" onClick={submitRegistration} disabled={submitting}>
                    <Fingerprint className="h-4 w-4" />
                    {submitting
                      ? processingRegistration
                        ? t("persons.addFace.processing")
                        : t("persons.addFace.submitting")
                      : t("persons.addFace.submit")}
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
          } ${toast.variant === "danger" ? "border-red-200" : toast.variant === "info" ? "border-sky-200" : "border-emerald-200"}`}
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div
                className={
                  toast.variant === "danger"
                    ? "font-semibold text-red-800"
                    : toast.variant === "info"
                      ? "font-semibold text-sky-800"
                      : "font-semibold text-emerald-800"
                }
              >
                {toast.title}
              </div>
              <div className="mt-1 text-sm text-slate-600">{toast.description}</div>
            </div>
            <button
              type="button"
              onClick={closeToast}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"
              aria-label={t("persons.addFace.closeToast")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getLocalizedRegistrationError(error: unknown, t: Translator) {
  if (error instanceof ApiError) {
    const translated = translateFailureReason(error.message, t);
    if (translated !== error.message.trim()) {
      return translated;
    }
    return getTranslatedBackendError(t, error, "registrations");
  }

  if (error instanceof Error) {
    return translateFailureReason(error.message, t);
  }

  return t("persons.addFace.failedDescription");
}

function translateFailureReason(message: string, t: Translator) {
  const normalized = message.trim();
  const lowered = normalized.toLowerCase();

  if (lowered.includes("multiple faces detected")) return t("persons.addFace.multipleFacesDetected");
  if (lowered.includes("no face detected")) return t("persons.addFace.noFaceDetected");
  if (lowered.includes("face too small")) return t("persons.addFace.faceTooSmall");
  if (lowered.includes("blur")) return t("persons.addFace.blurredImage");
  if (lowered.includes("low light")) return t("persons.addFace.lowLightImage");
  if (lowered.includes("spoof")) return t("persons.addFace.spoofSuspected");
  if (lowered.includes("embedding failed")) return t("persons.addFace.embeddingFailed");
  if (lowered.includes("image is empty")) return t("persons.addFace.emptyImage");
  if (lowered.includes("too large")) return t("persons.addFace.imageTooLarge");
  if (lowered.includes("unsupported image type")) return t("persons.addFace.invalidImageDescription");
  if (lowered.includes("timeout")) return t("persons.addFace.processingTimeout");
  if (lowered.includes("person not found")) return t("persons.addFace.personNotFound");
  if (lowered.includes("registration not found")) return t("persons.addFace.registrationNotFound");
  if (lowered.includes("bucket name is required")) return t("persons.addFace.missingBucket");
  if (lowered.includes("request failed")) return t("errors.system.requestFailed");

  return normalized;
}
