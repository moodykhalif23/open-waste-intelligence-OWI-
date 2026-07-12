from fastapi import FastAPI

from owi_api.routers import observations


def create_app() -> FastAPI:
    app = FastAPI(title="OpenWaste Intelligence API", version="0.1.0")
    app.include_router(observations.router)

    @app.get("/healthz")
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
