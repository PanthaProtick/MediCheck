
import json
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace
import time
import unittest
from unittest.mock import patch

from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
import jwt

from app.core.auth import ClerkSessionVerifier
from app.core.config import Settings
from app.core.errors import AppError
from app.main import create_app
import test_api_v2


class TestHostedStartup(unittest.TestCase):
    def config(self, **changes):
        values = dict(_env_file=None, APP_MODE="hosted", ENV="production",
                      DATABASE_URL="postgresql://user:pass@localhost/test",
                      CLERK_ISSUER="https://clerk.example.com",
                      CLERK_PUBLISHABLE_KEY="pk_live_example",
                      PUBLIC_APP_ORIGIN="https://app.example.com",
                      CORS_ORIGINS=["https://app.example.com"])
        values.update(changes)
        return Settings(**values)

    def test_hosted_config_rejects_missing_or_unsafe_dependencies(self):
        for changes in (
            {"DATABASE_URL": ""}, {"DATABASE_URL": "sqlite:///test.sqlite3"},
            {"CLERK_ISSUER": ""}, {"CLERK_ISSUER": "http://clerk.example.com"},
            {"PUBLIC_APP_ORIGIN": "http://localhost:5173"},
            {"PUBLIC_APP_ORIGIN": "https://app.example.com/path"},
            {"CLERK_PUBLISHABLE_KEY": ""}, {"CLERK_PUBLISHABLE_KEY": "pk_test_example"},
            {"CORS_ORIGINS": ["*"]},
        ):
            with self.subTest(changes=list(changes)):
                with self.assertRaises(RuntimeError):
                    self.config(**changes).validate_hosted()
        self.config().validate_hosted()

    def test_production_cannot_start_local_mode(self):
        with TemporaryDirectory() as directory:
            database = str(Path(directory) / "must-not-create.sqlite3")
            app = create_app(Settings(_env_file=None, ENV="production", APP_MODE="local",
                                      DEMO_DATABASE_PATH=database, DEMO_STAFF_TOKEN="unused"))
            with self.assertRaises(RuntimeError):
                with TestClient(app):
                    pass
            self.assertFalse(Path(database).exists())

    def test_hosted_startup_requires_correct_frontend_before_connecting(self):
        with TemporaryDirectory() as directory:
            settings = self.config(STATIC_DIR=directory)
            with patch("app.main.create_pg_engine") as factory:
                with self.assertRaises(RuntimeError):
                    with TestClient(create_app(settings)):
                        pass
                factory.assert_not_called()

    def test_hosted_startup_checks_database_and_closes_failed_engine(self):
        with TemporaryDirectory() as directory:
            Path(directory, "index.html").write_text("test")
            Path(directory, "deployment.json").write_text(json.dumps({"schema_version":1,"runtime_config":True}))
            with patch("app.main.create_pg_engine") as factory, patch("app.main.check_pg_readiness", side_effect=AppError(503, "storage_unavailable", "Unavailable", [])):
                with self.assertRaises(AppError):
                    with TestClient(create_app(self.config(STATIC_DIR=directory))):
                        pass
                factory.return_value.dispose.assert_called_once()

    def test_test_database_never_falls_back_to_application_database(self):
        settings = self.config(TEST_DATABASE_URL="")
        self.assertEqual(settings.get_sync_database_url(is_test=True), "")


