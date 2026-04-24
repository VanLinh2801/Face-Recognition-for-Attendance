"""Run recognizer comparison benchmarks."""

from __future__ import annotations

import json
import math
import time
from datetime import datetime
from pathlib import Path

import numpy as np
from PIL import Image

from ..core.config import BenchmarkSettings
from .schemas import (
    ImageSample,
    MatchRecord,
    ModelBenchmarkReport,
    SkippedSample,
    ThresholdMetrics,
)

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


class InsightFaceRecognizer:
    def __init__(self, model_name: str, ctx_id: int, det_size: int) -> None:
        try:
            from insightface.app import FaceAnalysis
        except ImportError as exc:
            raise RuntimeError(
                "insightface is not installed. Add insightface and onnxruntime first."
            ) from exc

        self._app = FaceAnalysis(name=model_name)
        self._app.prepare(ctx_id=ctx_id, det_size=(det_size, det_size))

    def embed_image(self, path: Path) -> tuple[np.ndarray | None, str | None]:
        image = np.array(Image.open(path).convert("RGB"))[:, :, ::-1]
        faces = self._app.get(image)
        if not faces:
            return None, "no_face"
        if len(faces) > 1:
            return None, "multiple_faces"

        face = faces[0]
        embedding = getattr(face, "normed_embedding", None)
        if embedding is None:
            return None, "missing_embedding"
        return np.asarray(embedding, dtype=np.float32), None


def _cosine_similarity(left: np.ndarray, right: np.ndarray) -> float:
    denominator = float(np.linalg.norm(left) * np.linalg.norm(right))
    if math.isclose(denominator, 0.0):
        return 0.0
    return float(np.dot(left, right) / denominator)


def _collect_samples(root: Path) -> list[ImageSample]:
    samples: list[ImageSample] = []
    if not root.exists():
        return samples

    for path in sorted(root.rglob("*")):
        if not path.is_file() or path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        try:
            identity = path.relative_to(root).parts[0]
        except IndexError:
            identity = "unknown"
        samples.append(ImageSample(identity=identity, path=str(path)))
    return samples


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _safe_rate(numerator: int, denominator: int) -> float:
    return numerator / denominator if denominator else 0.0


def _build_threshold_metrics(
    matches: list[MatchRecord],
    threshold: float,
) -> ThresholdMetrics:
    true_accepts = 0
    false_rejects = 0
    true_rejects = 0
    false_accepts = 0

    for match in matches:
        accepted = match.score >= threshold and match.correct
        if match.is_known_identity:
            if accepted:
                true_accepts += 1
            else:
                false_rejects += 1
            continue

        if match.score >= threshold:
            false_accepts += 1
        else:
            true_rejects += 1

    known_count = sum(1 for match in matches if match.is_known_identity)
    unknown_count = len(matches) - known_count
    accept_rate = _safe_rate(true_accepts, known_count)
    false_reject_rate = _safe_rate(false_rejects, known_count)
    false_accept_rate = _safe_rate(false_accepts, unknown_count)
    true_reject_rate = _safe_rate(true_rejects, unknown_count)
    balanced_accuracy = (
        (accept_rate + true_reject_rate) / 2 if known_count and unknown_count else 0.0
    )

    return ThresholdMetrics(
        threshold=threshold,
        true_accepts=true_accepts,
        false_rejects=false_rejects,
        true_rejects=true_rejects,
        false_accepts=false_accepts,
        accept_rate=accept_rate,
        false_accept_rate=false_accept_rate,
        false_reject_rate=false_reject_rate,
        balanced_accuracy=balanced_accuracy,
    )


def _find_best_threshold(matches: list[MatchRecord]) -> ThresholdMetrics | None:
    if not matches:
        return None

    candidate_thresholds = {0.0, 1.0}
    candidate_thresholds.update(match.score for match in matches)
    scored_metrics = [
        _build_threshold_metrics(matches, threshold)
        for threshold in sorted(candidate_thresholds)
    ]
    return max(
        scored_metrics,
        key=lambda item: (
            item.balanced_accuracy,
            item.accept_rate,
            -item.false_accept_rate,
            item.threshold,
        ),
    )


