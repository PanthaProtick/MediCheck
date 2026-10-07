import json
from pathlib import Path
import sqlite3
from typing import Any

from app.core.errors import AppError
from app.models.schemas import BootstrapResponse

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
