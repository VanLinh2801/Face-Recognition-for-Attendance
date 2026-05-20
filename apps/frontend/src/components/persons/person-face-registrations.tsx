"use client";

import Image from "next/image";
import Link from "next/link";
import { Fingerprint, Loader2, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { RegistrationStatusBadge } from "@/components/data/status-badge";
import { useTheme } from "@/components/theme/theme-provider";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { apiFetch } from "@/lib/api-client";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import type { FaceRegistration } from "@/lib/types";
import { cn } from "@/lib/utils";

type RegistrationListResponse = {
  items: FaceRegistration[];
};

export function PersonFaceRegistrations({
  personId,
  initialRegistrations,
}: {
  personId: string;
  initialRegistrations: FaceRegistration[];
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { theme } = useTheme();
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRegistration, setSelectedRegistration] = useState<FaceRegistration | null>(null);
  const registrationDialog = useDialogTransition(selectedRegistration);
  const visibleRegistration = registrationDialog.value;
  const glassCardClass =
    theme === "dark"
      ? "border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
      : "border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl";

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) return;

    const controller = new AbortController();
    async function loadRegistrations() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<RegistrationListResponse>(`/persons/${personId}/registrations?page_size=100`, {
          withAuth: true,
          signal: controller.signal,
        });
        setRegistrations(data.items);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : t("persons.registrations.loadFailed"));
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRegistrations();
    return () => controller.abort();
  }, [personId, t]);

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) return;

    const controller = new AbortController();
    const urls: string[] = [];

    async function loadPreviews() {
      try {
        const entries = await Promise.all(
          registrations
            .filter((registration) => registration.face_image_media_asset_id)
            .map(async (registration) => {
              const res = await fetch(`/api/v1/media-assets/${registration.face_image_media_asset_id}/content`, {
                headers: { authorization: `Bearer ${token}` },
                signal: controller.signal,
              });
              if (!res.ok) return null;
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              urls.push(url);
              return [registration.id, url] as const;
            }),
        );
        if (!controller.signal.aborted) {
          setPreviewUrls(Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => entry !== null)));
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : t("persons.registrations.previewLoadFailed"));
      }
    }

    void loadPreviews();
    return () => {
      controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [registrations, t]);

  return (
    <>
      <Card className={glassCardClass}>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100">
                <Fingerprint className="h-4 w-4 text-slate-600" />
              </div>
              <CardTitle>{t("persons.registrations.title")}</CardTitle>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>
            <Link
              href={`/persons/${personId}/face-registrations/new`}
              className={cn(buttonVariants({ size: "sm" }))}
            >
              <Plus className="h-4 w-4" />
              {t("persons.registrations.addFace")}
            </Link>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {error ? (
            <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {error}
            </div>
          ) : null}
          {registrations.map((registration) => (
            <button
              key={registration.id}
              type="button"
              onClick={() => setSelectedRegistration(registration)}
              className="rounded-lg border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="truncate font-mono text-xs text-slate-500">{registration.id}</span>
                <RegistrationStatusBadge status={registration.registration_status} />
              </div>
              <div className="grid aspect-video place-items-center overflow-hidden rounded-md bg-slate-100 text-sm text-slate-500">
                {previewUrls[registration.id] ? (
                  <Image
                    src={previewUrls[registration.id]}
                    alt={t("persons.registrations.previewAlt")}
                    width={420}
                    height={240}
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                ) : (
                  t("persons.registrations.previewFallback")
                )}
              </div>
              <div className="mt-3 space-y-1 text-sm">
                <div>{t("persons.registrations.model")}: {registration.embedding_model ?? "N/A"}</div>
                <div>{t("persons.registrations.version")}: {registration.embedding_version ?? "N/A"}</div>
                <div>{t("persons.registrations.indexed")}: {registration.indexed_at ? formatDateTimeLocalized(registration.indexed_at, locale) : t("persons.registrations.pending")}</div>
                {registration.validation_notes ? <div className="text-slate-500">{registration.validation_notes}</div> : null}
              </div>
            </button>
          ))}
          {registrations.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">{t("persons.registrations.empty")}</div>
          ) : null}
        </CardContent>
      </Card>

      {visibleRegistration ? (
        <DialogPortal>
          <div
            className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(registrationDialog.visible)}`}
            onMouseDown={() => setSelectedRegistration(null)}
          >
            <div
              className={`flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(registrationDialog.visible)}`}
              onMouseDown={(event) => event.stopPropagation()}
            >
            <div className="flex items-start justify-between border-b border-slate-200 p-5">
              <div>
                <h2 className="text-lg font-semibold">{t("persons.registrations.detailTitle")}</h2>
                <p className="mt-1 font-mono text-xs text-slate-500">{visibleRegistration.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRegistration(null)}
                className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                aria-label={t("persons.registrations.closeDetail")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 overflow-y-auto p-5 lg:grid-cols-[1.25fr_1fr]">
              <div className="space-y-4">
                <div className="grid aspect-video place-items-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100 text-sm text-slate-500">
                  {previewUrls[visibleRegistration.id] ? (
                    <Image
                      src={previewUrls[visibleRegistration.id]}
                      alt={t("persons.registrations.previewAlt")}
                      width={960}
                      height={540}
                      unoptimized
                      className="h-full w-full object-contain"
                    />
                  ) : (
                    t("persons.registrations.previewFallback")
                  )}
                </div>
                {visibleRegistration.validation_notes ? (
                  <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    {visibleRegistration.validation_notes}
                  </div>
                ) : null}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.detail.status")}</span>
                  <RegistrationStatusBadge status={visibleRegistration.registration_status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.model")}</span>
                  <span>{visibleRegistration.embedding_model ?? "N/A"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.version")}</span>
                  <span>{visibleRegistration.embedding_version ?? "N/A"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.indexed")}</span>
                  <span>{visibleRegistration.indexed_at ? formatDateTimeLocalized(visibleRegistration.indexed_at, locale) : t("persons.registrations.pending")}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.created")}</span>
                  <span>{formatDateTimeLocalized(visibleRegistration.created_at, locale)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.updated")}</span>
                  <span>{formatDateTimeLocalized(visibleRegistration.updated_at, locale)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.sourceMedia")}</span>
                  <span className="truncate font-mono text-xs">{visibleRegistration.source_media_asset_id}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.faceMedia")}</span>
                  <span className="truncate font-mono text-xs">{visibleRegistration.face_image_media_asset_id ?? "N/A"}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">{t("persons.registrations.active")}</span>
                  <span>{visibleRegistration.is_active ? t("persons.registrations.yes") : t("persons.registrations.no")}</span>
                </div>
              </div>
            </div>
            </div>
          </div>
        </DialogPortal>
      ) : null}
    </>
  );
}

function formatDateTimeLocalized(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