class RecognizerBenchmark:
    def __init__(self, settings: BenchmarkSettings) -> None:
        self._settings = settings
        self._gallery_root = Path(settings.gallery_dir)
        self._probe_root = Path(settings.probe_dir)
        self._report_root = Path(settings.report_dir)

    def run(self) -> Path:
        reports = [self._evaluate_model(model_name) for model_name in self._settings.models]
        self._report_root.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        report_path = self._report_root / f"recognizer_benchmark_{timestamp}.json"
        payload = {
            "generated_at_utc": timestamp,
            "gallery_dir": str(self._gallery_root),
            "probe_dir": str(self._probe_root),
            "models": [report.to_dict() for report in reports],
        }
        report_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return report_path

    def _evaluate_model(self, model_name: str) -> ModelBenchmarkReport:
        started_at = time.perf_counter()
        runner = InsightFaceRecognizer(
            model_name=model_name,
            ctx_id=self._settings.insightface_ctx_id,
            det_size=self._settings.insightface_det_size,
        )
        report = ModelBenchmarkReport(model_name=model_name)
        report.configured_threshold = self._settings.match_threshold
        gallery_vectors: list[tuple[ImageSample, np.ndarray]] = []
        gallery_embedding_times_ms: list[float] = []
        probe_embedding_times_ms: list[float] = []

        for sample in _collect_samples(self._gallery_root):
            embed_started_at = time.perf_counter()
            embedding, reason = runner.embed_image(Path(sample.path))
            gallery_embedding_times_ms.append(
                (time.perf_counter() - embed_started_at) * 1000
            )
            if embedding is None:
                report.skipped_gallery.append(SkippedSample(path=sample.path, reason=reason or "unknown"))
                continue
            gallery_vectors.append((sample, embedding))

        report.processed_gallery = len(gallery_vectors)
        report.gallery_embedding_ms_mean = _mean(gallery_embedding_times_ms)
        if not gallery_vectors:
            report.total_runtime_ms = (time.perf_counter() - started_at) * 1000
            return report

        gallery_identities = {sample.identity for sample, _ in gallery_vectors}
        genuine_scores: list[float] = []
        impostor_scores: list[float] = []
        matches: list[MatchRecord] = []

        for sample in _collect_samples(self._probe_root):
            embed_started_at = time.perf_counter()
            embedding, reason = runner.embed_image(Path(sample.path))
            probe_embedding_times_ms.append((time.perf_counter() - embed_started_at) * 1000)
            if embedding is None:
                report.skipped_probes.append(SkippedSample(path=sample.path, reason=reason or "unknown"))
                continue

            scored = [
                (gallery_sample, _cosine_similarity(embedding, gallery_embedding))
                for gallery_sample, gallery_embedding in gallery_vectors
            ]
            scored.sort(key=lambda item: item[1], reverse=True)
            best_sample, best_score = scored[0]
            is_known_identity = sample.identity in gallery_identities
            is_correct = is_known_identity and best_sample.identity == sample.identity
            matches.append(
                MatchRecord(
                    probe_identity=sample.identity,
                    probe_path=sample.path,
                    is_known_identity=is_known_identity,
                    predicted_identity=best_sample.identity,
                    gallery_path=best_sample.path,
                    score=best_score,
                    correct=is_correct,
                )
            )
            report.processed_probes += 1
            if is_known_identity:
                report.known_probe_count += 1
            else:
                report.unknown_probe_count += 1

            for gallery_sample, score in scored:
                if gallery_sample.identity == sample.identity:
                    genuine_scores.append(score)
                else:
                    impostor_scores.append(score)

        report.top_matches = matches
        report.probe_embedding_ms_mean = _mean(probe_embedding_times_ms)
        if report.known_probe_count:
            report.rank1_accuracy = sum(1 for item in matches if item.correct) / report.known_probe_count
        report.genuine_mean_score = _mean(genuine_scores)
        report.impostor_mean_score = _mean(impostor_scores)
        if matches:
            report.configured_threshold_metrics = _build_threshold_metrics(
                matches,
                report.configured_threshold,
            )
            report.best_threshold_metrics = _find_best_threshold(matches)
        report.total_runtime_ms = (time.perf_counter() - started_at) * 1000
        return report
