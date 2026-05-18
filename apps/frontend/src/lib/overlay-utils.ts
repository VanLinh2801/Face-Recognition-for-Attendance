import type { BoundingBox, FrameOverlayPayload, OverlayTrack, OverlayRenderBox, AnalysisStatus } from "./types";

const DEFAULT_FRAME_WIDTH = 640;
const DEFAULT_FRAME_HEIGHT = 480;

interface VideoDimensions {
  width: number;
  height: number;
}

export function transformBBox(
  bbox: BoundingBox,
  frameWidth: number,
  frameHeight: number,
  videoDimensions: VideoDimensions
): { left: string; top: string; width: string; height: string } {
  const frameAspect = frameWidth / frameHeight;
  const videoAspect = videoDimensions.width / videoDimensions.height;

  let scale: number;
  let offsetX: number;
  let offsetY: number;

  if (frameAspect > videoAspect) {
    scale = videoDimensions.width / frameWidth;
    const renderedHeight = frameHeight * scale;
    offsetX = 0;
    offsetY = (videoDimensions.height - renderedHeight) / 2;
  } else {
    scale = videoDimensions.height / frameHeight;
    const renderedWidth = frameWidth * scale;
    offsetX = (videoDimensions.width - renderedWidth) / 2;
    offsetY = 0;
  }

  const left = ((bbox.x * scale) + offsetX) / videoDimensions.width * 100;
  const top = ((bbox.y * scale) + offsetY) / videoDimensions.height * 100;
  const width = (bbox.width * scale) / videoDimensions.width * 100;
  const height = (bbox.height * scale) / videoDimensions.height * 100;

  return {
    left: `${left.toFixed(2)}%`,
    top: `${top.toFixed(2)}%`,
    width: `${width.toFixed(2)}%`,
    height: `${height.toFixed(2)}%`,
  };
}

const STATUS_COLORS: Record<AnalysisStatus, string> = {
  detected: "border-emerald-400",
  spoof: "border-red-500",
  low_quality: "border-amber-400",
  ignored: "border-slate-500",
};

const STATUS_LABELS: Record<AnalysisStatus, string> = {
  detected: "Face Detected",
  spoof: "Spoof Alert",
  low_quality: "Low Quality",
  ignored: "Ignored",
};

export function getTrackColor(status: AnalysisStatus): string {
  return STATUS_COLORS[status];
}

export function getTrackLabel(track: OverlayTrack): string {
  return track.display_label || STATUS_LABELS[track.analysis_status];
}

export function transformOverlayToRenderBoxes(
  overlay: FrameOverlayPayload,
  videoDimensions: VideoDimensions | null
): OverlayRenderBox[] {
  if (!videoDimensions || videoDimensions.width === 0 || videoDimensions.height === 0) {
    return [];
  }

  return overlay.tracks
    .filter((track) => track.tracking_state !== "lost")
    .map((track) => {
      const transformed = transformBBox(
        track.bbox,
        overlay.frame_width,
        overlay.frame_height,
        videoDimensions
      );
      return {
        track_id: track.track_id,
        left: transformed.left,
        top: transformed.top,
        width: transformed.width,
        height: transformed.height,
        color: getTrackColor(track.analysis_status),
        label: getTrackLabel(track),
        tracking_state: track.tracking_state,
        analysis_status: track.analysis_status,
        expiresAt: 0,
      };
    });
}

export function mergeOverlayBoxes(
  existingBoxes: OverlayRenderBox[],
  newOverlay: FrameOverlayPayload,
  videoDimensions: VideoDimensions | null
): OverlayRenderBox[] {
  const newBoxes = transformOverlayToRenderBoxes(newOverlay, videoDimensions);

  const existingByTrack = new Map(existingBoxes.map((box) => [box.track_id, box]));
  const newByTrack = new Map(newBoxes.map((box) => [box.track_id, box]));

  const merged: OverlayRenderBox[] = [];

  for (const [trackId, existingBox] of existingByTrack) {
    const newBox = newByTrack.get(trackId);
    if (newBox) {
      merged.push(newBox);
    } else {
      merged.push(existingBox);
    }
  }

  for (const [trackId, newBox] of newByTrack) {
    if (!existingByTrack.has(trackId)) {
      merged.push(newBox);
    }
  }

  return merged;
}

export type RecognitionBoxSource = {
  track_id: string;
  person_id: string | null;
  full_name: string | null;
  bbox: BoundingBox | null;
  match_score: number | null;
  is_unknown: boolean;
  frame_width?: number;
  frame_height?: number;
};

export function transformRecognitionToRenderBox(
  source: RecognitionBoxSource,
  videoDimensions: VideoDimensions | null
): OverlayRenderBox | null {
  if (!videoDimensions || videoDimensions.width === 0 || videoDimensions.height === 0) {
    return null;
  }

  if (!source.bbox) {
    return null;
  }

  const frameWidth = source.frame_width || DEFAULT_FRAME_WIDTH;
  const frameHeight = source.frame_height || DEFAULT_FRAME_HEIGHT;

  const transformed = transformBBox(
    source.bbox,
    frameWidth,
    frameHeight,
    videoDimensions
  );

  const color = source.is_unknown ? "border-amber-400" : "border-emerald-400";
  const label = source.full_name || (source.is_unknown ? "Unknown" : source.person_id || "Detected");

  return {
    track_id: source.track_id,
    left: transformed.left,
    top: transformed.top,
    width: transformed.width,
    height: transformed.height,
    color,
    label,
    tracking_state: "tracking",
    analysis_status: source.is_unknown ? "detected" : "detected",
    expiresAt: 0,
  };
}
