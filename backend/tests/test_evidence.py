from datetime import datetime, timedelta, timezone
import unittest
from uuid import uuid4

from pydantic import ValidationError

from app.models.schemas import (
    Claim,
    Conclusion,
    EnquiryRecord,
    EvaluationInput,
    Observation,
    Product,
    Reason,
    ReportKind,
    Status,
    Unit,
)
from app.services.evidence import evaluate


class TestEvidenceEvaluator(unittest.TestCase):
    def setUp(self):
        self.now = datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc)
        self.product_a = Product(
            id="MED-A",
            name="Demo Medicine A",
            strength="10 mg",
            form="tablet",
            unit=Unit.tablet,
        )
        self.claim_a = Claim(
            id="CLAIM-A",
            pharmacy_id="PHARM-A",
            product_id="MED-A",
            quantity=12,
            unit=Unit.tablet,
            recorded_at=self.now - timedelta(hours=2),
            loaded_at=self.now - timedelta(hours=1),
            source="synthetic test inventory",
            simulated=True,
        )

    def _make_enquiry(self, req_qty=6, product=None, claim=None):
        return EnquiryRecord(
            id=uuid4(),
            pharmacy_id="PHARM-A",
            product=product or self.product_a,
            requested_quantity=req_qty,
            unit=(product or self.product_a).unit,
            created_at=self.now,
            claim=claim if claim is not ... else self.claim_a,
            simulated=True,
        )

    def _make_observation(
        self,
        product_id="MED-A",
        unit=Unit.tablet,
        kind=ReportKind.checked,
        obtainable_quantity=4,
        observed_at=None,
        submitted_at=None,
        unresolved_reason=None,
    ):
        sub_at = submitted_at or self.now
        obs_at = (self.now - timedelta(minutes=5)) if observed_at is ... else observed_at
        basis = "staff_reported_obtainable_count" if kind == ReportKind.checked else "unable_to_check"
        return Observation(
            product_id=product_id,
            unit=unit,
            kind=kind,
            obtainable_quantity=obtainable_quantity,
            observed_at=obs_at,
            unresolved_reason=unresolved_reason,
            staff_id="STAFF-DEMO",
            submitted_at=sub_at,
            basis=basis,
            simulated=True,
        )

    def test_no_report(self):
        enquiry = self._make_enquiry(claim=self.claim_a)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=None))
        self.assertEqual(res.status, Status.pending)
        self.assertEqual(res.answer.conclusion, Conclusion.unresolved)
        self.assertEqual(res.answer.reason, Reason.awaiting_check)
        self.assertIsNone(res.answer.discrepancy_units)
        self.assertIn("No staff check has been saved", res.answer.message)

    def test_count4_request6_record12(self):
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(obtainable_quantity=4, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.insufficient)
        self.assertEqual(res.answer.reason, Reason.checked_below_request)
        self.assertEqual(res.answer.discrepancy_units, -8)
        self.assertIn("This did not meet the requested quantity", res.answer.message)

    def test_count8_request6_record12(self):
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(obtainable_quantity=8, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.sufficient)
        self.assertEqual(res.answer.reason, Reason.checked_meets_request)
        self.assertEqual(res.answer.discrepancy_units, -4)
        self.assertIn("This met the requested quantity", res.answer.message)

    def test_count0_request6_record12(self):
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(obtainable_quantity=0, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.insufficient)
        self.assertEqual(res.answer.reason, Reason.checked_below_request)
        self.assertEqual(res.answer.discrepancy_units, -12)

    def test_count_equal6_request6_record12(self):
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(obtainable_quantity=6, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.sufficient)
        self.assertEqual(res.answer.reason, Reason.checked_meets_request)
        self.assertEqual(res.answer.discrepancy_units, -6)

    def test_unable_report(self):
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(
            kind=ReportKind.unable_to_check,
            obtainable_quantity=None,
            observed_at=None,
            unresolved_reason="cannot_check",
        )
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.unresolved)
        self.assertEqual(res.answer.conclusion, Conclusion.unresolved)
        self.assertEqual(res.answer.reason, Reason.cannot_check)
        self.assertIsNone(res.answer.discrepancy_units)
        self.assertIn("Staff could not complete the check", res.answer.message)

    def test_checked_unknown_time(self):
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(obtainable_quantity=4, observed_at=None)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.unresolved)
        self.assertEqual(res.answer.conclusion, Conclusion.unresolved)
        self.assertEqual(res.answer.reason, Reason.observation_time_unknown)
        self.assertIsNone(res.answer.discrepancy_units)
        self.assertIn("observation time is unknown", res.answer.message)

    def test_missing_claim(self):
        enquiry = self._make_enquiry(req_qty=6, claim=None)
        obs = self._make_observation(obtainable_quantity=8, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.sufficient)
        self.assertEqual(res.answer.reason, Reason.checked_meets_request)
        self.assertIsNone(res.answer.discrepancy_units)
        self.assertIn("No recorded stock claim was supplied", res.answer.message)

    def test_claim_quantity_null(self):
        null_claim = Claim(
            id="CLAIM-NULL",
            pharmacy_id="PHARM-A",
            product_id="MED-A",
            quantity=None,
            unit=Unit.tablet,
            recorded_at=self.now,
            loaded_at=self.now,
            source="synthetic",
            simulated=True,
        )
        enquiry = self._make_enquiry(req_qty=6, claim=null_claim)
        obs = self._make_observation(obtainable_quantity=8, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.sufficient)
        self.assertIsNone(res.answer.discrepancy_units)

    def test_claim_time_null(self):
        no_time_claim = Claim(
            id="CLAIM-NOTIME",
            pharmacy_id="PHARM-A",
            product_id="MED-A",
            quantity=12,
            unit=Unit.tablet,
            recorded_at=None,
            loaded_at=self.now,
            source="synthetic",
            simulated=True,
        )
        enquiry = self._make_enquiry(req_qty=6, claim=no_time_claim)
        obs = self._make_observation(obtainable_quantity=4, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.insufficient)
        self.assertEqual(res.answer.discrepancy_units, -8)

    def test_old_check(self):
        old_time = self.now - timedelta(days=2)
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(obtainable_quantity=8, observed_at=old_time)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.answered)
        self.assertEqual(res.answer.conclusion, Conclusion.sufficient)
        self.assertEqual(res.answer.discrepancy_units, -4)

    def test_schema_valid_product_mismatch(self):
        # Observation product MED-B does not match enquiry product MED-A
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(product_id="MED-B", obtainable_quantity=8, observed_at=...)
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.unresolved)
        self.assertEqual(res.answer.conclusion, Conclusion.unresolved)
        self.assertEqual(res.answer.reason, Reason.evidence_conflict)
        self.assertIsNone(res.answer.discrepancy_units)

    def test_check_time_after_submission(self):
        sub_at = self.now
        obs_at = self.now + timedelta(minutes=10)
        enquiry = self._make_enquiry(req_qty=6, claim=self.claim_a)
        obs = self._make_observation(
            obtainable_quantity=8,
            observed_at=obs_at,
            submitted_at=sub_at,
        )
        res = evaluate(EvaluationInput(enquiry=enquiry, observation=obs))
        self.assertEqual(res.status, Status.unresolved)
        self.assertEqual(res.answer.conclusion, Conclusion.unresolved)
        self.assertEqual(res.answer.reason, Reason.evidence_conflict)

    def test_basis_mismatch_fails_model(self):
        # Cross-field validator on Observation model rejects mismatched basis
        with self.assertRaises(ValidationError):
            Observation(
                product_id="MED-A",
                unit=Unit.tablet,
                kind=ReportKind.checked,
                obtainable_quantity=4,
                observed_at=self.now,
                unresolved_reason=None,
                staff_id="STAFF-DEMO",
                submitted_at=self.now,
                basis="unable_to_check",  # Mismatched!
                simulated=True,
            )


if __name__ == "__main__":
    unittest.main()
