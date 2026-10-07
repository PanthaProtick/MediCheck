from datetime import datetime, timezone
import re
from enum import Enum
from typing import Annotated, Literal
from uuid import UUID
from pydantic import (
    AwareDatetime, BaseModel, ConfigDict, Field,
    StringConstraints, field_validator, model_validator,
)

CANONICAL_UUID_PATTERN = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"

def validate_canonical_uuid(value: str | UUID) -> str:
    if isinstance(value, UUID):
        return str(value).lower()
    if not isinstance(value, str) or re.fullmatch(CANONICAL_UUID_PATTERN, value) is None:
        raise ValueError("id must be a canonical lowercase UUID string")
    return value

Id = Annotated[str, StringConstraints(
    strict=True, pattern=r"^[A-Z][A-Z0-9-]{0,63}$"
)]
Text = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=500)]
RequestedQty = Annotated[int, Field(strict=True, ge=1, le=10000)]
ObservedQty = Annotated[int, Field(strict=True, ge=0, le=10000)]
SignedQty = Annotated[int, Field(strict=True, ge=-10000, le=10000)]

class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def wire_primitives(cls, value, info):
        time_fields = {
            "recorded_at", "loaded_at", "observed_at",
            "submitted_at", "created_at", "served_at",
        }
        if info.field_name in time_fields and value is not None:
            # Server-side Python construction may use datetime objects.
            # JSON cannot contain datetime objects; wire inputs must be strings.
            if not isinstance(value, datetime):
                pattern = (r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
                           r"(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})")
                if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
                    raise ValueError("timestamp must be an ISO string with seconds/timezone")
        if info.field_name == "simulated" and value is not True:
            raise ValueError("simulated must be literal true")
        return value

    @field_validator("*", mode="after")
    @classmethod
    def normalize_times(cls, value, info):
        if isinstance(value, datetime):
            try:
                return value.astimezone(timezone.utc)
            except (OverflowError, ValueError) as exc:
                raise ValueError("timestamp cannot be represented in UTC") from exc
        return value

class Unit(str, Enum):
    tablet = "tablet"
    capsule = "capsule"

class Status(str, Enum):
    pending = "pending"
    answered = "answered"
    unresolved = "unresolved"

class Conclusion(str, Enum):
    sufficient = "sufficient"
    insufficient = "insufficient"
    unresolved = "unresolved"

class Reason(str, Enum):
    awaiting_check = "awaiting_check"
    checked_meets_request = "checked_meets_request"
    checked_below_request = "checked_below_request"
    cannot_check = "cannot_check"
    observation_time_unknown = "observation_time_unknown"
    evidence_conflict = "evidence_conflict"

class ReportKind(str, Enum):
    checked = "checked"
    unable_to_check = "unable_to_check"

class Pharmacy(WireModel):
    id: Id
    name: Text

class Product(WireModel):
    id: Id
    name: Text
    strength: Text
    form: Text
    unit: Unit

class Claim(WireModel):
    id: Id
    pharmacy_id: Id
    product_id: Id
    quantity: ObservedQty | None
    unit: Unit
    recorded_at: AwareDatetime | None
    loaded_at: AwareDatetime
    source: Text
    simulated: Literal[True]

class BootstrapResponse(WireModel):
    pharmacy: Pharmacy
    products: list[Product]
    claims: list[Claim]
    simulated: Literal[True]

class CreateEnquiryRequest(WireModel):
    pharmacy_id: Id
    product_id: Id
    requested_quantity: RequestedQty
    unit: Unit

class ObservationRequest(WireModel):
    product_id: Id
    unit: Unit
    kind: ReportKind
    obtainable_quantity: ObservedQty | None
    observed_at: AwareDatetime | None
    unresolved_reason: Literal["cannot_check"] | None

    @field_validator("observed_at")
    @classmethod
    def utc_time(cls, value):
        return value.astimezone(timezone.utc) if value is not None else None

    @model_validator(mode="after")
    def coherent_report(self):
        if self.kind == ReportKind.checked:
            if self.obtainable_quantity is None or self.unresolved_reason is not None:
                raise ValueError("checked requires count and null unresolved_reason")
        else:
            if (self.obtainable_quantity is not None or self.observed_at is not None
                    or self.unresolved_reason != "cannot_check"):
                raise ValueError("unable_to_check requires null count/time and cannot_check")
        return self

class Observation(ObservationRequest):
    staff_id: Id
    submitted_at: AwareDatetime
    basis: Literal["staff_reported_obtainable_count", "unable_to_check"]
    simulated: Literal[True]

    @model_validator(mode="after")
    def matching_basis(self):
        expected = ("staff_reported_obtainable_count"
                    if self.kind == ReportKind.checked else "unable_to_check")
        if self.basis != expected:
            raise ValueError("basis does not match report kind")
        return self

class Answer(WireModel):
    conclusion: Conclusion
    reason: Reason
    discrepancy_units: SignedQty | None
    message: Text
    limitations: list[Text]

class EnquiryRecord(WireModel):
    id: UUID
    pharmacy_id: Id
    product: Product
    requested_quantity: RequestedQty
    unit: Unit
    created_at: AwareDatetime
    claim: Claim | None
    simulated: Literal[True]

    @field_validator("id", mode="before")
    @classmethod
    def canonical_uuid(cls, value):
        if isinstance(value, UUID):  # Internal Python construction only.
            return value
        pattern = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
        if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
            raise ValueError("id must be a canonical lowercase UUID string")
        return value

class EnquiryView(EnquiryRecord):
    served_at: AwareDatetime
    observation: Observation | None
    status: Status
    answer: Answer

class ErrorDetail(WireModel):
    code: Literal[
        "validation_error", "unauthorized", "forbidden", "not_found",
        "immutable_conflict", "storage_unavailable", "internal_error",
        "method_not_allowed", "unsupported_media_type"
    ]
    message: Text
    fields: list[Text]

class ErrorResponse(WireModel):
    error: ErrorDetail

class HealthResponse(WireModel):
    status: Literal["ready"]
    storage: Literal["sqlite"]

class StaffPrincipal(WireModel):
    staff_id: Id
    pharmacy_id: Id
    simulated: Literal[True]

class EvaluationInput(WireModel):
    enquiry: EnquiryRecord
    observation: Observation | None

class EvaluationResult(WireModel):
    status: Status
    answer: Answer

class RepositoryWriteResult(WireModel):
    created: Annotated[bool, Field(strict=True)]
    enquiry: EnquiryRecord
    observation: Observation | None
