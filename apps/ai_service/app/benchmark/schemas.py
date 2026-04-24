"""Schemas for recognizer benchmark reports."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class ImageSample:
    identity: str
    path: str


@dataclass(frozen=True)
class MatchRecord:
    probe_identity: str
    probe_path: str
    is_known_identity: bool
    predicted_identity: str
    gallery_path: str
    score: float
    correct: bool


@dataclass(frozen=True)
class SkippedSample:
    path: str
    reason: str


@dataclass(frozen=True)
class ThresholdMetrics:
    threshold: float
    true_accepts: int
    false_rejects: int
    true_rejects: int
    false_accepts: int
    accept_rate: float
    false_accept_rate: float
    false_reject_rate: float
    balanced_accuracy: float


@dataclass
class ModelBenchmarkReport:
    model_name: str
    processed_probes: int = 0
    processed_gallery: int = 0
    known_probe_count: int = 0
    unknown_probe_count: int = 0
    rank1_accuracy: float = 0.0
    genuine_mean_score: float = 0.0
    impostor_mean_score: float = 0.0
    gallery_embedding_ms_mean: float = 0.0
    probe_embedding_ms_mean: float = 0.0
    total_runtime_ms: float = 0.0
    configured_threshold: float = 0.0
    configured_threshold_metrics: ThresholdMetrics | None = None
    best_threshold_metrics: ThresholdMetrics | None = None
    skipped_probes: list[SkippedSample] = field(default_factory=list)
    skipped_gallery: list[SkippedSample] = field(default_factory=list)
    top_matches: list[MatchRecord] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "model_name": self.model_name,
            "processed_probes": self.processed_probes,
            "processed_gallery": self.processed_gallery,
            "known_probe_count": self.known_probe_count,
            "unknown_probe_count": self.unknown_probe_count,
            "rank1_accuracy": self.rank1_accuracy,
            "genuine_mean_score": self.genuine_mean_score,
            "impostor_mean_score": self.impostor_mean_score,
            "gallery_embedding_ms_mean": self.gallery_embedding_ms_mean,
            "probe_embedding_ms_mean": self.probe_embedding_ms_mean,
            "total_runtime_ms": self.total_runtime_ms,
            "configured_threshold": self.configured_threshold,
            "configured_threshold_metrics": (
                asdict(self.configured_threshold_metrics)
                if self.configured_threshold_metrics is not None
                else None
            ),
            "best_threshold_metrics": (
                asdict(self.best_threshold_metrics)
                if self.best_threshold_metrics is not None
                else None
            ),
            "skipped_probes": [asdict(item) for item in self.skipped_probes],
            "skipped_gallery": [asdict(item) for item in self.skipped_gallery],
            "top_matches": [asdict(item) for item in self.top_matches],
        }
