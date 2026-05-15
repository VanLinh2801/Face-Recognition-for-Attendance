from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any

import cv2

BENCHMARKS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BENCHMARKS_ROOT))

from env_utils import bootstrap_env, env_bool, env_int  # noqa: E402

DEFAULT_ENV_FILE = BENCHMARKS_ROOT / ".env.benchmark"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

# Pipeline settings applied only when not already set in the environment.
# These mirror the production defaults so the benchmark is representative.
_PIPELINE_DEFAULTS: dict[str, str] = {
    "FACE_DETECTION_THRESHOLD": "0.65",
    "FACE_TRACKER_COOLDOWN": "300",
    "FACE_TRACKER_MAX_AGE": "60.0",
    "MAX_INITIAL_SNAPSHOTS": "5",
    "MIN_FACE_SIZE_PX": "90",
    "REQUIRE_FULL_KPS": "true",
    "MIN_KPS_DIST_PX": "2.0",
    "FACE_OVERLAP_IOU_THRESHOLD": "0.5",
    "MAX_FACE_YAW_DEG": "45.0",
    "MIN_FACE_SHARPNESS": "150.0",
    "MIN_FACE_DETECTION_CONFIDENCE": "0.70",
    "MIN_FACE_BRIGHTNESS": "65.0",
}


def _apply_pipeline_defaults() -> None:
    for key, value in _PIPELINE_DEFAULTS.items():
        os.environ.setdefault(key, value)


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    index = min(len(values) - 1, int(round((pct / 100.0) * (len(values) - 1))))
    return values[index]


def summarize_ms(values: list[float]) -> dict[str, float | int]:
    if not values:
        return {"count": 0, "avg": 0.0, "p50": 0.0, "p95": 0.0, "max": 0.0}
    return {
        "count": len(values),
        "avg": round(statistics.mean(values), 3),
        "p50": round(percentile(values, 50), 3),
        "p95": round(percentile(values, 95), 3),
        "max": round(max(values), 3),
    }


def parse_args() -> argparse.Namespace:
    loaded_env_file = bootstrap_env(DEFAULT_ENV_FILE)
    parser = argparse.ArgumentParser(
        description=(
            "End-to-end pipeline latency benchmark: "
            "detect → track → quality-filter → crop → embed → (qdrant)."
        )
    )
    parser.add_argument("--env-file", default=str(loaded_env_file))
    parser.add_argument(
        "--frames-dir",
        default=os.environ.get("BENCH_E2E_FRAMES_DIR"),
        help="Directory of JPEG/PNG frames simulating camera input. Env: BENCH_E2E_FRAMES_DIR.",
    )
    parser.add_argument("--scrfd-model-path", default=os.environ.get("SCRFD_MODEL_PATH"))
    parser.add_argument("--model-name", default=os.environ.get("INSIGHTFACE_MODEL_NAME"))
    parser.add_argument("--model-dir", default=os.environ.get("INSIGHTFACE_MODEL_DIR"))
    parser.add_argument(
        "--model-file", default=os.environ.get("INSIGHTFACE_RECOGNITION_MODEL_FILE")
    )
    parser.add_argument(
        "--ctx-id",
        type=int,
        default=int(os.environ["INSIGHTFACE_CTX_ID"])
        if os.environ.get("INSIGHTFACE_CTX_ID")
        else None,
    )
    parser.add_argument(
        "--qdrant-url", default=os.environ.get("QDRANT_URL", "http://localhost:6333")
    )
    parser.add_argument("--qdrant-collection", default=os.environ.get("QDRANT_COLLECTION"))
    parser.add_argument(
        "--include-qdrant",
        action="store_true",
        default=env_bool("BENCH_E2E_INCLUDE_QDRANT", False),
        help="Include Qdrant vector search in timing. Env: BENCH_E2E_INCLUDE_QDRANT.",
    )
    parser.add_argument(
        "--warmup",
        type=int,
        default=env_int("BENCH_E2E_WARMUP", 5),
        help="Warmup frames before recording (not counted). Env: BENCH_E2E_WARMUP.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=env_int("BENCH_E2E_LIMIT", 0),
        help="Max benchmark frames to process (0 = all). Env: BENCH_E2E_LIMIT.",
    )
    parser.add_argument("--output", default=os.environ.get("BENCH_E2E_SUMMARY_OUTPUT"))
    parser.add_argument(
        "--frames-output", default=os.environ.get("BENCH_E2E_FRAMES_OUTPUT")
    )
    args = parser.parse_args()
    if not args.frames_dir:
        parser.error(
            "Missing --frames-dir. Set BENCH_E2E_FRAMES_DIR in benchmarks/.env.benchmark "
            "or pass --frames-dir."
        )
    return args


