from collections.abc import Callable
from datetime import datetime, timezone
import json
import sqlite3

from app.core.database import connect_database
from app.core.errors import AppError
from app.models.schemas import (
    BootstrapResponse,
    Claim,
    CreateEnquiryRequest,
    EnquiryRecord,
    Observation,
    ObservationRequest,
    Pharmacy,
    Product,
    ReportKind,
    RepositoryWriteResult,
    StaffPrincipal,
    Unit,
    validate_canonical_uuid,
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def read_bootstrap(database_path: str) -> BootstrapResponse:
    conn = connect_database(database_path)
    try:
        cur = conn.execute("SELECT id, name, strength, form, unit FROM products ORDER BY id")
        products = [
            Product(
                id=row["id"],
                name=row["name"],
                strength=row["strength"],
                form=row["form"],
                unit=Unit(row["unit"]),
            )
            for row in cur.fetchall()
        ]

        cur = conn.execute(
            """
            SELECT id, pharmacy_id, product_id, quantity, unit,
                   recorded_at, loaded_at, source, simulated
            FROM claims
            ORDER BY id
            """
        )
        claims = [
            Claim(
                id=row["id"],
                pharmacy_id=row["pharmacy_id"],
                product_id=row["product_id"],
                quantity=row["quantity"],
                unit=Unit(row["unit"]),
                recorded_at=row["recorded_at"],
                loaded_at=row["loaded_at"],
                source=row["source"],
                simulated=row["simulated"] == 1,
            )
            for row in cur.fetchall()
        ]

        pharmacy = Pharmacy(id="PHARM-A", name="Synthetic Demo Pharmacy")
        return BootstrapResponse(
            pharmacy=pharmacy,
            products=products,
            claims=claims,
            simulated=True,
        )
    finally:
        conn.close()


def create_enquiry(
    database_path: str,
    enquiry_id: str,
    request: CreateEnquiryRequest,
    clock: Callable[[], datetime] = utc_now,
) -> RepositoryWriteResult:
    try:
        canonical_id = validate_canonical_uuid(enquiry_id)
    except ValueError as exc:
        raise AppError(422, "validation_error", "Invalid enquiry UUID.", ["id"]) from exc

    conn = connect_database(database_path)
    try:
        conn.execute("BEGIN IMMEDIATE")

        # 1. Check for existing enquiry
        cur = conn.execute(
            """
            SELECT id, pharmacy_id, product_id, requested_quantity, unit,
                   created_at, product_snapshot_json, claim_snapshot_json
            FROM enquiries
            WHERE id = ?
            """,
            (canonical_id,),
        )
        existing = cur.fetchone()

        if existing is not None:
            # Check immutable fields match
            is_identical = (
                existing["pharmacy_id"] == request.pharmacy_id
                and existing["product_id"] == request.product_id
                and existing["requested_quantity"] == request.requested_quantity
                and existing["unit"] == request.unit.value
            )
            if is_identical:
                record = _decode_enquiry_row(existing)
                obs = _read_observation(conn, canonical_id)
                conn.commit()
                return RepositoryWriteResult(created=False, enquiry=record, observation=obs)
            else:
                conn.rollback()
                raise AppError(
                    status_code=409,
                    code="immutable_conflict",
                    message="An enquiry with this ID already exists with different request parameters.",
                    fields=["id"],
                )

        # 2. Validate against catalog
        if request.pharmacy_id != "PHARM-A":
            conn.rollback()
            raise AppError(
                status_code=422,
                code="validation_error",
                message=f"Unknown pharmacy: {request.pharmacy_id}",
                fields=["pharmacy_id"],
            )

        cur = conn.execute(
            "SELECT id, name, strength, form, unit FROM products WHERE id = ?",
            (request.product_id,),
        )
        prod_row = cur.fetchone()
        if prod_row is None:
            conn.rollback()
            raise AppError(
                status_code=422,
                code="validation_error",
                message=f"Unknown product: {request.product_id}",
                fields=["product_id"],
            )

        if prod_row["unit"] != request.unit.value:
            conn.rollback()
            raise AppError(
                status_code=422,
                code="validation_error",
                message="unit does not match the selected product.",
                fields=["unit"],
            )

        product_snapshot = Product(
            id=prod_row["id"],
            name=prod_row["name"],
            strength=prod_row["strength"],
            form=prod_row["form"],
            unit=Unit(prod_row["unit"]),
        )

        cur = conn.execute(
            """
            SELECT id, pharmacy_id, product_id, quantity, unit,
                   recorded_at, loaded_at, source, simulated
            FROM claims
            WHERE pharmacy_id = ? AND product_id = ?
            """,
            (request.pharmacy_id, request.product_id),
        )
        claim_row = cur.fetchone()
        if claim_row is not None:
            claim_snapshot = Claim(
                id=claim_row["id"],
                pharmacy_id=claim_row["pharmacy_id"],
                product_id=claim_row["product_id"],
                quantity=claim_row["quantity"],
                unit=Unit(claim_row["unit"]),
                recorded_at=claim_row["recorded_at"],
                loaded_at=claim_row["loaded_at"],
                source=claim_row["source"],
                simulated=claim_row["simulated"] == 1,
            )
        else:
            claim_snapshot = None

        created_at = clock().astimezone(timezone.utc)
        created_at_str = created_at.isoformat().replace("+00:00", "Z")

        conn.execute(
            """
            INSERT INTO enquiries (
                id, pharmacy_id, product_id, requested_quantity, unit,
                created_at, product_snapshot_json, claim_snapshot_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                canonical_id,
                request.pharmacy_id,
                request.product_id,
                request.requested_quantity,
                request.unit.value,
                created_at_str,
                product_snapshot.model_dump_json(),
                claim_snapshot.model_dump_json() if claim_snapshot else None,
            ),
        )
        conn.commit()

        record = EnquiryRecord(
            id=canonical_id,
            pharmacy_id=request.pharmacy_id,
            product=product_snapshot,
            requested_quantity=request.requested_quantity,
            unit=request.unit,
            created_at=created_at,
            claim=claim_snapshot,
            simulated=True,
        )
        return RepositoryWriteResult(created=True, enquiry=record, observation=None)
    except sqlite3.DatabaseError as e:
        conn.rollback()
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="Storage is unavailable.",
            fields=[],
        ) from e
    finally:
        conn.close()


def accept_observation(
    database_path: str,
    enquiry_id: str,
    request: ObservationRequest,
    principal: StaffPrincipal,
    clock: Callable[[], datetime] = utc_now,
) -> RepositoryWriteResult:
    try:
        canonical_id = validate_canonical_uuid(enquiry_id)
    except ValueError as exc:
        raise AppError(422, "validation_error", "Invalid enquiry UUID.", ["id"]) from exc

    conn = connect_database(database_path)
    try:
        conn.execute("BEGIN IMMEDIATE")

        # 1. Load enquiry
        cur = conn.execute(
            """
            SELECT id, pharmacy_id, product_id, requested_quantity, unit,
                   created_at, product_snapshot_json, claim_snapshot_json
            FROM enquiries
            WHERE id = ?
            """,
            (canonical_id,),
        )
        enquiry_row = cur.fetchone()
        if enquiry_row is None:
            conn.rollback()
            raise AppError(
                status_code=404,
                code="not_found",
                message="Enquiry not found.",
                fields=["id"],
            )

        # 2. Check pharmacy permission
        if principal.pharmacy_id != enquiry_row["pharmacy_id"]:
            conn.rollback()
            raise AppError(
                status_code=403,
                code="forbidden",
                message="Staff principal is not authorized for this pharmacy.",
                fields=[],
            )

        record = _decode_enquiry_row(enquiry_row)

        # 3. Check for existing observation
        cur = conn.execute(
            """
            SELECT enquiry_id, product_id, unit, kind, obtainable_quantity,
                   observed_at, unresolved_reason, staff_id, submitted_at,
                   basis, simulated
            FROM observations
            WHERE enquiry_id = ?
            """,
            (canonical_id,),
        )
        obs_row = cur.fetchone()

        if obs_row is not None:
            existing_obs = _decode_observation_row(obs_row)
            # Replay comparison on normalized ObservationRequest fields
            req_observed_at = request.observed_at.isoformat().replace("+00:00", "Z") if request.observed_at else None
            ex_observed_at = existing_obs.observed_at.isoformat().replace("+00:00", "Z") if existing_obs.observed_at else None

            is_identical = (
                existing_obs.product_id == request.product_id
                and existing_obs.unit == request.unit
                and existing_obs.kind == request.kind
                and existing_obs.obtainable_quantity == request.obtainable_quantity
                and ex_observed_at == req_observed_at
                and existing_obs.unresolved_reason == request.unresolved_reason
            )

            if is_identical:
                conn.commit()
                return RepositoryWriteResult(created=False, enquiry=record, observation=existing_obs)
            else:
                conn.rollback()
                raise AppError(
                    status_code=409,
                    code="immutable_conflict",
                    message="A different observation has already been recorded for this enquiry.",
                    fields=["observation"],
                )

        # 4. Validate observation matches enquiry
        if request.product_id != record.product.id or request.unit != record.unit:
            conn.rollback()
            fields = ["product_id"] if request.product_id != record.product.id else ["unit"]
            raise AppError(
                status_code=422,
                code="validation_error",
                message="Observation product or unit does not match enquiry.",
                fields=fields,
            )

        submitted_at = clock().astimezone(timezone.utc)
        if request.observed_at is not None and request.observed_at > submitted_at:
            conn.rollback()
            raise AppError(
                status_code=422,
                code="validation_error",
                message="Observation time cannot be in the future.",
                fields=["observed_at"],
            )

        basis = (
            "staff_reported_obtainable_count"
            if request.kind == ReportKind.checked
            else "unable_to_check"
        )
        observed_at_str = request.observed_at.isoformat().replace("+00:00", "Z") if request.observed_at else None
        submitted_at_str = submitted_at.isoformat().replace("+00:00", "Z")

        conn.execute(
            """
            INSERT INTO observations (
                enquiry_id, product_id, unit, kind, obtainable_quantity,
                observed_at, unresolved_reason, staff_id, submitted_at,
                basis, simulated
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            """,
            (
                canonical_id,
                request.product_id,
                request.unit.value,
                request.kind.value,
                request.obtainable_quantity,
                observed_at_str,
                request.unresolved_reason,
                principal.staff_id,
                submitted_at_str,
                basis,
            ),
        )
        conn.commit()

        new_obs = Observation(
            product_id=request.product_id,
            unit=request.unit,
            kind=request.kind,
            obtainable_quantity=request.obtainable_quantity,
            observed_at=request.observed_at,
            unresolved_reason=request.unresolved_reason,
            staff_id=principal.staff_id,
            submitted_at=submitted_at,
            basis=basis,
            simulated=True,
        )
        return RepositoryWriteResult(created=True, enquiry=record, observation=new_obs)
    except sqlite3.DatabaseError as e:
        conn.rollback()
        raise AppError(
            status_code=503,
            code="storage_unavailable",
            message="Storage is unavailable.",
            fields=[],
        ) from e
    finally:
        conn.close()


def read_enquiry(database_path: str, enquiry_id: str) -> tuple[EnquiryRecord, Observation | None]:
    try:
        canonical_id = validate_canonical_uuid(enquiry_id)
    except ValueError as exc:
        raise AppError(422, "validation_error", "Invalid enquiry UUID.", ["id"]) from exc

    conn = connect_database(database_path)
    try:
        cur = conn.execute(
            """
            SELECT id, pharmacy_id, product_id, requested_quantity, unit,
                   created_at, product_snapshot_json, claim_snapshot_json
            FROM enquiries
            WHERE id = ?
            """,
            (canonical_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise AppError(
                status_code=404,
                code="not_found",
                message="Enquiry not found.",
                fields=["id"],
            )

        record = _decode_enquiry_row(row)
        obs = _read_observation(conn, canonical_id)
        return record, obs
    finally:
        conn.close()


def list_pending(database_path: str, principal: StaffPrincipal) -> list[tuple[EnquiryRecord, Observation | None]]:
    conn = connect_database(database_path)
    try:
        cur = conn.execute(
            """
            SELECT e.id, e.pharmacy_id, e.product_id, e.requested_quantity, e.unit,
                   e.created_at, e.product_snapshot_json, e.claim_snapshot_json
            FROM enquiries e
            WHERE e.pharmacy_id = ?
              AND NOT EXISTS (
                  SELECT 1 FROM observations o WHERE o.enquiry_id = e.id
              )
            ORDER BY e.created_at ASC, e.id ASC
            """,
            (principal.pharmacy_id,),
        )
        rows = cur.fetchall()
        return [(_decode_enquiry_row(row), None) for row in rows]
    finally:
        conn.close()


def _read_observation(conn: sqlite3.Connection, enquiry_id: str) -> Observation | None:
    cur = conn.execute(
        """
        SELECT enquiry_id, product_id, unit, kind, obtainable_quantity,
               observed_at, unresolved_reason, staff_id, submitted_at,
               basis, simulated
        FROM observations
        WHERE enquiry_id = ?
        """,
        (enquiry_id,),
    )
    obs_row = cur.fetchone()
    if obs_row is None:
        return None
    return _decode_observation_row(obs_row)


def _decode_enquiry_row(row: sqlite3.Row) -> EnquiryRecord:
    try:
        product_dict = json.loads(row["product_snapshot_json"])
        product = Product.model_validate(product_dict)
        if product.id != row["product_id"]:
            raise ValueError("Snapshot identity disagrees with stored request.")

        claim = None
        if row["claim_snapshot_json"] is not None:
            claim_dict = json.loads(row["claim_snapshot_json"])
            claim = Claim.model_validate(claim_dict)

        return EnquiryRecord(
            id=row["id"],
            pharmacy_id=row["pharmacy_id"],
            product=product,
            requested_quantity=row["requested_quantity"],
            unit=Unit(row["unit"]),
            created_at=row["created_at"],
            claim=claim,
            simulated=True,
        )
    except Exception as e:
        raise AppError(
            status_code=500,
            code="internal_error",
            message="Stored enquiry data is malformed or unreadable.",
            fields=[],
        ) from e


def _decode_observation_row(row: sqlite3.Row) -> Observation:
    try:
        return Observation(
            product_id=row["product_id"],
            unit=Unit(row["unit"]),
            kind=ReportKind(row["kind"]),
            obtainable_quantity=row["obtainable_quantity"],
            observed_at=row["observed_at"],
            unresolved_reason=row["unresolved_reason"],
            staff_id=row["staff_id"],
            submitted_at=row["submitted_at"],
            basis=row["basis"],
            simulated=row["simulated"] == 1,
        )
    except Exception as e:
        raise AppError(
            status_code=500,
            code="internal_error",
            message="Stored observation data is malformed or unreadable.",
            fields=[],
        ) from e
