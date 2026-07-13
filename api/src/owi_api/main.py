from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from owi_api.config import settings
from owi_api.routers import (
    admin,
    auth,
    bins,
    models,
    observations,
    operations,
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
            allow_headers=["Authorization", "Content-Type"],
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
    app.include_router(volunteers.router)

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
