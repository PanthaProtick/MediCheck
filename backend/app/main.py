from collections.abc import AsyncGenerator, Callable
from contextlib import asynccontextmanager
from datetime import datetime
import json
import logging
import sqlite3
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.engine import Engine
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import router as api_router
from app.api.routes_v2 import router as api_router_v2
from app.core.auth import SessionVerifier
from app.core.config import Settings, settings as default_settings
from app.core.database import initialize_database, create_pg_engine, check_pg_readiness
from app.core.errors import AppError
from app.services.enquiries import utc_now

logger = logging.getLogger(__name__)


def create_app(
    settings: Settings | None = None,
    clock: Callable[[], datetime] | None = None,
    engine: Engine | None = None,
    session_verifier: SessionVerifier | None = None,
) -> FastAPI:
    active_settings = settings or default_settings
    active_clock = clock or utc_now

    dist_dir = (
        Path(active_settings.STATIC_DIR)
        if active_settings.STATIC_DIR
        else Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
    ).resolve()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
        testing = active_settings.ENV == "test" and engine is not None and session_verifier is not None
        if active_settings.APP_MODE == "hosted":
            if not testing:
                active_settings.validate_hosted()
                if session_verifier is not None or engine is not None:
                    raise RuntimeError("Hosted runtime does not allow injected test dependencies.")
                manifest = dist_dir / "deployment.json"
                if not manifest.exists() or json.loads(manifest.read_text()) != {"schema_version": 1, "runtime_config": True}:
                    raise RuntimeError("Build the runtime-config frontend before hosted startup.")
                if not (dist_dir / "index.html").exists():
                    raise RuntimeError("Hosted frontend assets are missing.")
                app.state.engine = create_pg_engine(
                    active_settings.get_sync_database_url(),
                    active_settings.DB_POOL_SIZE, active_settings.DB_MAX_OVERFLOW,
                    active_settings.DB_POOL_TIMEOUT,
                )
            try:
                check_pg_readiness(app.state.engine)
            except Exception:
                app.state.engine.dispose()
                raise
        else:
            active_settings.validate_hosted()
            if not active_settings.DEMO_STAFF_TOKEN.strip():
                raise RuntimeError("DEMO_STAFF_TOKEN must be configured in the backend environment.")
            if not Path(active_settings.DEMO_DATABASE_PATH).is_absolute():
                raise RuntimeError("DEMO_DATABASE_PATH must be an absolute path.")
            initialize_database(active_settings.DEMO_DATABASE_PATH)
            if active_settings.ENV == "demo" and not (dist_dir / "index.html").exists():
                raise RuntimeError("Demo mode requires built frontend assets. Run npm run build.")
        try:
            yield
        finally:
            if hasattr(app.state, "engine") and app.state.engine is not None:
                try:
                    app.state.engine.dispose()
                except Exception:
                    pass

    app = FastAPI(
        title=active_settings.PROJECT_NAME,
        version="2.0.0",
        docs_url=None if active_settings.ENV == "production" else "/docs",
        openapi_url=None if active_settings.ENV == "production" else "/openapi.json",
        redoc_url=None,
        lifespan=lifespan,
    )

    app.state.settings = active_settings
    app.state.clock = active_clock
    if engine is not None:
        app.state.engine = engine
    if session_verifier is not None:
        app.state.session_verifier = session_verifier

    from app.core.rate_limit import InMemoryRateLimiter

    rate_limiter = InMemoryRateLimiter(
        max_requests_per_min=active_settings.RATE_LIMIT_MAX_REQUESTS,
        max_mutations_per_min=active_settings.RATE_LIMIT_MAX_MUTATIONS,
    )
    app.state.rate_limiter = rate_limiter

    # Middleware for media type check, body size bounds, rate limiting, and Cache-Control
    @app.middleware("http")
    async def api_middleware(request: Request, call_next):
        is_api = request.url.path.startswith("/api/v1") or request.url.path.startswith("/api/v2") or request.url.path.startswith("/api/")

        if is_api:
            # 1. Body ceiling check (16KiB)
            cl = request.headers.get("content-length")
            if cl:
                try:
                    if int(cl) > active_settings.MAX_REQUEST_BODY_BYTES:
                        return JSONResponse(
                            status_code=413,
                            content={
                                "error": {
                                    "code": "validation_error",
                                    "message": f"Request body exceeds maximum allowed size of {active_settings.MAX_REQUEST_BODY_BYTES} bytes.",
                                    "fields": ["body"],
                                }
                            },
                            headers={"Cache-Control": "no-store"},
                        )
                except ValueError:
                    pass

            if request.method in ("PUT", "POST", "PATCH"):
                parts = []
                size = 0
                async for chunk in request.stream():
                    size += len(chunk)
                    if size > active_settings.MAX_REQUEST_BODY_BYTES:
                        return JSONResponse(status_code=413, content={"error": {
                            "code": "validation_error", "message": "Request body exceeds maximum allowed size.",
                            "fields": ["body"]}}, headers={"Cache-Control": "no-store"})
                    parts.append(chunk)
                request._body = b"".join(parts)

            # 2. Rate limiting check
            if active_settings.RATE_LIMIT_ENABLED:
                # Unverified bearer strings must never create new limit identities.
                client_key = f"ip:{request.client.host if request.client else 'unknown'}"

                is_mutation = request.method in ("PUT", "POST", "DELETE", "PATCH")
                limit_res = rate_limiter.check_and_record(client_key, is_mutation=is_mutation)
                if not limit_res.allowed:
                    return JSONResponse(
                        status_code=429,
                        content={
                            "error": {
                                "code": "rate_limited" if active_settings.APP_MODE == "hosted" else "rate_limit_exceeded",
                                "message": f"Rate limit exceeded. Try again in {limit_res.retry_after} seconds.",
                                "fields": [],
                            }
                        },
                        headers={
                            "Retry-After": str(limit_res.retry_after),
                            "Cache-Control": "no-store",
                        },
                    )

            # 3. Media type check for mutations
            if request.method in ("PUT", "POST"):
                ct = request.headers.get("content-type", "")
                media_type = ct.split(";")[0].strip().lower()
                if media_type != "application/json":
                    return JSONResponse(
                        status_code=415,
                        content={
                            "error": {
                                "code": "unsupported_media_type",
                                "message": "Content-Type must be application/json.",
                                "fields": ["body"],
                            }
                        },
                        headers={"Cache-Control": "no-store"},
                    )

        response = await call_next(request)
        if is_api:
            response.headers["Cache-Control"] = "no-store"
        return response

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=active_settings.CORS_ORIGINS if isinstance(active_settings.CORS_ORIGINS, list) else [],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Error Handlers
    @app.exception_handler(AppError)
    def app_error_handler(request: Request, exc: AppError):
        headers = {"Cache-Control": "no-store"}
        if exc.status_code == 401:
            headers["WWW-Authenticate"] = "Bearer"
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.to_response_dict(),
            headers=headers,
        )

    @app.exception_handler(RequestValidationError)
    def validation_error_handler(request: Request, exc: RequestValidationError):
        fields: list[str] = []
        for err in exc.errors():
            loc = err.get("loc", ())
            if loc:
                field_name = str(loc[-1])
                if field_name not in ("body", "__root__") and field_name not in fields:
                    fields.append(field_name)
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "validation_error",
                    "message": "Invalid request parameters.",
                    "fields": fields,
                }
            },
            headers={"Cache-Control": "no-store"},
        )

    @app.exception_handler(StarletteHTTPException)
    def starlette_http_error_handler(request: Request, exc: StarletteHTTPException):
        if request.url.path.startswith("/api/v1") or request.url.path.startswith("/api"):
            code_map = {
                404: "not_found",
                405: "method_not_allowed",
                401: "unauthorized",
                403: "forbidden",
                415: "unsupported_media_type",
                422: "validation_error",
                500: "internal_error",
                503: "storage_unavailable",
            }
            code = code_map.get(exc.status_code, "internal_error")
            fields: list[str] = []
            if exc.status_code == 405:
                fields = ["method"]
            elif exc.status_code == 404:
                fields = ["id"]
            elif exc.status_code == 415:
                fields = ["body"]

            headers = {"Cache-Control": "no-store"}
            if exc.headers:
                headers.update(exc.headers)
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": {
                        "code": code,
                        "message": str(exc.detail or "HTTP error."),
                        "fields": fields,
                    }
                },
                headers=headers,
            )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
        )

    @app.exception_handler(sqlite3.DatabaseError)
    def storage_error_handler(request: Request, exc: sqlite3.DatabaseError):
        return JSONResponse(status_code=503, content={"error": {
            "code": "storage_unavailable", "message": "Storage is unavailable.", "fields": []
        }}, headers={"Cache-Control": "no-store"})

    @app.exception_handler(Exception)
    def internal_error_handler(request: Request, exc: Exception):
        if "SQLAlchemyError" in type(exc).__name__:
            return JSONResponse(status_code=503, content={"error": {
                "code": "storage_unavailable", "message": "Storage is unavailable.", "fields": []
            }}, headers={"Cache-Control": "no-store"})
        return JSONResponse(status_code=500, content={"error": {
            "code": "internal_error", "message": "Unable to process stored evidence.", "fields": []
        }}, headers={"Cache-Control": "no-store"})

    # Register API routers
    @app.get("/api/config")
    def public_config():
        return JSONResponse({
            "mode": active_settings.APP_MODE,
            "clerk_publishable_key": active_settings.CLERK_PUBLISHABLE_KEY if active_settings.APP_MODE == "hosted" else None,
            "simulated": True,
        }, headers={"Cache-Control": "no-store"})

    if active_settings.APP_MODE == "hosted":
        app.include_router(api_router_v2, prefix="/api/v2")
    else:
        app.include_router(api_router, prefix="/api/v1")
        app.include_router(api_router_v2, prefix="/api/v2")

    # Serve static assets if built
    if dist_dir.exists() and (dist_dir / "index.html").exists():
        assets_dir = dist_dir / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        @app.get("/", include_in_schema=False)
        def serve_root():
            return FileResponse(str(dist_dir / "index.html"))

        @app.get("/{full_path:path}", include_in_schema=False)
        def serve_spa(full_path: str):
            if full_path.startswith("api/") or full_path == "api":
                return JSONResponse(
                    status_code=404,
                    content={
                        "error": {
                            "code": "not_found",
                            "message": "API endpoint not found.",
                            "fields": ["id"],
                        }
                    },
                    headers={"Cache-Control": "no-store"},
                )
            target = (dist_dir / full_path).resolve()
            if not target.is_relative_to(dist_dir):
                raise StarletteHTTPException(status_code=404, detail="File not found.")
            if target.is_file():
                return FileResponse(str(target))
            return FileResponse(str(dist_dir / "index.html"))

    return app


app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=False)
