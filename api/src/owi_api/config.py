from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

# The stand-in shipped in example.env. Boots a fresh clone, refused in
# production — a copied template must never become a live deployment.
_PLACEHOLDER = "replace-me"
_MUST_BE_REAL = ("database_url", "jwt_secret", "s3_secret_key", "admin_password")


class Settings(BaseSettings):
    # Every credential is read from the repo-root .env in *every* environment —
    # none carry a working default, so a dev value cannot reach production by
    # accident. `cp example.env .env` documents the full set.
    model_config = SettingsConfigDict(
        env_prefix="OWI_", env_file=(".env", "../.env"), extra="ignore"
    )

    environment: Literal["dev", "production"] = "dev"
    cors_origins: list[str] = []
    database_url: str
    redis_url: str = "redis://localhost:6379/0"

    storage_driver: Literal["local", "s3"] = "local"
    storage_root: Path = Path("var/objects")
    s3_endpoint: str = "localhost:9000"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "owi-images"
    s3_secure: bool = False

    # The dashboard admin login lives in .env so it can be read and rotated in
    # one place. Only its argon2 hash is ever written to the database; unset
    # values mean "leave whatever is already there alone".
    admin_phone: str = ""
    admin_password: str = ""
    admin_name: str = "Admin"
    org_name: str = ""

    # HS256 requires ≥32 bytes; set OWI_JWT_SECRET in .env.
    jwt_secret: str
    access_token_ttl_hours: int = 12
    # Collector phones stay signed in for months; revocation is per-user via token_version.
    device_token_ttl_days: int = 180

    max_upload_bytes: int = 2 * 1024 * 1024
    # Governance: pre-blur originals must not outlive blur verification (≤72h).
    quarantine_retention_hours: int = 72
    person_model_path: Path = Path("var/models/yolox_tiny.onnx")

    # Empty = straight-line (haversine) distances; set to a self-hosted OSRM base
    # URL (e.g. http://osrm:5000) for road distances once an OSM extract is loaded.
    osrm_url: str = ""
    route_time_limit_s: int = 5
    # Loose municipal waste ~0.1 kg/L; turns fill-band x bin volume into a demand estimate.
    waste_density_kg_per_l: float = 0.1
    # Set to the org's diesel price to show KES saved in the savings report; 0 hides it.
    fuel_price_kes_per_l: float = 0.0

    # Open Data API: public aggregates lag reality (governance hard line) and are keyed + throttled.
    public_api_delay_days: int = 7
    public_api_rate_per_min: int = 60

    # Notifications: unset credentials fall back to a console/log provider, so the
    # path stays exercisable without an account. Secrets live in .env only.
    notify_channel: Literal["sms", "whatsapp"] = "sms"
    at_username: str = ""
    at_api_key: str = ""
    at_sender_id: str = ""
    wa_token: str = ""
    wa_phone_number_id: str = ""

    def assert_configured(self) -> None:
        """Refusing to boot beats silently running a public API on template values."""
        if self.storage_driver == "s3" and not (self.s3_access_key and self.s3_secret_key):
            raise RuntimeError("storage_driver=s3 needs OWI_S3_ACCESS_KEY and OWI_S3_SECRET_KEY")
        if self.environment != "production":
            return
        if len(self.jwt_secret) < 32:
            raise RuntimeError("OWI_JWT_SECRET must be at least 32 characters in production")
        unset = [name for name in _MUST_BE_REAL if _PLACEHOLDER in getattr(self, name)]
        if unset:
            raise RuntimeError(f"production run with example.env values: {', '.join(unset)}")


# The required fields come from .env at runtime, which mypy cannot see.
settings = Settings()  # type: ignore[call-arg]
