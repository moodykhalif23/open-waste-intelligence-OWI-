"""Recurring maintenance loop: python -m owi_api.scheduler"""

import logging
import time

from owi_api.config import settings
from owi_api.db import SessionLocal
from owi_api.ingestion.storage import get_store
from owi_api.maintenance import purge_expired_quarantine

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 3600


def run_once() -> None:
    with SessionLocal() as session:
        purged = purge_expired_quarantine(
            session, get_store(settings), settings.quarantine_retention_hours
        )
    logger.info("quarantine purge: %d originals deleted", purged)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    while True:
        try:
            run_once()
        except Exception:
            logger.exception("maintenance run failed")
        time.sleep(INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
