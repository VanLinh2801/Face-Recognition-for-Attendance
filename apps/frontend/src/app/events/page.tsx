"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EventsReviewCenter } from "@/components/events/events-review-center";
import { PageHeader } from "@/components/data/page-header";
import { ApiError, apiFetch } from "@/lib/api-client";
import { getAccessToken } from "@/lib/auth-client";
import type { EventFeedItem, EventFeedListResponse, EventFeedType } from "@/lib/types";

const PAGE_SIZE = 100;

export default function EventsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<EventFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeType, setActiveType] = useState<"all" | EventFeedType>("all");
  const [query, setQuery] = useState("");
  const [fromTime, setFromTime] = useState(() => getTodayRange().from);
  const [toTime, setToTime] = useState(() => getTodayRange().to);
  const deferredQuery = useDeferredValue(query);

  const requestPath = useMemo(() => {
    const params = new URLSearchParams({
      page: "1",
      page_size: String(PAGE_SIZE),
      type: activeType,
    });

    if (fromTime) params.set("from_at", new Date(fromTime).toISOString());
    if (toTime) params.set("to_at", new Date(toTime).toISOString());

    const trimmedQuery = deferredQuery.trim();
    if (trimmedQuery) {
      params.set("q", trimmedQuery);
    }

    return `/events?${params.toString()}`;
  }, [activeType, deferredQuery, fromTime, toTime]);

  const loadEvents = useCallback(
    async (signal?: AbortSignal) => {
      await Promise.resolve();
      if (signal?.aborted) return;

      setLoading(true);
      setError("");

      try {
        // v1: keep the current no-pagination UX by requesting a larger first page.
        const response = await apiFetch<EventFeedListResponse>(requestPath, {
          withAuth: true,
          signal,
        });
        if (signal?.aborted) return;
        setRows(response.items);
      } catch (err) {
        if (signal?.aborted) return;
        setRows([]);
        setError(err instanceof ApiError ? err.message : "Failed to load events.");
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [requestPath],
  );

  useEffect(() => {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadEvents(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadEvents, router]);

  return (
    <div>
      <PageHeader title="Sự kiện" description="Review recognition, unknown, and spoof alerts from one backend-driven feed." />
      <EventsReviewCenter
        rows={rows}
        loading={loading}
        error={error}
        activeType={activeType}
        query={query}
        fromTime={fromTime}
        toTime={toTime}
        onTypeChange={setActiveType}
        onQueryChange={setQuery}
        onFromTimeChange={setFromTime}
        onToTimeChange={setToTime}
        onRefresh={loadEvents}
      />
    </div>
  );
}

function getTodayRange() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return {
    from: `${year}-${month}-${day}T00:00`,
    to: `${year}-${month}-${day}T23:59`,
  };
}
