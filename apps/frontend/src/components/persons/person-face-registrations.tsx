"use client";

import Image from "next/image";
import Link from "next/link";
import { Fingerprint, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { RegistrationStatusBadge } from "@/components/data/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FaceRegistration } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

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
  const [registrations, setRegistrations] = useState(initialRegistrations);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) return;

    const controller = new AbortController();
    async function loadRegistrations() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/v1/persons/${personId}/registrations?page_size=100`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => ({}))) as RegistrationListResponse & { message?: string };
        if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
        setRegistrations(data.items);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Failed to load registrations");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRegistrations();
    return () => controller.abort();
  }, [personId]);

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) return;

    const controller = new AbortController();
    const urls: string[] = [];

    async function loadPreviews() {
      const entries = await Promise.all(
        registrations
          .filter((registration) => registration.face_image_media_asset_id)
          .map(async (registration) => {
            const res = await fetch(`${API_BASE}/api/v1/media-assets/${registration.face_image_media_asset_id}/content`, {
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
    }

    void loadPreviews();
    return () => {
      controller.abort();
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, [registrations]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-100">
              <Fingerprint className="h-4 w-4 text-slate-600" />
            </div>
            <CardTitle>Face registrations</CardTitle>
            {loading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>
          <Link
            href={`/persons/${personId}/face-registrations/new`}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            Đăng ký lại face
          </Link>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        {error ? <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div> : null}
        {registrations.map((registration) => (
          <div key={registration.id} className="rounded-lg border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="truncate font-mono text-xs text-slate-500">{registration.id}</span>
              <RegistrationStatusBadge status={registration.registration_status} />
            </div>
            <div className="grid aspect-video place-items-center overflow-hidden rounded-md bg-slate-100 text-sm text-slate-500">
              {previewUrls[registration.id] ? (
                <Image
                  src={previewUrls[registration.id]}
                  alt="Registered face crop"
                  width={420}
                  height={240}
                  unoptimized
                  className="h-full w-full object-contain"
                />
              ) : (
                "Face crop preview"
              )}
            </div>
            <div className="mt-3 space-y-1 text-sm">
              <div>Model: {registration.embedding_model ?? "N/A"}</div>
              <div>Version: {registration.embedding_version ?? "N/A"}</div>
              <div>Indexed: {registration.indexed_at ? formatDateTime(registration.indexed_at) : "Pending"}</div>
              {registration.validation_notes ? <div className="text-slate-500">{registration.validation_notes}</div> : null}
            </div>
          </div>
        ))}
        {registrations.length === 0 ? <div className="rounded-md border border-dashed border-slate-300 p-6 text-sm text-slate-500">No registrations.</div> : null}
      </CardContent>
    </Card>
  );
}
