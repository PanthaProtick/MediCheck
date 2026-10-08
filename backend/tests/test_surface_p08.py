from datetime import datetime, timezone
import unittest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.core.auth import TestSessionVerifier
from app.core.config import Settings
from app.core.rate_limit import InMemoryRateLimiter
from app.main import create_app
from app.models.schemas_v2 import VerifiedIdentity


class TestBoundedPublicSurface(unittest.TestCase):
    def setUp(self):
        self.settings = Settings(
            DEMO_DATABASE_PATH=":memory:",
            DEMO_STAFF_TOKEN="test-staff-token",
            ENV="test",
            APP_MODE="hosted",
            RATE_LIMIT_ENABLED=True,
            RATE_LIMIT_MAX_REQUESTS=10,
            RATE_LIMIT_MAX_MUTATIONS=3,
            MAX_REQUEST_BODY_BYTES=16384,
        )
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        schema_sql = """
            CREATE TABLE schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL);
            INSERT INTO schema_migrations (version, applied_at) VALUES ('001_multi_user', '2026-10-07T00:00:00Z');

            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                auth_subject TEXT UNIQUE NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE pharmacies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                simulated INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE pharmacy_memberships (
                user_id TEXT NOT NULL,
                pharmacy_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_id, pharmacy_id)
            );

            CREATE TABLE products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                strength TEXT NOT NULL,
                form TEXT NOT NULL,
                unit TEXT NOT NULL
            );

            CREATE TABLE claims (
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

            CREATE TABLE enquiries (
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

            CREATE TABLE observations (
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

            INSERT INTO pharmacies (id, name, active, simulated) VALUES ('PHARM-A', 'Demo Pharmacy A', 1, 1);
            INSERT INTO products (id, name, strength, form, unit) VALUES ('MED-A', 'Demo Medicine A', '10 mg', 'tablet', 'tablet');
        """
        with self.engine.connect() as conn:
            with conn.begin():
                for stmt in schema_sql.strip().split(";"):
                    if stmt.strip():
                        conn.execute(text(stmt.strip()))

        self.verifier = TestSessionVerifier()
        self.verifier.add_user("token-caregiver", VerifiedIdentity(auth_subject="sub_caregiver"))

        self.app = create_app(
            settings=self.settings,
            clock=lambda: datetime(2026, 10, 7, 5, 0, 0, tzinfo=timezone.utc),
            engine=self.engine,
            session_verifier=self.verifier,
        )
        self.client = TestClient(self.app)

    def tearDown(self):
        self.engine.dispose()

    def test_request_body_exceeding_16kib_rejected(self):
        oversized = "a" * (17 * 1024)
        response = self.client.put(
            "/api/v2/enquiries/00000000-0000-4000-8000-000000000099",
            headers={
                "Authorization": "Bearer token-caregiver",
                "Content-Type": "application/json",
                "Content-Length": str(len(oversized)),
            },
            content=oversized,
        )
        self.assertEqual(response.status_code, 413)
        self.assertEqual(response.headers.get("cache-control"), "no-store")
        body = response.json()
        self.assertEqual(body["error"]["code"], "validation_error")
        self.assertIn("16384 bytes", body["error"]["message"])

    def test_rate_limiter_enforces_mutation_ceiling_with_429_and_retry_after(self):
        req = {
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "requested_quantity": 6,
            "unit": "tablet",
        }
        for i in range(3):
            res = self.client.put(
                f"/api/v2/enquiries/00000000-0000-4000-8000-00000000001{i}",
                headers={"Authorization": "Bearer token-caregiver"},
                json=req,
            )
            self.assertEqual(res.status_code, 201)

        # 4th mutation should hit 429
        res = self.client.put(
            "/api/v2/enquiries/00000000-0000-4000-8000-000000000014",
            headers={"Authorization": "Bearer token-caregiver"},
            json=req,
        )
        self.assertEqual(res.status_code, 429)
        self.assertEqual(res.headers.get("cache-control"), "no-store")
        self.assertIn("retry-after", res.headers)
        data = res.json()
        self.assertEqual(data["error"]["code"], "rate_limited")

    def test_unknown_api_route_returns_json_404_with_no_store(self):
        response = self.client.get("/api/v2/nonexistent/endpoint")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.headers.get("cache-control"), "no-store")
        data = response.json()
        self.assertEqual(data["error"]["code"], "not_found")

    def test_rate_limiter_unit_logic(self):
        limiter = InMemoryRateLimiter(max_requests_per_min=5, max_mutations_per_min=2)
        self.assertTrue(limiter.check_and_record("user1", is_mutation=True, now=100.0).allowed)
        self.assertTrue(limiter.check_and_record("user1", is_mutation=True, now=101.0).allowed)
        res = limiter.check_and_record("user1", is_mutation=True, now=102.0)
        self.assertFalse(res.allowed)
        self.assertGreater(res.retry_after, 0)

        # Different user ok
        self.assertTrue(limiter.check_and_record("user2", is_mutation=True, now=102.0).allowed)

        # After 60 seconds, user1 is allowed again
        self.assertTrue(limiter.check_and_record("user1", is_mutation=True, now=162.0).allowed)


class TestRateLimitBounds(unittest.TestCase):
    def test_key_flood_is_bounded_and_expired_slots_reusable(self):
        limiter = InMemoryRateLimiter(max_keys=2)
        self.assertTrue(limiter.check_and_record("a", True, now=100).allowed)
        self.assertTrue(limiter.check_and_record("b", True, now=100).allowed)
        for i in range(100):
            self.assertFalse(limiter.check_and_record(str(i), True, now=101).allowed)
        self.assertEqual(len(limiter._requests), 2)
        self.assertEqual(len(limiter._mutations), 2)
        self.assertTrue(limiter.check_and_record("new", True, now=160).allowed)

    def test_retry_after_rounds_up(self):
        limiter = InMemoryRateLimiter(max_requests_per_min=1)
        self.assertTrue(limiter.check_and_record("a", now=100).allowed)
        self.assertEqual(limiter.check_and_record("a", now=100.1).retry_after, 60)
        self.assertTrue(limiter.check_and_record("a", now=160).allowed)
