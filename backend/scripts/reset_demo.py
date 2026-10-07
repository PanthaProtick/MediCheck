import os
from pathlib import Path
import sqlite3
import sys

# Ensure backend root is on sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from app.core.config import settings
from app.core.database import initialize_database


def reset_demo_database():
    target = Path(settings.DEMO_DATABASE_PATH).resolve()
    expected_default = (backend_root / "data" / "demo.sqlite3").resolve()

    print(f"Target demo database: {target}")

    # Guardrails: verify target is within the workspace backend/data folder
    if target != expected_default:
        print(f"ERROR: Refusing to reset. Configured path '{target}' is not the expected default '{expected_default}'.")
        sys.exit(1)

    if not target.parent.exists():
        target.parent.mkdir(parents=True, exist_ok=True)

    if target.exists():
        # Check for an active database lock; an idle server cannot be detected here.
        # The operator must stop the backend before invoking this maintenance script.
        conn = None
        try:
            conn = sqlite3.connect(str(target), timeout=1.0)
            conn.execute("BEGIN EXCLUSIVE")
            conn.rollback()
        except sqlite3.OperationalError:
            print("WARNING: Database file is locked. Please ensure the backend server is stopped before resetting.")
            sys.exit(1)
        finally:
            if conn:
                conn.close()

        try:
            os.remove(target)
            print(f"Removed existing database file: {target}")
        except Exception as e:
            print(f"ERROR: Could not remove database file: {e}")
            sys.exit(1)

    # Recreate and seed from bootstrap fixture
    initialize_database(str(target))
    print(f"Successfully initialized and reseeded fresh database at: {target}")


if __name__ == "__main__":
    reset_demo_database()
