# Kế hoạch Triển khai KPI Evaluation cho Face Attendance Pipeline

## Mục tiêu

**Chạy 1 script duy nhất, dừng bằng Ctrl+C, kết quả tự lưu vào file.**

```
┌────────────────────────────────────────────────────────────┐
│  Chạy:  python run_kpi_evaluation.py                      │
│  Dừng:  Ctrl+C                                            │
│  Output: result.json + result.md                           │
└────────────────────────────────────────────────────────────┘
```

## Output khi kết thúc

### result.json
```json
{
  "generated_at": "2026-05-15T16:30:00",
  "runtime_seconds": 3600,
  "runtime_formatted": "1h 0m 0s",
  "quality_filter": {
    "total_detections": 4500,
    "total_passed": 3270,
    "total_rejected": 1230,
    "pass_rate_percent": 72.67,
    "avg_filter_latency_ms": 4.52
  },
  "detection_to_send": {
    "avg_latency_ms": 4523,
    "samples_count": 340,
    "min_ms": 2100,
    "max_ms": 6800,
    "p50_ms": 4400,
    "p95_ms": 5500
  },
  "pipeline": {
    "avg_input_fps": 24.8,
    "avg_output_fps": 15.2,
    "frame_drop_rate_percent": 38.71,
    "avg_payload_size_kb": 12.34,
    "avg_aspect_ratio_distortion_percent": 3.21,
    "id_switch_count": 45,
    "id_switch_rate_percent": 1.38,
    "total_track_changes": 3270
  },
  "storage": {
    "avg_upload_dispatch_ms": 0.32,
    "avg_upload_complete_ms": 45.67
  }
}
```

### result.md (Markdown)
```markdown
# KPI Evaluation Report

**Runtime:** 1h 0m 0s
**Generated:** 2026-05-15T16:30:00

---

## 1. Face Quality Filter

| Metric | Value |
|--------|-------|
| Total detections | 4500 |
| Passed | 3270 |
| Rejected | 1230 |
| Pass rate | 72.67% |
| Avg filter latency | 4.52ms |

## 2. Detection-to-Send Latency

| Metric | Value |
|--------|-------|
| Samples | 340 |
| Avg | 4523ms |
| Min | 2100ms |
| Max | 6800ms |
| P50 | 4400ms |
| P95 | 5500ms |

## 3. Pipeline Performance

| Metric | Value |
|--------|-------|
| Input FPS | 24.8 |
| Output FPS | 15.2 |
| Frame drop rate | 38.71% |
| Avg payload size | 12.34 KB |
| Aspect ratio distortion | 3.21% |
| ID switch count | 45 |
| ID switch rate | 1.38% |

## 4. Storage I/O

| Metric | Value |
|--------|-------|
| Avg upload dispatch | 0.32ms |
| Avg upload complete | 45.67ms |
```

---

## Danh sách KPI cuối cùng (13 metrics)

| # | KPI | Ý nghĩa |
|---|-----|----------|
| 1 | **Pass Rate (%)** | Tỷ lệ face pass quality filter |
| 2 | **Filter Latency (ms)** | Thời gian chạy quality filter |
| 3 | **Detection-to-Send Latency (ms)** | Từ detect đến gửi đủ 5 frames |
| 4 | Input FPS | Frame rate đầu vào |
| 5 | Output FPS | Frame rate thực tế xử lý |
| 6 | Frame Drop Rate (%) | Tỷ lệ frame bị drop đầu vào |
| 7 | Payload Size (KB) | Kích thước ảnh base64 |
| 8 | Aspect Ratio Distortion (%) | Độ biến dạng tỷ lệ |
| 9 | ID Switch Count | Số lần track_id thay đổi |
| 10 | ID Switch Rate (%) | Stability metric |
| 11 | Upload Dispatch (ms) | Thời gian dispatch |
| 12 | Upload Complete (ms) | Thời gian upload |
| 13 | Display Latency (ms) | Thời gian BE->FE |

---

## Tổng kết các file cần tạo/sửa

