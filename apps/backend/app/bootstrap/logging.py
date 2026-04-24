"""Logging bootstrap utilities."""

from __future__ import annotations

import logging


LOG_FORMAT = "%(asctime)s %(levelname)s [%(name)s] [cid=%(correlation_id)s] %(message)s"


class _CorrelationFilter(logging.Filter):
    """Inject placeholder correlation id for logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "correlation_id"):
            record.correlation_id = "-"
        return True


def configure_logging(level: str = "INFO") -> None:
    """Configure root logging for API and background workers."""
    root_logger = logging.getLogger()
    if root_logger.handlers:
        root_logger.setLevel(level.upper())
        return

    logging.basicConfig(level=level.upper(), format=LOG_FORMAT)
    correlation_filter = _CorrelationFilter()
    for handler in root_logger.handlers:
        handler.addFilter(correlation_filter)
