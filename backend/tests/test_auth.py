from datetime import datetime, timezone
import unittest
from uuid import UUID

from sqlalchemy import create_engine, text

from app.core.auth import (
    ClerkSessionVerifier,
    SessionVerifier,
    TestSessionVerifier,
    extract_bearer_token,
    get_or_create_local_user,
)
from app.core.config import Settings
from app.core.errors import AppError
from app.models.schemas_v2 import VerifiedIdentity


class TestAuth(unittest.TestCase):
    def setUp(self):
        self.settings = Settings()
        self.engine = create_engine("sqlite:///:memory:")
        with self.engine.connect() as conn:
            with conn.begin():
                conn.execute(
                    text(
                        """
                    CREATE TABLE users (
                        id TEXT PRIMARY KEY,
                        auth_subject TEXT UNIQUE NOT NULL,
                        active INTEGER NOT NULL DEFAULT 1,
                        created_at TEXT NOT NULL
                    );
                """
                    )
                )
                conn.execute(
                    text(
                        """
                    CREATE TABLE pharmacy_memberships (
                        user_id TEXT NOT NULL,
                        pharmacy_id TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'staff',
                        active INTEGER NOT NULL DEFAULT 1,
                        created_at TEXT NOT NULL,
                        PRIMARY KEY (user_id, pharmacy_id)
                    );
                """
                    )
                )

    def tearDown(self):
        self.engine.dispose()

    def test_extract_bearer_token(self):
        self.assertEqual(extract_bearer_token("Bearer abc.123.xyz"), "abc.123.xyz")
        self.assertEqual(extract_bearer_token("bearer token123"), "token123")

        with self.assertRaises(AppError) as ctx:
            extract_bearer_token(None)
        self.assertEqual(ctx.exception.status_code, 401)
        self.assertEqual(ctx.exception.code, "unauthorized")

        with self.assertRaises(AppError) as ctx:
            extract_bearer_token("Basic dXNlcjpwYXNz")
        self.assertEqual(ctx.exception.status_code, 401)

        with self.assertRaises(AppError) as ctx:
            extract_bearer_token("Bearer")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_clerk_verifier_unconfigured_fails_closed(self):
        verifier = ClerkSessionVerifier()
        settings = Settings(CLERK_ISSUER="", CLERK_SECRET_KEY="")
        with self.assertRaises(AppError) as ctx:
            verifier.verify_token("some-token", settings)
        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.code, "auth_unavailable")

    def test_test_session_verifier(self):
        verifier = TestSessionVerifier()
        identity = VerifiedIdentity(auth_subject="sub_user_1", email="user1@example.com")
        verifier.add_user("token-user-1", identity)

        verified = verifier.verify_token("token-user-1", self.settings)
        self.assertEqual(verified.auth_subject, "sub_user_1")

        with self.assertRaises(AppError) as ctx:
            verifier.verify_token("error-expired", self.settings)
        self.assertEqual(ctx.exception.status_code, 401)

        with self.assertRaises(AppError) as ctx:
            verifier.verify_token("error-unavailable", self.settings)
        self.assertEqual(ctx.exception.status_code, 503)

        with self.assertRaises(AppError) as ctx:
            verifier.verify_token("unknown-token", self.settings)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_get_or_create_local_user_lifecycle(self):
        fixed_now = datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc)
        identity = VerifiedIdentity(auth_subject="clerk_sub_test")

        with self.engine.connect() as conn:
            with conn.begin():
                principal1 = get_or_create_local_user(conn, identity, clock=lambda: fixed_now)
                self.assertIsInstance(principal1.user_id, UUID)
                self.assertEqual(principal1.auth_subject, "clerk_sub_test")
                self.assertTrue(principal1.active)
                self.assertEqual(len(principal1.memberships), 0)

                # Replay with same subject returns exact same user_id
                principal2 = get_or_create_local_user(conn, identity, clock=lambda: fixed_now)
                self.assertEqual(principal1.user_id, principal2.user_id)

    def test_disabled_user_raises_403(self):
        fixed_now = datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc)
        identity = VerifiedIdentity(auth_subject="disabled_sub")

        with self.engine.connect() as conn:
            with conn.begin():
                principal = get_or_create_local_user(conn, identity, clock=lambda: fixed_now)
                # Disable user
                conn.execute(
                    text("UPDATE users SET active = 0 WHERE id = :id"),
                    {"id": str(principal.user_id)},
                )

            with conn.begin():
                with self.assertRaises(AppError) as ctx:
                    get_or_create_local_user(conn, identity, clock=lambda: fixed_now)
                self.assertEqual(ctx.exception.status_code, 403)
                self.assertEqual(ctx.exception.code, "forbidden")

    def test_user_with_memberships(self):
        fixed_now = datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc)
        identity = VerifiedIdentity(auth_subject="staff_sub")

        with self.engine.connect() as conn:
            with conn.begin():
                principal = get_or_create_local_user(conn, identity, clock=lambda: fixed_now)
                # Grant membership to PHARM-A
                conn.execute(
                    text(
                        """
                    INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at)
                    VALUES (:uid, 'PHARM-A', 'staff', 1, :created_at)
                """
                    )
                    ,
                    {"uid": str(principal.user_id), "created_at": fixed_now.isoformat()},
                )

            with conn.begin():
                reloaded = get_or_create_local_user(conn, identity, clock=lambda: fixed_now)
                self.assertEqual(len(reloaded.memberships), 1)
                self.assertEqual(reloaded.memberships[0].pharmacy_id, "PHARM-A")
                self.assertTrue(reloaded.is_member_of("PHARM-A"))
                self.assertFalse(reloaded.is_member_of("PHARM-B"))


if __name__ == "__main__":
    unittest.main()
