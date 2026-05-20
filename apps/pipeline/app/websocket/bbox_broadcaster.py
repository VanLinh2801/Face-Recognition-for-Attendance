import asyncio
import json
from typing import Set
from fastapi import WebSocket
from app.utils.logger import logger

SCALE_FACTOR = 1.3


class BBoxBroadcaster:
    def __init__(self):
        self._clients: Set[WebSocket] = set()
        self._lock = asyncio.Lock()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        async with self._lock:
            self._clients.add(ws)
        logger.info(f"[BBOX_WS] +client total={len(self._clients)}")

    async def disconnect(self, ws: WebSocket):
        async with self._lock:
            self._clients.discard(ws)
        logger.info(f"[BBOX_WS] -client total={len(self._clients)}")

    async def broadcast_detections(self, context: dict):
        """Broadcast scaled bboxes + velocity to all FE clients."""
        if not self._clients:
            return
        all_tracked = context.get('all_tracked_detections', [])
        if not all_tracked:
            return

        fw = context.get('frame_width', 1920)
        fh = context.get('frame_height', 1080)
        tracks = []
        for det in all_tracked:
            x1, y1, x2, y2 = det['bbox']
            cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
            bw = (x2 - x1) * SCALE_FACTOR
            bh = (y2 - y1) * SCALE_FACTOR
            sx = max(0, cx - bw / 2)
            sy = max(0, cy - bh / 2)
            sw = min(bw, fw - sx)
            sh = min(bh, fh - sy)
            tracks.append({
                "t": det['track_id'],
                "b": [round(sx, 1), round(sy, 1), round(sw, 1), round(sh, 1)],
                "v": det.get('velocity', [0, 0]),
                "c": round(det.get('score', 0), 2),
            })

        data = json.dumps({
            "e": "d",
            "seq": context.get('frame_sequence', 0),
            "fw": fw,
            "fh": fh,
            "tr": tracks,
        })

        dead = []
        async with self._lock:
            for ws in self._clients:
                try:
                    await asyncio.wait_for(ws.send_text(data), timeout=0.05)
                except Exception:
                    dead.append(ws)
        for ws in dead:
            await self.disconnect(ws)


bbox_broadcaster = BBoxBroadcaster()
