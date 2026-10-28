"""Recurring maintenance loop: python -m owi_api.scheduler"""

import logging
import time
from collections.abc import Callable

from owi_api.analytics.cleanliness_refresh import refresh_cleanliness
from owi_api.analytics.refresh import refresh_bin_health
from owi_api.config import settings
from owi_api.db import SessionLocal
from owi_api.digest import maybe_send_daily_digest
from owi_api.ingestion.storage import get_store
from owi_api.maintenance import purge_expired_images, purge_expired_quarantine

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 3600


QUARANTINE_CUTOFF_HOURS = settings.quarantine_retention_hours - INTERVAL_SECONDS // 3600


def run_once() -> None:
    with SessionLocal() as session:
        store = get_store(settings)
        jobs: list[tuple[str, str, Callable[[], int]]] = [
            (
                "quarantine purge",
                "originals deleted",
                lambda: purge_expired_quarantine(session, store, QUARANTINE_CUTOFF_HOURS),
            ),
            (
                "image retention",
                "expired images deleted",
                lambda: purge_expired_images(session, store),
            ),
            ("bin health refresh", "bins scored", lambda: refresh_bin_health(session)),
            ("cleanliness refresh", "areas scored", lambda: refresh_cleanliness(session)),
            ("overflow digest", "messages", lambda: maybe_send_daily_digest(session)),
        ]
        for name, unit, job in jobs:
            try:
                logger.info("%s: %d %s", name, job(), unit)
            except Exception:
                session.rollback()
                logger.exception("%s failed", name)


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
