from collections.abc import Callable
from datetime import datetime, timezone
import json
import logging
from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.engine import Connection

from app.core.errors import AppError
from app.models.schemas_v2 import (
    AuthenticatedPrincipal,
    BootstrapResponseV2,
    Claim,
    CreateEnquiryRequest,
    EnquiryPage,
    EnquiryRecordV2,
    ObservationRequest,
    ObservationV2,
    Pharmacy,
    Product,
    ReportKind,
    RepositoryWriteResultV2,
    Unit,
    validate_canonical_uuid,
)
from app.services.evidence_v2 import build_view_v2

logger = logging.getLogger(__name__)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def read_bootstrap_v2(conn: Connection) -> BootstrapResponseV2:
    stmt_pharmacies = text("SELECT id, name, active, simulated FROM pharmacies WHERE active = TRUE ORDER BY id;")
    p_rows = conn.execute(stmt_pharmacies).fetchall()
    pharmacies = [
        Pharmacy(id=r[0], name=r[1], active=bool(r[2]), simulated=True)
        for r in p_rows
    ]

    stmt_products = text("SELECT id, name, strength, form, unit FROM products ORDER BY id;")
    prod_rows = conn.execute(stmt_products).fetchall()
    products = [
        Product(id=r[0], name=r[1], strength=r[2], form=r[3], unit=Unit(r[4]))
        for r in prod_rows
    ]

    stmt_claims = text("""
        SELECT id, pharmacy_id, product_id, quantity, unit, recorded_at, loaded_at, source, simulated
        FROM claims ORDER BY id;
    """)
    c_rows = conn.execute(stmt_claims).fetchall()
    claims = [
        Claim(
            id=r[0],
            pharmacy_id=r[1],
            product_id=r[2],
            quantity=r[3],
            unit=Unit(r[4]),
            recorded_at=r[5],
            loaded_at=r[6],
            source=r[7],
            simulated=True,
        )
        for r in c_rows
    ]

    return BootstrapResponseV2(
        pharmacies=pharmacies,
        products=products,
        claims=claims,
        simulated=True,
    )


