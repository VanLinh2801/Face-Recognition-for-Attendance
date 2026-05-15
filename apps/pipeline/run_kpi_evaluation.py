#!/usr/bin/env python3
"""
Script chạy KPI Evaluation cho Face Attendance Pipeline.
- Chạy: python run_kpi_evaluation.py
- Dừng: Ctrl+C
- Kết quả: result.json + result_summary.md tự động lưu khi dừng
"""
import asyncio
import signal
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

from app.utils.logger import logger
from app.utils.metrics_collector import metrics_collector
from app.camera.manager import CameraManager
from app.services.pipeline_service import pipeline_service


class KPIEvaluationRunner:
    """Runner quản lý lifecycle của KPI evaluation."""

    def __init__(self):
        self.camera_manager: CameraManager = None
        self._shutdown_event = asyncio.Event()

    async def setup(self):
        """Khởi tạo pipeline."""
        logger.info("[KPI] Initializing Pipeline Service...")
        self.camera_manager = CameraManager(
            process_callback=pipeline_service.handle_realtime_frame
        )
        logger.info("[KPI] Starting camera manager...")
        await self.camera_manager.start_all()
        logger.info("[KPI] Pipeline started. Monitoring metrics...")
        logger.info("[KPI] Press Ctrl+C to stop and save results.")

    async def run(self):
        """Chạy pipeline cho đến khi có signal shutdown."""
        try:
            await self._shutdown_event.wait()
        except asyncio.CancelledError:
            pass

    def save_results(self):
        """Lưu kết quả vào result.json và in bảng tổng kết."""
        logger.info("[KPI] Saving results...")
        result = metrics_collector.save_result()
        self._print_summary(result)

    def _print_summary(self, result: dict):
        """In bảng tổng kết ra console và lưu vào file markdown."""
        runtime = result.get("runtime_formatted", "N/A")
        qf = result.get("quality_filter", {})
        dts = result.get("detection_to_send", {})
        pl = result.get("pipeline", {})
        st = result.get("storage", {})

        print("\n" + "=" * 50)
        print(f"  KPI EVALUATION - Runtime: {runtime}")
        print("=" * 50)
        print(f"  Pass Rate: {qf.get('pass_rate_percent', 0):.1f}%")
        print(f"  Detection-to-Send: {dts.get('avg_latency_ms', 0):.0f}ms avg")
        print(f"  FPS: {pl.get('avg_input_fps', 0):.1f} -> {pl.get('avg_output_fps', 0):.1f}")
        print(f"  Frame Drop: {pl.get('frame_drop_rate_percent', 0):.1f}%")
        print("=" * 50)
        print(f"  result.json: {metrics_collector.result_file}")
        print(f"  result.md:   {metrics_collector.result_file.parent / 'result_summary.md'}")
        print("=" * 50 + "\n")

    async def shutdown(self):
        """Dừng pipeline gracefully."""
        if self.camera_manager:
            await self.camera_manager.stop_all()


async def main():
    runner = KPIEvaluationRunner()

    # Setup signal handlers
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
