from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Sample Docker container, GPU, and optional host process resource usage."
    )
    parser.add_argument("--duration-sec", type=float, default=60.0)
    parser.add_argument("--interval-sec", type=float, default=1.0)
    parser.add_argument("--output", required=True, help="JSONL samples output path.")
    parser.add_argument(
        "--process-name",
        action="append",
        default=[],
        help="Optional process name to sample via psutil when installed. Can be repeated.",
    )
    return parser.parse_args()


def parse_size_to_mb(value: str) -> float | None:
    text = value.strip().replace("iB", "B")
    units = [
        ("KiB", 1 / 1024),
        ("KB", 1 / 1024),
        ("MiB", 1),
        ("MB", 1),
        ("GiB", 1024),
        ("GB", 1024),
    ]
    for suffix, multiplier in units:
        if text.endswith(suffix):
            try:
                return float(text[: -len(suffix)].strip()) * multiplier
            except ValueError:
                return None
    return None


def sample_docker() -> list[dict[str, Any]]:
    if not shutil.which("docker"):
        return []

    command = ["docker", "stats", "--no-stream", "--format", "{{json .}}"]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=10, check=False)
    except Exception:
        return []

    containers: list[dict[str, Any]] = []
    for line in completed.stdout.splitlines():
        if not line.strip():
            continue
        try:
            raw = json.loads(line)
        except json.JSONDecodeError:
            continue

        mem_usage = raw.get("MemUsage", "")
        used_text = mem_usage.split("/")[0].strip() if "/" in mem_usage else mem_usage
        containers.append(
            {
                "name": raw.get("Name") or raw.get("Container"),
                "container": raw.get("Container"),
                "cpu_percent": raw.get("CPUPerc"),
                "mem_usage": mem_usage,
                "mem_used_mb": parse_size_to_mb(used_text),
                "mem_percent": raw.get("MemPerc"),
                "net_io": raw.get("NetIO"),
                "block_io": raw.get("BlockIO"),
                "pids": raw.get("PIDs"),
            }
        )
    return containers


def sample_gpu() -> list[dict[str, Any]]:
    if not shutil.which("nvidia-smi"):
        return []

    query = (
        "timestamp,name,utilization.gpu,utilization.memory,memory.used,"
        "memory.total,power.draw,temperature.gpu"
    )
    command = [
        "nvidia-smi",
        f"--query-gpu={query}",
        "--format=csv,noheader,nounits",
    ]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=10, check=False)
    except Exception:
        return []

    gpus: list[dict[str, Any]] = []
    for line in completed.stdout.splitlines():
        parts = [part.strip() for part in line.split(",")]
        if len(parts) < 8:
            continue
        gpus.append(
            {
                "timestamp": parts[0],
                "name": parts[1],
                "gpu_util_percent": to_float(parts[2]),
                "mem_util_percent": to_float(parts[3]),
                "memory_used_mb": to_float(parts[4]),
                "memory_total_mb": to_float(parts[5]),
                "power_w": to_float(parts[6]),
                "temperature_c": to_float(parts[7]),
            }
        )
    return gpus


def sample_processes(process_names: list[str]) -> list[dict[str, Any]]:
    if not process_names:
        return []
    try:
        import psutil  # type: ignore[import-not-found]  # noqa: PLC0415
    except Exception:
        return []

    wanted = {name.lower() for name in process_names}
    samples: list[dict[str, Any]] = []
    for proc in psutil.process_iter(["pid", "name", "memory_info", "cpu_percent"]):
        try:
            name = (proc.info.get("name") or "").lower()
            if name not in wanted:
                continue
            memory_info = proc.info.get("memory_info")
            samples.append(
                {
                    "pid": proc.info["pid"],
                    "name": proc.info["name"],
                    "cpu_percent": proc.info.get("cpu_percent"),
                    "rss_mb": memory_info.rss / (1024 * 1024) if memory_info else None,
                }
            )
        except Exception:
            continue
    return samples


def to_float(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def main() -> None:
    args = parse_args()
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    end_at = time.perf_counter() + args.duration_sec
    with output_path.open("w", encoding="utf-8") as output:
        while time.perf_counter() < end_at:
            sample = {
                "sampled_at": datetime.now(timezone.utc).isoformat(),
                "docker": sample_docker(),
                "gpu": sample_gpu(),
                "processes": sample_processes(args.process_name),
            }
            output.write(json.dumps(sample, ensure_ascii=False) + "\n")
            output.flush()
            time.sleep(args.interval_sec)


if __name__ == "__main__":
    main()
