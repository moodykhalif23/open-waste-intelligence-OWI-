from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from owi_api.config import settings
from owi_api.routers import (
    admin,
    analytics,
    auth,
    bins,
    carbon,
    cleanliness,
    dumping,
    models,
    observations,
    operations,
    public,
    recycling,
    review,
    routes,
    sites,
    users,
    volunteers,
)


def create_app() -> FastAPI:
    settings.assert_production_safe()

    app = FastAPI(title="OpenWaste Intelligence API", version="0.1.0")
    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["Authorization", "Content-Type", "X-API-Key"],
        )

    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    app.include_router(auth.router)
    app.include_router(admin.router)
    app.include_router(users.router)
    app.include_router(sites.router)
    app.include_router(operations.router)
    app.include_router(routes.router)
    app.include_router(bins.router)
    app.include_router(observations.router)
    app.include_router(review.router)
    app.include_router(models.router)
    app.include_router(analytics.router)
    app.include_router(recycling.router)
    app.include_router(carbon.router)
    app.include_router(cleanliness.router)
    app.include_router(dumping.router)
    app.include_router(volunteers.router)
    app.include_router(public.router)
    app.include_router(public.keys_router)

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz")
    def readyz(response: Response) -> dict[str, str]:
        """Readiness: healthz says the process runs; this says it can serve."""
        from redis import Redis
        from sqlalchemy import text

        from owi_api.db import SessionLocal
        from owi_api.ingestion.storage import get_store

        checks: dict[str, str] = {}
        try:
            with SessionLocal() as session:
                session.execute(text("SELECT 1"))
            checks["db"] = "ok"
        except Exception:
            checks["db"] = "down"
        try:
            Redis.from_url(settings.redis_url, socket_timeout=3).ping()
            checks["redis"] = "ok"
        except Exception:
            checks["redis"] = "down"
        try:
            checks["storage"] = "ok" if get_store(settings).ready() else "down"
        except Exception:
            checks["storage"] = "down"
        if any(state != "ok" for state in checks.values()):
            response.status_code = 503
        return checks

    return app


app = create_app()
