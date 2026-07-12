import hmac
import uuid

from fastapi import Header, HTTPException

from owi_api.config import settings

# Single pilot tenant until org onboarding exists; replaced by JWT org claims.
PILOT_ORG_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")


def require_device_token(authorization: str = Header(default="")) -> uuid.UUID:
    token = authorization.removeprefix("Bearer ").strip()
    if not hmac.compare_digest(token, settings.device_token):
        raise HTTPException(status_code=401, detail="invalid device token")
    return PILOT_ORG_ID
