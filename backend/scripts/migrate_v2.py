#!/usr/bin/env python3
"""Database migration and seed script for PostgreSQL (Neon) v2 deployment."""
import argparse
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.config import settings
from app.core.database import (
    apply_pg_migrations,
    seed_pg_database,
    check_pg_readiness,
    create_pg_engine,
)


def main():
    parser = argparse.ArgumentParser(description="Apply PostgreSQL schema migrations and seed initial data.")
    parser.add_argument("--url", help="Database connection URL (defaults to DATABASE_URL in settings)")
    parser.add_argument("--seed", action="store_true", help="Seed catalog products and claims from bootstrap_v2.json")
    parser.add_argument("--check-only", action="store_true", help="Perform readiness check without modifying database")

    args = parser.parse_args()

    url = args.url or settings.get_sync_database_url()
    if not url:
        print("ERROR: No PostgreSQL database URL configured. Provide --url or set DATABASE_URL.", file=sys.stderr)
        sys.exit(1)

    print(f"Connecting to database...")
    engine = create_pg_engine(url)

    try:
        if args.check_only:
            print("Checking schema readiness...")
            check_pg_readiness(engine)
            print("OK: Database schema is migrated and ready.")
            return

        print("Applying schema migrations...")
        apply_pg_migrations(engine)
        print("OK: Migrations applied successfully.")

        if args.seed:
            print("Seeding initial bootstrap catalog and claims...")
            seed_pg_database(engine)
            print("OK: Seed data populated successfully.")

        print("Verifying readiness...")
        check_pg_readiness(engine)
        print("SUCCESS: PostgreSQL database is ready for v2 multi-user operation.")

    except Exception as exc:
        print("ERROR: Migration or readiness check failed. Check database connectivity and migration state.", file=sys.stderr)
        sys.exit(1)
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