class TestClerkSignedSessions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        cls.other = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    def setUp(self):
        self.settings = Settings(_env_file=None, CLERK_ISSUER="https://clerk.example.com",
                                 PUBLIC_APP_ORIGIN="https://app.example.com")
        self.verifier = ClerkSessionVerifier(SimpleNamespace(
            get_signing_key_from_jwt=lambda token: SimpleNamespace(key=self.private.public_key())))

    def claims(self):
        now = int(time.time())
        return dict(sub="user_signed", iss=self.settings.CLERK_ISSUER,
                    azp=self.settings.PUBLIC_APP_ORIGIN, exp=now+300, iat=now-1, nbf=now-1)

    def signed(self, claims, key=None):
        return jwt.encode(claims, key or self.private, algorithm="RS256", headers={"kid":"test"})

    def test_signed_session_maps_verified_subject(self):
        result = self.verifier.verify_token(self.signed(self.claims()), self.settings)
        self.assertEqual(result.auth_subject, "user_signed")

    def test_wrong_signature_issuer_party_expiry_future_time_and_missing_claims_fail(self):
        for key in ("exp", "iat", "nbf", "sub", "azp"):
            claims = self.claims()
            del claims[key]
            with self.subTest(missing=key), self.assertRaises(AppError) as error:
                self.verifier.verify_token(self.signed(claims), self.settings)
            self.assertEqual(error.exception.status_code, 401)
        for values in (
            {"iss":"https://other.example.com"}, {"azp":"https://evil.example.com"},
            {"exp":int(time.time())-30}, {"nbf":int(time.time())+300},
            {"iat":int(time.time())+300},
        ):
            claims = {**self.claims(), **values}
            with self.subTest(values=list(values)), self.assertRaises(AppError) as error:
                self.verifier.verify_token(self.signed(claims), self.settings)
            self.assertEqual(error.exception.status_code, 401)
        with self.assertRaises(AppError) as error:
            self.verifier.verify_token(self.signed(self.claims(), self.other), self.settings)
        self.assertEqual(error.exception.status_code, 401)

    def test_shared_secret_and_demo_tokens_are_not_sessions(self):
        for token in ("test-token-caregiver_1", jwt.encode(self.claims(), "not-a-session-key-for-test-only-32bytes", algorithm="HS256")):
            with self.assertRaises(AppError) as error:
                self.verifier.verify_token(token, self.settings)
            self.assertEqual(error.exception.status_code, 401)

    def test_jwks_failure_is_unavailable_not_an_accepted_identity(self):
        client = SimpleNamespace(get_signing_key_from_jwt=lambda token: (_ for _ in ()).throw(ConnectionError()))
        with self.assertRaises(AppError) as error:
            ClerkSessionVerifier(client).verify_token("token", self.settings)
        self.assertEqual(error.exception.status_code, 503)


class TestHostedSurface(unittest.TestCase):
    def setUp(self):
        self.fixture = test_api_v2.TestApiV2("test_v2_health")
        self.fixture.setUp()
        self.client = self.fixture.client

    def tearDown(self):
        self.fixture.tearDown()

    def test_local_routes_are_not_exposed_and_config_has_no_secrets(self):
        for path in ("/api/v1/bootstrap", "/api/v1/staff/enquiries", "/api/v1/health"):
            self.assertEqual(self.client.get(path).status_code, 404)
        value = self.client.get("/api/config").json()
        self.assertEqual(set(value), {"mode","clerk_publishable_key","simulated"})
        self.assertEqual(value["mode"], "hosted")

    def test_unknown_fabricated_token_is_rejected(self):
        self.assertEqual(self.client.get("/api/v2/me", headers={"Authorization":"Bearer test-token-caregiver_1"}).status_code, 401)

    def test_chunked_body_cannot_bypass_size_bound(self):
        response = self.client.put("/api/v2/enquiries/00000000-0000-4000-8000-000000000099",
                                   headers={"Content-Type":"application/json"},
                                   content=iter([b"x"*8192, b"x"*8192, b"x"]))
        self.assertEqual(response.status_code, 413)


class TestHostedRotatingTokenLimits(unittest.TestCase):
    def test_rotating_unverified_tokens_do_not_bypass_limits(self):
        fixture = test_api_v2.TestApiV2("test_v2_health")
        fixture.setUp()
        try:
            fixture.client.app.state.settings.RATE_LIMIT_ENABLED = True
            fixture.client.app.state.rate_limiter.max_requests_per_min = 2
            for token in ["invalid-a", "invalid-b"]:
                self.assertEqual(fixture.client.get("/api/v2/me", headers={"Authorization":"Bearer " + token}).status_code, 401)
            response = fixture.client.get("/api/v2/me", headers={"Authorization":"Bearer invalid-c"})
            self.assertEqual(response.status_code, 429)
            self.assertEqual(response.json()["error"]["code"], "rate_limited")
        finally:
            fixture.tearDown()
