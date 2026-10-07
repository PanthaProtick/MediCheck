from datetime import datetime
from app.models.schemas import (
    Answer,
    Conclusion,
    EnquiryRecord,
    EnquiryView,
    EvaluationInput,
    EvaluationResult,
    Observation,
    Reason,
    ReportKind,
    Status,
)

STANDARD_LIMITS_STAFF = [
    "Synthetic demonstration.",
    "Staff report is not independently verified.",
    "This check does not reserve stock or guarantee availability on arrival.",
    "Exact identity matching is not clinical approval.",
]

STANDARD_LIMITS_PENDING = [
    "Synthetic demonstration.",
    "Recorded stock is not a physical check.",
    "No stock reservation or clinical approval.",
]

STANDARD_LIMITS_UNABLE = [
    "Synthetic demonstration.",
    "No obtainable quantity established.",
    "No stock reservation or clinical approval.",
]


def evaluate(input_data: EvaluationInput) -> EvaluationResult:
    enquiry = input_data.enquiry
    obs = input_data.observation

    if enquiry.unit != enquiry.product.unit:
        return EvaluationResult(status=Status.unresolved, answer=Answer(
            conclusion=Conclusion.unresolved, reason=Reason.evidence_conflict,
            discrepancy_units=None, message="Saved request unit conflicts with its product. Availability remains unresolved.",
            limitations=STANDARD_LIMITS_STAFF,
        ))

    # 1. No report saved
    if obs is None:
        answer = Answer(
            conclusion=Conclusion.unresolved,
            reason=Reason.awaiting_check,
            discrepancy_units=None,
            message=f"You requested {enquiry.requested_quantity} {enquiry.unit.value}s. No staff check has been saved.",
            limitations=STANDARD_LIMITS_PENDING,
        )
        return EvaluationResult(status=Status.pending, answer=answer)

    # 2. Check semantic / identity conflicts:
    # Mismatched product ID, mismatched unit, or observed_at strictly after submitted_at
    if (
        obs.product_id != enquiry.product.id
        or obs.unit != enquiry.unit
        or (obs.observed_at is not None and obs.observed_at > obs.submitted_at)
    ):
        answer = Answer(
            conclusion=Conclusion.unresolved,
            reason=Reason.evidence_conflict,
            discrepancy_units=None,
            message="Saved check identity conflicts with this enquiry. Availability for this request remains unresolved.",
            limitations=STANDARD_LIMITS_STAFF,
        )
        return EvaluationResult(status=Status.unresolved, answer=answer)

    # 3. Staff unable to check
    if obs.kind == ReportKind.unable_to_check:
        answer = Answer(
            conclusion=Conclusion.unresolved,
            reason=Reason.cannot_check,
            discrepancy_units=None,
            message="Staff could not complete the check. Availability for this request remains unresolved.",
            limitations=STANDARD_LIMITS_UNABLE,
        )
        return EvaluationResult(status=Status.unresolved, answer=answer)

    # 4. Checked count but observation time is unknown
    if obs.observed_at is None:
        answer = Answer(
            conclusion=Conclusion.unresolved,
            reason=Reason.observation_time_unknown,
            discrepancy_units=None,
            message="Staff reported a count but the observation time is unknown. Availability for this request remains unresolved.",
            limitations=STANDARD_LIMITS_STAFF,
        )
        return EvaluationResult(status=Status.unresolved, answer=answer)

    # 5. Conclusive check
    time_str = obs.observed_at.strftime("%Y-%m-%dT%H:%M:%SZ")
    if obs.obtainable_quantity is not None and obs.obtainable_quantity >= enquiry.requested_quantity:
        conclusion = Conclusion.sufficient
        reason = Reason.checked_meets_request
        meets_str = "This met the requested quantity at that time."
    else:
        conclusion = Conclusion.insufficient
        reason = Reason.checked_below_request
        meets_str = "This did not meet the requested quantity at that time."

    # Discrepancy computation
    if (
        enquiry.claim is not None
        and enquiry.claim.quantity is not None
        and enquiry.claim.pharmacy_id == enquiry.pharmacy_id
        and enquiry.claim.product_id == enquiry.product.id
        and enquiry.claim.unit == enquiry.unit
    ):
        discrepancy_units = (obs.obtainable_quantity or 0) - enquiry.claim.quantity
        claim_str = f" Recorded stock was {enquiry.claim.quantity} {enquiry.unit.value}s."
    else:
        discrepancy_units = None
        claim_str = (" No recorded stock claim was supplied." if enquiry.claim is None
                     else " Recorded stock is unknown or incompatible and was not used for comparison.")

    message = (
        f"You requested {enquiry.requested_quantity} {enquiry.unit.value}s. "
        f"Staff reported {obs.obtainable_quantity} obtainable {enquiry.unit.value}s at {time_str}. "
        f"{meets_str}{claim_str}"
    )

    answer = Answer(
        conclusion=conclusion,
        reason=reason,
        discrepancy_units=discrepancy_units,
        message=message,
        limitations=STANDARD_LIMITS_STAFF,
    )
    return EvaluationResult(status=Status.answered, answer=answer)


def build_view(record: EnquiryRecord, observation: Observation | None, served_at: datetime) -> EnquiryView:
    eval_res = evaluate(EvaluationInput(enquiry=record, observation=observation))
    return EnquiryView(
        id=record.id,
        pharmacy_id=record.pharmacy_id,
        product=record.product,
        requested_quantity=record.requested_quantity,
        unit=record.unit,
        created_at=record.created_at,
        claim=record.claim,
        simulated=True,
        served_at=served_at,
        observation=observation,
        status=eval_res.status,
        answer=eval_res.answer,
    )
