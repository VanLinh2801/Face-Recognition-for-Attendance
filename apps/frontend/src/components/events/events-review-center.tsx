"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  FileJson,
  ImageIcon,
  Loader2,
  Radio,
  ShieldAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DirectionBadge, ReviewStatusBadge, SeverityBadge } from "@/components/data/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input, Select, Textarea } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import type { EventFeedItem, EventFeedType, MediaAsset, ReviewStatus, UpdateEventReviewRequest } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";
import { formatDateTime, percent } from "@/lib/utils";

type EventType = "all" | EventFeedType;
type EventKey = `${EventFeedType}:${string}`;

const typeMeta = {
  recognition: { icon: Radio, badge: "success" as const, label: "Recognition" },
  unknown: { icon: AlertTriangle, badge: "warning" as const, label: "Unknown" },
  spoof: { icon: ShieldAlert, badge: "danger" as const, label: "Spoof" },
};

export function EventsReviewCenter({
  rows,
  loading,
  error,
  activeType,
  query,
  fromTime,
  toTime,
  onTypeChange,
  onQueryChange,
  onFromTimeChange,
  onToTimeChange,
  onRefresh,
}: {
  rows: EventFeedItem[];
  loading: boolean;
  error: string;
  activeType: EventType;
  query: string;
  fromTime: string;
  toTime: string;
  onTypeChange: (value: EventType) => void;
  onQueryChange: (value: string) => void;
  onFromTimeChange: (value: string) => void;
  onToTimeChange: (value: string) => void;
  onRefresh: (signal?: AbortSignal) => Promise<void>;
}) {
  const [selectedEventKey, setSelectedEventKey] = useState<EventKey | null>(null);

  const selectedEvent = useMemo(() => {
    if (!selectedEventKey) return null;
    return rows.find((row) => toEventKey(row) === selectedEventKey) ?? null;
  }, [rows, selectedEventKey]);

  const eventDialog = useDialogTransition(selectedEvent);
  const visibleEvent = eventDialog.value;

  const counts = {
    recognition: rows.filter((row) => row.type === "recognition").length,
    unknown: rows.filter((row) => row.type === "unknown").length,
    spoof: rows.filter((row) => row.type === "spoof").length,
    unreviewed: rows.filter((row) => row.review_status === "new" || row.severity === "high").length,
  };

  const summaryCards: Array<{ label: string; value: number; icon: LucideIcon }> = [
    { label: "Recognition", value: counts.recognition, icon: Radio },
    { label: "Unknown", value: counts.unknown, icon: AlertTriangle },
    { label: "Spoof alerts", value: counts.spoof, icon: ShieldAlert },
    { label: "Needs review", value: counts.unreviewed, icon: Eye },
  ];

  return (
    <div className="space-y-4 p-6">
      <section className="grid gap-4 md:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
              <div className="grid h-11 w-11 place-items-center rounded-md bg-slate-100">
                <Icon className="h-5 w-5 text-slate-600" />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", "Tất cả"],
              ["recognition", "Recognition"],
              ["unknown", "Unknown"],
              ["spoof", "Spoof"],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onTypeChange(value as EventType)}
                className={
                  activeType === value
                    ? "h-9 rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
                    : "h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                }
              >
                {label}
              </button>
            ))}
          </div>

          <div className="grid items-end gap-3 md:grid-cols-[minmax(320px,0.8fr)_260px_260px]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-transparent">Search</span>
              <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search event id, person, source" />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">From</span>
              <DateTimePicker value={fromTime} onChange={onFromTimeChange} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">To</span>
              <DateTimePicker value={toTime} onChange={onToTimeChange} />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">Loading events...</div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-14 py-3">No.</th>
                  <th className="w-36">Type</th>
                  <th className="w-40">Occurred at</th>
                  <th>Person</th>
                  <th className="w-24">Direction</th>
                  <th className="w-24">Score</th>
                  <th className="w-24 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const meta = typeMeta[row.type];
                  return (
                    <tr key={toEventKey(row)} className="border-b border-slate-100">
                      <td className="py-3 font-mono text-xs text-slate-500">{index + 1}</td>
                      <td>
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                      </td>
                      <td className="font-mono text-xs text-slate-500">{formatDateTime(row.occurred_at)}</td>
                      <td className="truncate pr-4">
                        {row.person_id ? (
                          <Link href={`/persons/${row.person_id}`} className="font-medium text-slate-900 hover:underline">
                            {row.person_name ?? "Unknown"}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.person_name ?? "Unknown"}</span>
                        )}
                      </td>
                      <td>{row.direction ? <DirectionBadge direction={row.direction} /> : <span className="text-slate-400">N/A</span>}</td>
                      <td>{percent(row.score)}</td>
                      <td className="text-right">
                        <Button variant="outline" size="sm" onClick={() => setSelectedEventKey(toEventKey(row))}>
                          <Eye className="h-4 w-4" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && !error && rows.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No events match the current filters.
            </div>
          ) : null}
          <div className="mt-4 text-sm text-slate-500">{rows.length} events</div>
        </CardContent>
      </Card>

      {visibleEvent ? (
        <EventDetailDrawer
          key={getEventRevisionKey(visibleEvent)}
          event={visibleEvent}
          visible={eventDialog.visible}
          onClose={() => setSelectedEventKey(null)}
          onRefresh={onRefresh}
        />
      ) : null}
    </div>
  );
}

function DateTimePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(datePart(value)));
  const selectedDate = parseDate(datePart(value));
  const days = calendarDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" });

  useOutsideClick(containerRef, open, () => setOpen(false));

  function shiftMonth(offset: number) {
    setVisibleMonth((current) => new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1)));
  }

  function updateDate(nextDate: string) {
    onChange(`${nextDate}T${timePart(value)}`);
    setOpen(false);
  }

  function updateTime(nextTime: string) {
    onChange(`${datePart(value)}T${nextTime}`);
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
          <span className="truncate font-medium text-slate-800">{formatDateTimeInputLabel(value)}</span>
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
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold capitalize text-slate-950">{monthLabel}</div>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Next month"
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
                const nextDate = toDateValue(day);
                const inMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();
                const selected = sameDay(day, selectedDate);

                return (
                  <button
                    key={nextDate}
                    type="button"
                    onClick={() => updateDate(nextDate)}
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

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <span className="text-xs font-medium text-slate-500">Time</span>
              <Input className="w-32" type="time" value={timePart(value)} onChange={(event) => updateTime(event.target.value)} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EventDetailDrawer({
  event,
  visible,
  onClose,
  onRefresh,
}: {
  event: EventFeedItem;
  visible: boolean;
  onClose: () => void;
  onRefresh: (signal?: AbortSignal) => Promise<void>;
}) {
  const meta = typeMeta[event.type];
  const Icon = meta.icon;
  const initialNotes = getEventNotes(event);
  const [mediaAsset, setMediaAsset] = useState<MediaAsset | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaLoading, setMediaLoading] = useState(Boolean(event.snapshot_media_asset_id));
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>(event.review_status ?? "new");
  const [reviewNotes, setReviewNotes] = useState(initialNotes);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaPreviewUrl) return;
    return () => URL.revokeObjectURL(mediaPreviewUrl);
  }, [mediaPreviewUrl]);

  useEffect(() => {
    const assetId = event.snapshot_media_asset_id;
    const token = getAccessToken();

    if (!assetId || !token) {
      return;
    }

    const controller = new AbortController();

    async function loadMedia() {
      try {
        await Promise.resolve();
        if (controller.signal.aborted) return;

        const asset = await apiFetch<MediaAsset>(`/media-assets/${assetId}`, {
          withAuth: true,
          signal: controller.signal,
        });
        const response = await fetch(`/api/v1/media-assets/${assetId}/content`, {
          headers: { authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to load media content.");
        }
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        const previewUrl = URL.createObjectURL(blob);
        setMediaAsset(asset);
        setMediaPreviewUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return previewUrl;
        });
      } catch (err) {
        if (controller.signal.aborted) return;
        setMediaAsset(null);
        setMediaError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Failed to load media.");
      } finally {
        if (!controller.signal.aborted) {
          setMediaLoading(false);
        }
      }
    }

    void loadMedia();

    return () => controller.abort();
  }, [event.snapshot_media_asset_id]);

  const detailJson = JSON.stringify(
    {
      id: event.id,
      type: event.type,
      occurred_at: event.occurred_at,
      person_id: event.person_id,
      direction: event.direction,
      score: event.score,
      spoof_score: event.spoof_score,
      source: event.source,
      status: event.status,
      severity: event.severity,
      review_status: event.review_status,
      metadata: event.metadata,
      raw_payload: event.raw_payload,
    },
    null,
    2,
  );

  async function handleReviewSubmit() {
    if (event.type === "recognition") return;

    setReviewSaving(true);
    setReviewError(null);
    setReviewSuccess(null);

    const payload: UpdateEventReviewRequest = {
      review_status: reviewStatus,
      notes: reviewNotes.trim() ? reviewNotes.trim() : null,
    };

    try {
      if (event.type === "unknown") {
        await apiFetch(`/unknown-events/${event.id}`, {
          method: "PATCH",
          withAuth: true,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch(`/spoof-alert-events/${event.id}`, {
          method: "PATCH",
          withAuth: true,
          body: JSON.stringify(payload),
        });
      }
      await onRefresh();
      setReviewSuccess("Review updated.");
    } catch (err) {
      setReviewError(err instanceof ApiError ? err.message : "Failed to update review.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function handleCopyJson() {
    try {
      await navigator.clipboard.writeText(detailJson);
    } catch {
      setReviewError("Failed to copy raw payload.");
    }
  }

  return (
    <div className={`fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(visible)}`} onMouseDown={onClose}>
      <div
        className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(visible)}`}
        onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
              <Icon className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Event details</h2>
                <Badge variant={meta.badge}>{meta.label}</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">{event.id}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close event details">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                Media snapshot
              </div>
              {mediaLoading ? (
                <div className="grid aspect-video min-h-[360px] place-items-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading media...
                  </div>
                </div>
              ) : mediaAsset ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid aspect-video min-h-[360px] place-items-center overflow-hidden rounded-md bg-slate-200 text-sm text-slate-500">
                    {mediaPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaPreviewUrl} alt={mediaAsset.original_filename} className="h-full w-full object-contain" />
                    ) : (
                      "Snapshot preview"
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="font-medium text-slate-900">{mediaAsset.original_filename}</div>
                    <div className="font-mono text-slate-500">bucket: {mediaAsset.bucket_name}</div>
                    <div className="font-mono text-slate-500">object: {mediaAsset.object_key}</div>
                    <div className="text-slate-500">
                      {mediaAsset.mime_type} · {Math.round(mediaAsset.file_size / 1024)} KB
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid aspect-video min-h-[360px] place-items-center rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  {mediaError ?? (event.snapshot_media_asset_id ? "No media preview is available for this event." : "This event does not have a linked snapshot.")}
                </div>
              )}
            </section>

            <div className="space-y-5">
              <section className="grid gap-3">
                <DetailItem label="Occurred at" value={formatDateTime(event.occurred_at)} />
                <DetailItem label="Source" value={event.source} />
                <DetailItem label="Person" value={event.person_name ?? "Unknown"} />
                <DetailItem label="Direction" value={event.direction ?? "N/A"} />
                <DetailItem label="Score" value={percent(event.score)} />
                <DetailItem label="Spoof score" value={percent(event.spoof_score)} />
              </section>

              {event.type !== "recognition" ? (
                <section className="rounded-lg border border-slate-200 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="font-medium">Review</div>
                    <div className="flex items-center gap-2">
                      <ReviewStatusBadge status={reviewStatus} />
                      {event.severity ? <SeverityBadge severity={event.severity} /> : null}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-500">Review status</span>
                      <Select value={reviewStatus} onChange={(changeEvent) => setReviewStatus(changeEvent.target.value as ReviewStatus)} disabled={reviewSaving}>
                        <option value="new">new</option>
                        <option value="reviewed">reviewed</option>
                        <option value="ignored">ignored</option>
                      </Select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-xs font-medium text-slate-500">Notes</span>
                      <Textarea value={reviewNotes} onChange={(changeEvent) => setReviewNotes(changeEvent.target.value)} disabled={reviewSaving} />
                    </label>
                    {reviewError ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{reviewError}</div> : null}
                    {reviewSuccess ? <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">{reviewSuccess}</div> : null}
                    <div className="flex justify-end">
                      <Button onClick={() => void handleReviewSubmit()} disabled={reviewSaving}>
                        {reviewSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Save review
                      </Button>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 font-medium">
                    <FileJson className="h-4 w-4 text-slate-500" />
                    Raw payload
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void handleCopyJson()}>
                    <Copy className="h-4 w-4" />
                    Copy
                  </Button>
                </div>
                <pre className="max-h-80 overflow-auto rounded-md bg-slate-950 p-4 text-xs text-slate-100">{detailJson}</pre>
              </section>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
          {event.person_id ? (
            <Link
              href={`/persons/${event.person_id}`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              Open person profile
            </Link>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 truncate text-sm font-medium">{value}</div>
    </div>
  );
}

function toEventKey(event: Pick<EventFeedItem, "type" | "id">): EventKey {
  return `${event.type}:${event.id}`;
}

function getEventRevisionKey(event: EventFeedItem) {
  return `${toEventKey(event)}:${event.review_status ?? ""}:${getEventNotes(event)}`;
}

function getEventNotes(event: EventFeedItem) {
  return typeof event.metadata.notes === "string" ? event.metadata.notes : "";
}

function datePart(value: string) {
  return value.slice(0, 10);
}

function timePart(value: string) {
  return value.slice(11, 16) || "00:00";
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

function formatDateTimeInputLabel(value: string) {
  return `${parseDate(datePart(value)).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })} ${timePart(value)}`;
}