def create_enquiry_v2(
    conn: Connection,
    enquiry_id: str,
    request: CreateEnquiryRequest,
    principal: AuthenticatedPrincipal,
    clock: Callable[[], datetime] = utc_now,
) -> RepositoryWriteResultV2:
    try:
        canonical_id = validate_canonical_uuid(enquiry_id)
    except ValueError as exc:
        raise AppError(422, "validation_error", "Invalid enquiry UUID.", ["id"]) from exc

    if not principal.active:
        raise AppError(403, "forbidden", "Account has been disabled.", [])

    # Check for existing enquiry
    lock_sql = "FOR UPDATE" if conn.dialect.name == "postgresql" else ""
    stmt_existing = text(f"""
        SELECT id, owner_user_id, pharmacy_id, product_id, requested_quantity, unit,
               created_at, product_snapshot_json, claim_snapshot_json
        FROM enquiries
        WHERE id = :id {lock_sql};
    """)
    existing_row = conn.execute(stmt_existing, {"id": canonical_id}).fetchone()

    if existing_row is not None:
        existing_owner_id = str(existing_row[1])
        # If enquiry exists under another owner, return 404 to hide its existence
        if existing_owner_id != str(principal.user_id):
            raise AppError(
                status_code=404,
                code="not_found",
                message="Enquiry not found.",
                fields=["id"],
            )

        # Same owner replay check
        is_identical = (
            existing_row[2] == request.pharmacy_id
            and existing_row[3] == request.product_id
            and existing_row[4] == request.requested_quantity
            and existing_row[5] == request.unit.value
        )
        if is_identical:
            record = _decode_enquiry_row_v2(existing_row)
            obs = _read_observation_v2(conn, canonical_id)
            return RepositoryWriteResultV2(created=False, enquiry=record, observation=obs)
        else:
            raise AppError(
                status_code=409,
                code="immutable_conflict",
                message="An enquiry with this ID already exists with different request parameters.",
                fields=["id"],
            )

    # Validate target pharmacy
    stmt_pharm = text("SELECT id, name, active FROM pharmacies WHERE id = :id AND active = TRUE;")
    pharm_row = conn.execute(stmt_pharm, {"id": request.pharmacy_id}).fetchone()
    if pharm_row is None:
        raise AppError(
            status_code=422,
            code="validation_error",
            message=f"Unknown or inactive pharmacy: {request.pharmacy_id}",
            fields=["pharmacy_id"],
        )

    # Validate product
    stmt_prod = text("SELECT id, name, strength, form, unit FROM products WHERE id = :id;")
    prod_row = conn.execute(stmt_prod, {"id": request.product_id}).fetchone()
    if prod_row is None:
        raise AppError(
            status_code=422,
            code="validation_error",
            message=f"Unknown product: {request.product_id}",
            fields=["product_id"],
        )

    if prod_row[4] != request.unit.value:
        raise AppError(
            status_code=422,
            code="validation_error",
            message="unit does not match the selected product.",
            fields=["unit"],
        )

    product_snapshot = Product(
        id=prod_row[0],
        name=prod_row[1],
        strength=prod_row[2],
        form=prod_row[3],
        unit=Unit(prod_row[4]),
    )

    # Snapshot claim if exists for this pharmacy & product
    stmt_claim = text("""
        SELECT id, pharmacy_id, product_id, quantity, unit, recorded_at, loaded_at, source, simulated
        FROM claims WHERE pharmacy_id = :pharmacy_id AND product_id = :product_id;
    """)
    claim_row = conn.execute(stmt_claim, {"pharmacy_id": request.pharmacy_id, "product_id": request.product_id}).fetchone()
    if claim_row is not None:
        claim_snapshot = Claim(
            id=claim_row[0],
            pharmacy_id=claim_row[1],
            product_id=claim_row[2],
            quantity=claim_row[3],
            unit=Unit(claim_row[4]),
            recorded_at=claim_row[5],
            loaded_at=claim_row[6],
            source=claim_row[7],
            simulated=True,
        )
    else:
        claim_snapshot = None

    created_at = clock().astimezone(timezone.utc)
    created_at_str = created_at.isoformat().replace("+00:00", "Z")

    stmt_insert = text("""
        INSERT INTO enquiries (
            id, owner_user_id, pharmacy_id, product_id, requested_quantity, unit,
            created_at, product_snapshot_json, claim_snapshot_json
        ) VALUES (
            :id, :owner_user_id, :pharmacy_id, :product_id, :requested_quantity, :unit,
            :created_at, :product_snapshot_json, :claim_snapshot_json
        );
    """)
    conn.execute(
        stmt_insert,
        {
            "id": canonical_id,
            "owner_user_id": str(principal.user_id),
            "pharmacy_id": request.pharmacy_id,
            "product_id": request.product_id,
            "requested_quantity": request.requested_quantity,
            "unit": request.unit.value,
            "created_at": created_at_str,
            "product_snapshot_json": product_snapshot.model_dump_json(),
            "claim_snapshot_json": claim_snapshot.model_dump_json() if claim_snapshot else None,
        },
    )

    record = EnquiryRecordV2(
        id=UUID(canonical_id),
        owner_user_id=principal.user_id,
        pharmacy_id=request.pharmacy_id,
        product=product_snapshot,
        requested_quantity=request.requested_quantity,
        unit=request.unit,
        created_at=created_at,
        claim=claim_snapshot,
        simulated=True,
    )
    return RepositoryWriteResultV2(created=True, enquiry=record, observation=None)


