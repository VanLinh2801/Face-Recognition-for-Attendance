"""AI service entrypoint."""

from __future__ import annotations

import logging

from .config import Settings
from .service import AIService


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    settings = Settings()
    service = AIService(settings)
    service.bootstrap()
    service.run()


if __name__ == "__main__":
    main()

