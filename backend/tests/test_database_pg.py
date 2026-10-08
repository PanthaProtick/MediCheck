import os
import pathlib
import unittest
from uuid import uuid4
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor
from sqlalchemy import text
from fastapi.testclient import TestClient
from app.core.auth import TestSessionVerifier, get_or_create_local_user
from app.models.schemas_v2 import VerifiedIdentity
from app.main import create_app

from app.core.config import Settings
from app.core.database import (
    apply_pg_migrations,
    check_pg_readiness,
    create_pg_engine,
    seed_pg_database,
)
from app.core.errors import AppError


class TestPostgresDatabase(unittest.TestCase):
    def setUp(self):
        self.migration_path = (
            pathlib.Path(__file__).resolve().parent.parent / "migrations" / "001_multi_user.sql"
        )
        self.test_db_url = os.environ.get("TEST_DATABASE_URL", "").strip()

    def test_migration_file_exists_and_contains_required_tables(self):
        self.assertTrue(self.migration_path.exists(), "001_multi_user.sql must exist")
        content = self.migration_path.read_text(encoding="utf-8")
        required_tables = [
            "schema_migrations",
            "users",
            "pharmacies",
            "pharmacy_memberships",
            "products",
            "claims",
            "enquiries",
            "observations",
        ]
        for tbl in required_tables:
            self.assertIn(f"CREATE TABLE IF NOT EXISTS {tbl}", content)

        # Check required constraints and indexes
        self.assertIn("idx_enquiries_owner", content)
        self.assertIn("idx_enquiries_pharmacy_pending", content)
        self.assertIn("chk_obs_coherence", content)
        self.assertIn("PRIMARY KEY (user_id, pharmacy_id)", content)

    def test_engine_creation_error_on_missing_url(self):
        with self.assertRaises(AppError) as ctx:
            create_pg_engine("")
        self.assertEqual(ctx.exception.status_code, 503)
        self.assertEqual(ctx.exception.code, "storage_unavailable")

    def test_settings_url_normalization(self):
        s1 = Settings(DATABASE_URL="postgresql+asyncpg://user:pass@host:5432/db")
        self.assertEqual(
            s1.get_sync_database_url(),
            "postgresql+psycopg://user:pass@host:5432/db",
        )

        s2 = Settings(DATABASE_URL="postgres://user:pass@host:5432/db")
        self.assertEqual(
            s2.get_sync_database_url(),
            "postgresql+psycopg://user:pass@host:5432/db",
        )

        s3 = Settings(DATABASE_URL="postgresql://user:pass@host:5432/db")
        self.assertEqual(
            s3.get_sync_database_url(),
            "postgresql+psycopg://user:pass@host:5432/db",
        )

    def test_live_postgres_integration(self):
        if not self.test_db_url:
            self.skipTest(
                "TEST_DATABASE_URL is not set. Per plan (Section 12), live PG tests are skipped and not silently substituted with SQLite."
            )

        # Ensure we are not pointing at production
        self.assertIn(
            "test",
            self.test_db_url.lower(),
            "TEST_DATABASE_URL must contain 'test' to prevent operating on production DB",
        )

        settings = Settings(TEST_DATABASE_URL=self.test_db_url)
        sync_url = settings.get_sync_database_url(is_test=True)
        engine = create_pg_engine(sync_url)

        try:
            apply_pg_migrations(engine)
            seed_pg_database(engine)
            check_pg_readiness(engine)
            self.check_live_workflow(engine)
        finally:
            engine.dispose()

    def check_live_workflow(self, engine):
        prefix = "integration_" + uuid4().hex
        owner = VerifiedIdentity(auth_subject=prefix + "_owner")
        staff = VerifiedIdentity(auth_subject=prefix + "_staff")
        stranger = VerifiedIdentity(auth_subject=prefix + "_stranger")
        verifier = TestSessionVerifier({"owner":owner, "staff":staff, "stranger":stranger})
        settings = Settings(APP_MODE="hosted", ENV="test", RATE_LIMIT_ENABLED=False)
        app = create_app(settings=settings, engine=engine, session_verifier=verifier)
        enquiry_id = str(uuid4())
        headers = lambda token: {"Authorization":"Bearer " + token}
        def provision():
            with engine.begin() as conn:
                return str(get_or_create_local_user(conn, owner).user_id)
        try:
            # Independent PostgreSQL transactions must converge on one local identity.
            with ThreadPoolExecutor(max_workers=2) as workers:
                identities = list(workers.map(lambda _: provision(), range(2)))
            self.assertEqual(identities[0], identities[1])
            with TestClient(app) as client:
                self.assertEqual(client.get("/api/v2/health").json()["storage"], "postgresql")
                staff_id = client.get("/api/v2/me", headers=headers("staff")).json()["user_id"]
                with engine.begin() as conn:
                    conn.execute(text("INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at) VALUES (:uid,'PHARM-A','staff',TRUE,:stamp)"), {"uid":staff_id,"stamp":datetime.now(timezone.utc)})
                request = {"pharmacy_id":"PHARM-A","product_id":"MED-A","requested_quantity":6,"unit":"tablet"}
                def create():
                    return client.put("/api/v2/enquiries/" + enquiry_id, headers=headers("owner"), json=request)
                with ThreadPoolExecutor(max_workers=2) as workers:
                    results = list(workers.map(lambda _: create(), range(2)))
                self.assertEqual(sorted(result.status_code for result in results), [200, 201])
                path = "/api/v2/enquiries/" + enquiry_id
                self.assertEqual(client.get(path, headers=headers("stranger")).status_code, 404)
                report = {"product_id":"MED-A","unit":"tablet","kind":"checked","obtainable_quantity":4,"observed_at":datetime.now(timezone.utc).isoformat(),"unresolved_reason":None}
                saved = client.put(path + "/observation", headers=headers("staff"), json=report)
                self.assertEqual(saved.status_code, 201, saved.text)
                self.assertEqual(saved.json()["observation"]["reported_by_user_id"], staff_id)
                self.assertEqual(client.put(path + "/observation", headers=headers("staff"), json=report).status_code, 200)
                changed = {**report,"obtainable_quantity":5}
                self.assertEqual(client.put(path + "/observation", headers=headers("staff"), json=changed).status_code, 409)
        finally:
            with engine.begin() as conn:
                conn.execute(text("DELETE FROM observations WHERE enquiry_id=:id"), {"id":enquiry_id})
                conn.execute(text("DELETE FROM enquiries WHERE id=:id"), {"id":enquiry_id})
                subjects = [owner.auth_subject, staff.auth_subject, stranger.auth_subject]
                for subject in subjects:
                    conn.execute(text("DELETE FROM pharmacy_memberships WHERE user_id IN (SELECT id FROM users WHERE auth_subject=:subject)"), {"subject":subject})
                    conn.execute(text("DELETE FROM users WHERE auth_subject=:subject"), {"subject":subject})


if __name__ == "__main__":
    unittest.main()
