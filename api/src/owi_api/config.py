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

    # Stopgap shared secret until the JWT auth slice lands.
    device_token: str = "dev-only-token"

    max_upload_bytes: int = 2 * 1024 * 1024


settings = Settings()
