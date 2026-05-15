from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import statistics
import sys
import uuid
from pathlib import Path
from typing import Any

import cv2
import numpy as np

BENCHMARKS_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BENCHMARKS_ROOT))

from env_utils import bootstrap_env, env_bool, env_float  # noqa: E402

DEFAULT_ENV_FILE = BENCHMARKS_ROOT / ".env.benchmark"
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def percentile(values: list[float], pct: float) -> float:
    if not values:
        return 0.0
    values = sorted(values)
    index = min(len(values) - 1, int(round((pct / 100.0) * (len(values) - 1))))
    return values[index]


def parse_args() -> argparse.Namespace:
    loaded_env_file = bootstrap_env(DEFAULT_ENV_FILE)
    parser = argparse.ArgumentParser(
        description="Benchmark face recognition accuracy: FAR, FRR, TPR, EER, AUC, ROC."
    )
    parser.add_argument("--env-file", default=str(loaded_env_file))
    parser.add_argument(
        "--data-dir",
        default=os.environ.get("BENCH_ACCURACY_DATA_DIR"),
        help=(
            "Root directory containing enrolled/, genuine/, impostor/ sub-dirs. "
            "Env: BENCH_ACCURACY_DATA_DIR."
        ),
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
    parser.add_argument(
        "--qdrant-collection",
        default=os.environ.get("BENCH_ACCURACY_QDRANT_COLLECTION", "bench_accuracy_temp"),
        help="Isolated Qdrant collection for this run. Env: BENCH_ACCURACY_QDRANT_COLLECTION.",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=env_float("BENCH_ACCURACY_THRESHOLD", 0.6),
        help="Recognition threshold for KNOWN/UNKNOWN. Env: BENCH_ACCURACY_THRESHOLD.",
    )
    parser.add_argument(
        "--keep-collection",
        action="store_true",
        default=env_bool("BENCH_ACCURACY_KEEP_COLLECTION", False),
        help="Keep temp Qdrant collection after run. Env: BENCH_ACCURACY_KEEP_COLLECTION.",
    )
    parser.add_argument("--output", default=os.environ.get("BENCH_ACCURACY_SUMMARY_OUTPUT"))
    parser.add_argument(
        "--samples-output", default=os.environ.get("BENCH_ACCURACY_SAMPLES_OUTPUT")
    )
    parser.add_argument("--roc-output", default=os.environ.get("BENCH_ACCURACY_ROC_OUTPUT"))
    args = parser.parse_args()
    if not args.data_dir:
        parser.error(
            "Missing --data-dir. Set BENCH_ACCURACY_DATA_DIR in benchmarks/.env.benchmark "
            "or pass --data-dir."
        )
    return args


def apply_env_overrides(args: argparse.Namespace) -> None:
    repo_root = Path(__file__).resolve().parents[2]

    overrides = {
        "INSIGHTFACE_MODEL_NAME": args.model_name,
        "INSIGHTFACE_MODEL_DIR": args.model_dir,
        "INSIGHTFACE_RECOGNITION_MODEL_FILE": args.model_file,
        "INSIGHTFACE_CTX_ID": str(args.ctx_id) if args.ctx_id is not None else None,
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


def find_images(directory: Path) -> list[Path]:
    return sorted(
        p for p in directory.rglob("*")
        if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS
    )


def detect_and_crop(
    image_path: Path, detector: Any, cropper: Any
) -> tuple[bytes | None, list[list[float]] | None, float | None]:
    """
    Detect the largest face in image_path, crop it.
    Returns (jpeg_bytes, kpss, detection_score) or (None, None, None) on failure.
    """
    frame = cv2.imread(str(image_path))
    if frame is None:
        return None, None, None

    context = detector.process({"frame": frame})
    detections = context.get("detections", [])
    if not detections:
        return None, None, None

    best = max(
        detections,
        key=lambda d: (d["bbox"][2] - d["bbox"][0]) * (d["bbox"][3] - d["bbox"][1]),
    )
    context["faces_to_emit"] = [
        {
            "track_id": "bench",
            "bbox": best["bbox"],
            "score": best["score"],
            "kpss": best.get("kpss"),
        }
    ]
    context["frame"] = frame
    crop_ctx = cropper.process(context)
    processed = crop_ctx.get("processed_faces", [])
    if not processed:
        return None, None, None

    face = processed[0]
    return base64.b64decode(face["image_b64"]), face.get("kpss"), best["score"]


async def embed(
    image_bytes: bytes,
    kpss: list,
    track_id: str,
    embedder: Any,
    FaceInput: Any,
) -> np.ndarray | None:
    try:
        face_input = FaceInput(track_id=track_id, image_data=image_bytes, kpss=kpss)
        result = await embedder.extract(face_input)
        return result.vector
    except Exception as exc:
        print(f"  [WARN] Embedding failed for {track_id}: {exc}", file=sys.stderr)
        return None


def normalize(vector: np.ndarray) -> np.ndarray:
    norm = np.linalg.norm(vector)
    return vector / norm if norm > 0 else vector


async def enroll_persons(
    enrolled_dir: Path,
    detector: Any,
    cropper: Any,
    embedder: Any,
    FaceInput: Any,
    qdrant: Any,
    collection: str,
) -> dict[str, str]:
    """
    For each sub-directory in enrolled_dir: detect+crop+embed all photos, average the
    embeddings, upsert one vector per person.  Returns {identity -> registration_id}.
    """
    from qdrant_client.models import Distance, PointStruct, VectorParams  # noqa: PLC0415

    existing = {c.name for c in (await qdrant.get_collections()).collections}
    if collection not in existing:
        await qdrant.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(size=512, distance=Distance.COSINE),
        )
        print(f"[ENROLL] Created temp collection: {collection}")
    else:
        print(f"[ENROLL] Reusing existing collection: {collection}")

    identity_dirs = sorted(d for d in enrolled_dir.iterdir() if d.is_dir())
    print(f"[ENROLL] {len(identity_dirs)} person(s) to enroll")

    enrolled: dict[str, str] = {}

    for identity_dir in identity_dirs:
        identity = identity_dir.name
        images = find_images(identity_dir)
        if not images:
            print(f"  [WARN] No images in enrolled/{identity}, skipping.")
            continue

        vectors: list[np.ndarray] = []
        for img_path in images:
            img_bytes, kpss, _ = detect_and_crop(img_path, detector, cropper)
            if img_bytes is None:
                print(f"  [WARN] No face detected: enrolled/{identity}/{img_path.name}")
                continue
            vec = await embed(img_bytes, kpss, f"{identity}_{img_path.stem}", embedder, FaceInput)
            if vec is not None:
                vectors.append(vec)

        if not vectors:
            print(f"  [WARN] {identity}: all photos failed, not enrolled.")
            continue

        avg = normalize(np.mean(np.stack(vectors), axis=0).astype(np.float32))
        reg_id = str(uuid.uuid4())
        enrolled[identity] = reg_id

        await qdrant.upsert(
            collection_name=collection,
            points=[
                PointStruct(
                    id=reg_id,
                    vector=avg.tolist(),
                    payload={"person_id": identity, "registration_id": reg_id},
                )
            ],
        )
        print(
            f"  [ENROLL] {identity}: averaged {len(vectors)}/{len(images)} photo(s) "
            f"→ reg_id={reg_id}"
        )

    return enrolled


async def run_queries(
    query_dir: Path,
    split: str,
    enrolled: dict[str, str] | None,
    detector: Any,
    cropper: Any,
    embedder: Any,
    FaceInput: Any,
    qdrant: Any,
    collection: str,
    threshold: float,
) -> list[dict[str, Any]]:
    """Detect+crop+embed every image in query_dir and compare against Qdrant."""
    samples: list[dict[str, Any]] = []
    identity_dirs = sorted(d for d in query_dir.iterdir() if d.is_dir())

    for identity_dir in identity_dirs:
        expected = identity_dir.name
        if split == "genuine" and enrolled is not None and expected not in enrolled:
            print(f"  [WARN] genuine/{expected} not in enrolled/, skipping.")
            continue

        for img_path in find_images(identity_dir):
            sample: dict[str, Any] = {
                "split": split,
                "expected_identity": expected,
                "image": img_path.name,
                "detected": False,
                "match_score": None,
                "predicted_identity": None,
                "decision": None,
                "is_tp": False,
                "is_fp": False,
                "is_tn": False,
                "is_fn": False,
            }

            img_bytes, kpss, det_score = detect_and_crop(img_path, detector, cropper)
            if img_bytes is None:
                # No face detected
                if split == "genuine":
                    sample.update({"is_fn": True, "decision": "fn_no_detection", "match_score": 0.0})
                else:
                    # Impostor not detected → correctly rejected
                    sample.update({"is_tn": True, "decision": "tn_no_detection", "match_score": 0.0})
                samples.append(sample)
                continue

            sample["detected"] = True
            sample["detection_score"] = det_score

            vec = await embed(img_bytes, kpss, f"{expected}_{img_path.stem}", embedder, FaceInput)
            if vec is None:
                if split == "genuine":
                    sample.update({"is_fn": True, "decision": "fn_embed_failed", "match_score": 0.0})
                else:
                    sample.update({"is_tn": True, "decision": "tn_embed_failed", "match_score": 0.0})
                samples.append(sample)
                continue

            results = await qdrant.search(
                collection_name=collection,
                query_vector=normalize(vec).tolist(),
                limit=1,
                with_payload=True,
            )

            if results:
                score = float(results[0].score)
                predicted = results[0].payload.get("person_id", "")
                sample["match_score"] = score
                sample["predicted_identity"] = predicted

                if split == "genuine":
                    if score >= threshold and predicted == expected:
                        sample.update({"is_tp": True, "decision": "tp"})
                    elif score >= threshold:
                        # Matched but wrong person
                        sample.update({"is_fn": True, "decision": "fn_wrong_person"})
                    else:
                        sample.update({"is_fn": True, "decision": "fn_below_threshold"})
                else:
                    if score >= threshold:
                        sample.update({"is_fp": True, "decision": "fp"})
                    else:
                        sample.update({"is_tn": True, "decision": "tn"})
            else:
                sample["match_score"] = 0.0
                if split == "genuine":
                    sample.update({"is_fn": True, "decision": "fn_no_results"})
                else:
                    sample.update({"is_tn": True, "decision": "tn_no_results"})

            samples.append(sample)

    return samples


def compute_roc(
    genuine_scores: list[float], impostor_scores: list[float]
) -> list[dict[str, float]]:
    points: list[dict[str, float]] = []
    for t in [round(i * 0.01, 2) for i in range(101)]:
        far = sum(1 for s in impostor_scores if s >= t) / max(len(impostor_scores), 1)
        frr = sum(1 for s in genuine_scores if s < t) / max(len(genuine_scores), 1)
        points.append({"threshold": t, "far": far, "frr": frr, "tpr": 1.0 - frr})
    return points


def compute_eer(roc: list[dict]) -> tuple[float, float]:
    best_t, best_rate, best_diff = 0.5, 0.5, float("inf")
    for point in roc:
        diff = abs(point["far"] - point["frr"])
        if diff < best_diff:
            best_diff = diff
            best_t = point["threshold"]
            best_rate = (point["far"] + point["frr"]) / 2.0
    return best_t, best_rate


def compute_auc(roc: list[dict]) -> float:
    pts = sorted(roc, key=lambda p: p["far"])
    auc = 0.0
    for i in range(1, len(pts)):
        dx = pts[i]["far"] - pts[i - 1]["far"]
        auc += dx * (pts[i]["tpr"] + pts[i - 1]["tpr"]) / 2.0
    return auc


async def run() -> None:
    args = parse_args()
    apply_env_overrides(args)

    def _resolve(p: str) -> Path:
        path = Path(p)
        return path if path.is_absolute() else BENCHMARKS_ROOT / path

    data_dir = _resolve(args.data_dir)
    enrolled_dir = data_dir / "enrolled"
    genuine_dir = data_dir / "genuine"
    impostor_dir = data_dir / "impostor"

    for d in (enrolled_dir, genuine_dir, impostor_dir):
        if not d.is_dir():
            print(f"[ERROR] Directory not found: {d}", file=sys.stderr)
            sys.exit(1)

    repo_root = Path(__file__).resolve().parents[2]

    # --- Import pipeline processors first ---
    sys.path.insert(0, str(repo_root / "apps" / "pipeline"))
    from app.processors.face_cropper import FaceCropper  # noqa: PLC0415
    from app.processors.face_detector import SCRFDFaceDetector  # noqa: PLC0415

    # Save pipeline's app.* modules then evict so ai_service can register its own
    _pipeline_modules = {k: v for k, v in sys.modules.items() if k == "app" or k.startswith("app.")}
    for k in list(_pipeline_modules):
        del sys.modules[k]

    # --- Import AI service modules ---
    sys.path.insert(0, str(repo_root / "apps" / "ai_service"))
    from app.domain.entities.face import FaceInput  # noqa: PLC0415
    from app.infrastructure.ai_models.insightface_embedder import InsightFaceEmbedder  # noqa: PLC0415
    from qdrant_client import AsyncQdrantClient  # noqa: PLC0415

    print("[INIT] Loading models...")
    detector = SCRFDFaceDetector()
    cropper = FaceCropper()
    embedder = InsightFaceEmbedder()
    qdrant = AsyncQdrantClient(url=args.qdrant_url)

    try:
        # ---- Phase 1: Enroll ----
        print(f"\n[PHASE 1] Enrolling from {enrolled_dir} ...")
        enrolled = await enroll_persons(
            enrolled_dir, detector, cropper, embedder, FaceInput,
            qdrant, args.qdrant_collection,
        )
        if not enrolled:
            print("[ERROR] No persons enrolled.", file=sys.stderr)
            sys.exit(1)
        print(f"[PHASE 1] Done — {len(enrolled)} person(s): {sorted(enrolled)}")

        # ---- Phase 2: Genuine queries ----
        print(f"\n[PHASE 2] Genuine queries from {genuine_dir} ...")
        genuine_samples = await run_queries(
            genuine_dir, "genuine", enrolled,
            detector, cropper, embedder, FaceInput,
            qdrant, args.qdrant_collection, args.threshold,
        )
        print(f"[PHASE 2] Done — {len(genuine_samples)} query image(s)")

        # ---- Phase 3: Impostor queries ----
        print(f"\n[PHASE 3] Impostor queries from {impostor_dir} ...")
        impostor_samples = await run_queries(
            impostor_dir, "impostor", None,
            detector, cropper, embedder, FaceInput,
            qdrant, args.qdrant_collection, args.threshold,
        )
        print(f"[PHASE 3] Done — {len(impostor_samples)} query image(s)")

    finally:
        if not args.keep_collection:
            try:
                await qdrant.delete_collection(args.qdrant_collection)
                print(f"\n[CLEANUP] Deleted temp collection: {args.qdrant_collection}")
            except Exception as exc:
                print(f"\n[WARN] Could not delete collection: {exc}", file=sys.stderr)
        await qdrant.close()

    # ---- Metrics ----
    all_samples = genuine_samples + impostor_samples
    tp = sum(1 for s in all_samples if s["is_tp"])
    fp = sum(1 for s in all_samples if s["is_fp"])
    tn = sum(1 for s in all_samples if s["is_tn"])
    fn = sum(1 for s in all_samples if s["is_fn"])

    tpr = tp / (tp + fn) if (tp + fn) else 0.0
    far = fp / (fp + tn) if (fp + tn) else 0.0
    frr = fn / (tp + fn) if (tp + fn) else 0.0
    accuracy = (tp + tn) / len(all_samples) if all_samples else 0.0
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    f1 = 2 * precision * tpr / (precision + tpr) if (precision + tpr) else 0.0

    genuine_scores = [s["match_score"] for s in genuine_samples if s["match_score"] is not None]
    impostor_scores = [s["match_score"] for s in impostor_samples if s["match_score"] is not None]
    roc = compute_roc(genuine_scores, impostor_scores)
    eer_threshold, eer_rate = compute_eer(roc)
    auc = compute_auc(roc)

    def score_stats(scores: list[float], low_pct: int = 5) -> dict:
        if not scores:
            return {"count": 0}
        return {
            "count": len(scores),
            "avg": round(statistics.mean(scores), 4),
            "p50": round(percentile(scores, 50), 4),
            f"p{low_pct}": round(percentile(scores, low_pct), 4),
            "min": round(min(scores), 4),
            "max": round(max(scores), 4),
        }

    summary = {
        "model_name": os.environ.get("INSIGHTFACE_MODEL_NAME", "unknown"),
        "threshold": args.threshold,
        "enrolled_persons": len(enrolled),
        "genuine_queries": len(genuine_samples),
        "impostor_queries": len(impostor_samples),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "tpr": round(tpr, 4),
        "far": round(far, 4),
        "frr": round(frr, 4),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "f1": round(f1, 4),
        "eer_threshold": eer_threshold,
        "eer_rate": round(eer_rate, 4),
        "auc": round(auc, 4),
        "genuine_score_stats": score_stats(genuine_scores, low_pct=5),
        "impostor_score_stats": score_stats(impostor_scores, low_pct=95),
    }

    print("\n=== ACCURACY RESULTS ===")
    print(json.dumps(summary, indent=2))

    if args.output:
        out = _resolve(args.output)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(summary, indent=2), encoding="utf-8")
        print(f"\n[OUT] Summary → {out}")

    if args.samples_output:
        sp = _resolve(args.samples_output)
        sp.parent.mkdir(parents=True, exist_ok=True)
        with sp.open("w", encoding="utf-8") as fh:
            for s in all_samples:
                fh.write(json.dumps(s, ensure_ascii=False) + "\n")
        print(f"[OUT] Per-sample → {sp}")

    if args.roc_output:
        rp = _resolve(args.roc_output)
        rp.parent.mkdir(parents=True, exist_ok=True)
        rp.write_text(json.dumps(roc, indent=2), encoding="utf-8")
        print(f"[OUT] ROC curve → {rp}")


if __name__ == "__main__":
    asyncio.run(run())
