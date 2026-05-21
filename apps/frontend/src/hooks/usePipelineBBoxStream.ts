"use client";

/* eslint-disable react-hooks/immutability */

import { useCallback, useEffect, useRef, useState } from "react";
import { transformBBox } from "@/lib/overlay-utils";
import type { OverlayRenderBox, BoundingBox } from "@/lib/types";
import type { VideoDimensions } from "@/components/dashboard/webrtc-player";

const WS_URL = process.env.NEXT_PUBLIC_PIPELINE_WS_URL ?? "ws://localhost:8002/ws/bbox";
const MAX_EXTRAP_MS = 150;
const POSITION_LERP = 1;
const SIZE_LERP = 0.75;
const TRACK_EXPIRY_MS = 3000;

type Sample = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  at: number;
};
type Track = {
  cur: Sample;
  prev: { x: number; y: number; w: number; h: number } | null;
  conf: number;
  lastSeen: number;
  latency?: {
    seq?: number;
    capturedAtMs?: number;
    captureToDetectorMs?: number;
    captureToWsSendMs?: number;
    wsTransitMs?: number;
    captureToReceiveMs?: number;
  };
};
type Identity = { name: string; color: string };

export function usePipelineBBoxStream(dims: VideoDimensions | null, enabled = true) {
  const [boxes, setBoxes] = useState<OverlayRenderBox[]>([]);
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("disconnected");
  const tracks = useRef<Map<string, Track>>(new Map());
  const identities = useRef<Map<string, Identity>>(new Map());
  const frame = useRef({ fw: 1920, fh: 1080 });
  const raf = useRef(0);
  const alive = useRef(true);
  const lastLatencyLogAt = useRef(0);
  const reportedMissingLatency = useRef(false);
  const lastSeq = useRef(-1);

  const setIdentity = useCallback((trackId: string, name: string, isUnknown: boolean) => {
    identities.current.set(trackId, {
      name,
      color: isUnknown ? "border-amber-400" : "border-emerald-400",
    });
  }, []);

  const onMsg = useCallback((ev: MessageEvent) => {
    try {
      const m = JSON.parse(ev.data as string);
      if (m.e !== "d") return;
      const seq = typeof m.seq === "number" ? m.seq : undefined;
      if (seq !== undefined && seq <= lastSeq.current) {
        return;
      }
      if (seq !== undefined) {
        lastSeq.current = seq;
      }
      frame.current = { fw: m.fw, fh: m.fh };
      const now = performance.now();
      const receivedAtMs = Date.now();
      const capturedAtMs = typeof m.cap === "number" ? m.cap : undefined;
      const sentAtMs = typeof m.send === "number" ? m.send : undefined;
      const latency = capturedAtMs
        ? {
            seq,
            capturedAtMs,
            captureToDetectorMs: typeof m.det === "number" ? m.det : undefined,
            captureToWsSendMs: sentAtMs ? sentAtMs - capturedAtMs : undefined,
            wsTransitMs: sentAtMs ? receivedAtMs - sentAtMs : undefined,
            captureToReceiveMs: receivedAtMs - capturedAtMs,
          }
        : undefined;
      const seen = new Set<string>();
      for (const t of m.tr) {
        seen.add(t.t);
        const s: Sample = {
          x: t.b[0],
          y: t.b[1],
          w: t.b[2],
          h: t.b[3],
          vx: t.v[0],
          vy: t.v[1],
          at: now,
        };
        const ex = tracks.current.get(t.t);
        if (ex) {
          ex.cur = s;
          ex.conf = t.c;
          ex.lastSeen = now;
          ex.latency = latency;
        } else {
          tracks.current.set(t.t, { cur: s, prev: null, conf: t.c, lastSeen: now, latency });
        }
      }
      for (const k of tracks.current.keys()) {
        if (!seen.has(k)) {
          tracks.current.delete(k);
        }
      }
      for (const k of identities.current.keys()) {
        if (!tracks.current.has(k)) {
          identities.current.delete(k);
        }
      }
      if (!latency && m.tr?.length && !reportedMissingLatency.current) {
        reportedMissingLatency.current = true;
        console.warn("[BBOX_LATENCY] Missing latency fields. Rebuild/restart the pipeline container so WS payload includes cap/det/send.");
      }
    } catch {
      // ignore parse errors
    }
  }, []);

  const animate = useCallback(() => {
    if (!alive.current) return;
    if (dims) {
      const now = performance.now();
      const { fw, fh } = frame.current;
      const out: OverlayRenderBox[] = [];
      for (const [id, tr] of tracks.current) {
        if (now - tr.lastSeen > TRACK_EXPIRY_MS) {
          tracks.current.delete(id);
          identities.current.delete(id);
          continue;
        }
        const s = tr.cur;
        const dt = Math.min(now - s.at, MAX_EXTRAP_MS) / 1000;
        let px = s.x + s.vx * dt;
        let py = s.y + s.vy * dt;
        px = Math.max(0, Math.min(px, fw - s.w));
        py = Math.max(0, Math.min(py, fh - s.h));
        let fx: number, fy: number, fww: number, fhh: number;
        if (tr.prev) {
          fx = lerp(tr.prev.x, px, POSITION_LERP);
          fy = lerp(tr.prev.y, py, POSITION_LERP);
          fww = lerp(tr.prev.w, s.w, SIZE_LERP);
          fhh = lerp(tr.prev.h, s.h, SIZE_LERP);
        } else {
          fx = px;
          fy = py;
          fww = s.w;
          fhh = s.h;
        }
        tr.prev = { x: fx, y: fy, w: fww, h: fhh };
        const b: BoundingBox = { x: fx, y: fy, width: fww, height: fhh };
        const t = transformBBox(b, fw, fh, dims);
        const ident = identities.current.get(id);
        out.push({
          track_id: id,
          left: t.left,
          top: t.top,
          width: t.width,
          height: t.height,
          color: ident?.color ?? "border-cyan-400",
          label: ident?.name ?? "",
          tracking_state: "tracking",
          analysis_status: "detected",
          expiresAt: 0,
        });
      }
      setBoxes(out);
      if (now - lastLatencyLogAt.current >= 2000) {
        lastLatencyLogAt.current = now;
        const firstTrack = tracks.current.values().next().value as Track | undefined;
        const latency = firstTrack?.latency;
        if (latency?.captureToReceiveMs !== undefined && latency.capturedAtMs !== undefined) {
          const captureToReceiveMs = latency.captureToReceiveMs;
          const capturedAtMs = latency.capturedAtMs;
          requestAnimationFrame(() => {
            console.log("[BBOX_LATENCY]", {
              seq: latency.seq,
              capture_to_detector_ms: latency.captureToDetectorMs,
              capture_to_ws_send_ms: latency.captureToWsSendMs?.toFixed(1),
              ws_transit_ms: latency.wsTransitMs?.toFixed(1),
              capture_to_fe_receive_ms: captureToReceiveMs.toFixed(1),
              capture_to_render_ms: (Date.now() - capturedAtMs).toFixed(1),
            });
          });
        }
      }
    }
    raf.current = requestAnimationFrame(animate);
  }, [dims]);

  useEffect(() => {
    if (!enabled) return;
    alive.current = true;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (!alive.current) return;
      setStatus("connecting");
      const wsUrl = WS_URL;
      console.log("[PIPELINE_WS] Attempting to connect to:", wsUrl);
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (alive.current) {
          console.log("[PIPELINE_WS] Connected successfully");
          lastSeq.current = -1;
          setStatus("connected");
        } else {
          ws?.close();
        }
      };
      ws.onmessage = onMsg;
      ws.onclose = (ev) => {
        console.log("[PIPELINE_WS] Closed", { code: ev.code, reason: ev.reason });
        if (alive.current) {
          setStatus("disconnected");
          timer = setTimeout(connect, 2000);
        }
      };
      ws.onerror = (ev) => {
        console.error("[PIPELINE_WS] Error", ev);
        setStatus("disconnected");
      };
    };
    connect();
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [enabled, onMsg]);

  useEffect(() => {
    alive.current = true;
    raf.current = requestAnimationFrame(animate);
    return () => {
      alive.current = false;
      cancelAnimationFrame(raf.current);
    };
  }, [animate]);

  return { boxes, status, setIdentity };
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
