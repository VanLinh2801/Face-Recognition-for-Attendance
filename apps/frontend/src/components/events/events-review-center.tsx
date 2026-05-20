"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertTriangle,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  ImageIcon,
  Loader2,
  Radio,
  ShieldAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ListTableAccent } from "@/components/data/list-table-accent";
import { useTheme } from "@/components/theme/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogPortal } from "@/components/ui/dialog-portal";
import { Input } from "@/components/ui/input";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import { canReviewEvent, isEventPendingReview, markEventAsReviewed, normalizeEventReviewStatus } from "@/lib/event-review";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { EventFeedItem, EventFeedType, MediaAsset } from "@/lib/types";
import { dialogOverlayClass, dialogPanelClass, useDialogTransition } from "@/lib/use-dialog-transition";
import { useOutsideClick } from "@/lib/use-outside-click";

type EventType = "all" | EventFeedType;
type EventKey = `${EventFeedType}:${string}`;
type ToastState = {
  title: string;
  description: string;
  variant: "success" | "danger";
} | null;

const typeMeta = {
  recognition: { icon: Radio, badge: "success" as const, labelKey: "events.summary.recognition" },
  unknown: { icon: AlertTriangle, badge: "warning" as const, labelKey: "events.summary.unknown" },
  spoof: { icon: ShieldAlert, badge: "danger" as const, labelKey: "events.summary.spoof" },
};

