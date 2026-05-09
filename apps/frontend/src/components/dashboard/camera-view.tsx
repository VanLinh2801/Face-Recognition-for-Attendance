"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { WebRTCPlayer, type VideoDimensions } from "./webrtc-player";
import { CameraOverlay } from "./camera-overlay";
import { transformRecognitionToRenderBox, type RecognitionBoxSource } from "@/lib/overlay-utils";
import type { OverlayRenderBox } from "@/lib/types";

const WS_URL = `ws://localhost:8002/api/ws/v1/realtime`;

// Which stream IDs to display overlays for. Empty array = show all.
const ALLOWED_STREAM_IDS: string[] = [];

const OVERLAY_TTL_MS = 1000;

export function CameraView() {
  const [videoDimensions, setVideoDimensions] = useState<VideoDimensions | null>(null);
  const [renderBoxes, setRenderBoxes] = useState<OverlayRenderBox[]>([]);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");

  // Queue events that arrive before video is ready
  const pendingEventsRef = useRef<any[]>([]);

  // ── Thêm recognition box mới ──────────────────────────────────────────────
  const addRecognitionBox = useCallback((data: { payload: Record<string, unknown>; event_type: string }) => {
    const payload = data.payload;
    const trackId = payload.track_id as string;
    const streamId = (payload.stream_id as string) || "";

    if (ALLOWED_STREAM_IDS.length > 0 && !ALLOWED_STREAM_IDS.some((s) => streamId.includes(s))) {
      return;
    }

    if (!videoDimensions) {
      // Queue the event if video is not ready
      pendingEventsRef.current.push(data);
      return;
    }

    const bbox = payload.bbox as { x: number; y: number; width: number; height: number } | null;
    if (!bbox) return;

    const source: RecognitionBoxSource = {
      track_id: trackId,
      person_id: (payload.person_id as string | null) ?? null,
      full_name: (payload.full_name as string | null) ?? null,
      bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height },
      match_score: (payload.match_score as number | null) ?? null,
      is_unknown: data.event_type === "unknown_event.detected",
      frame_width: (payload.frame_width as number | undefined) ?? undefined,
      frame_height: (payload.frame_height as number | undefined) ?? undefined,
    };

    const newBox = transformRecognitionToRenderBox(source, videoDimensions);
    if (!newBox) return;

    const expiresAt = Date.now() + OVERLAY_TTL_MS;
    setRenderBoxes((prev) => {
      const existing = prev.find((b) => b.track_id === trackId);
      if (existing) {
        return prev.map((b) => b.track_id === trackId ? { ...b, expiresAt } : b);
      }
      return [...prev, { ...newBox, expiresAt }];
    });
  }, [videoDimensions]);

  // Process queued events when videoDimensions becomes available
  useEffect(() => {
    if (videoDimensions && pendingEventsRef.current.length > 0) {
      pendingEventsRef.current.forEach((data) => {
        addRecognitionBox(data);
      });
      pendingEventsRef.current = [];
    }
  }, [videoDimensions, addRecognitionBox]);

  // ── WebSocket connection ───────────────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;
      setWsStatus("connecting");
      ws = new WebSocket(WS_URL);

      ws.onopen = () => {
        if (!isMounted) { ws?.close(); return; }
        setWsStatus("connected");
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data as string);
          console.debug("[WS] Received event:", data.event_type, "channel:", data.channel);
          if (data.event_type === "heartbeat") return;
          if (
            data.channel === "events.business" &&
            (data.event_type === "recognition_event.detected" || data.event_type === "unknown_event.detected")
          ) {
            console.debug("[WS] → calling addRecognitionBox", {
              track_id: data.payload?.track_id,
              bbox: data.payload?.bbox,
              frame_width: data.payload?.frame_width,
              frame_height: data.payload?.frame_height,
              videoDimensions,
            });
            addRecognitionBox(data);
          }
        } catch (e) {
          console.error("[WS] Parse error:", e);
        }
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setWsStatus("error");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsStatus("disconnected");
        reconnectTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [addRecognitionBox]);

  const overlayStatusBadge = useMemo(() => {
    switch (wsStatus) {
      case "connected":
        return <Badge variant="success">WS Connected</Badge>;
      case "connecting":
        return <Badge variant="warning">WS Connecting</Badge>;
      case "error":
        return <Badge variant="danger">WS Error</Badge>;
      default:
        return <Badge variant="dark">WS Disconnected</Badge>;
    }
  }, [wsStatus]);

  return (
    <section className="relative min-h-0 flex-1 overflow-hidden bg-slate-950 text-white">
      <div className="absolute inset-0 z-0">
        <WebRTCPlayer
          url="http://localhost:8889/mystream/whep"
          onVideoDimensionsChange={setVideoDimensions}
        />
      </div>

      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(15,23,42,0.4)_100%)]" />

      <CameraOverlay boxes={renderBoxes} />

      <div className="absolute inset-8 z-20 rounded-xl border border-white/10 bg-slate-900/10 backdrop-blur-[1px]">
        <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
          <Badge variant="danger">Live</Badge>
          <Badge variant="success">Camera online</Badge>
          <Badge variant="dark">30 FPS</Badge>
          <Badge variant="dark">42 ms</Badge>
          {overlayStatusBadge}
        </div>
        <div className="absolute right-5 top-5 font-mono text-xs text-slate-400">CAM-ENTRY-01 · Main Gate</div>
        <div className="absolute bottom-5 left-5 max-w-md">
          <h1 className="text-2xl font-semibold">Realtime recognition monitor</h1>
          <p className="mt-2 text-sm text-slate-300">
            Bounding box hiển thị ở lần nhận diện đầu tiên của mỗi người.
          </p>
        </div>
      </div>
    </section>
  );
}