def apply_env_overrides(args: argparse.Namespace) -> None:
    repo_root = Path(__file__).resolve().parents[2]

    overrides: dict[str, str | None] = {
        "INSIGHTFACE_MODEL_NAME": args.model_name,
        "INSIGHTFACE_MODEL_DIR": args.model_dir,
        "INSIGHTFACE_RECOGNITION_MODEL_FILE": args.model_file,
        "INSIGHTFACE_CTX_ID": str(args.ctx_id) if args.ctx_id is not None else None,
        "QDRANT_URL": args.qdrant_url,
        "QDRANT_COLLECTION": args.qdrant_collection,
    }
    if args.scrfd_model_path:
        overrides["SCRFD_MODEL_PATH"] = args.scrfd_model_path
    for key, value in overrides.items():
        if value is not None:
            os.environ[key] = value

    # Resolve relative model paths against repo root so scripts can be run
    # from any working directory.
    for key in ("SCRFD_MODEL_PATH", "INSIGHTFACE_MODEL_DIR"):
        val = os.environ.get(key)
        if val and not Path(val).is_absolute():
            os.environ[key] = str(repo_root / val)


async def process_frame(
    frame_idx: int,
    frame: Any,
    frame_name: str,
    detector: Any,
    tracker: Any,
    quality_filter: Any,
    cropper: Any,
    embedder: Any,
    vector_store: Any,
    FaceInput: Any,
) -> dict[str, Any]:
    h, w = frame.shape[:2]
    context: dict[str, Any] = {
        "frame": frame,
        "frame_width": w,
        "frame_height": h,
        "frame_sequence": frame_idx,
        "source_id": "benchmark",
    }
    result: dict[str, Any] = {
        "frame_idx": frame_idx,
        "frame_file": frame_name,
        "frame_width": w,
        "frame_height": h,
    }

    # Stage 1: Detect
    t0 = time.perf_counter()
    context = detector.process(context)
    t1 = time.perf_counter()
    result["detect_ms"] = (t1 - t0) * 1000
    result["faces_detected"] = len(context.get("detections", []))

    if not context.get("detections"):
        result.update({
            "track_ms": 0.0,
            "quality_ms": 0.0,
            "crop_ms": 0.0,
            "pipeline_ms": result["detect_ms"],
            "faces_to_emit": 0,
            "faces_passed": 0,
            "faces_embedded": 0,
            "embed_ms_total": 0.0,
            "embed_ms_per_face": 0.0,
            "qdrant_ms_total": 0.0,
            "qdrant_ms_per_face": 0.0,
            "e2e_ms": result["detect_ms"],
        })
        return result

    # Stage 2: Track
    context = tracker.process(context)
    t2 = time.perf_counter()
    result["track_ms"] = (t2 - t1) * 1000
    result["faces_to_emit"] = len(context.get("faces_to_emit", []))

    # Stage 3: Quality filter
    context = quality_filter.process(context)
    tracker.sync_filter_passed(context.get("_filter_passed_track_ids", {}))
    t3 = time.perf_counter()
    result["quality_ms"] = (t3 - t2) * 1000
    filtered = context.get("filtered_faces", [])
    result["faces_passed"] = len(filtered)

    # Stage 4: Crop (only quality-passed faces, matching pipeline_service.py line 86)
    context["faces_to_emit"] = filtered
    context = cropper.process(context)
    t4 = time.perf_counter()
    result["crop_ms"] = (t4 - t3) * 1000
    result["pipeline_ms"] = (t4 - t0) * 1000

    processed = context.get("processed_faces", [])

    # Stage 5: Embed + optional Qdrant search (per face, async)
    embed_times: list[float] = []
    qdrant_times: list[float] = []
    faces_embedded = 0

    for face in processed:
        img_bytes = base64.b64decode(face["image_b64"])
        kpss = face.get("kpss")
        if not kpss:
            continue
        face_input = FaceInput(
            track_id=face["track_id"],
            image_data=img_bytes,
            kpss=kpss,
            detection_confidence=face.get("score"),
        )
        try:
            te0 = time.perf_counter()
            embedding = await embedder.extract(face_input)
            te1 = time.perf_counter()
            embed_times.append((te1 - te0) * 1000)
            faces_embedded += 1

            if vector_store is not None:
                tq0 = time.perf_counter()
                await vector_store.search(embedding.vector, top_k=1)
                tq1 = time.perf_counter()
                qdrant_times.append((tq1 - tq0) * 1000)

        except Exception as exc:
            print(
                f"  [WARN] AI stage error frame={frame_idx} track={face['track_id']}: {exc}",
                file=sys.stderr,
            )

    t_end = time.perf_counter()
    result.update({
        "faces_embedded": faces_embedded,
        "embed_ms_total": sum(embed_times),
        "embed_ms_per_face": statistics.mean(embed_times) if embed_times else 0.0,
        "qdrant_ms_total": sum(qdrant_times),
        "qdrant_ms_per_face": statistics.mean(qdrant_times) if qdrant_times else 0.0,
        "e2e_ms": (t_end - t0) * 1000,
    })
    return result


