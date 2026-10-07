import json
import pathlib
import unittest
from datetime import datetime, timezone
from uuid import UUID

from pydantic import ValidationError

from app.models.schemas import (
    Answer,
    BootstrapResponse,
    Claim,
    Conclusion,
    CreateEnquiryRequest,
    EnquiryRecord,
    EnquiryView,
    ErrorResponse,
    EvaluationInput,
    EvaluationResult,
    HealthResponse,
    Observation,
    ObservationRequest,
    Pharmacy,
    Product,
    Reason,
    ReportKind,
    RepositoryWriteResult,
    StaffPrincipal,
    Status,
    Unit,
    validate_canonical_uuid,
)


class TestContracts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures_path = pathlib.Path(__file__).parent / "fixtures" / "contracts.json"
        with open(fixtures_path, "r", encoding="utf-8") as f:
            cls.fixtures = json.load(f)

    def test_fixtures_container_present(self):
        self.assertEqual(self.fixtures.get("contract_version"), "v1")
        self.assertEqual(len(self.fixtures.get("http_cases", [])), 32)
        self.assertEqual(len(self.fixtures.get("internal_cases", [])), 3)

    def test_all_32_http_cases(self):
        for case in self.fixtures["http_cases"]:
            name = case["name"]
            req = case.get("request", {})
            res = case.get("response", {})
            status = res.get("status")
            body = res.get("body")

            with self.subTest(case_name=name):
                # 1. Validate response models
                if status in (200, 201):
                    if name == "health":
                        HealthResponse.model_validate(body)
                    elif name == "bootstrap":
                        BootstrapResponse.model_validate(body)
                    elif name in ("staff_queue", "staff_queue_empty"):
                        self.assertIsInstance(body, list)
                        for item in body:
                            EnquiryView.model_validate(item)
                    else:
                        EnquiryView.model_validate(body)
                elif status in (401, 403, 404, 405, 409, 415, 422, 500, 503):
                    ErrorResponse.model_validate(body)
                else:
                    self.fail(f"Unexpected status {status} in case {name}")

                # 2. Validate request bodies where applicable
                req_body = req.get("body")
                if req_body is not None:
                    if name in ("create_pending", "creation_replay", "changed_creation", "wrong_unit", "wrong_media_type"):
                        CreateEnquiryRequest.model_validate(req_body)
                    elif name in (
                        "submit_insufficient",
                        "report_replay",
                        "submit_sufficient",
                        "submit_zero",
                        "submit_unable",
                        "submit_unknown_time",
                        "submit_missing_claim",
                        "wrong_pharmacy",
                        "changed_report",
                    ):
                        ObservationRequest.model_validate(req_body)
                    elif name == "invalid_quantity":
                        # Documented invalid request body must fail model validation
                        with self.assertRaises(ValidationError):
                            CreateEnquiryRequest.model_validate(req_body)

    def test_all_3_internal_cases(self):
        cases = {c["name"]: c for c in self.fixtures["internal_cases"]}

        # internal 1: evaluate_insufficient
        c1 = cases["evaluate_insufficient"]
        inp = c1["input"]
        eval_in = EvaluationInput(
            enquiry=EnquiryRecord.model_validate(inp["enquiry"]),
            observation=Observation.model_validate(inp["observation"]) if inp.get("observation") else None,
        )
        self.assertIsNotNone(eval_in.enquiry)
        eval_out = EvaluationResult.model_validate(c1["output"])
        self.assertEqual(eval_out.status, Status.answered)
        self.assertEqual(eval_out.answer.conclusion, Conclusion.insufficient)
        self.assertEqual(eval_out.answer.reason, Reason.checked_below_request)
        self.assertEqual(eval_out.answer.discrepancy_units, -8)

        # internal 2: accepted_report_write
        c2 = cases["accepted_report_write"]
        write_out = RepositoryWriteResult.model_validate(c2["output"])
        self.assertTrue(write_out.created)
        self.assertIsNotNone(write_out.enquiry)
        self.assertIsNotNone(write_out.observation)

        # internal 3: staff_principal
        c3 = cases["staff_principal"]
        principal = StaffPrincipal.model_validate(c3["output"])
        self.assertEqual(principal.staff_id, "STAFF-DEMO")
        self.assertEqual(principal.pharmacy_id, "PHARM-A")
        self.assertTrue(principal.simulated)

    def test_bootstrap_fixture_file(self):
        boot_path = pathlib.Path(__file__).parent.parent / "app" / "fixtures" / "bootstrap.json"
        with open(boot_path, "r", encoding="utf-8") as f:
            boot_data = json.load(f)
        boot = BootstrapResponse.model_validate(boot_data)
        self.assertEqual(boot.pharmacy.id, "PHARM-A")
        self.assertEqual(len(boot.products), 3)
        self.assertEqual(len(boot.claims), 1)

    def test_quantity_rejections(self):
        # JSON 6.0 rejected (float rejected by strict int)
        with self.assertRaises(ValidationError):
            CreateEnquiryRequest(
                pharmacy_id="PHARM-A",
                product_id="MED-A",
                requested_quantity=6.0,  # type: ignore
                unit=Unit.tablet,
            )

        # True rejected (bool rejected by strict int)
        with self.assertRaises(ValidationError):
            CreateEnquiryRequest(
                pharmacy_id="PHARM-A",
                product_id="MED-A",
                requested_quantity=True,  # type: ignore
                unit=Unit.tablet,
            )

        # String "6" rejected
        with self.assertRaises(ValidationError):
            CreateEnquiryRequest(
                pharmacy_id="PHARM-A",
                product_id="MED-A",
                requested_quantity="6",  # type: ignore
                unit=Unit.tablet,
            )

        # Zero request rejected (ge=1)
        with self.assertRaises(ValidationError):
            CreateEnquiryRequest(
                pharmacy_id="PHARM-A",
                product_id="MED-A",
                requested_quantity=0,
                unit=Unit.tablet,
            )

        # Negative request rejected
        with self.assertRaises(ValidationError):
            CreateEnquiryRequest(
                pharmacy_id="PHARM-A",
                product_id="MED-A",
                requested_quantity=-1,
                unit=Unit.tablet,
            )

        # Zero report accepted for checked kind
        obs_req = ObservationRequest.model_validate({
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 0,
            "observed_at": "2026-10-07T05:10:00Z",
            "unresolved_reason": None,
        })
        self.assertEqual(obs_req.obtainable_quantity, 0)

    def test_timestamp_validation_and_normalization(self):
        # Numeric time rejected
        with self.assertRaises(ValidationError):
            ObservationRequest.model_validate({
                "product_id": "MED-A",
                "unit": "tablet",
                "kind": "checked",
                "obtainable_quantity": 4,
                "observed_at": 1728277800,
                "unresolved_reason": None,
            })

        # Naive datetime rejected
        with self.assertRaises(ValidationError):
            ObservationRequest.model_validate({
                "product_id": "MED-A",
                "unit": "tablet",
                "kind": "checked",
                "obtainable_quantity": 4,
                "observed_at": "2026-10-07T05:10:00",
                "unresolved_reason": None,
            })

        # Date-only string rejected
        with self.assertRaises(ValidationError):
            ObservationRequest.model_validate({
                "product_id": "MED-A",
                "unit": "tablet",
                "kind": "checked",
                "obtainable_quantity": 4,
                "observed_at": "2026-10-07",
                "unresolved_reason": None,
            })

        # Offset time normalized to UTC
        req = ObservationRequest.model_validate({
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": "2026-10-07T11:10:00+06:00",
            "unresolved_reason": None,
        })
        self.assertEqual(req.observed_at, datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc))

    def test_nullable_field_omission_rejected(self):
        # Missing obtainable_quantity key completely is rejected (nullable is required)
        with self.assertRaises(ValidationError):
            ObservationRequest.model_validate({
                "product_id": "MED-A",
                "unit": "tablet",
                "kind": "checked",
                "observed_at": "2026-10-07T05:10:00Z",
                "unresolved_reason": None,
            })

        # Missing observed_at key completely is rejected
        with self.assertRaises(ValidationError):
            ObservationRequest.model_validate({
                "product_id": "MED-A",
                "unit": "tablet",
                "kind": "checked",
                "obtainable_quantity": 4,
                "unresolved_reason": None,
            })

        # Missing unresolved_reason key completely is rejected
        with self.assertRaises(ValidationError):
            ObservationRequest.model_validate({
                "product_id": "MED-A",
                "unit": "tablet",
                "kind": "checked",
                "obtainable_quantity": 4,
                "observed_at": "2026-10-07T05:10:00Z",
            })

    def test_simulated_flag_strictness(self):
        # Simulated integer 1 is rejected
        with self.assertRaises(ValidationError):
            HealthResponse.model_validate({"status": "ready", "storage": "sqlite", "simulated": 1})

        with self.assertRaises(ValidationError):
            StaffPrincipal.model_validate({
                "staff_id": "STAFF-DEMO",
                "pharmacy_id": "PHARM-A",
                "simulated": 1,
            })

    def test_extra_fields_forbidden(self):
        # Extra staff_id in CreateEnquiryRequest rejected
        with self.assertRaises(ValidationError):
            CreateEnquiryRequest.model_validate({
                "pharmacy_id": "PHARM-A",
                "product_id": "MED-A",
                "requested_quantity": 6,
                "unit": "tablet",
                "staff_id": "STAFF-DEMO",
            })

        # Extra answer in ObservationRequest rejected
        with self.assertRaises(ValidationError):
            ObservationRequest.model_validate({
                "product_id": "MED-A",
                "unit": "tablet",
                "kind": "checked",
                "obtainable_quantity": 4,
                "observed_at": "2026-10-07T05:10:00Z",
                "unresolved_reason": None,
                "answer": "sufficient",
            })

    def test_canonical_uuid_validation(self):
        # Valid lowercase UUID
        valid_uuid = "00000000-0000-4000-8000-000000000001"
        self.assertEqual(validate_canonical_uuid(valid_uuid), valid_uuid)

        # Uppercase UUID rejected
        with self.assertRaises(ValueError):
            validate_canonical_uuid("00000000-0000-4000-8000-00000000000A")

        # Whitespace rejected
        with self.assertRaises(ValueError):
            validate_canonical_uuid(" 00000000-0000-4000-8000-000000000001 ")

        # Shortened rejected
        with self.assertRaises(ValueError):
            validate_canonical_uuid("00000000-0000-4000-8000-00000000000")

        # Braced rejected
        with self.assertRaises(ValueError):
            validate_canonical_uuid("{00000000-0000-4000-8000-000000000001}")


if __name__ == "__main__":
    unittest.main()
