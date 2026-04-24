"""CLI entrypoint for recognizer comparison."""

from __future__ import annotations

from ..core.config import Settings
from .evaluator import RecognizerBenchmark


def main() -> None:
    settings = Settings()
    benchmark = RecognizerBenchmark(settings.benchmark)
    report_path = benchmark.run()
    print(report_path)


if __name__ == "__main__":
    main()