export function EventsReviewCenter({
  rows,
  total,
  currentPage,
  pageSize,
  loading,
  error,
  activeType,
  query,
  fromTime,
  toTime,
  retentionDays,
  minTime,
  maxTime,
  selectedEventId,
  onTypeChange,
  onQueryChange,
  onFromTimeChange,
  onToTimeChange,
  onPageChange,
}: {
  rows: EventFeedItem[];
  total: number;
  currentPage: number;
  pageSize: number;
  loading: boolean;
  error: string;
  activeType: EventType;
  query: string;
  fromTime: string;
  toTime: string;
  retentionDays: number | null;
  minTime: string | null;
  maxTime: string | null;
  selectedEventId?: string | null;
  onTypeChange: (value: EventType) => void;
  onQueryChange: (value: string) => void;
  onFromTimeChange: (value: string) => void;
  onToTimeChange: (value: string) => void;
  onPageChange: (value: number) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const { theme } = useTheme();
  const [selectedEventKey, setSelectedEventKey] = useState<EventKey | null>(null);
  const [reviewingKeys, setReviewingKeys] = useState<EventKey[]>([]);
  const [bulkReviewing, setBulkReviewing] = useState(false);
  const [reviewOverrides, setReviewOverrides] = useState<Partial<Record<EventKey, EventFeedItem>>>({});
  const [toast, setToast] = useState<ToastState>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const displayRows = useMemo(() => rows.map((row) => reviewOverrides[toEventKey(row)] ?? row), [reviewOverrides, rows]);

  useEffect(() => {
    if (!selectedEventId) return;
    const matchingRow = displayRows.find((row) => row.id === selectedEventId);
    if (!matchingRow) return;
    const nextEventKey = toEventKey(matchingRow);
    const syncTimer = window.setTimeout(() => {
      setSelectedEventKey((current) => (current === nextEventKey ? current : nextEventKey));
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [displayRows, selectedEventId]);

  const selectedEvent = useMemo(() => {
    if (!selectedEventKey) return null;
    return displayRows.find((row) => toEventKey(row) === selectedEventKey) ?? null;
  }, [displayRows, selectedEventKey]);

  const eventDialog = useDialogTransition(selectedEvent);
  const visibleEvent = eventDialog.value;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * pageSize;
  const pageRangeStart = total === 0 ? 0 : pageStartIndex + 1;
  const pageRangeEnd = Math.min(pageStartIndex + displayRows.length, total);
  const paginationPages = getVisiblePageNumbers(safeCurrentPage, totalPages);
  const pendingReviewRows = useMemo(() => displayRows.filter(isEventPendingReview), [displayRows]);

  useEffect(() => {
    if (!toast) return;
    const hideTimer = window.setTimeout(() => setToastVisible(false), 3500);
    const removeTimer = window.setTimeout(() => setToast(null), 3850);

    return () => {
      window.clearTimeout(hideTimer);
      window.clearTimeout(removeTimer);
    };
  }, [toast]);

  const counts = {
    recognition: displayRows.filter((row) => row.type === "recognition").length,
    unknown: displayRows.filter((row) => row.type === "unknown").length,
    spoof: displayRows.filter((row) => row.type === "spoof").length,
    unreviewed: pendingReviewRows.length,
  };

  const summaryCards: Array<{ label: string; value: number; icon: LucideIcon; iconClassName: string; iconShellClassName: string }> = [
    {
      label: t("events.summary.recognition"),
      value: counts.recognition,
      icon: Radio,
      iconClassName: "text-white",
      iconShellClassName: "bg-blue-600 ring-1 ring-blue-800/35 dark:bg-blue-500 dark:ring-blue-200/20",
    },
    {
      label: t("events.summary.unknown"),
      value: counts.unknown,
      icon: AlertTriangle,
      iconClassName: "text-white",
      iconShellClassName: "bg-orange-500 ring-1 ring-orange-700/35 dark:bg-orange-400 dark:ring-orange-200/20",
    },
    {
      label: t("events.summary.spoof"),
      value: counts.spoof,
      icon: ShieldAlert,
      iconClassName: "text-white",
      iconShellClassName: "bg-rose-600 ring-1 ring-rose-800/35 dark:bg-rose-500 dark:ring-rose-200/20",
    },
    {
      label: t("events.summary.needsReview"),
      value: counts.unreviewed,
      icon: Eye,
      iconClassName: "text-white",
      iconShellClassName: "bg-fuchsia-600 ring-1 ring-fuchsia-800/35 dark:bg-fuchsia-500 dark:ring-fuchsia-200/20",
    },
  ];

  function showToast(nextToast: NonNullable<ToastState>) {
    setToast(nextToast);
    setToastVisible(true);
  }

  function closeToast() {
    setToastVisible(false);
    window.setTimeout(() => setToast(null), 300);
  }

  async function handleReviewRow(row: EventFeedItem) {
    const key = toEventKey(row);

    setReviewingKeys((current) => (current.includes(key) ? current : [...current, key]));
    setReviewOverrides((current) => ({
      ...current,
      [key]: buildReviewedEvent(row),
    }));

    try {
      await markEventAsReviewed(row);
      showToast({
        title: t("events.review.successTitle"),
        description: t("events.review.successDescription", { id: row.id }),
        variant: "success",
      });
    } catch (err) {
      setReviewOverrides((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      showToast({
        title: t("events.review.failedTitle"),
        description: err instanceof ApiError ? getTranslatedBackendError(t, err, row.type === "spoof" ? "spoofEvents" : "unknownEvents") : t("events.review.failedDescription"),
        variant: "danger",
      });
    } finally {
      setReviewingKeys((current) => current.filter((value) => value !== key));
    }
  }

  async function handleReviewAllPending() {
    if (pendingReviewRows.length === 0) return;

    const keys = pendingReviewRows.map((row) => toEventKey(row));
    setBulkReviewing(true);
    setReviewingKeys((current) => Array.from(new Set([...current, ...keys])));
    setReviewOverrides((current) => ({
      ...current,
      ...Object.fromEntries(pendingReviewRows.map((row) => [toEventKey(row), buildReviewedEvent(row)])),
    }));

    const results = await Promise.allSettled(pendingReviewRows.map((row) => markEventAsReviewed(row)));
    const failedKeys = results.flatMap((result, index) => (result.status === "rejected" ? [keys[index]] : []));
    const succeededCount = results.length - failedKeys.length;

    if (failedKeys.length > 0) {
      setReviewOverrides((current) => {
        const next = { ...current };
        for (const key of failedKeys) delete next[key];
        return next;
      });
      const failedMessages = results
        .filter((result): result is PromiseRejectedResult => result.status === "rejected")
        .map((result) =>
          result.reason instanceof ApiError
            ? getTranslatedBackendError(t, result.reason)
            : t("events.review.failedDescription"),
        );
      showToast({
        title: succeededCount > 0 ? t("events.review.partialTitle") : t("events.review.failedTitle"),
        description:
          succeededCount > 0
            ? `${t("events.review.bulkSuccessDescription", {
                count: succeededCount,
                suffix: succeededCount === 1 ? "" : "s",
              })} ${failedMessages[0] ?? ""}`.trim()
            : failedMessages[0] ?? t("events.review.failedDescription"),
        variant: "danger",
      });
    } else if (succeededCount > 0) {
      showToast({
        title: t("events.review.bulkSuccessTitle"),
        description: t("events.review.bulkSuccessDescription", { count: succeededCount, suffix: succeededCount === 1 ? "" : "s" }),
        variant: "success",
      });
    }

    setReviewingKeys((current) => current.filter((value) => !keys.includes(value)));
    setBulkReviewing(false);
  }

  return (
    <div className="space-y-4 p-6">
      <section className="grid gap-4 md:grid-cols-4">
        {summaryCards.map(({ label, value, icon: Icon, iconClassName, iconShellClassName }) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-semibold">{value}</div>
                <div className="text-sm text-slate-500">{label}</div>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-xl shadow-sm ${iconShellClassName}`}>
                <Icon className={`h-5 w-5 ${iconClassName}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card
        className={
          theme === "dark"
            ? "relative z-20 border-white/8 bg-[rgba(15,27,45,0.42)] shadow-[0_18px_42px_rgba(2,6,23,0.24)] backdrop-blur-xl"
            : "relative z-20 border-white/10 bg-[rgba(255,255,255,0.58)] shadow-[0_18px_42px_rgba(15,23,42,0.08)] backdrop-blur-xl"
        }
      >
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {([
              ["all", t("events.filters.all")],
              ["recognition", t("events.filters.recognition")],
              ["unknown", t("events.filters.unknown")],
              ["spoof", t("events.filters.spoof")],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant={activeType === value ? "default" : "outline"}
                size="sm"
                onClick={() => onTypeChange(value as EventType)}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="grid items-end gap-3 md:grid-cols-[minmax(320px,0.8fr)_260px_260px]">
            <label className="space-y-1">
              <span className="text-xs font-medium text-transparent">{t("events.filters.searchLabel")}</span>
              <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder={t("events.filters.searchPlaceholder")} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">{t("events.filters.from")}</span>
              <DateTimePicker value={fromTime} onChange={onFromTimeChange} minValue={minTime} maxValue={maxTime} />
            </label>
            <label className="space-y-1">
              <span className="text-xs font-medium text-slate-500">{t("events.filters.to")}</span>
              <DateTimePicker value={toTime} onChange={onToTimeChange} minValue={minTime} maxValue={maxTime} />
            </label>
          </div>
          {retentionDays ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {t("events.filters.retentionHint", { days: retentionDays })}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="relative z-10 list-table-corner-accent">
        <ListTableAccent />
        <CardContent>
          {loading ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">{t("events.table.loading")}</div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
          ) : null}
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1" />
            <Button variant="outline" disabled={pendingReviewRows.length === 0 || bulkReviewing} onClick={() => void handleReviewAllPending()}>
              {bulkReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("events.table.reviewAllPending", { count: pendingReviewRows.length })}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] table-fixed text-left text-sm">
              <thead className="text-xs uppercase text-slate-500">
                <tr className="border-b border-slate-200">
                  <th className="w-14 py-3">{t("events.table.index")}</th>
                  <th className="w-36">{t("events.table.type")}</th>
                  <th className="w-40">{t("events.table.occurredAt")}</th>
                  <th className="w-56">{t("events.table.person")}</th>
                  <th className="w-48">{t("events.table.status")}</th>
                  <th className="w-24">{t("events.table.score")}</th>
                  <th className="w-44 text-right">{t("events.table.action")}</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => {
                  const meta = typeMeta[row.type];
                  const eventKey = toEventKey(row);
                  const rowReviewing = reviewingKeys.includes(eventKey);
                  const canReviewRow = canReviewEvent(row);
                  const pendingReview = isEventPendingReview(row);
                  return (
                    <tr key={eventKey} className="border-b border-slate-100">
                      <td className="py-3 font-mono text-xs text-slate-500">{pageStartIndex + index + 1}</td>
                      <td>
                        <Badge variant={meta.badge}>{t(meta.labelKey)}</Badge>
                      </td>
                      <td className="font-mono text-xs text-slate-500">{formatDateTimeLocalized(row.occurred_at, locale)}</td>
                      <td className="truncate pr-4">
                        {row.person_id ? (
                          <Link href={`/persons/${row.person_id}`} className="font-medium text-slate-900 hover:underline">
                            {row.person_name ?? t("events.table.unknownPerson")}
                          </Link>
                        ) : (
                          <span className="font-medium">{row.person_name ?? t("events.table.unknownPerson")}</span>
                        )}
                      </td>
                      <td>
                        <EventStatusCell event={row} />
                      </td>
                      <td>{formatPercent(row.score, t("common.unknown"))}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          {canReviewRow ? (
                            <Button
                              variant={pendingReview ? "default" : "outline"}
                              size="sm"
                              disabled={!pendingReview || rowReviewing}
                              onClick={() => void handleReviewRow(row)}
                            >
                              {rowReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              {pendingReview ? t("events.table.review") : t("events.table.reviewed")}
                            </Button>
                          ) : null}
                          <Button variant="outline" size="sm" onClick={() => setSelectedEventKey(eventKey)}>
                            <Eye className="h-4 w-4" />
                            {t("events.table.view")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!loading && !error && rows.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              {t("events.table.empty")}
            </div>
          ) : null}
          <div className="mt-4 flex flex-col gap-3 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
            <span>{t("events.table.showing", { from: pageRangeStart, to: pageRangeEnd, total })}</span>
            <div className="flex flex-wrap items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => onPageChange(1)} aria-label={t("events.table.firstPage")}>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage <= 1} onClick={() => onPageChange(Math.max(1, safeCurrentPage - 1))} aria-label={t("events.table.previousPage")}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {paginationPages.map((page) => (
                <Button
                  key={page}
                  variant={page === safeCurrentPage ? "default" : "outline"}
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onPageChange(page)}
                  aria-label={t("events.table.goToPage", { page })}
                  aria-current={page === safeCurrentPage ? "page" : undefined}
                >
                  {page}
                </Button>
              ))}
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => onPageChange(Math.min(totalPages, safeCurrentPage + 1))} aria-label={t("events.table.nextPage")}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={safeCurrentPage >= totalPages} onClick={() => onPageChange(totalPages)} aria-label={t("events.table.lastPage")}>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {visibleEvent ? <EventDetailDrawer key={toEventKey(visibleEvent)} event={visibleEvent} visible={eventDialog.visible} onClose={() => setSelectedEventKey(null)} /> : null}

      {toast ? (
        <div
          role="status"
          aria-live="polite"
          className={
            toast.variant === "success"
              ? `fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-emerald-200 bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${toastVisible ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0"}`
              : `fixed bottom-5 right-5 z-[90] w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-red-200 bg-white p-4 text-sm shadow-2xl transition-all duration-300 ease-out ${toastVisible ? "translate-x-0 opacity-100" : "translate-x-[calc(100%+2rem)] opacity-0"}`
          }
        >
          <div className="flex items-start gap-3">
            <div className={toast.variant === "success" ? "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" : "mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-red-500"} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-slate-950">{toast.title}</div>
              <div className="mt-1 text-slate-600">{toast.description}</div>
            </div>
            <button type="button" onClick={closeToast} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-900" aria-label={t("events.detail.close")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DateTimePicker({
  value,
  onChange,
  minValue,
  maxValue,
}: {
  value: string;
  onChange: (value: string) => void;
  minValue?: string | null;
  maxValue?: string | null;
}) {
  const t = useTranslations("events.filters");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => monthStart(datePart(value)));
  const selectedDate = parseDate(datePart(value));
  const days = calendarDays(visibleMonth);
  const monthLabel = visibleMonth.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const minDate = minValue ? datePart(minValue) : null;
  const maxDate = maxValue ? datePart(maxValue) : null;
  const selectedDateValue = datePart(value);
  const timeMin = minValue && selectedDateValue === datePart(minValue) ? timePart(minValue) : undefined;
  const timeMax = maxValue && selectedDateValue === datePart(maxValue) ? timePart(maxValue) : undefined;
  const weekdayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

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
        className="ui-filter-trigger"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CalendarSearch className="ui-filter-search-icon shrink-0" />
          <span className="ui-filter-value">{formatDateTimeInputLabel(value, locale)}</span>
        </span>
        <ChevronRight className={open ? "ui-filter-chevron rotate-90" : "ui-filter-chevron"} />
      </button>

      {open ? (
        <div className="ui-filter-panel absolute left-0 top-12 z-30 w-80">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button type="button" onClick={() => shiftMonth(-1)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={t("previousMonth")}>
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="text-sm font-semibold capitalize text-slate-950">{monthLabel}</div>
            <button type="button" onClick={() => shiftMonth(1)} className="grid h-8 w-8 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label={t("nextMonth")}>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3">
            <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[11px] font-semibold uppercase text-slate-400">
              {weekdayKeys.map((day) => <div key={day}>{t(`weekdays.${day}`)}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const nextDate = toDateValue(day);
                const inMonth = day.getUTCMonth() === visibleMonth.getUTCMonth();
                const selected = sameDay(day, selectedDate);
                const disabled = (minDate && nextDate < minDate) || (maxDate && nextDate > maxDate);

                return (
                  <button
                    key={nextDate}
                    type="button"
                    disabled={Boolean(disabled)}
                    onClick={() => updateDate(nextDate)}
                    className={
                      disabled
                        ? "grid h-9 place-items-center rounded-md text-sm text-slate-300"
                        : selected
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
              <span className="text-xs font-medium text-slate-500">{t("time")}</span>
              <Input className="w-32" type="time" min={timeMin} max={timeMax} value={timePart(value)} onChange={(event) => updateTime(event.target.value)} />
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
}: {
  event: EventFeedItem;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const meta = typeMeta[event.type];
  const Icon = meta.icon;
  const [mediaAsset, setMediaAsset] = useState<MediaAsset | null>(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaPreviewUrl) return;
    return () => URL.revokeObjectURL(mediaPreviewUrl);
  }, [mediaPreviewUrl]);

  useEffect(() => {
    const assetId = event.snapshot_media_asset_id;
    const token = getAccessToken();

    if (!assetId || !token) return;

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
          throw new Error(t("events.media.contentLoadFailed"));
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
        setMediaError(err instanceof ApiError ? getTranslatedBackendError(t, err, "events") : err instanceof Error ? err.message : t("events.media.loadFailed"));
      }
    }

    void loadMedia();
    return () => controller.abort();
  }, [event.snapshot_media_asset_id, t]);

  return (
    <DialogPortal>
      <div className={`fixed inset-0 z-[120] grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm ${dialogOverlayClass(visible)}`} onMouseDown={onClose}>
        <div className={`flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-white shadow-2xl ${dialogPanelClass(visible)}`} onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-md bg-slate-100">
              <Icon className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">{t("events.detail.title")}</h2>
                <Badge variant={meta.badge}>{t(meta.labelKey)}</Badge>
              </div>
              <p className="mt-1 font-mono text-xs text-slate-500">{event.id}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t("events.detail.closeAria")}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="thin-scrollbar flex-1 overflow-y-auto p-5">
          <div className="grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
            <section className="rounded-lg border border-slate-200 p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                {t("events.detail.mediaTitle")}
              </div>
              {event.snapshot_media_asset_id && !mediaPreviewUrl && !mediaError ? (
                <div className="grid aspect-video min-h-[360px] place-items-center rounded-md border border-slate-200 bg-slate-50 text-sm text-slate-500">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t("events.media.loading")}
                  </div>
                </div>
              ) : mediaAsset ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid aspect-video min-h-[360px] place-items-center overflow-hidden rounded-md bg-slate-200 text-sm text-slate-500">
                    {mediaPreviewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={mediaPreviewUrl} alt={mediaAsset.original_filename} className="h-full w-full object-contain" />
                    ) : (
                      t("events.media.previewFallback")
                    )}
                  </div>
                  <div className="mt-3 space-y-1 text-xs">
                    <div className="font-medium text-slate-900">{mediaAsset.original_filename}</div>
                    <div className="font-mono text-slate-500">{t("events.media.bucket")}: {mediaAsset.bucket_name}</div>
                    <div className="font-mono text-slate-500">{t("events.media.object")}: {mediaAsset.object_key}</div>
                    <div className="text-slate-500">{mediaAsset.mime_type} - {Math.round(mediaAsset.file_size / 1024)} KB</div>
                  </div>
                </div>
              ) : (
                <div className="grid aspect-video min-h-[360px] place-items-center rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  {mediaError ?? (event.snapshot_media_asset_id ? t("events.media.noPreview") : t("events.media.noSnapshot"))}
                </div>
              )}
            </section>

            <div className="space-y-5">
              <section className="grid gap-3">
                <DetailItem label={t("events.detail.occurredAt")} value={formatDateTimeLocalized(event.occurred_at, locale)} />
                <DetailItem label={t("events.detail.source")} value={event.source} />
                <DetailItem label={t("events.detail.person")} value={event.person_name ?? t("events.table.unknownPerson")} />
                <DetailItem label={t("events.detail.status")} value={formatEventStatusText(event, t)} />
                <DetailItem label={t("events.detail.score")} value={formatPercent(event.score, t("common.unknown"))} />
                <DetailItem label={t("events.detail.spoofScore")} value={formatPercent(event.spoof_score, t("common.unknown"))} />
              </section>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 p-5">
          {event.person_id ? (
            <Link href={`/persons/${event.person_id}`} className="ui-button-link ui-button-link-outline">
              {t("events.detail.openPersonProfile")}
            </Link>
          ) : null}
          <Button onClick={onClose}>{t("events.detail.close")}</Button>
        </div>
        </div>
      </div>
    </DialogPortal>
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

function EventStatusCell({ event }: { event: EventFeedItem }) {
  const t = useTranslations();
  const uniqueStatuses = getEventStatusValues(event);

  return (
    <div className="flex flex-wrap gap-1">
      {uniqueStatuses.map((status) => (
        <Badge key={status} variant={getStatusBadgeVariant(status)}>
          {formatKnownStatusLabel(status, t)}
        </Badge>
      ))}
    </div>
  );
}

function formatEventStatusText(event: EventFeedItem, t: ReturnType<typeof useTranslations>) {
  return getEventStatusValues(event).map((status) => formatKnownStatusLabel(status, t)).join(" / ");
}

function formatKnownStatusLabel(value: string, t: ReturnType<typeof useTranslations>) {
  if (t.has(`events.status.${value}`)) {
    return t(`events.status.${value}`);
  }
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getStatusBadgeVariant(value: string): "default" | "success" | "warning" | "danger" | "info" | "dark" {
  if (value === "valid" || value === "reviewed") return "success";
  if (value === "new" || value === "medium") return "warning";
  if (value === "high" || value === "invalid") return "danger";
  if (value === "ignored") return "default";
  return "info";
}

function getEventStatusValues(event: EventFeedItem) {
  if (event.type === "recognition") {
    return [event.status].filter((value): value is string => Boolean(value));
  }

  const normalizedReviewStatus = normalizeEventReviewStatus(event.review_status);
  const values: string[] = [];
  if (normalizedReviewStatus) values.push(normalizedReviewStatus);
  if (event.type === "spoof" && event.severity) values.push(event.severity);
  return Array.from(new Set(values));
}

function buildReviewedEvent(event: EventFeedItem): EventFeedItem {
  if (!canReviewEvent(event)) return event;
  return { ...event, status: "reviewed", review_status: "reviewed" };
}

function toEventKey(event: Pick<EventFeedItem, "type" | "id">): EventKey {
  return `${event.type}:${event.id}`;
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

function formatDateTimeInputLabel(value: string, locale: string) {
  return `${parseDate(datePart(value)).toLocaleDateString(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })} ${timePart(value)}`;
}

function formatDateTimeLocalized(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPercent(value: number | null | undefined, emptyLabel: string) {
  if (value == null) return emptyLabel;
  return `${Math.round(value * 100)}%`;
}

function getVisiblePageNumbers(currentPage: number, totalPages: number) {
  const maxVisiblePages = 5;
  if (totalPages <= maxVisiblePages) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const halfWindow = Math.floor(maxVisiblePages / 2);
  let startPage = currentPage - halfWindow;
  let endPage = currentPage + halfWindow;

  if (startPage < 1) {
    startPage = 1;
    endPage = maxVisiblePages;
  } else if (endPage > totalPages) {
    endPage = totalPages;
    startPage = totalPages - maxVisiblePages + 1;
  }

  return Array.from({ length: endPage - startPage + 1 }, (_, index) => startPage + index);
}
