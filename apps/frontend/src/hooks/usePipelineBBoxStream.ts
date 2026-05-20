"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { transformBBox } from "@/lib/overlay-utils";
import type { OverlayRenderBox, BoundingBox } from "@/lib/types";
import type { VideoDimensions } from "@/components/dashboard/webrtc-player";

const WS_URL = process.env.NEXT_PUBLIC_PIPELINE_WS_URL ?? "ws://localhost:8000/ws/bbox";
const MAX_EXTRAP_MS = 250;
const LERP = 0.35;
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
      frame.current = { fw: m.fw, fh: m.fh };
      const now = performance.now();
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
        } else {
          tracks.current.set(t.t, { cur: s, prev: null, conf: t.c, lastSeen: now });
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
          fx = lerp(tr.prev.x, px, LERP);
          fy = lerp(tr.prev.y, py, LERP);
          fww = lerp(tr.prev.w, s.w, LERP);
          fhh = lerp(tr.prev.h, s.h, LERP);
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
      // #region agent_debug
      fetch('http://127.0.0.1:7570/ingest/32dbe2b0-146b-4955-96b9-f649b087a041',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'3cf718'},body:JSON.stringify({sessionId:'3cf718',location:'usePipelineBBoxStream.ts:149',message:'WS_URL being connected',data:{wsUrl,timestamp:Date.now()},runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      ws = new WebSocket(wsUrl);
      ws.onopen = () => {
        if (alive.current) {
          console.log("[PIPELINE_WS] Connected successfully");
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
