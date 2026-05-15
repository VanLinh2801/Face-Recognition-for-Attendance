"""
MetricsCollector - Thu thập và tổng hợp KPI metrics cho báo cáo.
Kết quả ghi vào result.json và result_summary.md khi kết thúc.
"""
import json
import time
import asyncio
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional
from datetime import datetime


@dataclass
class QualityMetrics:
    """Metrics cho Face Quality Filter."""
    total_detections: int = 0
    total_passed: int = 0
    total_rejected: int = 0
    filter_latencies_ms: list = field(default_factory=list)

    @property
    def pass_rate(self) -> float:
        if self.total_detections == 0:
            return 0.0
        return (self.total_passed / self.total_detections) * 100

    @property
    def avg_filter_latency_ms(self) -> float:
        if not self.filter_latencies_ms:
            return 0.0
        return sum(self.filter_latencies_ms) / len(self.filter_latencies_ms)


@dataclass
class PipelineMetrics:
    """Metrics cho toàn bộ pipeline."""
    # FPS metrics
    input_frame_count: int = 0
    processed_frame_count: int = 0
    input_fps_samples: list = field(default_factory=list)
    output_fps_samples: list = field(default_factory=list)

    # Crop metrics
    payload_sizes_kb: list = field(default_factory=list)
    aspect_ratio_distortions: list = field(default_factory=list)

    # Tracker stability
    id_switch_count: int = 0
    total_track_changes: int = 0

    # Storage
    upload_dispatch_latencies_ms: list = field(default_factory=list)
    upload_complete_latencies_ms: list = field(default_factory=list)

    # Detection-to-Send latency
    detection_to_send_latencies_ms: list = field(default_factory=list)
    _track_sent_counts: dict = field(default_factory=dict)
    _track_start_times: dict = field(default_factory=dict)
    FRAMES_TO_SEND: int = 5
    TRACK_TIMEOUT_SECONDS: float = 2.0

    @property
    def avg_input_fps(self) -> float:
        if not self.input_fps_samples:
            return 0.0
        return sum(self.input_fps_samples) / len(self.input_fps_samples)

    @property
    def avg_output_fps(self) -> float:
        if not self.output_fps_samples:
            return 0.0
        return sum(self.output_fps_samples) / len(self.output_fps_samples)

    @property
    def frame_drop_rate(self) -> float:
        if self.avg_input_fps == 0:
            return 0.0
        return ((self.avg_input_fps - self.avg_output_fps) / self.avg_input_fps) * 100

    @property
    def avg_payload_size_kb(self) -> float:
        if not self.payload_sizes_kb:
            return 0.0
        return sum(self.payload_sizes_kb) / len(self.payload_sizes_kb)

    @property
    def avg_aspect_ratio_distortion(self) -> float:
        if not self.aspect_ratio_distortions:
            return 0.0
        return sum(self.aspect_ratio_distortions) / len(self.aspect_ratio_distortions)

    @property
    def id_switch_rate(self) -> float:
        """Tỷ lệ switch = switches / total track changes. Lower = stable."""
        if self.total_track_changes == 0:
            return 0.0
        return (self.id_switch_count / self.total_track_changes) * 100

    def start_track(self, track_id: str):
        """Bắt đầu track mới."""
        self._track_start_times[track_id] = time.time()
        self._track_sent_counts[track_id] = 0

    def record_frame_sent(self, track_id: str) -> bool:
        """
        Ghi nhận một frame được gửi cho track.
        Returns True nếu đã gửi đủ 5 frames (kết thúc track).
        """
        if track_id not in self._track_start_times:
            self.start_track(track_id)

        self._track_sent_counts[track_id] = self._track_sent_counts.get(track_id, 0) + 1
        count = self._track_sent_counts[track_id]

        if count >= self.FRAMES_TO_SEND:
            elapsed = (time.time() - self._track_start_times[track_id]) * 1000
            self.detection_to_send_latencies_ms.append(elapsed)
            self._cleanup_track(track_id)
            return True
        return False

    def check_track_expired(self, track_id: str) -> Optional[float]:
        """
        Kiểm tra track có expired không.
        Returns latency nếu expired, None nếu còn active.
        """
        if track_id not in self._track_start_times:
            return None

        elapsed = time.time() - self._track_start_times[track_id]
        if elapsed >= self.TRACK_TIMEOUT_SECONDS:
            total_elapsed_ms = elapsed * 1000
            frames_sent = self._track_sent_counts.get(track_id, 0)
            if frames_sent > 0:
                self.detection_to_send_latencies_ms.append(total_elapsed_ms)
            self._cleanup_track(track_id)
            return total_elapsed_ms
        return None

    def _cleanup_track(self, track_id: str):
        """Dọn dẹp track data."""
        self._track_start_times.pop(track_id, None)
        self._track_sent_counts.pop(track_id, None)

    @property
    def avg_detection_to_send_latency_ms(self) -> float:
        if not self.detection_to_send_latencies_ms:
            return 0.0
        return sum(self.detection_to_send_latencies_ms) / len(self.detection_to_send_latencies_ms)

    @property
    def detection_to_send_samples_count(self) -> int:
        return len(self.detection_to_send_latencies_ms)

    def _percentile(self, data: list, p: float) -> float:
        if not data:
            return 0.0
        sorted_data = sorted(data)
        idx = int(len(sorted_data) * p / 100)
        return sorted_data[min(idx, len(sorted_data) - 1)]

    def get_detection_to_send_stats(self) -> dict:
        if not self.detection_to_send_latencies_ms:
            return {
                "avg_latency_ms": 0,
                "samples_count": 0,
                "min_ms": 0,
                "max_ms": 0,
                "p50_ms": 0,
                "p95_ms": 0,
            }
        return {
            "avg_latency_ms": round(self.avg_detection_to_send_latency_ms, 0),
            "samples_count": self.detection_to_send_samples_count,
            "min_ms": round(min(self.detection_to_send_latencies_ms), 0),
            "max_ms": round(max(self.detection_to_send_latencies_ms), 0),
            "p50_ms": round(self._percentile(self.detection_to_send_latencies_ms, 50), 0),
            "p95_ms": round(self._percentile(self.detection_to_send_latencies_ms, 95), 0),
        }


