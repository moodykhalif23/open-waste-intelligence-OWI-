from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="OWI_", env_file=".env")

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


settings = Settings()
