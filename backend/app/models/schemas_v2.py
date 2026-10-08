from datetime import datetime, timezone
from enum import Enum
import re
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
PageLimit = Annotated[int, Field(strict=True, ge=1, le=100)]
PageOffset = Annotated[int, Field(strict=True, ge=0, le=1000)]

class WireModelV2(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def wire_primitives(cls, value, info):
        time_fields = {
            "recorded_at", "loaded_at", "observed_at",
            "submitted_at", "created_at", "served_at",
        }
        if info.field_name in time_fields and value is not None:
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

class ReportKind(str, Enum):
    checked = "checked"
    unable_to_check = "unable_to_check"

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

class Role(str, Enum):
    staff = "staff"

class StorageType(str, Enum):
    postgresql = "postgresql"

class Pharmacy(WireModelV2):
    id: Id
    name: Text
    active: bool = True
    simulated: Literal[True] = True

class PharmacyMembership(WireModelV2):
    pharmacy_id: Id
    role: Literal["staff"] = "staff"
    active: bool = True
    created_at: AwareDatetime

class MeResponse(WireModelV2):
    user_id: UUID
    auth_subject: Text
    active: bool = True
    memberships: list[PharmacyMembership] = Field(default_factory=list)

class Product(WireModelV2):
    id: Id
    name: Text
    strength: Text
    form: Text
    unit: Unit

class Claim(WireModelV2):
    id: Id
    pharmacy_id: Id
    product_id: Id
    quantity: ObservedQty | None
    unit: Unit
    recorded_at: AwareDatetime | None
    loaded_at: AwareDatetime
    source: Text
    simulated: Literal[True] = True

class BootstrapResponseV2(WireModelV2):
    pharmacies: list[Pharmacy]
    products: list[Product]
    claims: list[Claim]
    simulated: Literal[True] = True

class CreateEnquiryRequest(WireModelV2):
    pharmacy_id: Id
    product_id: Id
    requested_quantity: RequestedQty
    unit: Unit

class ObservationRequest(WireModelV2):
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

class ObservationV2(ObservationRequest):
    reported_by_user_id: UUID
    submitted_at: AwareDatetime
    basis: Literal["staff_reported_obtainable_count", "unable_to_check"]
    simulated: Literal[True] = True

    @model_validator(mode="after")
    def matching_basis(self):
        expected = ("staff_reported_obtainable_count"
                    if self.kind == ReportKind.checked else "unable_to_check")
        if self.basis != expected:
            raise ValueError("basis does not match report kind")
        return self

class Answer(WireModelV2):
    conclusion: Conclusion
    reason: Reason
    discrepancy_units: SignedQty | None
    message: Text
    limitations: list[Text]

class EnquiryRecordV2(WireModelV2):
    id: UUID
    owner_user_id: UUID
    pharmacy_id: Id
    product: Product
    requested_quantity: RequestedQty
    unit: Unit
    created_at: AwareDatetime
    claim: Claim | None
    simulated: Literal[True] = True

    @field_validator("id", "owner_user_id", mode="before")
    @classmethod
    def canonical_uuid(cls, value):
        if isinstance(value, UUID):
            return value
        pattern = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
        if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
            raise ValueError("UUID must be a canonical lowercase UUID string")
        return value

class EnquiryViewV2(EnquiryRecordV2):
    served_at: AwareDatetime
    observation: ObservationV2 | None
    status: Status
    answer: Answer

class EnquiryPage(WireModelV2):
    items: list[EnquiryViewV2]
    limit: PageLimit
    offset: PageOffset
    has_more: bool

class ErrorDetail(WireModelV2):
    code: Literal[
        "validation_error", "unauthorized", "forbidden", "not_found",
        "immutable_conflict", "storage_unavailable", "internal_error",
        "method_not_allowed", "unsupported_media_type", "auth_unavailable",
        "rate_limited"
    ]
    message: Text
    fields: list[Text]

class ErrorResponse(WireModelV2):
    error: ErrorDetail

class HealthResponseV2(WireModelV2):
    status: Literal["ready"] = "ready"
    storage: Literal["postgresql", "sqlite"] = "postgresql"

# Internal principals and workflow models
class VerifiedIdentity(BaseModel):
    model_config = ConfigDict(extra="forbid")
    auth_subject: Text
    email: str | None = None

class AuthenticatedPrincipal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    user_id: UUID
    auth_subject: Text
    active: bool = True
    memberships: list[PharmacyMembership] = Field(default_factory=list)

    def is_member_of(self, pharmacy_id: str) -> bool:
        if not self.active:
            return False
        return any(m.pharmacy_id == pharmacy_id and m.active for m in self.memberships)

class RepositoryWriteResultV2(BaseModel):
    model_config = ConfigDict(extra="forbid")
    created: Annotated[bool, Field(strict=True)]
    enquiry: EnquiryRecordV2
    observation: ObservationV2 | None

class EvaluationInputV2(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enquiry: EnquiryRecordV2
    observation: ObservationV2 | None

class EvaluationResultV2(BaseModel):
    model_config = ConfigDict(extra="forbid")
    status: Status
    answer: Answer
