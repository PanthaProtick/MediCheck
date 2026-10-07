from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
import pathlib
import sqlite3
import tempfile
import threading
import unittest

from app.core.config import Settings
from app.core.database import connect_database, initialize_database
from app.core.errors import AppError
from app.core.security import require_staff
from app.models.schemas import (
    CreateEnquiryRequest,
    ObservationRequest,
    ReportKind,
    StaffPrincipal,
    Unit,
)
from app.services.enquiries import (
    accept_observation,
    create_enquiry,
    list_pending,
    read_enquiry,
)


class TestRepositoryHardening(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = str(pathlib.Path(self.temp_dir.name) / "test_repo.sqlite3")
        self.clock_time = datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc)
        initialize_database(self.db_path)
        self.principal = StaffPrincipal(staff_id="STAFF-DEMO", pharmacy_id="PHARM-A", simulated=True)
        self.wrong_principal = StaffPrincipal(staff_id="STAFF-OTHER", pharmacy_id="PHARM-B", simulated=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def _create_sample_enquiry(self, enquiry_id="00000000-0000-4000-8000-000000000001", qty=6):
        req = CreateEnquiryRequest(
            pharmacy_id="PHARM-A",
            product_id="MED-A",
            requested_quantity=qty,
            unit=Unit.tablet,
        )
        return create_enquiry(self.db_path, enquiry_id, req, clock=lambda: self.clock_time)

    def test_changed_creation_conflict(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)

        # Replay identical -> created=False
        req_same = CreateEnquiryRequest(
            pharmacy_id="PHARM-A",
            product_id="MED-A",
            requested_quantity=6,
            unit=Unit.tablet,
        )
        res_replay = create_enquiry(self.db_path, eid, req_same, clock=lambda: self.clock_time)
        self.assertFalse(res_replay.created)

        # Changed -> 409
        req_diff = CreateEnquiryRequest(
            pharmacy_id="PHARM-A",
            product_id="MED-A",
            requested_quantity=10,
            unit=Unit.tablet,
        )
        with self.assertRaises(AppError) as ctx:
            create_enquiry(self.db_path, eid, req_diff, clock=lambda: self.clock_time)
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertEqual(ctx.exception.code, "immutable_conflict")

    def test_offset_equivalent_replay(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)

        # First report with UTC timestamp
        req1 = ObservationRequest(
            product_id="MED-A",
            unit=Unit.tablet,
            kind=ReportKind.checked,
            obtainable_quantity=4,
            observed_at=datetime(2026, 10, 7, 5, 2, 0, tzinfo=timezone.utc),
            unresolved_reason=None,
        )
        res1 = accept_observation(self.db_path, eid, req1, self.principal, clock=lambda: self.clock_time)
        self.assertTrue(res1.created)

        # Replay with offset timestamp representing exact same UTC instant
        from datetime import timezone as dt_tz, timedelta
        plus6 = dt_tz(timedelta(hours=6))
        req2 = ObservationRequest(
            product_id="MED-A",
            unit=Unit.tablet,
            kind=ReportKind.checked,
            obtainable_quantity=4,
            observed_at=datetime(2026, 10, 7, 11, 2, 0, tzinfo=plus6),
            unresolved_reason=None,
        )
        res2 = accept_observation(self.db_path, eid, req2, self.principal, clock=lambda: self.clock_time)
        self.assertFalse(res2.created)
        self.assertEqual(res2.observation.obtainable_quantity, 4)

    def test_concurrent_identical_reports(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)

        req = ObservationRequest(
            product_id="MED-A",
            unit=Unit.tablet,
            kind=ReportKind.checked,
            obtainable_quantity=4,
            observed_at=self.clock_time,
            unresolved_reason=None,
        )

        barrier = threading.Barrier(2)
        results = []

        def worker():
            barrier.wait()
            res = accept_observation(self.db_path, eid, req, self.principal, clock=lambda: self.clock_time)
            results.append(res)

        with ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(worker)
            f2 = executor.submit(worker)
            f1.result()
            f2.result()

        created_flags = [r.created for r in results]
        # One must be created=True (first winner) and the other created=False (replay)
        self.assertIn(True, created_flags)
        self.assertIn(False, created_flags)

    def test_concurrent_different_reports(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)

        req1 = ObservationRequest(
            product_id="MED-A",
            unit=Unit.tablet,
            kind=ReportKind.checked,
            obtainable_quantity=4,
            observed_at=self.clock_time,
            unresolved_reason=None,
        )
        req2 = ObservationRequest(
            product_id="MED-A",
            unit=Unit.tablet,
            kind=ReportKind.checked,
            obtainable_quantity=8,
            observed_at=self.clock_time,
            unresolved_reason=None,
        )

        barrier = threading.Barrier(2)
        outcomes = []

        def worker(req):
            barrier.wait()
            try:
                res = accept_observation(self.db_path, eid, req, self.principal, clock=lambda: self.clock_time)
                outcomes.append(("success", res))
            except AppError as e:
                outcomes.append(("error", e))

        with ThreadPoolExecutor(max_workers=2) as executor:
            f1 = executor.submit(worker, req1)
            f2 = executor.submit(worker, req2)
            f1.result()
            f2.result()

        successes = [o for o in outcomes if o[0] == "success"]
        errors = [o for o in outcomes if o[0] == "error"]

        self.assertEqual(len(successes), 1)
        self.assertEqual(len(errors), 1)
        self.assertEqual(errors[0][1].status_code, 409)

        # Verify winning observation remains unchanged
        _, obs = read_enquiry(self.db_path, eid)
        self.assertEqual(obs.obtainable_quantity, successes[0][1].observation.obtainable_quantity)

    def test_seed_twice_survives(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)

        # Run initialize_database again
        initialize_database(self.db_path)

        # Enquiry still intact
        rec, obs = read_enquiry(self.db_path, eid)
        self.assertEqual(rec.requested_quantity, 6)
        self.assertIsNone(obs)

    def test_restart_reopen(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)
        req = ObservationRequest(
            product_id="MED-A",
            unit=Unit.tablet,
            kind=ReportKind.checked,
            obtainable_quantity=4,
            observed_at=self.clock_time,
            unresolved_reason=None,
        )
        accept_observation(self.db_path, eid, req, self.principal, clock=lambda: self.clock_time)

        # Reopen with fresh connection
        conn = connect_database(self.db_path)
        try:
            enq_row = conn.execute("SELECT * FROM enquiries WHERE id = ?", (eid,)).fetchone()
            self.assertIsNotNone(enq_row)
            obs_row = conn.execute("SELECT * FROM observations WHERE enquiry_id = ?", (eid,)).fetchone()
            self.assertIsNotNone(obs_row)
        finally:
            conn.close()

        rec, obs = read_enquiry(self.db_path, eid)
        self.assertEqual(rec.requested_quantity, 6)
        self.assertEqual(obs.obtainable_quantity, 4)

    def test_snapshot_preservation_after_catalog_change(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)

        # Direct SQL mutation to products catalog
        conn = connect_database(self.db_path)
        try:
            conn.execute("UPDATE products SET name = 'Modified Catalog Name' WHERE id = 'MED-A'")
            conn.commit()
        finally:
            conn.close()

        # Read enquiry must retain original snapshot name
        rec, _ = read_enquiry(self.db_path, eid)
        self.assertEqual(rec.product.name, "Demo Medicine A")

    def test_security_auth_and_forbidden_pharmacy(self):
        eid = "00000000-0000-4000-8000-000000000001"
        self._create_sample_enquiry(eid, 6)

        # Security require_staff with invalid token
        settings = Settings(DEMO_STAFF_TOKEN="secret123")
        with self.assertRaises(AppError) as ctx:
            require_staff("Bearer wrong-token", settings)
        self.assertEqual(ctx.exception.status_code, 401)

        # Security require_staff missing header
        with self.assertRaises(AppError) as ctx:
            require_staff(None, settings)
        self.assertEqual(ctx.exception.status_code, 401)

        # Observation write with wrong pharmacy principal -> 403
        req = ObservationRequest(
            product_id="MED-A",
            unit=Unit.tablet,
            kind=ReportKind.checked,
            obtainable_quantity=4,
            observed_at=self.clock_time,
            unresolved_reason=None,
        )
        with self.assertRaises(AppError) as ctx:
            accept_observation(self.db_path, eid, req, self.wrong_principal, clock=lambda: self.clock_time)
        self.assertEqual(ctx.exception.status_code, 403)
        self.assertEqual(ctx.exception.code, "forbidden")


if __name__ == "__main__":
    unittest.main()
