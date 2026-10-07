from collections.abc import Callable
from datetime import datetime
from fastapi import APIRouter, Header, Request, Response, status

from app.core.config import Settings, settings as default_settings
from app.core.database import check_readiness
from app.core.security import require_staff
from app.models.schemas import (
    BootstrapResponse,
    CreateEnquiryRequest,
    EnquiryView,
    HealthResponse,
    ObservationRequest,
)
from app.services.enquiries import (
    accept_observation,
    create_enquiry,
    list_pending,
    read_bootstrap,
    read_enquiry,
    utc_now,
)
from app.services.evidence import build_view

router = APIRouter()


def _get_settings(request: Request) -> Settings:
    return getattr(request.app.state, "settings", default_settings)


def _get_clock(request: Request) -> Callable[[], datetime]:
    return getattr(request.app.state, "clock", utc_now)


@router.get("/health", response_model=HealthResponse)
def get_health(request: Request, response: Response):
    settings = _get_settings(request)
    check_readiness(settings.DEMO_DATABASE_PATH)
    response.headers["Cache-Control"] = "no-store"
    return HealthResponse(status="ready", storage="sqlite")


@router.get("/bootstrap", response_model=BootstrapResponse)
def get_bootstrap(request: Request, response: Response):
    settings = _get_settings(request)
    data = read_bootstrap(settings.DEMO_DATABASE_PATH)
    response.headers["Cache-Control"] = "no-store"
    return data


@router.put("/enquiries/{id}", response_model=EnquiryView)
def put_enquiry(id: str, payload: CreateEnquiryRequest, request: Request, response: Response):
    settings = _get_settings(request)
    clock = _get_clock(request)
    result = create_enquiry(settings.DEMO_DATABASE_PATH, id, payload, clock)
    view = build_view(result.enquiry, result.observation, clock())
    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    response.headers["Cache-Control"] = "no-store"
    return view


@router.get("/enquiries/{id}", response_model=EnquiryView)
def get_enquiry(id: str, request: Request, response: Response):
    settings = _get_settings(request)
    clock = _get_clock(request)
    record, obs = read_enquiry(settings.DEMO_DATABASE_PATH, id)
    view = build_view(record, obs, clock())
    response.headers["Cache-Control"] = "no-store"
    return view


@router.get("/staff/enquiries", response_model=list[EnquiryView])
def get_staff_enquiries(request: Request, response: Response, authorization: str | None = Header(None)):
    settings = _get_settings(request)
    clock = _get_clock(request)
    principal = require_staff(authorization, settings)
    pending_items = list_pending(settings.DEMO_DATABASE_PATH, principal)
    views = [build_view(record, obs, clock()) for record, obs in pending_items]
    response.headers["Cache-Control"] = "no-store"
    return views


@router.put("/enquiries/{id}/observation", response_model=EnquiryView)
def put_observation(
    id: str,
    payload: ObservationRequest,
    request: Request,
    response: Response,
    authorization: str | None = Header(None),
):
    settings = _get_settings(request)
    clock = _get_clock(request)
    principal = require_staff(authorization, settings)
    result = accept_observation(settings.DEMO_DATABASE_PATH, id, payload, principal, clock)
    view = build_view(result.enquiry, result.observation, clock())
    response.status_code = status.HTTP_201_CREATED if result.created else status.HTTP_200_OK
    response.headers["Cache-Control"] = "no-store"
    return view
