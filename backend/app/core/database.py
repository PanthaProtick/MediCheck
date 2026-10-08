import json
from pathlib import Path
import sqlite3
from typing import Any

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import AppError
from app.models.schemas import BootstrapResponse
from app.models.schemas_v2 import BootstrapResponseV2

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    strength TEXT NOT NULL,
    form TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule'))
);

CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    quantity INTEGER NULL CHECK (quantity IS NULL OR (typeof(quantity) = 'integer' AND quantity >= 0 AND quantity <= 10000)),
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule')),
    recorded_at TEXT NULL,
    loaded_at TEXT NOT NULL,
    source TEXT NOT NULL,
    simulated INTEGER NOT NULL CHECK (simulated = 1),
    UNIQUE (pharmacy_id, product_id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    pharmacy_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    requested_quantity INTEGER NOT NULL CHECK (typeof(requested_quantity) = 'integer' AND requested_quantity >= 1 AND requested_quantity <= 10000),
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule')),
    created_at TEXT NOT NULL,
    product_snapshot_json TEXT NOT NULL,
    claim_snapshot_json TEXT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS observations (
    enquiry_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    unit TEXT NOT NULL CHECK (unit IN ('tablet', 'capsule')),
    kind TEXT NOT NULL CHECK (kind IN ('checked', 'unable_to_check')),
    obtainable_quantity INTEGER NULL CHECK (obtainable_quantity IS NULL OR (typeof(obtainable_quantity) = 'integer' AND obtainable_quantity >= 0 AND obtainable_quantity <= 10000)),
    observed_at TEXT NULL,
    unresolved_reason TEXT NULL CHECK (unresolved_reason IS NULL OR unresolved_reason = 'cannot_check'),
    staff_id TEXT NOT NULL,
    submitted_at TEXT NOT NULL,
    basis TEXT NOT NULL CHECK (basis IN ('staff_reported_obtainable_count', 'unable_to_check')),
    simulated INTEGER NOT NULL CHECK (simulated = 1),
    CHECK ((kind = 'checked' AND obtainable_quantity IS NOT NULL AND unresolved_reason IS NULL) OR (kind = 'unable_to_check' AND obtainable_quantity IS NULL AND observed_at IS NULL AND unresolved_reason IS 'cannot_check')),
    CHECK ((kind = 'checked' AND basis = 'staff_reported_obtainable_count') OR (kind = 'unable_to_check' AND basis = 'unable_to_check')),
    FOREIGN KEY (enquiry_id) REFERENCES enquiries(id)
);
"""


def connect_database(database_path: str) -> sqlite3.Connection:
    conn = None
    try:
        conn = sqlite3.connect(database_path, timeout=2.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA busy_timeout = 2000;")
        return conn
    except sqlite3.DatabaseError as e:
        if conn is not None:
            conn.close()
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="Storage is unavailable.",
            fields=[],
        ) from e


def initialize_database(database_path: str, bootstrap_data: dict[str, Any] | None = None) -> None:
    db_file = Path(database_path).resolve()
    db_file.parent.mkdir(parents=True, exist_ok=True)

    conn = connect_database(str(db_file))
    try:
        conn.executescript(SCHEMA_SQL)

        for table, column, minimum in (
            ('claims', 'quantity', 0), ('enquiries', 'requested_quantity', 1),
            ('observations', 'obtainable_quantity', 0),
        ):
            for event in ('INSERT', 'UPDATE'):
                conn.execute(f"""CREATE TRIGGER IF NOT EXISTS {table}_{column}_{event.lower()}_integer
                    BEFORE {event} ON {table}
                    WHEN NEW.{column} IS NOT NULL AND
                        (typeof(NEW.{column}) != 'integer' OR NEW.{column} < {minimum} OR NEW.{column} > 10000)
                    BEGIN SELECT RAISE(ABORT, 'Invalid whole-unit quantity'); END""")

        for event in ('INSERT', 'UPDATE'):
            conn.execute(f"""CREATE TRIGGER IF NOT EXISTS observations_{event.lower()}_coherence
                BEFORE {event} ON observations
                WHEN NOT (CASE
                    WHEN NEW.kind = 'checked' AND NEW.obtainable_quantity IS NOT NULL
                        AND NEW.unresolved_reason IS NULL AND NEW.basis = 'staff_reported_obtainable_count' THEN 1
                    WHEN NEW.kind = 'unable_to_check' AND NEW.obtainable_quantity IS NULL
                        AND NEW.observed_at IS NULL AND NEW.unresolved_reason IS 'cannot_check'
                        AND NEW.basis = 'unable_to_check' THEN 1
                    ELSE 0 END)
                BEGIN SELECT RAISE(ABORT, 'Invalid observation coherence'); END""")

        # Seed data if provided or if default bootstrap fixture is available
        if bootstrap_data is None:
            default_fixture = Path(__file__).resolve().parent.parent / "fixtures" / "bootstrap.json"
            if default_fixture.exists():
                with open(default_fixture, "r", encoding="utf-8") as f:
                    bootstrap_data = json.load(f)

        if bootstrap_data:
            validated_boot = BootstrapResponse.model_validate(bootstrap_data)

            # Insert products
            for prod in validated_boot.products:
                conn.execute(
                    """
                    INSERT OR IGNORE INTO products (id, name, strength, form, unit)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (prod.id, prod.name, prod.strength, prod.form, prod.unit.value),
                )

            # Insert claims
            for claim in validated_boot.claims:
                rec_at = claim.recorded_at.isoformat().replace("+00:00", "Z") if claim.recorded_at else None
                load_at = claim.loaded_at.isoformat().replace("+00:00", "Z")
                conn.execute(
                    """
                    INSERT OR IGNORE INTO claims (
                        id, pharmacy_id, product_id, quantity, unit,
                        recorded_at, loaded_at, source, simulated
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    (
                        claim.id,
                        claim.pharmacy_id,
                        claim.product_id,
                        claim.quantity,
                        claim.unit.value,
                        rec_at,
                        load_at,
                        claim.source,
                    ),
                )
        conn.commit()
    finally:
        conn.close()


def check_readiness(database_path: str) -> None:
    db_file = Path(database_path)
    if not db_file.exists():
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="Database file does not exist.",
            fields=[],
        )

    try:
        conn = connect_database(str(db_file))
        try:
            required = {
                'products': 'id, name, strength, form, unit',
                'claims': 'id, pharmacy_id, product_id, quantity, unit, recorded_at, loaded_at, source, simulated',
                'enquiries': 'id, pharmacy_id, product_id, requested_quantity, unit, created_at, product_snapshot_json, claim_snapshot_json',
                'observations': 'enquiry_id, product_id, unit, kind, obtainable_quantity, observed_at, unresolved_reason, staff_id, submitted_at, basis, simulated',
            }
            for table, columns in required.items():
                conn.execute(f"SELECT {columns} FROM {table} LIMIT 1").fetchone()
        finally:
            conn.close()
    except Exception as e:
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="Database readiness check failed.",
            fields=[],
        ) from e


def create_pg_engine(
    database_url: str,
    pool_size: int = 5,
    max_overflow: int = 0,
    pool_timeout: float = 2.0,
) -> Engine:
    if not database_url:
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="DATABASE_URL is not configured.",
            fields=[],
        )
    return create_engine(
        database_url,
        pool_size=pool_size,
        max_overflow=max_overflow,
        pool_timeout=pool_timeout,
        pool_pre_ping=True,
    )


def apply_pg_migrations(engine: Engine) -> None:
    if engine.dialect.name != "postgresql":
        raise RuntimeError("Hosted migrations require PostgreSQL.")
    directory = Path(__file__).resolve().parent.parent.parent / "migrations"
    try:
        with engine.begin() as conn:
            # Serialize deployment migration jobs without a shared filesystem.
            conn.execute(text("SELECT pg_advisory_xact_lock(71609241);"))
            conn.execute(text("""CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );"""))
            for name in ("001_multi_user", "002_observation_coherence"):
                exists = conn.execute(text(
                    "SELECT version FROM schema_migrations WHERE version = :version"
                ), {"version": name}).fetchone()
                if exists:
                    continue
                for stmt in (directory / (name + ".sql")).read_text().split(";"):
                    if stmt.strip():
                        conn.execute(text(stmt))
                conn.execute(text(
                    "INSERT INTO schema_migrations (version, applied_at) VALUES (:version, NOW())"
                ), {"version": name})
    except SQLAlchemyError as exc:
        raise AppError(503, "storage_unavailable", "Failed to apply database migrations.", []) from exc


def seed_pg_database(engine: Engine, bootstrap_data: dict[str, Any] | None = None) -> None:
    if bootstrap_data is None:
        fixture_path = Path(__file__).resolve().parent.parent / "fixtures" / "bootstrap_v2.json"
        if fixture_path.exists():
            with open(fixture_path, "r", encoding="utf-8") as f:
                bootstrap_data = json.load(f)

    if not bootstrap_data:
        return

    validated = BootstrapResponseV2.model_validate(bootstrap_data)

    try:
        with engine.connect() as conn:
            with conn.begin():
                for pharm in validated.pharmacies:
                    conn.execute(
                        text(
                            """
                            INSERT INTO pharmacies (id, name, active, simulated)
                            VALUES (:id, :name, :active, TRUE)
                            ON CONFLICT (id) DO NOTHING;
                            """
                        ),
                        {"id": pharm.id, "name": pharm.name, "active": pharm.active},
                    )

                for prod in validated.products:
                    conn.execute(
                        text(
                            """
                            INSERT INTO products (id, name, strength, form, unit)
                            VALUES (:id, :name, :strength, :form, :unit)
                            ON CONFLICT (id) DO NOTHING;
                            """
                        ),
                        {
                            "id": prod.id,
                            "name": prod.name,
                            "strength": prod.strength,
                            "form": prod.form,
                            "unit": prod.unit.value,
                        },
                    )

                for claim in validated.claims:
                    conn.execute(
                        text(
                            """
                            INSERT INTO claims (
                                id, pharmacy_id, product_id, quantity, unit,
                                recorded_at, loaded_at, source, simulated
                            ) VALUES (
                                :id, :pharmacy_id, :product_id, :quantity, :unit,
                                :recorded_at, :loaded_at, :source, TRUE
                            )
                            ON CONFLICT (pharmacy_id, product_id) DO NOTHING;
                            """
                        ),
                        {
                            "id": claim.id,
                            "pharmacy_id": claim.pharmacy_id,
                            "product_id": claim.product_id,
                            "quantity": claim.quantity,
                            "unit": claim.unit.value,
                            "recorded_at": claim.recorded_at,
                            "loaded_at": claim.loaded_at,
                            "source": claim.source,
                        },
                    )
    except SQLAlchemyError as exc:
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="Failed to seed database.",
            fields=[],
        ) from exc


def check_pg_readiness(engine: Engine) -> None:
    try:
        with engine.connect() as conn:
            row = conn.execute(
                text("SELECT version FROM schema_migrations WHERE version = '001_multi_user';")
            ).fetchone()
            if row is None:
                raise AppError(
                    status_code=503,
                    code="storage_unavailable",
                    message="Database schema migration 001_multi_user is not applied.",
                    fields=[],
                )
            if engine.dialect.name == "postgresql":
                hardened = conn.execute(text(
                    "SELECT version FROM schema_migrations WHERE version = '002_observation_coherence';"
                )).fetchone()
                if hardened is None:
                    raise AppError(503, "storage_unavailable", "Database migrations are incomplete.", [])
            required_columns = {
                "users": "id, auth_subject, active, created_at",
                "pharmacies": "id, name, active, simulated",
                "pharmacy_memberships": "user_id, pharmacy_id, role, active, created_at",
                "products": "id, name, strength, form, unit",
                "claims": "id, pharmacy_id, product_id, quantity, unit, recorded_at, loaded_at, source, simulated",
                "enquiries": "id, owner_user_id, pharmacy_id, product_id, requested_quantity, unit, created_at, product_snapshot_json, claim_snapshot_json",
                "observations": "enquiry_id, product_id, unit, kind, obtainable_quantity, observed_at, unresolved_reason, reported_by_user_id, submitted_at, basis, simulated",
            }
            for table, columns in required_columns.items():
                conn.execute(text(f"SELECT {columns} FROM {table} LIMIT 0"))
            required = [
                "users",
                "pharmacies",
                "pharmacy_memberships",
                "products",
                "claims",
                "enquiries",
                "observations",
            ]
            for tbl in required:
                conn.execute(text(f"SELECT 1 FROM {tbl} LIMIT 1;"))
    except AppError:
        raise
    except Exception as exc:
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="Database readiness check failed.",
            fields=[],
        ) from exc

