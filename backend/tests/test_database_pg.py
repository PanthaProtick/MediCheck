import os
import pathlib
import unittest

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
        finally:
            engine.dispose()


if __name__ == "__main__":
    unittest.main()
