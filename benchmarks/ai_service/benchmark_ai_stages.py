from __future__ import annotations

import argparse
import asyncio
import json
import os
import statistics
import sys
import time
from pathlib import Path
from typing import Any


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
        "avg": statistics.mean(values),
        "p50": percentile(values, 50),
        "p95": percentile(values, 95),
        "max": max(values),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Benchmark AI service stages with the currently selected recognizer."
    )
    parser.add_argument("--manifest", required=True, help="JSONL from benchmarks/face_pipeline/prepare_faces.py.")
    parser.add_argument("--model-name", help="Override INSIGHTFACE_MODEL_NAME, e.g. buffalo_l.")
    parser.add_argument("--model-dir", help="Override INSIGHTFACE_MODEL_DIR.")
    parser.add_argument("--model-file", help="Override INSIGHTFACE_RECOGNITION_MODEL_FILE.")
    parser.add_argument("--ctx-id", type=int, help="Override INSIGHTFACE_CTX_ID. Use 0 for GPU, -1 for CPU.")
    parser.add_argument("--qdrant-url", help="Override QDRANT_URL.")
    parser.add_argument("--qdrant-collection", help="Override QDRANT_COLLECTION.")
    parser.add_argument("--warmup", type=int, default=20)
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--limit", type=int, default=0, help="Limit manifest rows; 0 means all.")
    parser.add_argument("--include-qdrant", action="store_true", help="Measure Qdrant search for each embedding.")
    parser.add_argument("--output", help="Write summary JSON to this path.")
    parser.add_argument("--samples-output", help="Write per-sample JSONL timings to this path.")
    return parser.parse_args()


def apply_env_overrides(args: argparse.Namespace) -> None:
    overrides = {
        "INSIGHTFACE_MODEL_NAME": args.model_name,
        "INSIGHTFACE_MODEL_DIR": args.model_dir,
        "INSIGHTFACE_RECOGNITION_MODEL_FILE": args.model_file,
        "INSIGHTFACE_CTX_ID": str(args.ctx_id) if args.ctx_id is not None else None,
        "QDRANT_URL": args.qdrant_url,
        "QDRANT_COLLECTION": args.qdrant_collection,
    }
    for key, value in overrides.items():
        if value is not None:
            os.environ[key] = value


def load_manifest(path: Path, limit: int) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            if not line.strip():
                continue
            row = json.loads(line)
            if not row.get("kpss") or not row.get("image_path"):
                continue
            image_path = Path(row["image_path"])
            if not image_path.is_absolute():
                image_path = path.parent / image_path
            row["image_path"] = image_path
            rows.append(row)
            if limit > 0 and len(rows) >= limit:
                break
    return rows


async def run() -> dict[str, Any]:
    args = parse_args()
    apply_env_overrides(args)

    repo_root = Path(__file__).resolve().parents[2]
    sys.path.insert(0, str(repo_root / "apps" / "ai_service"))

    from app.core.config import settings  # noqa: PLC0415
    from app.domain.entities.face import FaceInput  # noqa: PLC0415
    from app.infrastructure.ai_models.insightface_embedder import InsightFaceEmbedder  # noqa: PLC0415
    from app.infrastructure.persistence.qdrant_vector_store import QdrantVectorStore  # noqa: PLC0415

    manifest_path = Path(args.manifest)
    rows = load_manifest(manifest_path, args.limit)
    if not rows:
        raise SystemExit("No usable manifest rows with image_path + kpss.")

    decode_ms: list[float] = []
    inputs: list[FaceInput] = []
    for index, row in enumerate(rows, start=1):
        started = time.perf_counter()
        image_data = Path(row["image_path"]).read_bytes()
        decode_ms.append((time.perf_counter() - started) * 1000)
        inputs.append(
            FaceInput(
                track_id=str(row.get("track_id", index)),
                image_data=image_data,
                kpss=row["kpss"],
                detection_confidence=row.get("detection_confidence"),
            )
        )

    embedder = InsightFaceEmbedder()
    for sample in inputs[: min(args.warmup, len(inputs))]:
        await embedder.extract(sample)

    vector_store = QdrantVectorStore() if args.include_qdrant else None
    if vector_store is not None:
        await vector_store.ensure_collection()

    embedding_ms: list[float] = []
    qdrant_search_ms: list[float] = []
    total_ai_ms: list[float] = []
    sample_rows: list[dict[str, Any]] = []

    total_started = time.perf_counter()
    for repeat_index in range(args.repeat):
        for sample in inputs:
            sample_started = time.perf_counter()

            started = time.perf_counter()
            embedding = await embedder.extract(sample)
            embedding_elapsed = (time.perf_counter() - started) * 1000
            embedding_ms.append(embedding_elapsed)

            qdrant_elapsed = None
            if vector_store is not None:
                started = time.perf_counter()
                await vector_store.search(embedding.vector, top_k=settings.QDRANT_TOP_K)
                qdrant_elapsed = (time.perf_counter() - started) * 1000
                qdrant_search_ms.append(qdrant_elapsed)

            total_elapsed = (time.perf_counter() - sample_started) * 1000
            total_ai_ms.append(total_elapsed)
            sample_rows.append(
                {
                    "repeat": repeat_index + 1,
                    "track_id": sample.track_id,
                    "embedding_ms": embedding_elapsed,
                    "qdrant_search_ms": qdrant_elapsed,
                    "total_ai_ms": total_elapsed,
                }
            )

    total_seconds = time.perf_counter() - total_started
    summary = {
        "model_name": settings.INSIGHTFACE_MODEL_NAME,
        "model_file": settings.INSIGHTFACE_RECOGNITION_MODEL_FILE,
        "model_dir": settings.INSIGHTFACE_MODEL_DIR,
        "ctx_id": settings.INSIGHTFACE_CTX_ID,
        "qdrant_enabled": args.include_qdrant,
        "samples": len(inputs),
        "repeat": args.repeat,
        "total_faces": len(total_ai_ms),
        "total_seconds": total_seconds,
        "throughput_fps": len(total_ai_ms) / total_seconds if total_seconds > 0 else 0.0,
        "decode_ms": summarize_ms(decode_ms),
        "embedding_ms": summarize_ms(embedding_ms),
        "qdrant_search_ms": summarize_ms(qdrant_search_ms),
        "total_ai_ms": summarize_ms(total_ai_ms),
    }

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")

    if args.samples_output:
        samples_path = Path(args.samples_output)
        samples_path.parent.mkdir(parents=True, exist_ok=True)
        with samples_path.open("w", encoding="utf-8") as handle:
            for row in sample_rows:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    return summary


if __name__ == "__main__":
    print(json.dumps(asyncio.run(run()), indent=2))
