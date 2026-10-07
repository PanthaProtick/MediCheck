from collections.abc import Callable
from datetime import datetime, timezone
import json
import logging
from typing import Any
from uuid import UUID, uuid4

import jwt
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core.config import Settings
from app.core.errors import AppError
from app.models.schemas_v2 import (
    AuthenticatedPrincipal,
    PharmacyMembership,
    VerifiedIdentity,
)

logger = logging.getLogger(__name__)


class SessionVerifier:
    def verify_token(self, token: str, settings: Settings) -> VerifiedIdentity:
        raise NotImplementedError


class ClerkSessionVerifier(SessionVerifier):
    def __init__(self, jwks_client: Any | None = None):
        self._jwks_client = jwks_client

    def verify_token(self, token: str, settings: Settings) -> VerifiedIdentity:
        if not token or not token.strip():
            raise AppError(
                status_code=401,
                code="unauthorized",
                message="Missing session token.",
                fields=[],
            )

        # If Clerk secret / issuer is not configured, fail closed
        if not settings.CLERK_ISSUER and not settings.CLERK_SECRET_KEY:
            raise AppError(
                status_code=503,
                code="auth_unavailable",
                message="Identity verification service is not configured.",
                fields=[],
            )

        try:
            # If using JWKS from Clerk issuer
            if self._jwks_client is None and settings.CLERK_ISSUER:
                jwks_url = f"{settings.CLERK_ISSUER.rstrip('/')}/.well-known/jwks.json"
                self._jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True, max_cached_keys=16)

            if self._jwks_client:
                signing_key = self._jwks_client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key.key,
                    algorithms=["RS256"],
                    issuer=settings.CLERK_ISSUER if settings.CLERK_ISSUER else None,
                    options={"verify_exp": True, "verify_nbf": True, "verify_iss": bool(settings.CLERK_ISSUER)},
                )
            else:
                # Secret key fallback if configured
                payload = jwt.decode(
                    token,
                    settings.CLERK_SECRET_KEY,
                    algorithms=["HS256"],
                    options={"verify_exp": True},
                )

            sub = payload.get("sub")
            if not sub or not isinstance(sub, str):
                raise AppError(
                    status_code=401,
                    code="unauthorized",
                    message="Invalid token subject claim.",
                    fields=[],
                )

            email = payload.get("email") or payload.get("email_address")
            return VerifiedIdentity(auth_subject=sub, email=str(email) if email else None)

        except jwt.ExpiredSignatureError as exc:
            raise AppError(
                status_code=401,
                code="unauthorized",
                message="Session token has expired.",
                fields=[],
            ) from exc
        except (jwt.InvalidTokenError, jwt.DecodeError) as exc:
            raise AppError(
                status_code=401,
                code="unauthorized",
                message="Invalid session token signature or claims.",
                fields=[],
            ) from exc
        except Exception as exc:
            logger.error("Auth verification service failure: %s", exc)
            raise AppError(
                status_code=503,
                code="auth_unavailable",
                message="Identity verification service is temporarily unavailable.",
                fields=[],
            ) from exc


class TestSessionVerifier(SessionVerifier):
    def __init__(self, mapping: dict[str, VerifiedIdentity] | None = None):
        self.mapping = mapping or {}

    def add_user(self, token: str, identity: VerifiedIdentity) -> None:
        self.mapping[token] = identity

    def verify_token(self, token: str, settings: Settings) -> VerifiedIdentity:
        if token == "error-unavailable":
            raise AppError(
                status_code=503,
                code="auth_unavailable",
                message="Identity verification service is temporarily unavailable.",
                fields=[],
            )
        if token == "error-expired":
            raise AppError(
                status_code=401,
                code="unauthorized",
                message="Session token has expired.",
                fields=[],
            )
        if token in self.mapping:
            return self.mapping[token]
        raise AppError(
            status_code=401,
            code="unauthorized",
            message="Invalid session credential.",
            fields=[],
        )


def extract_bearer_token(authorization_header: str | None) -> str:
    if not authorization_header or not authorization_header.strip():
        raise AppError(
            status_code=401,
            code="unauthorized",
            message="Missing authorization header.",
            fields=[],
        )

    parts = authorization_header.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AppError(
            status_code=401,
            code="unauthorized",
            message="Invalid authorization header format.",
            fields=[],
        )

    return parts[1]


def get_or_create_local_user(
    conn: Connection,
    identity: VerifiedIdentity,
    clock: Callable[[], datetime] | None = None,
) -> AuthenticatedPrincipal:
    now_fn = clock or (lambda: datetime.now(timezone.utc))
    now = now_fn().astimezone(timezone.utc)

    # 1. Check existing user
    stmt_find = text("SELECT id, auth_subject, active, created_at FROM users WHERE auth_subject = :sub;")
    row = conn.execute(stmt_find, {"sub": identity.auth_subject}).fetchone()

    if row is None:
        new_id = uuid4()
        stmt_insert = text("""
            INSERT INTO users (id, auth_subject, active, created_at)
            VALUES (:id, :sub, TRUE, :created_at);
        """)
        conn.execute(stmt_insert, {"id": str(new_id), "sub": identity.auth_subject, "created_at": now})
        user_id = new_id
        active = True
    else:
        user_id = UUID(str(row[0])) if not isinstance(row[0], UUID) else row[0]
        active = bool(row[2])

    if not active:
        raise AppError(
            status_code=403,
            code="forbidden",
            message="Account has been disabled.",
            fields=[],
        )

    # 2. Query active memberships
    stmt_memberships = text("""
        SELECT pharmacy_id, role, active, created_at
        FROM pharmacy_memberships
        WHERE user_id = :user_id AND active = TRUE;
    """)
    m_rows = conn.execute(stmt_memberships, {"user_id": str(user_id)}).fetchall()
    memberships = [
        PharmacyMembership(
            pharmacy_id=m[0],
            role=m[1],
            active=bool(m[2]),
            created_at=m[3],
        )
        for m in m_rows
    ]

    return AuthenticatedPrincipal(
        user_id=user_id,
        auth_subject=identity.auth_subject,
        active=active,
        memberships=memberships,
    )
