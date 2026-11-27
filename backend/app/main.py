import logging
from contextlib import asynccontextmanager
from pathlib import Path

import structlog
from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import get_settings
from app.errors import install_error_handlers
from app.routers import admin, auth, bookings, events, organizer_bookings, organizer_events, organizers, uploads


def configure_logging() -> None:
    s = get_settings()
    logging.basicConfig(level=s.log_level, format="%(message)s")
    structlog.configure(
        processors=[
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer() if s.environment == "production" else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(logging.getLevelName(s.log_level)),
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_settings().validate_production()
    configure_logging()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="ZOURE API",
        version="1.0.0",
        description="Events discovery, hosting, booking and check-in for Nepal.",
        lifespan=lifespan,
        docs_url="/docs",
        openapi_url="/openapi.json",
    )
    # CORS is locked to the frontend origin only.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[s.frontend_url],
        allow_credentials=False,  # tokens travel in the Authorization header
        allow_methods=["GET", "POST", "PATCH", "DELETE"],
        allow_headers=["Authorization", "Content-Type", "Idempotency-Key"],
        max_age=600,
    )
    install_error_handlers(app)

    api = APIRouter(prefix="/api/v1")
    api.include_router(auth.router)
    # organizers must come before events: /organizers/me has to win over /organizers/{slug}
    api.include_router(organizers.router)
    api.include_router(organizer_events.router)
    api.include_router(organizer_bookings.router)
    api.include_router(bookings.router)
    api.include_router(uploads.router)
    api.include_router(admin.router)
    api.include_router(events.router)
    app.include_router(api)

    if s.storage_backend == "local":
        public_dir = Path(s.local_upload_dir) / "public"
        public_dir.mkdir(parents=True, exist_ok=True)
        app.mount("/uploads/public", StaticFiles(directory=public_dir), name="uploads")  # private/ is never mounted

    @app.get("/healthz", include_in_schema=False)
    async def healthz():
        return {"status": "ok"}

    return app


app = create_app()
