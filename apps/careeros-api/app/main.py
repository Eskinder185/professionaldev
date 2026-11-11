"""CareerOS home-lab API.

Run:  uvicorn app.main:app --host 127.0.0.1 --port 8000
Needs CAREEROS_DATABASE_URL and CAREEROS_API_TOKEN (see .env.example). The schema is created by
sql/001_init.sql or `alembic upgrade head`, never at startup.
"""

from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, selectinload
from starlette.exceptions import HTTPException as StarletteHTTPException

from .config import Settings, get_settings
from .llm import HttpLlmClient, LlmClient
from .routes_lab import make_lab_router
from .db import make_engine, make_session_factory, session_dependency
from .models import STATUSES, Application, Company
from .schemas import ApplicationDetail, ApplicationOut, HealthOut, Page
from .security import token_dependency

log = logging.getLogger("careeros.api")
if not logging.getLogger("careeros").handlers:  # uvicorn only configures its own loggers
    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(name)s %(message)s"))
    logging.getLogger("careeros").addHandler(_handler)
    logging.getLogger("careeros").setLevel(logging.INFO)

API_PREFIX = "/careeros/v1"
MAX_LIMIT = 100


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


def _like_escape(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def create_app(settings: Settings | None = None, llm: LlmClient | None = None) -> FastAPI:
    settings = settings or get_settings()
    engine = make_engine(settings)
    factory = make_session_factory(engine)
    get_session = session_dependency(factory)
    require_token = token_dependency(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        engine.dispose()  # graceful shutdown: close pooled connections

    app = FastAPI(
        lifespan=lifespan,
        title="CareerOS API",
        version="0.1.0",
        docs_url="/docs" if settings.enable_docs else None,
        redoc_url=None,
        openapi_url="/openapi.json" if settings.enable_docs else None,
    )

    # Exact origins only; no wildcard, no cookies. The token travels in a header.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        allow_credentials=False,
    )

    @app.middleware("http")
    async def access_log(request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        # Method, path and status only: no query string, headers, or bodies.
        log.info("%s %s -> %s (%.0f ms)", request.method, request.url.path, response.status_code, (time.perf_counter() - started) * 1000)
        return response

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, exc: StarletteHTTPException):
        code = {401: "unauthorized", 403: "forbidden", 404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
        response = _error(exc.status_code, code, str(exc.detail))
        if exc.headers:
            response.headers.update(exc.headers)
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        first = exc.errors()[0] if exc.errors() else {}
        where = ".".join(str(part) for part in first.get("loc", []) if part != "query")
        return _error(422, "validation_error", f"Invalid {where or 'request'}: {first.get('msg', 'bad value')}.")

    @app.exception_handler(Exception)
    async def unexpected(_: Request, exc: Exception):
        log.exception("Unhandled error")  # the traceback stays in the server log, never in the response
        return _error(500, "internal_error", "Something went wrong on the server.")

    # --- public ---

    @app.get(f"{API_PREFIX}/health", response_model=HealthOut)
    def health(session: Session = Depends(get_session)):
        try:
            session.execute(text("SELECT 1"))
        except Exception:
            # Say that it failed, never why: connection errors can contain the connection string.
            return JSONResponse(status_code=503, content={"status": "degraded", "database": "unavailable"})
        return HealthOut(status="ok", database="ok")

    # --- private ---

    @app.get(f"{API_PREFIX}/applications", response_model=Page[ApplicationOut], dependencies=[Depends(require_token)])
    def list_applications(
        session: Session = Depends(get_session),
        status: str | None = Query(default=None, description="One tracker status, e.g. Applied"),
        company: str | None = Query(default=None, max_length=200, description="Part of the company name"),
        updated_since: datetime | None = Query(default=None),
        limit: int = Query(default=25, ge=1, le=MAX_LIMIT),
        offset: int = Query(default=0, ge=0, le=1_000_000),
    ):
        if status is not None and status not in STATUSES:
            raise HTTPException(status_code=422, detail=f"status must be one of: {', '.join(STATUSES)}.")
        filters = []
        if status:
            filters.append(Application.status == status)
        if company:
            filters.append(Company.normalized_name.like(f"%{_like_escape(company.strip().lower())}%", escape="\\"))
        if updated_since:
            filters.append(Application.last_activity_at >= updated_since)

        base = select(Application).join(Company, Company.id == Application.company_id).where(*filters)
        total = session.scalar(select(func.count()).select_from(base.subquery())) or 0
        rows = session.scalars(
            base.order_by(Application.last_activity_at.desc(), Application.id.desc()).limit(limit).offset(offset)
        ).unique().all()
        return Page[ApplicationOut](items=[ApplicationOut.model_validate(r) for r in rows], total=total, limit=limit, offset=offset)

    @app.get(f"{API_PREFIX}/applications/{{application_id}}", response_model=ApplicationDetail, dependencies=[Depends(require_token)])
    def get_application(application_id: int, session: Session = Depends(get_session)):
        row = session.scalars(
            select(Application).where(Application.id == application_id).options(selectinload(Application.events))
        ).unique().one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Application not found.")
        return ApplicationDetail.model_validate(row)

    app.include_router(make_lab_router(settings, get_session, require_token, llm or HttpLlmClient(settings)))
    return app


app = create_app()
