"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FrameOverlayEvent, WebSocketConnectionStatus } from "@/lib/types";

interface UseRealtimeOverlayOptions {
  token: string;
  streamId?: string;
  enabled?: boolean;
  onOverlay?: (event: FrameOverlayEvent) => void;
  onStatusChange?: (status: WebSocketConnectionStatus) => void;
}

interface UseRealtimeOverlayReturn {
  status: WebSocketConnectionStatus;
  lastOverlay: FrameOverlayEvent | null;
  overlays: FrameOverlayEvent[];
}

const HEARTBEAT_INTERVAL = 30000;
const RECONNECT_DELAY_BASE = 1000;
const RECONNECT_DELAY_MAX = 30000;
const MAX_STORED_OVERLAYS = 20;

function getSameOriginWsUrl(path: string): string {
  if (typeof window === "undefined") return path;

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${path}`;
}

export function useRealtimeOverlay({
  token,
  streamId = "default",
  enabled = true,
  onOverlay,
  onStatusChange,
}: UseRealtimeOverlayOptions): UseRealtimeOverlayReturn {
  const [status, setStatus] = useState<WebSocketConnectionStatus>("disconnected");
  const [lastOverlay, setLastOverlay] = useState<FrameOverlayEvent | null>(null);
  const [overlays, setOverlays] = useState<FrameOverlayEvent[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isMountedRef = useRef(true);

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

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!isMountedRef.current) return;

    try {
      const data = JSON.parse(event.data as string);

      if (data.event_type === "heartbeat") return;

      if (
        data.channel === "stream.overlay" &&
        data.event_type === "frame_analysis.updated"
      ) {
        const overlayEvent = data as FrameOverlayEvent;

        if (streamId && overlayEvent.payload?.stream_id !== streamId) {
          return;
        }

        setLastOverlay(overlayEvent);
        setOverlays((prev) => {
          const updated = [...prev, overlayEvent];
          return updated.slice(-MAX_STORED_OVERLAYS);
        });
        onOverlay?.(overlayEvent);
      }
    } catch {
      // Ignore parse errors for non-JSON messages
    }
  }, [streamId, onOverlay]);

  const connect = useCallback(() => {
    if (!isMountedRef.current || !enabled) return;

    const channels = ["stream.overlay"];
    const wsUrl = getSameOriginWsUrl(
      `/api/ws/v1/realtime?token=${encodeURIComponent(token)}&channels=${channels.join(",")}`,
    );

    setStatus("connecting");
    onStatusChange?.("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) {
          ws.close();
          return;
        }
        setStatus("connected");
        onStatusChange?.("connected");
        reconnectAttemptRef.current = 0;
        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onerror = () => {
        if (!isMountedRef.current) return;
        setStatus("error");
        onStatusChange?.("error");
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        setStatus("disconnected");
        onStatusChange?.("disconnected");
        clearTimers();

        if (enabled) {
          const delay = Math.min(
            RECONNECT_DELAY_BASE * Math.pow(2, reconnectAttemptRef.current),
            RECONNECT_DELAY_MAX
          );
          reconnectAttemptRef.current += 1;
          reconnectTimerRef.current = setTimeout(connect, delay);
        }
      };
    } catch {
      setStatus("error");
      onStatusChange?.("error");
    }
  }, [token, enabled, handleMessage, startHeartbeat, clearTimers, onStatusChange]);

  useEffect(() => {
    isMountedRef.current = true;

    if (enabled && token) {
      connect();
    }

    return () => {
      isMountedRef.current = false;
      clearTimers();
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, token, connect, clearTimers]);

  return {
    status,
    lastOverlay,
    overlays,
  };
}
