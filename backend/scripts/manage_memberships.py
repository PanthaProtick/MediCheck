import argparse
from datetime import datetime, timezone
import sys
from pathlib import Path

# Keep direct script invocation consistent with the migration CLI.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError

from app.core.config import settings
from app.models.schemas_v2 import validate_canonical_uuid


def get_engine():
    db_url = settings.get_sync_database_url()
    if not db_url:
        print("ERROR: DATABASE_URL is not configured in environment.", file=sys.stderr)
        sys.exit(1)
    try:
        postgres = make_url(db_url).get_backend_name() == "postgresql"
    except ArgumentError:
        postgres = False
    if not postgres:
        print("ERROR: Operator commands require a PostgreSQL database URL.", file=sys.stderr)
        sys.exit(1)
    return create_engine(db_url)


def create_pharmacy(pharmacy_id: str, name: str) -> None:
    engine = get_engine()
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("""
                    INSERT INTO pharmacies (id, name, active, simulated)
                    VALUES (:id, :name, TRUE, TRUE)
                    ON CONFLICT (id) DO UPDATE SET name = :name, active = TRUE;
                """),
                {"id": pharmacy_id, "name": name},
            )
    print(f"Successfully created/activated pharmacy: {pharmacy_id} ({name})")


def deactivate_pharmacy(pharmacy_id: str) -> None:
    engine = get_engine()
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("UPDATE pharmacies SET active = FALSE WHERE id = :id;"),
                {"id": pharmacy_id},
            )
    print(f"Successfully deactivated pharmacy: {pharmacy_id}")


def grant_staff(user_uuid_str: str, pharmacy_id: str) -> None:
    canonical_uuid = validate_canonical_uuid(user_uuid_str)
    engine = get_engine()
    with engine.connect() as conn:
        with conn.begin():
            # Validate user exists
            user_row = conn.execute(
                text("SELECT id FROM users WHERE id = :id;"),
                {"id": canonical_uuid},
            ).fetchone()
            if not user_row:
                print(f"ERROR: User UUID {canonical_uuid} does not exist in users table.", file=sys.stderr)
                sys.exit(1)

            # Validate pharmacy exists
            pharm_row = conn.execute(
                text("SELECT id FROM pharmacies WHERE id = :id AND active = TRUE;"),
                {"id": pharmacy_id},
            ).fetchone()
            if not pharm_row:
                print(f"ERROR: Active pharmacy {pharmacy_id} does not exist.", file=sys.stderr)
                sys.exit(1)

            now = datetime.now(timezone.utc)
            conn.execute(
                text("""
                    INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at)
                    VALUES (:uid, :pid, 'staff', TRUE, :created_at)
                    ON CONFLICT (user_id, pharmacy_id) DO UPDATE SET active = TRUE, role = 'staff';
                """),
                {"uid": canonical_uuid, "pid": pharmacy_id, "created_at": now},
            )
    print(f"Successfully granted staff membership for user {canonical_uuid} at {pharmacy_id}.")


def revoke_staff(user_uuid_str: str, pharmacy_id: str) -> None:
    canonical_uuid = validate_canonical_uuid(user_uuid_str)
    engine = get_engine()
    with engine.connect() as conn:
        with conn.begin():
            conn.execute(
                text("""
                    UPDATE pharmacy_memberships
                    SET active = FALSE
                    WHERE user_id = :uid AND pharmacy_id = :pid;
                """),
                {"uid": canonical_uuid, "pid": pharmacy_id},
            )
    print(f"Successfully revoked staff membership for user {canonical_uuid} at {pharmacy_id}.")


def list_memberships(pharmacy_id: str | None = None) -> None:
    engine = get_engine()
    with engine.connect() as conn:
        if pharmacy_id:
            rows = conn.execute(
                text("""
                    SELECT m.user_id, m.pharmacy_id, m.role, m.active, u.auth_subject
                    FROM pharmacy_memberships m
                    JOIN users u ON u.id = m.user_id
                    WHERE m.pharmacy_id = :pid
                    ORDER BY m.created_at DESC;
                """),
                {"pid": pharmacy_id},
            ).fetchall()
        else:
            rows = conn.execute(
                text("""
                    SELECT m.user_id, m.pharmacy_id, m.role, m.active, u.auth_subject
                    FROM pharmacy_memberships m
                    JOIN users u ON u.id = m.user_id
                    ORDER BY m.pharmacy_id, m.created_at DESC;
                """)
            ).fetchall()

    print(f"{'User ID':<38} {'Pharmacy':<10} {'Role':<8} {'Active':<8} {'Auth Subject'}")
    print("-" * 80)
    for r in rows:
        print(f"{str(r[0]):<38} {r[1]:<10} {r[2]:<8} {str(bool(r[3])):<8} {r[4]}")


def main():
    parser = argparse.ArgumentParser(description="Operator CLI for demo pharmacy and membership management.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create-pharmacy
    cp_parser = subparsers.add_parser("create-pharmacy")
    cp_parser.add_argument("pharmacy_id", help="Pharmacy catalog ID (e.g. PHARM-A)")
    cp_parser.add_argument("name", help="Display name of pharmacy")

    # deactivate-pharmacy
    dp_parser = subparsers.add_parser("deactivate-pharmacy")
    dp_parser.add_argument("pharmacy_id", help="Pharmacy catalog ID to deactivate")

    # grant-staff
    gs_parser = subparsers.add_parser("grant-staff")
    gs_parser.add_argument("user_id", help="Canonical lowercase user UUID")
    gs_parser.add_argument("pharmacy_id", help="Target pharmacy ID")

    # revoke-staff
    rs_parser = subparsers.add_parser("revoke-staff")
    rs_parser.add_argument("user_id", help="Canonical lowercase user UUID")
    rs_parser.add_argument("pharmacy_id", help="Target pharmacy ID")

    # list-memberships
    lm_parser = subparsers.add_parser("list-memberships")
    lm_parser.add_argument("--pharmacy-id", help="Filter by pharmacy ID", default=None)

    args = parser.parse_args()

    if args.command == "create-pharmacy":
        create_pharmacy(args.pharmacy_id, args.name)
    elif args.command == "deactivate-pharmacy":
        deactivate_pharmacy(args.pharmacy_id)
    elif args.command == "grant-staff":
        grant_staff(args.user_id, args.pharmacy_id)
    elif args.command == "revoke-staff":
        revoke_staff(args.user_id, args.pharmacy_id)
    elif args.command == "list-memberships":
        list_memberships(args.pharmacy_id)


if __name__ == "__main__":
    main()
