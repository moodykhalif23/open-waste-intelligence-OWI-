import pytest

from owi_api.config import Settings


def make(**overrides: object) -> Settings:
    # _env_file=None: tests must not pick up the developer's real .env.
    return Settings(_env_file=None, **overrides)  # type: ignore[arg-type]


def test_production_refuses_dev_secrets() -> None:
    with pytest.raises(RuntimeError, match="jwt_secret"):
        make(environment="production").assert_production_safe()


def test_production_boots_with_real_secrets() -> None:
    make(
        environment="production",
        jwt_secret="x" * 48,
        s3_secret_key="a-real-secret-value",
        database_url="postgresql+psycopg://owi:real-password@db:5432/owi",
    ).assert_production_safe()


def test_dev_allows_defaults() -> None:
    make().assert_production_safe()
