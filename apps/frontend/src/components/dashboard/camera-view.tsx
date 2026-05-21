"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getAccessToken } from "@/lib/auth-client";
import { buildRealtimeWebSocketUrl } from "@/lib/realtime-websocket";
import { CameraOverlay } from "./camera-overlay";
import { WebRTCPlayer, type VideoDimensions } from "./webrtc-player";
import { usePipelineBBoxStream } from "@/hooks/usePipelineBBoxStream";

export function CameraView() {
  const [videoDimensions, setVideoDimensions] = useState<VideoDimensions | null>(null);
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("disconnected");

  const { boxes: detectionBoxes, status: pipelineStatus, setIdentity } = usePipelineBBoxStream(videoDimensions);

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

  const pipelineStatusBadge = useMemo(() => {
    switch (pipelineStatus) {
      case "connected":
        return <Badge variant="success">Pipeline Connected</Badge>;
      case "connecting":
        return <Badge variant="warning">Pipeline Connecting</Badge>;
      default:
        return <Badge variant="dark">Pipeline Disconnected</Badge>;
    }
  }, [pipelineStatus]);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      const token = getAccessToken();
      if (!token) {
        setWsStatus("disconnected");
        return;
      }

      setWsStatus("connecting");
      ws = new WebSocket(
        buildRealtimeWebSocketUrl({
          token,
          channels: ["events.business"],
        }),
      );

      ws.onopen = () => {
        if (!isMounted) {
          ws?.close();
          return;
        }
        setWsStatus("connected");
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data as string) as {
            event_type?: string;
            channel?: string;
            payload?: Record<string, unknown>;
          };
          if (data.event_type === "heartbeat") return;
          if (data.channel === "events.business") {
            const p = data.payload;
            const trackId = p?.track_id as string | undefined;
            if (!trackId) return;
            if (data.event_type === "recognition_event.detected") {
              setIdentity(trackId, (p?.full_name as string | undefined) ?? (p?.person_id as string | undefined) ?? "Recognized", false);
            } else if (data.event_type === "unknown_event.detected") {
              setIdentity(trackId, "Người lạ", true);
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onerror = () => {
        if (!isMounted) return;
        setWsStatus("error");
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setWsStatus("disconnected");
        reconnectTimer = setTimeout(() => {
          connect();
        }, 3000);
      };
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [setIdentity]);

  return (
    <section
      className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 text-white sm:p-4 lg:p-6"
      style={{
        background: "linear-gradient(180deg, var(--background-panel) 0%, var(--background) 100%)",
      }}
    >
      <div
        className="relative aspect-video w-full max-w-[1920px] overflow-hidden bg-slate-950 shadow-[0_18px_50px_rgb(2_6_23/0.28)]"
        style={{
          maxHeight: "min(1080px, 100%)",
        }}
      >
        <div className="absolute inset-0 z-0">
          <WebRTCPlayer
            url="http://localhost:8889/mystream/whep"
            onVideoDimensionsChange={setVideoDimensions}
          />
        </div>

        <div
          className="absolute inset-0 z-10"
          style={{
            background: "radial-gradient(circle at center, transparent 30%, rgba(15, 23, 42, 0.4) 100%)",
          }}
        />

        <CameraOverlay boxes={detectionBoxes} />

        <div
          className="absolute inset-4 z-20 rounded-xl border backdrop-blur-[1px] sm:inset-6 lg:inset-8"
          style={{
            borderColor: "rgb(255 255 255 / 0.1)",
            backgroundColor: "rgb(15 23 42 / 0.12)",
          }}
        >
          <div className="absolute left-3 top-3 flex flex-wrap items-center gap-2 sm:left-5 sm:top-5">
            <Badge variant="danger">Live</Badge>
            <Badge variant="success">Camera online</Badge>
            <Badge variant="dark">1920 x 1080</Badge>
            <Badge variant="dark">30 FPS</Badge>
            <Badge variant="dark">42 ms</Badge>
            {overlayStatusBadge}
            {pipelineStatusBadge}
          </div>
          <div className="absolute right-3 top-3 font-mono text-xs text-white/55 sm:right-5 sm:top-5">CAM-ENTRY-01 - Main Gate</div>
          <div className="absolute bottom-3 left-3 max-w-md sm:bottom-5 sm:left-5">
            <h1 className="text-xl font-semibold sm:text-2xl">Realtime recognition monitor</h1>
            <p className="mt-2 hidden text-sm text-white/70 sm:block">
              Bounding boxes bam sat khuon mat theo thoi gian thuc, extrapolated 60fps.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