def read_enquiry_v2(
    conn: Connection,
    enquiry_id: str,
    principal: AuthenticatedPrincipal,
) -> tuple[EnquiryRecordV2, ObservationV2 | None]:
    try:
        canonical_id = validate_canonical_uuid(enquiry_id)
    except ValueError as exc:
        raise AppError(422, "validation_error", "Invalid enquiry UUID.", ["id"]) from exc

    if not principal.active:
        raise AppError(403, "forbidden", "Account has been disabled.", [])

    stmt = text("""
        SELECT id, owner_user_id, pharmacy_id, product_id, requested_quantity, unit,
               created_at, product_snapshot_json, claim_snapshot_json
        FROM enquiries
        WHERE id = :id;
    """)
    row = conn.execute(stmt, {"id": canonical_id}).fetchone()
    if row is None:
        raise AppError(404, "not_found", "Enquiry not found.", ["id"])

    # Authorization check
    is_owner = str(row[1]) == str(principal.user_id)
    is_pharm_staff = principal.is_member_of(str(row[2]))

    if not (is_owner or is_pharm_staff):
        # Hidden 404 to avoid revealing enquiry existence
        raise AppError(404, "not_found", "Enquiry not found.", ["id"])

    record = _decode_enquiry_row_v2(row)
    obs = _read_observation_v2(conn, canonical_id)
    return record, obs


def list_own_enquiries_v2(
    conn: Connection,
    principal: AuthenticatedPrincipal,
    limit: int = 20,
    offset: int = 0,
    clock: Callable[[], datetime] = utc_now,
) -> EnquiryPage:
    if not principal.active:
        raise AppError(403, "forbidden", "Account has been disabled.", [])

    if limit < 1 or limit > 100:
        raise AppError(422, "validation_error", "limit must be between 1 and 100.", ["limit"])
    if offset < 0 or offset > 1000:
        raise AppError(422, "validation_error", "offset must be between 0 and 1000.", ["offset"])

    # Query limit + 1 to determine has_more
    fetch_count = limit + 1
    stmt = text("""
        SELECT id, owner_user_id, pharmacy_id, product_id, requested_quantity, unit,
               created_at, product_snapshot_json, claim_snapshot_json
        FROM enquiries
        WHERE owner_user_id = :user_id
        ORDER BY created_at DESC, id DESC
        LIMIT :fetch_count OFFSET :offset;
    """)
    rows = conn.execute(stmt, {"user_id": str(principal.user_id), "fetch_count": fetch_count, "offset": offset}).fetchall()

    has_more = len(rows) > limit
    page_rows = rows[:limit]
    served_at = clock().astimezone(timezone.utc)

    items = []
    for r in page_rows:
        rec = _decode_enquiry_row_v2(r)
        obs = _read_observation_v2(conn, str(rec.id))
        items.append(build_view_v2(rec, obs, served_at))

    return EnquiryPage(items=items, limit=limit, offset=offset, has_more=has_more)


def list_pending_v2(
    conn: Connection,
    principal: AuthenticatedPrincipal,
    pharmacy_id: str,
    limit: int = 20,
    offset: int = 0,
    clock: Callable[[], datetime] = utc_now,
) -> EnquiryPage:
    if not principal.active:
        raise AppError(403, "forbidden", "Account has been disabled.", [])

    if not principal.is_member_of(pharmacy_id):
        raise AppError(
            status_code=403,
            code="forbidden",
            message="Caller is not an active staff member of this pharmacy.",
            fields=["pharmacy_id"],
        )

    if limit < 1 or limit > 100:
        raise AppError(422, "validation_error", "limit must be between 1 and 100.", ["limit"])
    if offset < 0 or offset > 1000:
        raise AppError(422, "validation_error", "offset must be between 0 and 1000.", ["offset"])

    fetch_count = limit + 1
    stmt = text("""
        SELECT e.id, e.owner_user_id, e.pharmacy_id, e.product_id, e.requested_quantity, e.unit,
               e.created_at, e.product_snapshot_json, e.claim_snapshot_json
        FROM enquiries e
        WHERE e.pharmacy_id = :pharmacy_id
          AND NOT EXISTS (
              SELECT 1 FROM observations o WHERE o.enquiry_id = e.id
          )
        ORDER BY e.created_at ASC, e.id ASC
        LIMIT :fetch_count OFFSET :offset;
    """)
    rows = conn.execute(stmt, {"pharmacy_id": pharmacy_id, "fetch_count": fetch_count, "offset": offset}).fetchall()

    has_more = len(rows) > limit
    page_rows = rows[:limit]
    served_at = clock().astimezone(timezone.utc)

    items = [build_view_v2(_decode_enquiry_row_v2(r), None, served_at) for r in page_rows]
    return EnquiryPage(items=items, limit=limit, offset=offset, has_more=has_more)