| File | Thay đổi |
|------|----------|
| `apps/pipeline/run_kpi_evaluation.py` | **MỚI** - Script chạy duy nhất |
| `apps/pipeline/app/utils/metrics_collector.py` | **MỚI** - Class thu thập KPI |
| `apps/pipeline/app/processors/face_quality_filter.py` | Ghi filter latency |
| `apps/pipeline/app/services/pipeline_service.py` | FPS, payload, aspect ratio |
| `apps/pipeline/app/processors/face_tracker.py` | ID switch tracking |
| `apps/pipeline/app/clients/storage_client.py` | Upload timing |
| `apps/backend/app/infrastructure/realtime/websocket_hub.py` | time_sent timestamp |
| Frontend | Display latency |
| `apps/pipeline/scripts/collect_debug_images.py` | **MỚI** - Script nhặt ảnh |

---

## Chi tiết các Tasks

### Task 0: run_kpi_evaluation.py

```python
#!/usr/bin/env python3
"""
Script chạy KPI Evaluation.
- Chạy: python run_kpi_evaluation.py
- Dừng: Ctrl+C
- Kết quả: result.json + result.md tự động lưu khi dừng
"""
import asyncio
import signal
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from app.utils.logger import logger
from app.utils.metrics_collector import metrics_collector
from app.config import get_settings
from app.services.pipeline_service import PipelineService


class KPIEvaluationRunner:
    def __init__(self):
        self.pipeline_service = None
        self._shutdown_event = asyncio.Event()

    async def setup(self):
        settings = get_settings()
        self.pipeline_service = PipelineService(settings)
        await self.pipeline_service.start()
        logger.info("[KPI] Pipeline started. Monitoring metrics...")

    async def run(self):
        logger.info("[KPI] Press Ctrl+C to stop and save results.")
        try:
            await self._shutdown_event.wait()
        except asyncio.CancelledError:
            pass

    def save_results(self):
        logger.info("[KPI] Saving results...")
        result = metrics_collector.save_result()
        self._print_summary(result)

    def _print_summary(self, result: dict):
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

        md_file = metrics_collector.result_file.parent / "result_summary.md"
        md_file.write_text("\n".join(md_lines), encoding="utf-8")

        print("\n" + "=" * 50)
        print(f"  KPI EVALUATION - Runtime: {runtime}")
        print("=" * 50)
        print(f"  Pass Rate: {qf.get('pass_rate_percent', 0):.1f}%")
        print(f"  Detection-to-Send: {dts.get('avg_latency_ms', 0):.0f}ms avg")
        print(f"  FPS: {pl.get('avg_input_fps', 0):.1f} -> {pl.get('avg_output_fps', 0):.1f}")
        print(f"  Frame Drop: {pl.get('frame_drop_rate_percent', 0):.1f}%")
        print("=" * 50)
        print(f"  result.json: {metrics_collector.result_file}")
        print(f"  result.md:   {md_file}")
        print("=" * 50 + "\n")

    async def shutdown(self):
        if self.pipeline_service:
            await self.pipeline_service.stop()


async def main():
    runner = KPIEvaluationRunner()

    def signal_handler(sig, frame):
        logger.info(f"[KPI] Received signal {sig}, shutting down...")
        runner._shutdown_event.set()

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        await runner.setup()
        await runner.run()
    finally:
        runner.save_results()
        await runner.shutdown()


if __name__ == "__main__":
    asyncio.run(main())
```

### Task 1: MetricsCollector

`apps/pipeline/app/utils/metrics_collector.py`

