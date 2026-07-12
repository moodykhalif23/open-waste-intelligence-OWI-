FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# UV_NO_SYNC: the image is immutable — uv run must never install at runtime.
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_NO_SYNC=1
WORKDIR /app

# Dependency layer caches independently of source changes.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

# Model weights are part of the image (the privacy gate must never depend on a
# runtime download) — fetched before source so code edits don't re-download.
COPY scripts scripts
RUN python3 scripts/fetch_models.py

COPY src src
COPY alembic alembic
COPY alembic.ini ./
RUN uv sync --frozen --no-dev

RUN useradd --create-home owi && chown -R owi /app
USER owi

EXPOSE 8000
CMD ["uv", "run", "uvicorn", "owi_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