async def run() -> None:
    args = parse_args()
    _apply_pipeline_defaults()
    apply_env_overrides(args)

    def _resolve(p: str) -> Path:
        path = Path(p)
        return path if path.is_absolute() else BENCHMARKS_ROOT / path

    frames_dir = _resolve(args.frames_dir)
    if not frames_dir.is_dir():
        print(f"[ERROR] Frames directory not found: {frames_dir}", file=sys.stderr)
        sys.exit(1)

    all_paths = sorted(
        p for p in frames_dir.rglob("*")
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )
    warmup_paths = all_paths[: args.warmup]
    bench_paths = all_paths[args.warmup:]
    if args.limit > 0:
        bench_paths = bench_paths[: args.limit]

    print(f"[INIT] {len(all_paths)} frame(s) total — warmup={len(warmup_paths)}, bench={len(bench_paths)}")

    repo_root = Path(__file__).resolve().parents[2]

    # Import pipeline processors first so their app.core.config is pipeline's
    sys.path.insert(0, str(repo_root / "apps" / "pipeline"))
    from app.processors.face_cropper import FaceCropper  # noqa: PLC0415
    from app.processors.face_detector import SCRFDFaceDetector  # noqa: PLC0415
    from app.processors.face_quality_filter import FaceQualityFilter  # noqa: PLC0415
    from app.processors.face_tracker import FaceTracker  # noqa: PLC0415

    # Evict pipeline's app.* so ai_service can register its own namespace
    for k in [k for k in sys.modules if k == "app" or k.startswith("app.")]:
        del sys.modules[k]

    # Import AI service modules (ai_service's app.core.config is now active)
    sys.path.insert(0, str(repo_root / "apps" / "ai_service"))
    from app.domain.entities.face import FaceInput  # noqa: PLC0415
    from app.infrastructure.ai_models.insightface_embedder import InsightFaceEmbedder  # noqa: PLC0415

    vector_store = None
    if args.include_qdrant:
        from app.infrastructure.persistence.qdrant_vector_store import QdrantVectorStore  # noqa: PLC0415
        vector_store = QdrantVectorStore()
        await vector_store.ensure_collection()

    print("[INIT] Loading models...")
    detector = SCRFDFaceDetector()
    tracker = FaceTracker()
    quality_filter = FaceQualityFilter()
    cropper = FaceCropper()
    embedder = InsightFaceEmbedder()

    # ---- Warmup ----
    if warmup_paths:
        print(f"[WARMUP] Processing {len(warmup_paths)} warmup frame(s)...")
        for i, fp in enumerate(warmup_paths):
            frame = cv2.imread(str(fp))
            if frame is None:
                continue
            await process_frame(
                i, frame, fp.name,
                detector, tracker, quality_filter, cropper, embedder, vector_store, FaceInput,
            )
        # Reset tracker state so warmup tracking state doesn't pollute the benchmark
        tracker = FaceTracker()
        print("[WARMUP] Done — tracker reset.")

    # ---- Benchmark ----
    frame_results: list[dict[str, Any]] = []
    total_started = time.perf_counter()

    for bench_idx, fp in enumerate(bench_paths):
        if bench_idx % 20 == 0:
            print(f"  [BENCH] frame {bench_idx + 1}/{len(bench_paths)}: {fp.name}")
        frame = cv2.imread(str(fp))
        if frame is None:
            print(f"  [WARN] Cannot read: {fp}")
            continue
        result = await process_frame(
            bench_idx, frame, fp.name,
            detector, tracker, quality_filter, cropper, embedder, vector_store, FaceInput,
        )
        frame_results.append(result)

    total_seconds = time.perf_counter() - total_started

    if not frame_results:
        print("[ERROR] No benchmark frames processed.", file=sys.stderr)
        sys.exit(1)

    # ---- Aggregate ----
    frames_with_faces = sum(1 for r in frame_results if r["faces_detected"] > 0)
    frames_with_output = sum(1 for r in frame_results if r["faces_passed"] > 0)
    total_embedded = sum(r["faces_embedded"] for r in frame_results)

    embed_per_face = [r["embed_ms_per_face"] for r in frame_results if r["embed_ms_per_face"] > 0]
    qdrant_per_face = [r["qdrant_ms_per_face"] for r in frame_results if r["qdrant_ms_per_face"] > 0]

    summary = {
        "frames_total": len(frame_results),
        "frames_with_detected_faces": frames_with_faces,
        "frames_with_output_faces": frames_with_output,
        "frame_drop_rate": round(1.0 - frames_with_output / max(1, len(frame_results)), 4),
        "total_faces_embedded": total_embedded,
        "total_seconds": round(total_seconds, 3),
        "frame_throughput_fps": round(len(frame_results) / total_seconds, 2) if total_seconds else 0,
        "face_throughput_fps": round(total_embedded / total_seconds, 2) if total_seconds else 0,
        "qdrant_enabled": args.include_qdrant,
        "stages": {
            "detect_ms": summarize_ms([r["detect_ms"] for r in frame_results]),
            "track_ms": summarize_ms([r["track_ms"] for r in frame_results]),
            "quality_ms": summarize_ms([r["quality_ms"] for r in frame_results]),
            "crop_ms": summarize_ms([r["crop_ms"] for r in frame_results]),
            "pipeline_ms": summarize_ms([r["pipeline_ms"] for r in frame_results]),
            "embed_ms_per_face": summarize_ms(embed_per_face),
            "qdrant_ms_per_face": summarize_ms(qdrant_per_face),
            "e2e_ms": summarize_ms([r["e2e_ms"] for r in frame_results]),
        },
    }

    print("\n=== E2E LATENCY RESULTS ===")
    print(json.dumps(summary, indent=2))

    if args.output:
        out = _resolve(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"\n[OUT] Summary → {out}")

    if args.frames_output:
        fp_out = _resolve(args.frames_output)
        fp_out.parent.mkdir(parents=True, exist_ok=True)
        with fp_out.open("w", encoding="utf-8") as fh:
            for r in frame_results:
                fh.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"[OUT] Per-frame → {fp_out}")


if __name__ == "__main__":
    asyncio.run(run())