```python
"""
MetricsCollector - Thu thập và tổng hợp KPI metrics.
Kết quả ghi vào result.json và result.md khi kết thúc.
"""
import json
import time
import asyncio
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional
from datetime import datetime

from app.utils.logger import logger


@dataclass
class QualityMetrics:
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
    # FPS
    input_frame_count: int = 0
    processed_frame_count: int = 0
    input_fps_samples: list = field(default_factory=list)
    output_fps_samples: list = field(default_factory=list)

    # Crop
    payload_sizes_kb: list = field(default_factory=list)
    aspect_ratio_distortions: list = field(default_factory=list)

    # Tracker
    id_switch_count: int = 0
    total_track_changes: int = 0

    # Storage
    upload_dispatch_latencies_ms: list = field(default_factory=list)
    upload_complete_latencies_ms: list = field(default_factory=list)

    # Detection-to-Send
    detection_to_send_latencies_ms: list = field(default_factory=list)
    _track_sent_counts: dict = field(default_factory=dict)
    _track_start_times: dict = field(default_factory=dict)
    FRAMES_TO_SEND = 5
    TRACK_TIMEOUT_SECONDS = 2.0

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
        if self.total_track_changes == 0:
            return 0.0
        return (self.id_switch_count / self.total_track_changes) * 100

    def start_track(self, track_id: str):
        self._track_start_times[track_id] = time.time()
        self._track_sent_counts[track_id] = 0

    def record_frame_sent(self, track_id: str) -> bool:
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
            return {}
        return {
            "avg_latency_ms": self.avg_detection_to_send_latency_ms,
            "samples_count": self.detection_to_send_samples_count,
            "min_ms": min(self.detection_to_send_latencies_ms),
            "max_ms": max(self.detection_to_send_latencies_ms),
            "p50_ms": self._percentile(self.detection_to_send_latencies_ms, 50),
            "p95_ms": self._percentile(self.detection_to_send_latencies_ms, 95),
        }


class MetricsCollector:
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
        self.quality = QualityMetrics()
        self.pipeline = PipelineMetrics()
        self.start_time: float = time.time()
        self.last_summary_time: float = self.start_time
        self.summary_interval: float = 30.0
        self.result_file: Path = Path("result.json")

    def record_detection(self, passed: int, rejected: int, filter_latency_ms: float):
        self.quality.total_detections += (passed + rejected)
        self.quality.total_passed += passed
        self.quality.total_rejected += rejected
        self.quality.filter_latencies_ms.append(filter_latency_ms)

    def record_payload_size(self, size_kb: float):
        self.pipeline.payload_sizes_kb.append(size_kb)

    def record_aspect_ratio_distortion(self, distortion_pct: float):
        self.pipeline.aspect_ratio_distortions.append(distortion_pct)

    def record_id_switch(self):
        self.pipeline.id_switch_count += 1

    def record_track_change(self):
        self.pipeline.total_track_changes += 1

    def record_input_frame(self):
        self.pipeline.input_frame_count += 1

    def record_processed_frame(self):
        self.pipeline.processed_frame_count += 1

    def record_upload_dispatch(self, latency_ms: float):
        self.pipeline.upload_dispatch_latencies_ms.append(latency_ms)

    def record_upload_complete(self, latency_ms: float):
        self.pipeline.upload_complete_latencies_ms.append(latency_ms)

    def _calculate_fps(self):
        elapsed = time.time() - self.last_summary_time
        if elapsed > 0:
            input_fps = self.pipeline.input_frame_count / elapsed
            output_fps = self.pipeline.processed_frame_count / elapsed
            self.pipeline.input_fps_samples.append(input_fps)
            self.pipeline.output_fps_samples.append(output_fps)

    def log_summary(self, force: bool = False):
        now = time.time()
        if not force and (now - self.last_summary_time) < self.summary_interval:
            return
        self._calculate_fps()
        runtime = now - self.start_time
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
        self._calculate_fps()
        self.log_summary(force=True)
        runtime = time.time() - self.start_time

        dts_stats = self.pipeline.get_detection_to_send_stats()
        avg_dispatch = sum(self.pipeline.upload_dispatch_latencies_ms) / len(self.pipeline.upload_dispatch_latencies_ms) if self.pipeline.upload_dispatch_latencies_ms else 0
        avg_complete = sum(self.pipeline.upload_complete_latencies_ms) / len(self.pipeline.upload_complete_latencies_ms) if self.pipeline.upload_complete_latencies_ms else 0

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

        with open(self.result_file, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)

        logger.info(f"[METRICS] Results saved to {self.result_file}")
        return result


metrics_collector = MetricsCollector()
```
