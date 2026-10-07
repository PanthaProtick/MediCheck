import json
import pathlib
import unittest
from uuid import UUID

from pydantic import ValidationError

from app.models.schemas_v2 import (
    Answer,
    AuthenticatedPrincipal,
    BootstrapResponseV2,
    Claim,
    Conclusion,
    CreateEnquiryRequest,
    EnquiryPage,
    EnquiryRecordV2,
    EnquiryViewV2,
    ErrorResponse,
    HealthResponseV2,
    MeResponse,
    ObservationRequest,
    ObservationV2,
    Pharmacy,
    PharmacyMembership,
    Product,
    Reason,
    ReportKind,
    Status,
    Unit,
    validate_canonical_uuid,
)


class TestContractsV2(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        fixtures_path = pathlib.Path(__file__).parent / "fixtures" / "contracts_v2.json"
        with open(fixtures_path, "r", encoding="utf-8") as f:
            cls.fixtures = json.load(f)

    def test_fixtures_container_present(self):
        self.assertEqual(self.fixtures.get("contract_version"), "v2")
        self.assertGreaterEqual(len(self.fixtures.get("http_cases", [])), 20)
        self.assertIn("test_users", self.fixtures)

    def test_all_test_users(self):
        for user_key, user_data in self.fixtures["test_users"].items():
            with self.subTest(user_key=user_key):
                me = MeResponse.model_validate(user_data)
                self.assertIsInstance(me.user_id, UUID)
                self.assertTrue(len(me.auth_subject) > 0)
                principal = AuthenticatedPrincipal.model_validate(user_data)
                self.assertEqual(principal.user_id, me.user_id)

    def test_all_http_cases(self):
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
                        HealthResponseV2.model_validate(body)
                    elif name.startswith("me_"):
                        MeResponse.model_validate(body)
                    elif name == "bootstrap":
                        BootstrapResponseV2.model_validate(body)
                    elif name in ("list_own_enquiries", "staff_queue_pharm_a"):
                        EnquiryPage.model_validate(body)
                    else:
                        EnquiryViewV2.model_validate(body)
                elif status in (401, 403, 404, 405, 409, 415, 422, 429, 500, 503):
                    ErrorResponse.model_validate(body)
                else:
                    self.fail(f"Unexpected status {status} in case {name}")

                # 2. Validate request bodies where present
                req_body = req.get("body")
                if req_body is not None:
                    if name.startswith("create_enquiry") or name == "rate_limited":
                        CreateEnquiryRequest.model_validate(req_body)
                    elif name.startswith("submit_observation"):
                        ObservationRequest.model_validate(req_body)

    def test_canonical_uuid_validation(self):
        valid = "00000000-0000-4000-8000-000000000001"
        self.assertEqual(validate_canonical_uuid(valid), valid)
        self.assertEqual(validate_canonical_uuid(UUID(valid)), valid)

        # Rejects uppercase, braces, extra whitespace, invalid chars
        invalid_cases = [
            "00000000-0000-4000-8000-00000000000Z",
            "00000000-0000-4000-8000-000000000001 ",
            "{00000000-0000-4000-8000-000000000001}",
            "00000000000040008000000000000001",
            "00000000-0000-4000-8000-00000000001",
        ]
        for bad_id in invalid_cases:
            with self.assertRaises(ValueError):
                validate_canonical_uuid(bad_id)

    def test_observation_request_coherence(self):
        # Checked requires count and null unresolved_reason
        with self.assertRaises(ValidationError):
            ObservationRequest(
                product_id="MED-A",
                unit=Unit.tablet,
                kind=ReportKind.checked,
                obtainable_quantity=None,
                observed_at="2026-10-07T05:15:00Z",
                unresolved_reason=None,
            )

        with self.assertRaises(ValidationError):
            ObservationRequest(
                product_id="MED-A",
                unit=Unit.tablet,
                kind=ReportKind.checked,
                obtainable_quantity=5,
                observed_at="2026-10-07T05:15:00Z",
                unresolved_reason="cannot_check",
            )

        # Unable to check requires null count, null time, and cannot_check
        with self.assertRaises(ValidationError):
            ObservationRequest(
                product_id="MED-A",
                unit=Unit.tablet,
                kind=ReportKind.unable_to_check,
                obtainable_quantity=5,
                observed_at=None,
                unresolved_reason="cannot_check",
            )

        with self.assertRaises(ValidationError):
            ObservationRequest(
                product_id="MED-A",
                unit=Unit.tablet,
                kind=ReportKind.unable_to_check,
                obtainable_quantity=None,
                observed_at=None,
                unresolved_reason=None,
            )

    def test_principal_membership_check(self):
        principal = AuthenticatedPrincipal(
            user_id="a1000000-0000-4000-8000-000000000001",
            auth_subject="user_1",
            active=True,
            memberships=[
                PharmacyMembership(
                    pharmacy_id="PHARM-A",
                    role="staff",
                    active=True,
                    created_at="2026-10-01T00:00:00Z",
                ),
                PharmacyMembership(
                    pharmacy_id="PHARM-B",
                    role="staff",
                    active=False,
                    created_at="2026-10-01T00:00:00Z",
                ),
            ],
        )
        self.assertTrue(principal.is_member_of("PHARM-A"))
        self.assertFalse(principal.is_member_of("PHARM-B"))
        self.assertFalse(principal.is_member_of("PHARM-C"))

        # Disabled principal loses all membership rights
        principal.active = False
        self.assertFalse(principal.is_member_of("PHARM-A"))


if __name__ == "__main__":
    unittest.main()
