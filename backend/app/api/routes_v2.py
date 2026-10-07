from collections.abc import Callable
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Header, Query, Request, Response, status
from sqlalchemy.engine import Engine

from app.core.auth import (
    ClerkSessionVerifier,
    SessionVerifier,
    extract_bearer_token,
    get_or_create_local_user,
)
from app.core.config import Settings, settings as default_settings
from app.core.database import check_pg_readiness, create_pg_engine
from app.core.errors import AppError
from app.models.schemas_v2 import (
    AuthenticatedPrincipal,
    BootstrapResponseV2,
    CreateEnquiryRequest,
    EnquiryPage,
    EnquiryViewV2,
    HealthResponseV2,
    ObservationRequest,
)
from app.services.enquiries_v2 import (
    accept_observation_v2,
    create_enquiry_v2,
    list_own_enquiries_v2,
    list_pending_v2,
    read_bootstrap_v2,
    read_enquiry_v2,
    utc_now,
)
from app.services.evidence_v2 import build_view_v2

router = APIRouter()


def _get_settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", default_settings)


def _get_clock(request: Request) -> Callable[[], datetime]:
    return getattr(request.app.state, "clock", utc_now)


def _get_engine(request: Request) -> Engine:
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        settings = _get_settings(request)
        sync_url = settings.get_sync_database_url()
        if not sync_url:
            raise AppError(503, "storage_unavailable", "DATABASE_URL is not configured.", [])
        engine = create_pg_engine(sync_url)
        request.app.state.engine = engine
    return engine


def _get_verifier(request: Request) -> SessionVerifier:
    verifier = getattr(request.app.state, "session_verifier", None)
    if verifier is None:
        verifier = ClerkSessionVerifier()
        request.app.state.session_verifier = verifier
    return verifier


def _get_principal(
    request: Request,
    authorization: str | None = Header(None),
) -> AuthenticatedPrincipal:
    token = extract_bearer_token(authorization)
    settings = _get_settings(request)
    verifier = _get_verifier(request)
    identity = verifier.verify_token(token, settings)

    engine = _get_engine(request)
    clock = _get_clock(request)
    with engine.connect() as conn:
        with conn.begin():
            principal = get_or_create_local_user(conn, identity, clock=clock)
    return principal


@router.get("/health", response_model=HealthResponseV2)
def get_health(request: Request, response: Response):
    engine = _get_engine(request)
    check_pg_readiness(engine)
    response.headers["Cache-Control"] = "no-store"
    return HealthResponseV2(status="ready", storage="postgresql")


@router.get("/me")
def get_me(
    request: Request,
    response: Response,
    authorization: str | None = Header(None),
):
    principal = _get_principal(request, authorization)
    response.headers["Cache-Control"] = "no-store"
    return {
        "user_id": str(principal.user_id),
        "auth_subject": principal.auth_subject,
        "active": principal.active,
        "memberships": [
            {
                "pharmacy_id": m.pharmacy_id,
                "role": m.role,
                "active": m.active,
                "created_at": m.created_at.isoformat().replace("+00:00", "Z"),
            }
            for m in principal.memberships
        ],
    }


@router.get("/bootstrap", response_model=BootstrapResponseV2)
def get_bootstrap(
    request: Request,
    response: Response,
    authorization: str | None = Header(None),
):
    _get_principal(request, authorization)
    engine = _get_engine(request)
    with engine.connect() as conn:
        data = read_bootstrap_v2(conn)
    response.headers["Cache-Control"] = "no-store"
    return data


@router.get("/enquiries", response_model=EnquiryPage)
def get_own_enquiries(
    request: Request,
    response: Response,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1000),
    authorization: str | None = Header(None),
):
    principal = _get_principal(request, authorization)
    engine = _get_engine(request)
    clock = _get_clock(request)
    with engine.connect() as conn:
        page = list_own_enquiries_v2(conn, principal, limit=limit, offset=offset, clock=clock)
    response.headers["Cache-Control"] = "no-store"
    return page


@router.put("/enquiries/{id}", response_model=EnquiryViewV2)
def put_enquiry(
    id: str,
    payload: CreateEnquiryRequest,
    request: Request,
    response: Response,
    authorization: str | None = Header(None),
):
    principal = _get_principal(request, authorization)
    engine = _get_engine(request)
    clock = _get_clock(request)
    with engine.connect() as conn:
        with conn.begin():
            result = create_enquiry_v2(conn, id, payload, principal, clock=clock)
    view = build_view_v2(result.enquiry, result.observation, clock())
    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    response.headers["Cache-Control"] = "no-store"
    return view


@router.get("/enquiries/{id}", response_model=EnquiryViewV2)
def get_enquiry(
    id: str,
    request: Request,
    response: Response,
    authorization: str | None = Header(None),
):
    principal = _get_principal(request, authorization)
    engine = _get_engine(request)
    clock = _get_clock(request)
    with engine.connect() as conn:
        record, obs = read_enquiry_v2(conn, id, principal)
    view = build_view_v2(record, obs, clock())
    response.headers["Cache-Control"] = "no-store"
    return view


@router.get("/staff/enquiries", response_model=EnquiryPage)
def get_staff_enquiries(
    request: Request,
    response: Response,
    pharmacy_id: str = Query(...),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=1000),
    authorization: str | None = Header(None),
):
    principal = _get_principal(request, authorization)
    engine = _get_engine(request)
    clock = _get_clock(request)
    with engine.connect() as conn:
        page = list_pending_v2(conn, principal, pharmacy_id, limit=limit, offset=offset, clock=clock)
    response.headers["Cache-Control"] = "no-store"
    return page


@router.put("/enquiries/{id}/observation", response_model=EnquiryViewV2)
def put_observation(
    id: str,
    payload: ObservationRequest,
    request: Request,
    response: Response,
    authorization: str | None = Header(None),
):
    principal = _get_principal(request, authorization)
    engine = _get_engine(request)
    clock = _get_clock(request)
    with engine.connect() as conn:
        with conn.begin():
            result = accept_observation_v2(conn, id, payload, principal, clock=clock)
    view = build_view_v2(result.enquiry, result.observation, clock())
    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    response.headers["Cache-Control"] = "no-store"
    return view
