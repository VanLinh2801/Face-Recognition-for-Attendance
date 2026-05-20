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
              setIdentity(trackId, "Unknown", true);
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
      className="relative min-h-0 flex-1 overflow-hidden text-white"
      style={{
        background: "linear-gradient(180deg, var(--background-panel) 0%, var(--background) 100%)",
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
        className="absolute inset-8 z-20 rounded-xl border backdrop-blur-[1px]"
        style={{
          borderColor: "rgb(255 255 255 / 0.1)",
          backgroundColor: "rgb(15 23 42 / 0.12)",
        }}
      >
        <div className="absolute left-5 top-5 flex flex-wrap items-center gap-2">
          <Badge variant="danger">Live</Badge>
          <Badge variant="success">Camera online</Badge>
          <Badge variant="dark">30 FPS</Badge>
          <Badge variant="dark">42 ms</Badge>
          {overlayStatusBadge}
          {pipelineStatusBadge}
        </div>
        <div className="absolute right-5 top-5 font-mono text-xs text-white/55">CAM-ENTRY-01 · Main Gate</div>
        <div className="absolute bottom-5 left-5 max-w-md">
          <h1 className="text-2xl font-semibold">Realtime recognition monitor</h1>
          <p className="mt-2 text-sm text-white/70">
            Bounding boxes bám sát khuôn mặt theo thời gian thực, extrapolated 60fps.
          </p>
        </div>
      </div>
    </section>
  );
}
