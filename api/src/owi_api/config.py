from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict

_DEV_DEFAULTS = {
    "jwt_secret": "dev-only-secret-change-me-before-deploying",
    "s3_secret_key": "owi-secret-change-me",
    "database_url": "postgresql+psycopg://owi:owi@localhost:5432/owi",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OWI_", env_file=".env")

    environment: Literal["dev", "production"] = "dev"
    cors_origins: list[str] = []
    database_url: str = "postgresql+psycopg://owi:owi@localhost:5432/owi"
    redis_url: str = "redis://localhost:6379/0"

    storage_driver: Literal["local", "s3"] = "local"
    storage_root: Path = Path("var/objects")
    s3_endpoint: str = "localhost:9000"
    s3_access_key: str = "owi"
    s3_secret_key: str = "owi-secret-change-me"
    s3_bucket: str = "owi-images"
    s3_secure: bool = False

    # HS256 requires ≥32 bytes; deployments must override via OWI_JWT_SECRET.
    jwt_secret: str = "dev-only-secret-change-me-before-deploying"
    access_token_ttl_hours: int = 12
    # Collector phones stay signed in for months; revocation is per-user via token_version.
    device_token_ttl_days: int = 180

    max_upload_bytes: int = 2 * 1024 * 1024

    def assert_production_safe(self) -> None:
        """Refusing to boot beats silently running a public API on dev credentials."""
        if self.environment != "production":
            return
        leaked = [name for name, value in _DEV_DEFAULTS.items() if getattr(self, name) == value]
        if leaked:
            raise RuntimeError(f"production run with dev-default secrets: {', '.join(leaked)}")


settings = Settings()