def accept_observation_v2(
    conn: Connection,
    enquiry_id: str,
    request: ObservationRequest,
    principal: AuthenticatedPrincipal,
    clock: Callable[[], datetime] = utc_now,
) -> RepositoryWriteResultV2:
    try:
        canonical_id = validate_canonical_uuid(enquiry_id)
    except ValueError as exc:
        raise AppError(422, "validation_error", "Invalid enquiry UUID.", ["id"]) from exc

    if not principal.active:
        raise AppError(403, "forbidden", "Account has been disabled.", [])

    # 1. Lock enquiry row
    lock_sql = "FOR UPDATE" if conn.dialect.name == "postgresql" else ""
    stmt_enquiry = text(f"""
        SELECT id, owner_user_id, pharmacy_id, product_id, requested_quantity, unit,
               created_at, product_snapshot_json, claim_snapshot_json
        FROM enquiries
        WHERE id = :id {lock_sql};
    """)
    enquiry_row = conn.execute(stmt_enquiry, {"id": canonical_id}).fetchone()
    if enquiry_row is None:
        raise AppError(404, "not_found", "Enquiry not found.", ["id"])

    # 2. Check pharmacy membership
    if not principal.is_member_of(str(enquiry_row[2])):
        raise AppError(
            status_code=403,
            code="forbidden",
            message="Caller is not an active staff member of this pharmacy.",
            fields=["pharmacy_id"],
        )

    record = _decode_enquiry_row_v2(enquiry_row)

    # 3. Check for existing observation
    stmt_obs = text(f"""
        SELECT enquiry_id, product_id, unit, kind, obtainable_quantity,
               observed_at, unresolved_reason, reported_by_user_id, submitted_at,
               basis, simulated
        FROM observations
        WHERE enquiry_id = :enquiry_id {lock_sql};
    """)
    obs_row = conn.execute(stmt_obs, {"enquiry_id": canonical_id}).fetchone()

    if obs_row is not None:
        existing_obs = _decode_observation_row_v2(obs_row)

        # Check reporter identity
        if str(existing_obs.reported_by_user_id) != str(principal.user_id):
            raise AppError(
                status_code=409,
                code="immutable_conflict",
                message="A different observation has already been recorded for this enquiry.",
                fields=["observation"],
            )

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
            return RepositoryWriteResultV2(created=False, enquiry=record, observation=existing_obs)
        else:
            raise AppError(
                status_code=409,
                code="immutable_conflict",
                message="A different observation has already been recorded for this enquiry.",
                fields=["observation"],
            )

    # 4. Validate observation matches enquiry
    if request.product_id != record.product.id or request.unit != record.unit:
        fields = ["product_id"] if request.product_id != record.product.id else ["unit"]
        raise AppError(
            status_code=422,
            code="validation_error",
            message="Observation product or unit does not match enquiry.",
            fields=fields,
        )

    submitted_at = clock().astimezone(timezone.utc)
    submitted_at_str = submitted_at.isoformat().replace("+00:00", "Z")
    observed_at_str = (
        request.observed_at.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        if request.observed_at is not None
        else None
    )

    if request.observed_at is not None and request.observed_at > submitted_at:
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

    stmt_insert_obs = text("""
        INSERT INTO observations (
            enquiry_id, product_id, unit, kind, obtainable_quantity,
            observed_at, unresolved_reason, reported_by_user_id, submitted_at,
            basis, simulated
        ) VALUES (
            :enquiry_id, :product_id, :unit, :kind, :obtainable_quantity,
            :observed_at, :unresolved_reason, :reported_by_user_id, :submitted_at,
            :basis, TRUE
        );
    """)
    conn.execute(
        stmt_insert_obs,
        {
            "enquiry_id": canonical_id,
            "product_id": request.product_id,
            "unit": request.unit.value,
            "kind": request.kind.value,
            "obtainable_quantity": request.obtainable_quantity,
            "observed_at": observed_at_str,
            "unresolved_reason": request.unresolved_reason,
            "reported_by_user_id": str(principal.user_id),
            "submitted_at": submitted_at_str,
            "basis": basis,
        },
    )

    new_obs = ObservationV2(
        product_id=request.product_id,
        unit=request.unit,
        kind=request.kind,
        obtainable_quantity=request.obtainable_quantity,
        observed_at=request.observed_at,
        unresolved_reason=request.unresolved_reason,
        reported_by_user_id=principal.user_id,
        submitted_at=submitted_at,
        basis=basis,
        simulated=True,
    )
    return RepositoryWriteResultV2(created=True, enquiry=record, observation=new_obs)


