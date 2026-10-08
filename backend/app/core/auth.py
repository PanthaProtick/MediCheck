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
            raise AppError(401, "unauthorized", "Missing session token.", [])
        if not settings.CLERK_ISSUER or not settings.PUBLIC_APP_ORIGIN:
            raise AppError(503, "auth_unavailable", "Identity verification service is not configured.", [])
        try:
            if self._jwks_client is None:
                self._jwks_client = jwt.PyJWKClient(
                    settings.CLERK_ISSUER.rstrip("/") + "/.well-known/jwks.json",
                    cache_keys=True, max_cached_keys=16, timeout=3,
                )
            signing_key = self._jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token, signing_key.key, algorithms=["RS256"],
                issuer=settings.CLERK_ISSUER.rstrip("/"),
                options={"require": ["exp", "iat", "nbf", "sub", "azp"],
                         "verify_exp": True, "verify_nbf": True, "verify_iat": True,
                         "verify_iss": True},
            )
            if payload.get("azp") != settings.PUBLIC_APP_ORIGIN.rstrip("/"):
                raise jwt.InvalidTokenError("Untrusted authorized party")
            sub = payload["sub"]
            if not isinstance(sub, str) or not sub or len(sub) > 500:
                raise jwt.InvalidTokenError("Invalid subject")
            return VerifiedIdentity(auth_subject=sub)
        except jwt.InvalidTokenError as exc:
            raise AppError(401, "unauthorized", "Invalid or expired session token.", []) from exc
        except Exception as exc:
            # Do not log supplied tokens, provider URLs, or provider exception bodies.
            logger.warning("Identity verification service unavailable")
            raise AppError(503, "auth_unavailable", "Identity verification service is temporarily unavailable.", []) from exc


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

    # Concurrent first requests converge on the unique auth subject.
    conn.execute(text("""
        INSERT INTO users (id, auth_subject, active, created_at)
        VALUES (:id, :sub, TRUE, :created_at)
        ON CONFLICT (auth_subject) DO NOTHING;
    """), {"id": str(uuid4()), "sub": identity.auth_subject, "created_at": now})
    row = conn.execute(text(
        "SELECT id, active FROM users WHERE auth_subject = :sub;"
    ), {"sub": identity.auth_subject}).one()
    user_id = UUID(str(row[0]))
    active = bool(row[1])

    if not active:
        raise AppError(
            status_code=403,
            code="forbidden",
            message="Account has been disabled.",
            fields=[],
        )

    # 2. Query active memberships
    stmt_memberships = text("""
        SELECT m.pharmacy_id, m.role, m.active, m.created_at
        FROM pharmacy_memberships m JOIN pharmacies p ON p.id = m.pharmacy_id
        WHERE m.user_id = :user_id AND m.active = TRUE AND p.active = TRUE;
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