class MetricsCollector:
    """
    Singleton metrics collector cho toàn bộ pipeline.
    Thread-safe với asyncio.Lock.
    """

    _instance: Optional['MetricsCollector'] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return

        self._initialized = True
        self._lock = asyncio.Lock()

        # Metrics objects
        self.quality = QualityMetrics()
        self.pipeline = PipelineMetrics()

        # Timing
        self.start_time: float = time.time()
        self.last_summary_time: float = self.start_time
        self.summary_interval: float = 30.0  # Log summary mỗi 30 giây

        # Result file path - lưu vào folder evaluate_pipeline_fe_ngan
        self.result_file: Path = Path("evaluate_pipeline_fe_ngan/result.json")

    def record_detection(self, passed: int, rejected: int, filter_latency_ms: float):
        """Ghi nhận một lần chạy quality filter."""
        self.quality.total_detections += (passed + rejected)
        self.quality.total_passed += passed
        self.quality.total_rejected += rejected
        self.quality.filter_latencies_ms.append(filter_latency_ms)

    def record_payload_size(self, size_kb: float):
        """Ghi nhận kích thước payload."""
        self.pipeline.payload_sizes_kb.append(size_kb)

    def record_aspect_ratio_distortion(self, distortion_pct: float):
        """Ghi nhận aspect ratio distortion."""
        self.pipeline.aspect_ratio_distortions.append(distortion_pct)

    def record_id_switch(self):
        """Ghi nhận một ID switch event."""
        self.pipeline.id_switch_count += 1

    def record_track_change(self):
        """Ghi nhận tổng số thay đổi track (passed frame)."""
        self.pipeline.total_track_changes += 1

    def start_track(self, track_id: str):
        """Start detection-to-send latency tracking for a track."""
        self.pipeline.start_track(track_id)

    def record_frame_sent(self, track_id: str) -> bool:
        """Record one sent frame for a track."""
        return self.pipeline.record_frame_sent(track_id)

    def check_track_expired(self, track_id: str) -> Optional[float]:
        """Return latency when a tracked face times out before enough frames are sent."""
        return self.pipeline.check_track_expired(track_id)

    def record_input_frame(self):
        """Ghi nhận một frame đầu vào."""
        self.pipeline.input_frame_count += 1

    def record_processed_frame(self):
        """Ghi nhận một frame đã xử lý xong."""
        self.pipeline.processed_frame_count += 1

    def record_upload_dispatch(self, latency_ms: float):
        """Ghi nhận thời gian dispatch upload (non-blocking)."""
        self.pipeline.upload_dispatch_latencies_ms.append(latency_ms)

    def record_upload_complete(self, latency_ms: float):
        """Ghi nhận thời gian upload hoàn tất."""
        self.pipeline.upload_complete_latencies_ms.append(latency_ms)

    def _calculate_fps(self):
        """Tính FPS dựa trên frame counts."""
        elapsed = time.time() - self.last_summary_time
        if elapsed > 0:
            input_fps = self.pipeline.input_frame_count / elapsed
            output_fps = self.pipeline.processed_frame_count / elapsed
            self.pipeline.input_fps_samples.append(input_fps)
            self.pipeline.output_fps_samples.append(output_fps)

    def log_summary(self, force: bool = False):
        """Log summary metrics mỗi summary_interval giây."""
        from app.utils.logger import logger

        now = time.time()
        if not force and (now - self.last_summary_time) < self.summary_interval:
            return

        self._calculate_fps()
        runtime = now - self.start_time

        # Reset counters
        self.pipeline.input_frame_count = 0
        self.pipeline.processed_frame_count = 0
        self.last_summary_time = now

        logger.info(
            f"[METRICS] Runtime={runtime:.0f}s | "
            f"FPS(in/out)={self.pipeline.avg_input_fps:.1f}/{self.pipeline.avg_output_fps:.1f} | "
            f"Quality(pass/det)={self.quality.total_passed}/{self.quality.total_detections} "
            f"({self.quality.pass_rate:.1f}%) | "
            f"Filter_Avg={self.quality.avg_filter_latency_ms:.2f}ms"
        )

    def save_result(self, filepath: Optional[Path] = None) -> dict:
        """Ghi kết quả vào file JSON và Markdown."""
        from app.utils.logger import logger

        self._calculate_fps()
        self.log_summary(force=True)

        runtime = time.time() - self.start_time
        dts_stats = self.pipeline.get_detection_to_send_stats()

        avg_dispatch = 0
        if self.pipeline.upload_dispatch_latencies_ms:
            avg_dispatch = sum(self.pipeline.upload_dispatch_latencies_ms) / len(self.pipeline.upload_dispatch_latencies_ms)

        avg_complete = 0
        if self.pipeline.upload_complete_latencies_ms:
            avg_complete = sum(self.pipeline.upload_complete_latencies_ms) / len(self.pipeline.upload_complete_latencies_ms)

        result = {
            "generated_at": datetime.now().isoformat(),
            "runtime_seconds": runtime,
            "runtime_formatted": f"{int(runtime // 3600)}h {int((runtime % 3600) // 60)}m {int(runtime % 60)}s",

            "quality_filter": {
                "total_detections": self.quality.total_detections,
                "total_passed": self.quality.total_passed,
                "total_rejected": self.quality.total_rejected,
                "pass_rate_percent": round(self.quality.pass_rate, 2),
                "avg_filter_latency_ms": round(self.quality.avg_filter_latency_ms, 2),
            },

            "detection_to_send": dts_stats,

            "pipeline": {
                "avg_input_fps": round(self.pipeline.avg_input_fps, 2),
                "avg_output_fps": round(self.pipeline.avg_output_fps, 2),
                "frame_drop_rate_percent": round(self.pipeline.frame_drop_rate, 2),
                "avg_payload_size_kb": round(self.pipeline.avg_payload_size_kb, 2),
                "avg_aspect_ratio_distortion_percent": round(self.pipeline.avg_aspect_ratio_distortion, 2),
                "id_switch_count": self.pipeline.id_switch_count,
                "id_switch_rate_percent": round(self.pipeline.id_switch_rate, 2),
                "total_track_changes": self.pipeline.total_track_changes,
            },

            "storage": {
                "avg_upload_dispatch_ms": round(avg_dispatch, 2),
                "avg_upload_complete_ms": round(avg_complete, 2),
            }
        }

        if filepath:
            self.result_file = filepath

        # Tạo folder nếu chưa có
        self.result_file.parent.mkdir(parents=True, exist_ok=True)

        # Save JSON
        with open(self.result_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        # Save Markdown summary
        md_file = self.result_file.parent / "result_summary.md"
        self._save_markdown(md_file, result)

        logger.info(f"[METRICS] Results saved to {self.result_file}")
        logger.info(f"[METRICS] Summary saved to {md_file}")
        return result

    def _save_markdown(self, filepath: Path, result: dict):
        """Lưu bảng tổng kết dạng Markdown."""
        runtime = result.get("runtime_formatted", "N/A")
        qf = result.get("quality_filter", {})
        dts = result.get("detection_to_send", {})
        pl = result.get("pipeline", {})
        st = result.get("storage", {})

        md_lines = [
            "# KPI Evaluation Report",
            "",
            f"**Runtime:** {runtime}",
            f"**Generated:** {result.get('generated_at', 'N/A')}",
            "",
            "---",
            "",
            "## 1. Face Quality Filter",
            "",
            "| Metric | Value |",
            "|--------|-------|",
            f"| Total detections | {qf.get('total_detections', 0)} |",
            f"| Passed | {qf.get('total_passed', 0)} |",
            f"| Rejected | {qf.get('total_rejected', 0)} |",
            f"| Pass rate | {qf.get('pass_rate_percent', 0):.1f}% |",
            f"| Avg filter latency | {qf.get('avg_filter_latency_ms', 0):.2f}ms |",
            "",
            "## 2. Detection-to-Send Latency",
            "",
            "| Metric | Value |",
            "|--------|-------|",
            f"| Samples | {dts.get('samples_count', 0)} |",
            f"| Avg | {dts.get('avg_latency_ms', 0):.0f}ms |",
            f"| Min | {dts.get('min_ms', 0)}ms |",
            f"| Max | {dts.get('max_ms', 0)}ms |",
            f"| P50 | {dts.get('p50_ms', 0)}ms |",
            f"| P95 | {dts.get('p95_ms', 0)}ms |",
            "",
            "## 3. Pipeline Performance",
            "",
            "| Metric | Value |",
            "|--------|-------|",
            f"| Input FPS | {pl.get('avg_input_fps', 0):.1f} |",
            f"| Output FPS | {pl.get('avg_output_fps', 0):.1f} |",
            f"| Frame drop rate | {pl.get('frame_drop_rate_percent', 0):.1f}% |",
            f"| Avg payload size | {pl.get('avg_payload_size_kb', 0):.2f} KB |",
            f"| Aspect ratio distortion | {pl.get('avg_aspect_ratio_distortion_percent', 0):.2f}% |",
            f"| ID switch count | {pl.get('id_switch_count', 0)} |",
            f"| ID switch rate | {pl.get('id_switch_rate_percent', 0):.2f}% |",
            "",
            "## 4. Storage I/O",
            "",
            "| Metric | Value |",
            "|--------|-------|",
            f"| Avg upload dispatch | {st.get('avg_upload_dispatch_ms', 0):.2f}ms |",
            f"| Avg upload complete | {st.get('avg_upload_complete_ms', 0):.2f}ms |",
        ]

        filepath.write_text("\n".join(md_lines), encoding="utf-8")

    def reset(self):
        """Reset all metrics (useful for testing)."""
        self.__init__()


# Global singleton instance
metrics_collector = MetricsCollector()
