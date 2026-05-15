"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { isRealtimeBusinessEvent } from "@/lib/realtime-notifications";
import { buildRealtimeWebSocketUrl } from "@/lib/realtime-websocket";
import type { RealtimeBusinessEvent, RealtimeEvent, WebSocketConnectionStatus } from "@/lib/types";

interface UseRealtimeBusinessEventsOptions {
  token: string | null;
  enabled?: boolean;
  initialSinceTimestamp?: string | null;
  onLiveEvents?: (events: RealtimeBusinessEvent[]) => void;
  onCatchupEvents?: (events: RealtimeBusinessEvent[]) => void;
  onStatusChange?: (status: WebSocketConnectionStatus) => void;
  onCursorChange?: (timestamp: string | null) => void;
}

interface RealtimeCatchupResponse {
  channel: string;
  since_timestamp: string;
  items: RealtimeEvent[];
}

const HEARTBEAT_INTERVAL = 30_000;
const RECONNECT_DELAY_BASE = 1_000;
const RECONNECT_DELAY_MAX = 30_000;

export function useRealtimeBusinessEvents({
  token,
  enabled = true,
  initialSinceTimestamp,
  onLiveEvents,
  onCatchupEvents,
  onStatusChange,
  onCursorChange,
}: UseRealtimeBusinessEventsOptions) {
  const [status, setStatus] = useState<WebSocketConnectionStatus>("disconnected");
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);
  const lastReceivedAtRef = useRef<string | null>(initialSinceTimestamp ?? null);
  const connectRef = useRef<(() => Promise<void>) | null>(null);

  const setConnectionStatus = useCallback(
    (nextStatus: WebSocketConnectionStatus) => {
      setStatus(nextStatus);
      onStatusChange?.(nextStatus);
    },
    [onStatusChange],
  );

  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const updateCursor = useCallback(
    (events: RealtimeBusinessEvent[]) => {
      if (events.length === 0) return;
      const latestTimestamp = events.reduce((latest, event) => {
        if (!latest) return event.occurred_at;
        return new Date(event.occurred_at).getTime() > new Date(latest).getTime() ? event.occurred_at : latest;
      }, lastReceivedAtRef.current);
      lastReceivedAtRef.current = latestTimestamp;
      onCursorChange?.(latestTimestamp);
    },
    [onCursorChange],
  );

  const fetchCatchup = useCallback(async () => {
    if (!token || !lastReceivedAtRef.current) return;

    try {
      const params = new URLSearchParams({
        channel: "events.business",
        since_timestamp: lastReceivedAtRef.current,
        limit: "50",
      });
      const response = await apiFetch<RealtimeCatchupResponse>(`/api/ws/v1/realtime/catchup?${params.toString()}`, {
        withAuth: true,
      });
      const catchupEvents = response.items.filter(isRealtimeBusinessEvent);
      if (catchupEvents.length > 0) {
        updateCursor(catchupEvents);
        onCatchupEvents?.(catchupEvents);
      }
    } catch {
      // Keep the live socket running even if catch-up fails.
    }
  }, [onCatchupEvents, token, updateCursor]);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }
    heartbeatTimerRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ event_type: "heartbeat" }));
      }
    }, HEARTBEAT_INTERVAL);
  }, []);

  const handleMessage = useCallback(
    (messageEvent: MessageEvent) => {
      if (!isMountedRef.current) return;

      try {
        const payload = JSON.parse(messageEvent.data as string) as RealtimeEvent | { event_type: "heartbeat" };
        if (payload.event_type === "heartbeat") return;
        if (!isRealtimeBusinessEvent(payload)) return;

        updateCursor([payload]);
        onLiveEvents?.([payload]);
      } catch {
        // Ignore non-JSON or malformed frames.
      }
    },
    [onLiveEvents, updateCursor],
  );

  const connect = useCallback(async () => {
    if (!enabled || !token || !isMountedRef.current) return;

    setConnectionStatus("connecting");

    try {
      const wsUrl = buildRealtimeWebSocketUrl({
        token,
        channels: ["events.business"],
      });
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        reconnectAttemptRef.current = 0;
        setConnectionStatus("connected");
        startHeartbeat();
        void fetchCatchup();
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setConnectionStatus("error");
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        clearTimers();
        setConnectionStatus("disconnected");
        if (!enabled || !isMountedRef.current) return;
        const delay = Math.min(RECONNECT_DELAY_BASE * 2 ** reconnectAttemptRef.current, RECONNECT_DELAY_MAX);
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(() => {
          void connectRef.current?.();
        }, delay);
      };
    } catch {
      setConnectionStatus("error");
      if (!enabled || !isMountedRef.current) return;
      const delay = Math.min(RECONNECT_DELAY_BASE * 2 ** reconnectAttemptRef.current, RECONNECT_DELAY_MAX);
      reconnectAttemptRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        void connectRef.current?.();
      }, delay);
    }
  }, [clearTimers, enabled, fetchCatchup, handleMessage, setConnectionStatus, startHeartbeat, token]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    lastReceivedAtRef.current = initialSinceTimestamp ?? null;
  }, [initialSinceTimestamp]);

  useEffect(() => {
    isMountedRef.current = true;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    if (enabled && token) {
      connectTimer = setTimeout(() => {
        void connect();
      }, 0);
    }

    return () => {
      isMountedRef.current = false;
      if (connectTimer) {
        clearTimeout(connectTimer);
      }
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [clearTimers, connect, enabled, token]);

  return { status };
}
