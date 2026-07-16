"""Recurring maintenance loop: python -m owi_api.scheduler"""

import logging
import time

from owi_api.analytics.cleanliness_refresh import refresh_cleanliness
from owi_api.analytics.refresh import refresh_bin_health
from owi_api.config import settings
from owi_api.db import SessionLocal
from owi_api.digest import maybe_send_daily_digest
from owi_api.ingestion.storage import get_store
from owi_api.maintenance import purge_expired_images, purge_expired_quarantine

logger = logging.getLogger(__name__)

INTERVAL_SECONDS = 3600


def run_once() -> None:
    with SessionLocal() as session:
        store = get_store(settings)
        purged = purge_expired_quarantine(session, store, settings.quarantine_retention_hours)
        retired = purge_expired_images(session, store)
        refreshed = refresh_bin_health(session)
        scored = refresh_cleanliness(session)
        notified = maybe_send_daily_digest(session)
    logger.info("quarantine purge: %d originals deleted", purged)
    logger.info("image retention: %d expired images deleted", retired)
    logger.info("bin health refresh: %d bins scored", refreshed)
    logger.info("cleanliness refresh: %d areas scored", scored)
    logger.info("overflow digest: %d messages", notified)


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
