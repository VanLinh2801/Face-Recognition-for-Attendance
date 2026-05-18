"use client";

import { useTranslations } from "next-intl";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageAmbientWave } from "@/components/data/page-ambient-wave";
import { EventsReviewCenter } from "@/components/events/events-review-center";
import { PageHeader } from "@/components/data/page-header";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import { getFilterPolicy, getDefaultEventRange, getEventBoundaryValues, normalizeEventRange } from "@/lib/filter-policy";
import { buildFocusRange } from "@/lib/realtime-notifications";
import { getTranslatedBackendError } from "@/lib/translated-backend-error";
import type { EventFeedItem, EventFeedListResponse, EventFeedType, FilterPolicy } from "@/lib/types";

const PAGE_SIZE = 10;

export default function EventsPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<EventFeedItem[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterPolicy, setFilterPolicy] = useState<FilterPolicy | null>(null);
  const [activeType, setActiveType] = useState<"all" | EventFeedType>("all");
  const [query, setQuery] = useState("");
  const [fromTime, setFromTime] = useState(() => getInitialEventRange().fromTime);
  const [toTime, setToTime] = useState(() => getInitialEventRange().toTime);
  const deferredQuery = useDeferredValue(query);
  const selectedEventId = searchParams.get("eventId");
  const focusTime = searchParams.get("focusTime");
  const requestedType = searchParams.get("type");
  const appliedFocusSignatureRef = useRef<string | null>(null);

  const normalizedRange = useMemo(() => {
    if (!filterPolicy) return null;
    return normalizeEventRange({ fromTime, toTime }, filterPolicy, "from");
  }, [filterPolicy, fromTime, toTime]);

  const eventBoundaries = useMemo(() => {
    if (!filterPolicy) return null;
    return getEventBoundaryValues(filterPolicy);
  }, [filterPolicy]);

  const requestPath = useMemo(() => {
    if (!normalizedRange) return null;

    const params = new URLSearchParams({
      page: String(currentPage),
      page_size: String(PAGE_SIZE),
      type: activeType,
    });

    params.set("from_at", new Date(normalizedRange.fromTime).toISOString());
    params.set("to_at", new Date(normalizedRange.toTime).toISOString());

    const trimmedQuery = deferredQuery.trim();
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    return `/events?${params.toString()}`;
  }, [activeType, currentPage, deferredQuery, normalizedRange]);

  const loadEvents = useCallback(
    async (signal?: AbortSignal) => {
      if (!requestPath) return;

      await Promise.resolve();
      if (signal?.aborted) return;

      setLoading(true);
      setError("");

      try {
        const response = await apiFetch<EventFeedListResponse>(requestPath, {
          withAuth: true,
          signal,
        });
        if (signal?.aborted) return;
        setRows(response.items);
        setTotal(response.total);
      } catch (err) {
        if (signal?.aborted) return;
        setRows([]);
        setTotal(0);
        setError(err instanceof ApiError ? getTranslatedBackendError(t, err, "events") : t("errors.system.requestFailed"));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [requestPath, t],
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const policy = await getFilterPolicy();
        if (controller.signal.aborted) return;
        const defaults = getDefaultEventRange(policy);
        setFilterPolicy(policy);
        setFromTime(defaults.fromTime);
        setToTime(defaults.toTime);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof ApiError ? getTranslatedBackendError(t, err, "events") : t("events.page.loadingPolicy"));
        setLoading(false);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [router, t]);

  useEffect(() => {
    if (!filterPolicy || !requestPath) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadEvents(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filterPolicy, loadEvents, requestPath]);

  useEffect(() => {
    if (!filterPolicy) return;
    const signature = [requestedType ?? "", selectedEventId ?? "", focusTime ?? ""].join("|");

    if (appliedFocusSignatureRef.current === signature) return;

    const syncTimer = window.setTimeout(() => {
      const nextActiveType =
        requestedType === "unknown" || requestedType === "spoof" || requestedType === "recognition" ? requestedType : null;

      if (nextActiveType && activeType !== nextActiveType) {
        setActiveType(nextActiveType);
        setCurrentPage(1);
      }

      if (!focusTime) {
        appliedFocusSignatureRef.current = signature;
        return;
      }

      const focusedRange = normalizeEventRange(buildFocusRange(focusTime), filterPolicy);
      if (!focusedRange) return;

      appliedFocusSignatureRef.current = signature;

      if (focusedRange.fromTime !== fromTime) setFromTime(focusedRange.fromTime);
      if (focusedRange.toTime !== toTime) setToTime(focusedRange.toTime);
      setCurrentPage(1);
    }, 0);

    return () => window.clearTimeout(syncTimer);
  }, [activeType, filterPolicy, focusTime, fromTime, requestedType, selectedEventId, toTime]);

  return (
    <div className="relative min-h-[calc(100vh-5rem)]">
      <PageAmbientWave className="fixed inset-x-0 top-1/2 z-0 h-0" />
      <PageHeader title={t("events.page.title")} description={t("events.page.description")} />
      <div className="relative z-10">
        <EventsReviewCenter
          rows={rows}
          total={total}
          currentPage={currentPage}
          pageSize={PAGE_SIZE}
          loading={loading}
          error={error}
          activeType={activeType}
          query={query}
          fromTime={fromTime}
          toTime={toTime}
          retentionDays={filterPolicy?.retention_days ?? null}
          minTime={eventBoundaries?.minEventStart ?? null}
          maxTime={eventBoundaries?.maxEventEnd ?? null}
          selectedEventId={selectedEventId}
          onTypeChange={(value) => {
            setActiveType(value);
            setCurrentPage(1);
          }}
          onQueryChange={(value) => {
            setQuery(value);
            setCurrentPage(1);
          }}
          onFromTimeChange={(value) => {
            if (!filterPolicy) return;
            const nextRange = normalizeEventRange({ fromTime: value, toTime }, filterPolicy, "from");
            if (!nextRange) return;
            setFromTime(nextRange.fromTime);
            setToTime(nextRange.toTime);
            setCurrentPage(1);
          }}
          onToTimeChange={(value) => {
            if (!filterPolicy) return;
            const nextRange = normalizeEventRange({ fromTime, toTime: value }, filterPolicy, "to");
            if (!nextRange) return;
            setFromTime(nextRange.fromTime);
            setToTime(nextRange.toTime);
            setCurrentPage(1);
          }}
          onPageChange={setCurrentPage}
        />
      </div>
    </div>
  );
}

function getInitialEventRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return {
    fromTime: `${year}-${month}-${day}T00:00`,
    toTime: `${year}-${month}-${day}T23:59`,
  };
}
