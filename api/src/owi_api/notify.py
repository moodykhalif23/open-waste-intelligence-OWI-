"""Outbound messages: Africa's Talking SMS or WhatsApp Cloud, console when unconfigured.

Console fallback means every deployment can exercise the notification path
end-to-end before buying provider credits.
"""

import logging

import httpx

from owi_api.config import settings

logger = logging.getLogger(__name__)

Outcome = tuple[str, str, str | None]  # (status, provider, error)


def send_sms(recipient: str, body: str) -> Outcome:
    if not (settings.at_username and settings.at_api_key):
        logger.info("notification (console) to=%s: %s", recipient, body)
        return "logged", "console", None
    try:
        data = {"username": settings.at_username, "to": recipient, "message": body}
        if settings.at_sender_id:
            data["from"] = settings.at_sender_id
        response = httpx.post(
            "https://api.africastalking.com/version1/messaging",
            headers={"apiKey": settings.at_api_key, "Accept": "application/json"},
            data=data,
            timeout=15,
        )
        ok = response.status_code in (200, 201)
        return ("sent" if ok else "failed", "africastalking", None if ok else response.text[:300])
    except httpx.HTTPError as exc:
        return "failed", "africastalking", str(exc)[:300]


def send_whatsapp(recipient: str, body: str) -> Outcome:
    if not (settings.wa_token and settings.wa_phone_number_id):
        logger.info("notification (console) to=%s: %s", recipient, body)
        return "logged", "console", None
    try:
        response = httpx.post(
            f"https://graph.facebook.com/v20.0/{settings.wa_phone_number_id}/messages",
            headers={"Authorization": f"Bearer {settings.wa_token}"},
            json={
                "messaging_product": "whatsapp",
                "to": recipient.lstrip("+"),
                "type": "text",
                "text": {"body": body},
            },
            timeout=15,
        )
        ok = response.status_code == 200
        return ("sent" if ok else "failed", "whatsapp", None if ok else response.text[:300])
    except httpx.HTTPError as exc:
        return "failed", "whatsapp", str(exc)[:300]


def send(channel: str, recipient: str, body: str) -> Outcome:
    return send_whatsapp(recipient, body) if channel == "whatsapp" else send_sms(recipient, body)
