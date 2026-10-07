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


from pathlib import Path
from sqlalchemy import create_engine, text
from app.core.auth import (
    ClerkSessionVerifier,
    SessionVerifier,
    TestSessionVerifier,
    extract_bearer_token,
    get_or_create_local_user,
)
from app.models.schemas_v2 import VerifiedIdentity


def _ensure_v2_schema_sqlite(engine: Engine) -> None:
    schema_sql = """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        );
        INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('001_multi_user', '2026-10-07T00:00:00Z');

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            auth_subject TEXT UNIQUE NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS pharmacies (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            simulated INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS pharmacy_memberships (
            user_id TEXT NOT NULL,
            pharmacy_id TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'staff',
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL,
            PRIMARY KEY (user_id, pharmacy_id)
        );

        CREATE TABLE IF NOT EXISTS products (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            strength TEXT NOT NULL,
            form TEXT NOT NULL,
            unit TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS claims (
            id TEXT PRIMARY KEY,
            pharmacy_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            quantity INTEGER NULL,
            unit TEXT NOT NULL,
            recorded_at TEXT NULL,
            loaded_at TEXT NOT NULL,
            source TEXT NOT NULL,
            simulated INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS enquiries (
            id TEXT PRIMARY KEY,
            owner_user_id TEXT NOT NULL,
            pharmacy_id TEXT NOT NULL,
            product_id TEXT NOT NULL,
            requested_quantity INTEGER NOT NULL,
            unit TEXT NOT NULL,
            created_at TEXT NOT NULL,
            product_snapshot_json TEXT NOT NULL,
            claim_snapshot_json TEXT NULL
        );

        CREATE TABLE IF NOT EXISTS observations (
            enquiry_id TEXT PRIMARY KEY,
            product_id TEXT NOT NULL,
            unit TEXT NOT NULL,
            kind TEXT NOT NULL,
            obtainable_quantity INTEGER NULL,
            observed_at TEXT NULL,
            unresolved_reason TEXT NULL,
            reported_by_user_id TEXT NOT NULL,
            submitted_at TEXT NOT NULL,
            basis TEXT NOT NULL,
            simulated INTEGER NOT NULL DEFAULT 1
        );

        INSERT OR IGNORE INTO pharmacies (id, name, active, simulated) VALUES
        ('PHARM-A', 'Synthetic Demo Pharmacy A', 1, 1),
        ('PHARM-B', 'Synthetic Demo Pharmacy B', 1, 1);

        INSERT OR IGNORE INTO products (id, name, strength, form, unit) VALUES
        ('MED-A', 'Demo Medicine A', '10 mg', 'tablet', 'tablet'),
        ('MED-B', 'Demo Medicine B', '500 mg', 'capsule', 'capsule');

        INSERT OR IGNORE INTO claims (id, pharmacy_id, product_id, quantity, unit, recorded_at, loaded_at, source, simulated) VALUES
        ('CLAIM-A', 'PHARM-A', 'MED-A', 12, 'tablet', '2026-10-07T05:00:00Z', '2026-10-07T05:00:00Z', 'synthetic inventory fixture', 1),
        ('CLAIM-B', 'PHARM-B', 'MED-B', 25, 'capsule', '2026-10-07T05:00:00Z', '2026-10-07T05:00:00Z', 'synthetic inventory fixture', 1);

        INSERT OR IGNORE INTO users (id, auth_subject, active, created_at) VALUES
        ('a1000000-0000-4000-8000-000000000001', 'sub_staff_a_1', 1, '2026-10-07T00:00:00Z'),
        ('b1000000-0000-4000-8000-000000000003', 'sub_staff_b', 1, '2026-10-07T00:00:00Z');

        INSERT OR IGNORE INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at) VALUES
        ('a1000000-0000-4000-8000-000000000001', 'PHARM-A', 'staff', 1, '2026-10-07T00:00:00Z'),
        ('b1000000-0000-4000-8000-000000000003', 'PHARM-B', 'staff', 1, '2026-10-07T00:00:00Z');
    """
    with engine.connect() as conn:
        with conn.begin():
            for stmt in schema_sql.strip().split(";"):
                if stmt.strip():
                    conn.execute(text(stmt.strip()))
            # Ensure columns exist if table was originally created under v1
            enq_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(enquiries)")).fetchall()]
            if "owner_user_id" not in enq_cols:
                conn.execute(text("ALTER TABLE enquiries ADD COLUMN owner_user_id TEXT;"))
            obs_cols = [r[1] for r in conn.execute(text("PRAGMA table_info(observations)")).fetchall()]
            if "reported_by_user_id" not in obs_cols:
                conn.execute(text("ALTER TABLE observations ADD COLUMN reported_by_user_id TEXT;"))


def _get_engine(request: Request) -> Engine:
    engine = getattr(request.app.state, "engine", None)
    if engine is None:
        settings = _get_settings(request)
        sync_url = settings.get_sync_database_url()
        is_sample = "ep-sample-pooler" in sync_url or "password@" in sync_url
        if sync_url and not is_sample:
            try:
                engine = create_pg_engine(sync_url)
                request.app.state.engine = engine
                return engine
            except Exception:
                if settings.ENV == "production":
                    raise
        # Development / demo fallback to SQLite
        db_path = settings.DEMO_DATABASE_PATH or str(Path(__file__).resolve().parent.parent.parent / "data" / "demo.sqlite3")
        engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
        _ensure_v2_schema_sqlite(engine)
        request.app.state.engine = engine
    return engine


def _get_verifier(request: Request) -> SessionVerifier:
    verifier = getattr(request.app.state, "session_verifier", None)
    if verifier is None:
        settings = _get_settings(request)
        if not settings.CLERK_ISSUER and not settings.CLERK_SECRET_KEY and settings.ENV != "production":
            verifier = TestSessionVerifier({
                "test-token-caregiver_1": VerifiedIdentity(auth_subject="sub_caregiver_1", email="caregiver_1@demo.local"),
                "test-token-caregiver_2": VerifiedIdentity(auth_subject="sub_caregiver_2", email="caregiver_2@demo.local"),
                "test-token-staff_a_1": VerifiedIdentity(auth_subject="sub_staff_a_1", email="staff_a_1@demo.local"),
                "test-token-staff_b": VerifiedIdentity(auth_subject="sub_staff_b", email="staff_b@demo.local"),
            })
            request.app.state.session_verifier = verifier
        else:
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
    email = f"{principal.auth_subject}@demo.local"
    return {
        "id": str(principal.user_id),
        "user_id": str(principal.user_id),
        "external_subject": principal.auth_subject,
        "auth_subject": principal.auth_subject,
        "email": email,
        "full_name": email.split("@")[0].replace("_", " ").title(),
        "status": "active" if principal.active else "disabled",
        "active": principal.active,
        "memberships": [
            {
                "pharmacy_id": m.pharmacy_id,
                "pharmacy_name": f"Pharmacy {m.pharmacy_id[-1]}" if m.pharmacy_id.startswith("PHARM-") else m.pharmacy_id,
                "role": m.role,
                "status": "active" if m.active else "disabled",
                "active": m.active,
                "granted_at": m.created_at.isoformat().replace("+00:00", "Z"),
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


@router.get("/pharmacies/{pharmacy_id}/queue", response_model=EnquiryPage)
def get_pharmacy_queue(
    pharmacy_id: str,
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
