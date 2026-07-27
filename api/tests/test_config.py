import pytest
from pydantic import ValidationError

from owi_api.config import Settings

REAL = {
    "database_url": "postgresql+psycopg://owi:a-real-password@db:5432/owi",
    "jwt_secret": "x" * 48,
    "s3_secret_key": "a-real-secret-value",
    "s3_access_key": "owi",
}


def make(**overrides: object) -> Settings:
    # _env_file=None: tests must not pick up the developer's real .env.
    return Settings(_env_file=None, **{**REAL, **overrides})  # type: ignore[arg-type]


def test_secrets_have_no_defaults_in_code() -> None:
    with pytest.raises(ValidationError, match="database_url"):
        Settings(_env_file=None, jwt_secret="x" * 48)  # type: ignore[call-arg]
    with pytest.raises(ValidationError, match="jwt_secret"):
        Settings(_env_file=None, database_url=REAL["database_url"])  # type: ignore[call-arg]


def test_production_refuses_template_values() -> None:
    with pytest.raises(RuntimeError, match="jwt_secret"):
        make(
            environment="production",
            jwt_secret="replace-me-with-a-random-secret-of-32-or-more-characters",
        ).assert_configured()


def test_production_refuses_short_jwt_secret() -> None:
    with pytest.raises(RuntimeError, match="32 characters"):
        make(environment="production", jwt_secret="too-short").assert_configured()


def test_production_boots_with_real_secrets() -> None:
    make(environment="production").assert_configured()


def test_s3_driver_needs_credentials() -> None:
    with pytest.raises(RuntimeError, match="OWI_S3_ACCESS_KEY"):
        make(storage_driver="s3", s3_access_key="", s3_secret_key="").assert_configured()


def test_local_driver_needs_no_s3_credentials() -> None:
    make(storage_driver="local", s3_access_key="", s3_secret_key="").assert_configured()
