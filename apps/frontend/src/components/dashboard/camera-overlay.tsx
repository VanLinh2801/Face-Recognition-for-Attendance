"use client";

import { cn } from "@/lib/utils";
import type { OverlayRenderBox } from "@/lib/types";

interface CameraOverlayProps {
  boxes: OverlayRenderBox[];
  className?: string;
}

export function CameraOverlay({ boxes, className }: CameraOverlayProps) {
  if (boxes.length === 0) {
    return null;
  }

  return (
    <div className={cn("absolute inset-0 pointer-events-none z-10", className)}>
      {boxes.map((box) => (
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