def _read_observation_v2(conn: Connection, enquiry_id: str) -> ObservationV2 | None:
    stmt = text("""
        SELECT enquiry_id, product_id, unit, kind, obtainable_quantity,
               observed_at, unresolved_reason, reported_by_user_id, submitted_at,
               basis, simulated
        FROM observations
        WHERE enquiry_id = :enquiry_id;
    """)
    row = conn.execute(stmt, {"enquiry_id": enquiry_id}).fetchone()
    if row is None:
        return None
    return _decode_observation_row_v2(row)


def _decode_enquiry_row_v2(row: Any) -> EnquiryRecordV2:
    try:
        product_dict = json.loads(row[7])
        product = Product.model_validate(product_dict)
        if product.id != row[3]:
            raise ValueError("Snapshot identity disagrees with stored request.")

        claim = None
        if row[8] is not None:
            claim_dict = json.loads(row[8])
            claim = Claim.model_validate(claim_dict)

        raw_id = row[0]
        raw_owner_id = row[1]
        enquiry_uuid = UUID(str(raw_id)) if not isinstance(raw_id, UUID) else raw_id
        owner_uuid = UUID(str(raw_owner_id)) if not isinstance(raw_owner_id, UUID) else raw_owner_id

        raw_created = row[6]
        if isinstance(raw_created, str) and " " in raw_created:
            raw_created = raw_created.replace(" ", "T", 1)

        return EnquiryRecordV2(
            id=enquiry_uuid,
            owner_user_id=owner_uuid,
            pharmacy_id=row[2],
            product=product,
            requested_quantity=row[4],
            unit=Unit(row[5]),
            created_at=raw_created,
            claim=claim,
            simulated=True,
        )
    except Exception as e:
        logger.error("Stored enquiry row malformed: %s", e)
        raise AppError(
            status_code=500,
            code="internal_error",
            message="Stored enquiry data is malformed or unreadable.",
            fields=[],
        ) from e


def _decode_observation_row_v2(row: Any) -> ObservationV2:
    try:
        raw_reported_by = row[7]
        reported_by_uuid = UUID(str(raw_reported_by)) if not isinstance(raw_reported_by, UUID) else raw_reported_by

        raw_observed = row[5]
        if isinstance(raw_observed, str) and " " in raw_observed:
            raw_observed = raw_observed.replace(" ", "T", 1)

        raw_submitted = row[8]
        if isinstance(raw_submitted, str) and " " in raw_submitted:
            raw_submitted = raw_submitted.replace(" ", "T", 1)

        return ObservationV2(
            product_id=row[1],
            unit=Unit(row[2]),
            kind=ReportKind(row[3]),
            obtainable_quantity=row[4],
            observed_at=raw_observed,
            unresolved_reason=row[6],
            reported_by_user_id=reported_by_uuid,
            submitted_at=raw_submitted,
            basis=row[9],
            simulated=True,
        )
    except Exception as e:
        logger.error("Stored observation row malformed: %s", e)
        raise AppError(
            status_code=500,
            code="internal_error",
            message="Stored observation data is malformed or unreadable.",
            fields=[],
        ) from e
