"""Overflow digest: the day's collect-today bins, pushed to the org's alert phones."""

import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from owi_api.config import settings
from owi_api.models.notification import Notification
from owi_api.models.operations import BinHealthDaily
from owi_api.models.org_settings import OrgSettings
from owi_api.models.registry import Bin, Site
from owi_api.notify import send

DIGEST_KIND = "overflow_digest"


def build_digest(rows: list[tuple[str, str, float]], total: int) -> str:
    head = f"OWI: {total} bin(s) need collection today."
    lines = [f"- {site} {qr} {round(fill)}%" for site, qr, fill in rows[:5]]
    if total > 5:
        lines.append(f"...and {total - 5} more")
    return "\n".join([head, *lines])


def _due_bins(session: Session, org_id: uuid.UUID) -> list[tuple[str, str, float]]:
    rows = session.execute(
        select(Site.name, Bin.qr_code, BinHealthDaily.fill_pct)
        .join(Bin, Bin.id == BinHealthDaily.bin_id)
        .join(Site, Site.id == Bin.site_id)
        .where(
            BinHealthDaily.org_id == org_id,
            BinHealthDaily.recommendation == "collect_today",
        )
        .order_by(BinHealthDaily.bin_id, BinHealthDaily.date.desc())
        .distinct(BinHealthDaily.bin_id)
    ).all()
    return sorted([(site, qr, fill) for site, qr, fill in rows], key=lambda r: r[2], reverse=True)


def _sent_today(session: Session, org_id: uuid.UUID) -> bool:
    start = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        session.scalar(
            select(func.count(Notification.id)).where(
                Notification.org_id == org_id,
                Notification.kind == DIGEST_KIND,
                Notification.created_at >= start,
            )
        )
        or 0
    ) > 0


def send_overflow_digest(session: Session, only_if_unsent_today: bool = True) -> int:
    """Returns messages dispatched. The scheduler dedupes per day; a manual
    admin trigger sends unconditionally."""
    messages = 0
    for org_row in session.execute(
        select(OrgSettings.org_id, OrgSettings.notify_phones).where(
            OrgSettings.notify_phones.is_not(None)
        )
    ):
        org_id, phones = org_row
        if not phones:
            continue
        if only_if_unsent_today and _sent_today(session, org_id):
            continue
        due = _due_bins(session, org_id)
        if not due:
            continue
        body = build_digest(due, len(due))
        for phone in phones:
            status, provider, error = send(settings.notify_channel, phone, body)
            session.add(
                Notification(
                    org_id=org_id,
                    kind=DIGEST_KIND,
                    channel=settings.notify_channel,
                    recipient=phone,
                    body=body,
                    status=status,
                    provider=provider,
                    error=error,
                )
            )
            messages += 1
    session.commit()
    return messages


def digest_window_open(now: datetime | None = None) -> bool:
    """Scheduler runs hourly; only the morning tick sends the digest."""
    hour = (now or datetime.now(UTC)).astimezone().hour
    return 6 <= hour <= 8


def maybe_send_daily_digest(session: Session) -> int:
    if not digest_window_open():
        return 0
    return send_overflow_digest(session, only_if_unsent_today=True)
