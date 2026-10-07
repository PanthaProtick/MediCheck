import pathlib
import tempfile
import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.database import connect_database
from app.main import create_app


class TestBackendJourney(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = str(pathlib.Path(self.temp_dir.name) / "test.sqlite3")
        self.test_clock_time = datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc)
        self.settings = Settings(
            DEMO_DATABASE_PATH=self.db_path,
            DEMO_STAFF_TOKEN="test-staff-secret",
        )
        self.app = create_app(
            settings=self.settings,
            clock=lambda: self.test_clock_time,
        )
        self.client = TestClient(self.app)
        # Enter lifespan to run DB init
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp_dir.cleanup()

    def test_m02_gate_journey(self):
        # 1. Health
        res = self.client.get("/api/v1/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), {"status": "ready", "storage": "sqlite"})
        self.assertEqual(res.headers.get("Cache-Control"), "no-store")

        # 2. Bootstrap
        res = self.client.get("/api/v1/bootstrap")
        self.assertEqual(res.status_code, 200)
        boot = res.json()
        self.assertEqual(boot["pharmacy"]["id"], "PHARM-A")
        self.assertEqual(len(boot["products"]), 3)
        self.assertEqual(len(boot["claims"]), 1)
        self.assertEqual(boot["claims"][0]["quantity"], 12)

        # 3. Create enquiry request 6
        enquiry_id = "00000000-0000-4000-8000-000000000001"
        create_payload = {
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "requested_quantity": 6,
            "unit": "tablet",
        }
        res = self.client.put(f"/api/v1/enquiries/{enquiry_id}", json=create_payload)
        self.assertEqual(res.status_code, 201)
        created_view = res.json()
        self.assertEqual(created_view["id"], enquiry_id)
        self.assertEqual(created_view["status"], "pending")
        self.assertEqual(created_view["answer"]["conclusion"], "unresolved")
        self.assertEqual(created_view["answer"]["reason"], "awaiting_check")

        # 4. Queue contains same ID
        # Unauthorized queue access (no token) -> 401
        res = self.client.get("/api/v1/staff/enquiries")
        self.assertEqual(res.status_code, 401)
        self.assertIn("WWW-Authenticate", res.headers)

        # Authorized queue access
        auth_headers = {"Authorization": "Bearer test-staff-secret"}
        res = self.client.get("/api/v1/staff/enquiries", headers=auth_headers)
        self.assertEqual(res.status_code, 200)
        queue = res.json()
        self.assertEqual(len(queue), 1)
        self.assertEqual(queue[0]["id"], enquiry_id)

        # 5. Unauthorized report write -> 401
        report_payload = {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": None,
        }
        res = self.client.put(
            f"/api/v1/enquiries/{enquiry_id}/observation",
            json=report_payload,
        )
        self.assertEqual(res.status_code, 401)

        # 6. Protected report 4 succeeds -> 201
        res = self.client.put(
            f"/api/v1/enquiries/{enquiry_id}/observation",
            headers=auth_headers,
            json=report_payload,
        )
        self.assertEqual(res.status_code, 201)
        rep_view = res.json()
        self.assertEqual(rep_view["status"], "answered")
        self.assertEqual(rep_view["answer"]["conclusion"], "insufficient")
        self.assertEqual(rep_view["answer"]["reason"], "checked_below_request")
        self.assertEqual(rep_view["answer"]["discrepancy_units"], -8)

        # 7. Read returns insufficient with claim 12 and report 4
        res = self.client.get(f"/api/v1/enquiries/{enquiry_id}")
        self.assertEqual(res.status_code, 200)
        read_view = res.json()
        self.assertEqual(read_view["status"], "answered")
        self.assertEqual(read_view["claim"]["quantity"], 12)
        self.assertEqual(read_view["observation"]["obtainable_quantity"], 4)
        self.assertEqual(read_view["answer"]["conclusion"], "insufficient")
        self.assertEqual(read_view["answer"]["discrepancy_units"], -8)

        # Queue is now empty since report is accepted
        res = self.client.get("/api/v1/staff/enquiries", headers=auth_headers)
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json(), [])

        # 8. Identical request replay -> 200
        res = self.client.put(f"/api/v1/enquiries/{enquiry_id}", json=create_payload)
        self.assertEqual(res.status_code, 200)

        # 9. Changed request body -> 409
        changed_create = dict(create_payload)
        changed_create["requested_quantity"] = 10
        res = self.client.put(f"/api/v1/enquiries/{enquiry_id}", json=changed_create)
        self.assertEqual(res.status_code, 409)

        # 10. Identical report replay -> 200
        res = self.client.put(
            f"/api/v1/enquiries/{enquiry_id}/observation",
            headers=auth_headers,
            json=report_payload,
        )
        self.assertEqual(res.status_code, 200)

        # 11. Changed report -> 409
        changed_report = dict(report_payload)
        changed_report["obtainable_quantity"] = 5
        res = self.client.put(
            f"/api/v1/enquiries/{enquiry_id}/observation",
            headers=auth_headers,
            json=changed_report,
        )
        self.assertEqual(res.status_code, 409)

        # 12. Direct SQLite row count check confirms real storage
        conn = connect_database(self.db_path)
        try:
            enq_count = conn.execute("SELECT count(*) FROM enquiries").fetchone()[0]
            obs_count = conn.execute("SELECT count(*) FROM observations").fetchone()[0]
            self.assertEqual(enq_count, 1)
            self.assertEqual(obs_count, 1)
        finally:
            conn.close()


if __name__ == "__main__":
    unittest.main()
