"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { OverlayRenderBox } from "@/lib/types";

interface CameraOverlayProps {
  boxes: OverlayRenderBox[];
  className?: string;
}

export function CameraOverlay({ boxes, className }: CameraOverlayProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 200);
    return () => clearInterval(id);
  }, []);

  const active = boxes.filter((box) => !box.expiresAt || Date.now() < box.expiresAt);

  if (active.length === 0) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-10", className)}>
      {active.map((box) => (
        <div
          key={box.track_id}
          className={cn(
            "absolute rounded-md border-2 transition-all duration-100",
            box.color,
            box.tracking_state === "new" && "animate-pulse"
          )}
          style={{
            left: box.left,
            top: box.top,
            width: box.width,
            height: box.height,
          }}
        >
          <div className="absolute -top-7 left-0 whitespace-nowrap rounded bg-slate-950/80 px-2 py-1 text-xs font-medium text-white ring-1 ring-slate-700 backdrop-blur-sm">
            {box.label}
          </div>
        </div>
      ))}
    </div>
  );
}
