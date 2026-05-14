from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def bootstrap_env(default_env_file: Path) -> Path:
    parser = argparse.ArgumentParser(add_help=False)
    parser.add_argument(
        "--env-file",
        default=os.environ.get("BENCH_ENV_FILE", str(default_env_file)),
    )
    args, _ = parser.parse_known_args()

    env_file = Path(args.env_file)
    explicit = (
        "BENCH_ENV_FILE" in os.environ
        or any(arg == "--env-file" or arg.startswith("--env-file=") for arg in sys.argv[1:])
    )
    if env_file.exists():
        load_env_file(env_file)
    elif explicit:
        raise SystemExit(f"Benchmark env file not found: {env_file}")
    return env_file


def load_env_file(path: Path) -> None:
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip("'\"")
        if key:
            os.environ.setdefault(key, value)


def env_bool(name: str, default: bool = False) -> bool:
    value = os.environ.get(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def env_int(name: str, default: int) -> int:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return int(value)


def env_float(name: str, default: float) -> float:
    value = os.environ.get(name)
    if value is None or value.strip() == "":
        return default
    return float(value)


def env_list(name: str) -> list[str]:
    value = os.environ.get(name)
    if not value:
        return []
    return [item.strip() for item in value.split(",") if item.strip()]
