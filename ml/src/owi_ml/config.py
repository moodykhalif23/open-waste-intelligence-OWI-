from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # No prefix: reads both LABEL_STUDIO_* and OWI_* names from the repo-root .env.
    model_config = SettingsConfigDict(env_file=(".env", "../.env"), extra="ignore")

    label_studio_url: str = "http://localhost:8080"
    label_studio_user_token: str = ""

    owi_s3_access_key: str = ""
    owi_s3_secret_key: str = ""
    owi_s3_bucket: str = "owi-images"
    # As seen from the Label Studio container, not from the host.
    owi_s3_internal_endpoint: str = "http://minio:9000"


settings = Settings()
