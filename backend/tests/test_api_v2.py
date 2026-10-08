from datetime import datetime, timezone
import json
import unittest
from uuid import UUID, uuid4

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.pool import StaticPool

from app.core.auth import TestSessionVerifier
from app.core.config import Settings
from app.main import create_app
from app.models.schemas_v2 import VerifiedIdentity


class TestApiV2(unittest.TestCase):
    def setUp(self):
        self.clock_time = datetime(2026, 10, 7, 5, 10, 0, tzinfo=timezone.utc)
        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )

        # Initialize SQLite schema matching the v2 model
        schema_sql = """
            CREATE TABLE schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TEXT NOT NULL
            );
            INSERT INTO schema_migrations (version, applied_at) VALUES ('001_multi_user', '2026-10-07T00:00:00Z');

            CREATE TABLE users (
                id TEXT PRIMARY KEY,
                auth_subject TEXT UNIQUE NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );

            CREATE TABLE pharmacies (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                active INTEGER NOT NULL DEFAULT 1,
                simulated INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE pharmacy_memberships (
                user_id TEXT NOT NULL,
                pharmacy_id TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'staff',
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                PRIMARY KEY (user_id, pharmacy_id)
            );

            CREATE TABLE products (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                strength TEXT NOT NULL,
                form TEXT NOT NULL,
                unit TEXT NOT NULL
            );

            CREATE TABLE claims (
                id TEXT PRIMARY KEY,
                pharmacy_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                quantity INTEGER NULL,
                unit TEXT NOT NULL,
                recorded_at TEXT NULL,
                loaded_at TEXT NOT NULL,
                source TEXT NOT NULL,
                simulated INTEGER NOT NULL DEFAULT 1
            );

            CREATE TABLE enquiries (
                id TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL,
                pharmacy_id TEXT NOT NULL,
                product_id TEXT NOT NULL,
                requested_quantity INTEGER NOT NULL,
                unit TEXT NOT NULL,
                created_at TEXT NOT NULL,
                product_snapshot_json TEXT NOT NULL,
                claim_snapshot_json TEXT NULL
            );

            CREATE TABLE observations (
                enquiry_id TEXT PRIMARY KEY,
                product_id TEXT NOT NULL,
                unit TEXT NOT NULL,
                kind TEXT NOT NULL,
                obtainable_quantity INTEGER NULL,
                observed_at TEXT NULL,
                unresolved_reason TEXT NULL,
                reported_by_user_id TEXT NOT NULL,
                submitted_at TEXT NOT NULL,
                basis TEXT NOT NULL,
                simulated INTEGER NOT NULL DEFAULT 1
            );

            INSERT INTO pharmacies (id, name, active, simulated) VALUES
            ('PHARM-A', 'Synthetic Demo Pharmacy A', 1, 1);
            INSERT INTO pharmacies (id, name, active, simulated) VALUES
            ('PHARM-B', 'Synthetic Demo Pharmacy B', 1, 1);

            INSERT INTO products (id, name, strength, form, unit) VALUES
            ('MED-A', 'Demo Medicine A', '10 mg', 'tablet', 'tablet');
            INSERT INTO products (id, name, strength, form, unit) VALUES
            ('MED-B', 'Demo Medicine A', '20 mg', 'tablet', 'tablet');
            INSERT INTO products (id, name, strength, form, unit) VALUES
            ('MED-C', 'Demo Medicine C', '10 mg', 'capsule', 'capsule');

            INSERT INTO claims (id, pharmacy_id, product_id, quantity, unit, recorded_at, loaded_at, source, simulated) VALUES
            ('CLAIM-A', 'PHARM-A', 'MED-A', 12, 'tablet', '2026-10-07T03:10:00Z', '2026-10-07T03:15:00Z', 'synthetic inventory fixture', 1);
            INSERT INTO claims (id, pharmacy_id, product_id, quantity, unit, recorded_at, loaded_at, source, simulated) VALUES
            ('CLAIM-B', 'PHARM-B', 'MED-A', 5, 'tablet', '2026-10-07T03:10:00Z', '2026-10-07T03:15:00Z', 'synthetic inventory fixture', 1);
        """
        with self.engine.connect() as conn:
            with conn.begin():
                for stmt in schema_sql.strip().split(";"):
                    if stmt.strip():
                        conn.execute(text(stmt.strip()))

        # Setup test verifier with deterministic subjects
        self.verifier = TestSessionVerifier()
        self.verifier.add_user("token-caregiver-1", VerifiedIdentity(auth_subject="sub_caregiver_1"))
        self.verifier.add_user("token-caregiver-2", VerifiedIdentity(auth_subject="sub_caregiver_2"))
        self.verifier.add_user("token-staff-a-1", VerifiedIdentity(auth_subject="sub_staff_a_1"))
        self.verifier.add_user("token-staff-a-2", VerifiedIdentity(auth_subject="sub_staff_a_2"))
        self.verifier.add_user("token-staff-b", VerifiedIdentity(auth_subject="sub_staff_b"))
        self.verifier.add_user("token-staff-multi", VerifiedIdentity(auth_subject="sub_staff_multi"))
        self.verifier.add_user("token-staff-revoked", VerifiedIdentity(auth_subject="sub_staff_revoked"))
        self.verifier.add_user("token-disabled", VerifiedIdentity(auth_subject="sub_disabled"))

        self.settings = Settings(
            ENV="test",
            APP_MODE="hosted",
            PROJECT_NAME="Availability Verification MVP v2",
            DEMO_STAFF_TOKEN="test-token",
        )

        self.app = create_app(
            settings=self.settings,
            clock=lambda: self.clock_time,
            engine=self.engine,
            session_verifier=self.verifier,
        )
        self.client = TestClient(self.app)
        self.client.__enter__()

        # Pre-initialize staff memberships for test staff accounts
        with self.engine.connect() as conn:
            with conn.begin():
                # Staff A1
                staff_a1_id = uuid4()
                conn.execute(
                    text("INSERT INTO users (id, auth_subject, active, created_at) VALUES (:id, 'sub_staff_a_1', 1, '2026-10-01T00:00:00Z');"),
                    {"id": str(staff_a1_id)},
                )
                conn.execute(
                    text("INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at) VALUES (:uid, 'PHARM-A', 'staff', 1, '2026-10-01T00:00:00Z');"),
                    {"uid": str(staff_a1_id)},
                )

                # Staff A2
                staff_a2_id = uuid4()
                conn.execute(
                    text("INSERT INTO users (id, auth_subject, active, created_at) VALUES (:id, 'sub_staff_a_2', 1, '2026-10-01T00:00:00Z');"),
                    {"id": str(staff_a2_id)},
                )
                conn.execute(
                    text("INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at) VALUES (:uid, 'PHARM-A', 'staff', 1, '2026-10-01T00:00:00Z');"),
                    {"uid": str(staff_a2_id)},
                )

                # Staff B
                staff_b_id = uuid4()
                conn.execute(
                    text("INSERT INTO users (id, auth_subject, active, created_at) VALUES (:id, 'sub_staff_b', 1, '2026-10-01T00:00:00Z');"),
                    {"id": str(staff_b_id)},
                )
                conn.execute(
                    text("INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at) VALUES (:uid, 'PHARM-B', 'staff', 1, '2026-10-01T00:00:00Z');"),
                    {"uid": str(staff_b_id)},
                )

                # Staff Multi
                staff_m_id = uuid4()
                conn.execute(
                    text("INSERT INTO users (id, auth_subject, active, created_at) VALUES (:id, 'sub_staff_multi', 1, '2026-10-01T00:00:00Z');"),
                    {"id": str(staff_m_id)},
                )
                conn.execute(
                    text("""
                    INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at) VALUES
                    (:uid, 'PHARM-A', 'staff', 1, '2026-10-01T00:00:00Z'),
                    (:uid, 'PHARM-B', 'staff', 1, '2026-10-01T00:00:00Z');
                """),
                    {"uid": str(staff_m_id)},
                )

                # Staff Revoked
                staff_rev_id = uuid4()
                conn.execute(
                    text("INSERT INTO users (id, auth_subject, active, created_at) VALUES (:id, 'sub_staff_revoked', 1, '2026-10-01T00:00:00Z');"),
                    {"id": str(staff_rev_id)},
                )
                conn.execute(
                    text("INSERT INTO pharmacy_memberships (user_id, pharmacy_id, role, active, created_at) VALUES (:uid, 'PHARM-A', 'staff', 0, '2026-10-01T00:00:00Z');"),
                    {"uid": str(staff_rev_id)},
                )

                # Disabled user
                dis_id = uuid4()
                conn.execute(
                    text("INSERT INTO users (id, auth_subject, active, created_at) VALUES (:id, 'sub_disabled', 0, '2026-10-01T00:00:00Z');"),
                    {"id": str(dis_id)},
                )

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.engine.dispose()

    def test_v2_health(self):
        res = self.client.get("/api/v2/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "ready")
        self.assertEqual(data["storage"], "sqlite")
        self.assertEqual(res.headers.get("cache-control"), "no-store")

    def test_v2_me_unauthorized(self):
        res = self.client.get("/api/v2/me")
        self.assertEqual(res.status_code, 401)
        self.assertEqual(res.json()["error"]["code"], "unauthorized")

    def test_v2_me_caregiver(self):
        res = self.client.get("/api/v2/me", headers={"Authorization": "Bearer token-caregiver-1"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["active"])
        self.assertEqual(data["auth_subject"], "sub_caregiver_1")
        self.assertEqual(len(data["memberships"]), 0)

    def test_v2_me_staff(self):
        res = self.client.get("/api/v2/me", headers={"Authorization": "Bearer token-staff-a-1"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data["memberships"]), 1)
        self.assertEqual(data["memberships"][0]["pharmacy_id"], "PHARM-A")

    def test_v2_me_disabled(self):
        res = self.client.get("/api/v2/me", headers={"Authorization": "Bearer token-disabled"})
        self.assertEqual(res.status_code, 403)
        self.assertEqual(res.json()["error"]["code"], "forbidden")

    def test_v2_bootstrap(self):
        res = self.client.get("/api/v2/bootstrap", headers={"Authorization": "Bearer token-caregiver-1"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["simulated"])
        pharm_ids = [p["id"] for p in data["pharmacies"]]
        self.assertIn("PHARM-A", pharm_ids)
        self.assertIn("PHARM-B", pharm_ids)
        self.assertEqual(len(data["products"]), 3)
        self.assertEqual(len(data["claims"]), 2)

    def test_v2_enquiry_journey_and_isolation(self):
        enquiry_id = "00000000-0000-4000-8000-000000000001"
        payload = {
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "requested_quantity": 6,
            "unit": "tablet",
        }

        # 1. Caregiver 1 creates enquiry
        res = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}",
            json=payload,
            headers={"Authorization": "Bearer token-caregiver-1"},
        )
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["id"], enquiry_id)
        self.assertEqual(data["status"], "pending")
        self.assertEqual(data["answer"]["conclusion"], "unresolved")

        # 2. Caregiver 1 replays exact enquiry -> 200 OK
        res_replay = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}",
            json=payload,
            headers={"Authorization": "Bearer token-caregiver-1"},
        )
        self.assertEqual(res_replay.status_code, 200)

        # 3. Caregiver 1 alters quantity -> 409 Conflict
        res_conflict = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}",
            json={**payload, "requested_quantity": 10},
            headers={"Authorization": "Bearer token-caregiver-1"},
        )
        self.assertEqual(res_conflict.status_code, 409)
        self.assertEqual(res_conflict.json()["error"]["code"], "immutable_conflict")

        # 4. Caregiver 2 attempts to use Caregiver 1's enquiry ID -> 404 (hidden existence)
        res_cross = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}",
            json=payload,
            headers={"Authorization": "Bearer token-caregiver-2"},
        )
        self.assertEqual(res_cross.status_code, 404)

        # 5. Caregiver 1 reads own enquiry -> 200
        res_read_owner = self.client.get(
            f"/api/v2/enquiries/{enquiry_id}",
            headers={"Authorization": "Bearer token-caregiver-1"},
        )
        self.assertEqual(res_read_owner.status_code, 200)

        # 6. Caregiver 2 reads Caregiver 1's enquiry -> 404 Not Found
        res_read_cross = self.client.get(
            f"/api/v2/enquiries/{enquiry_id}",
            headers={"Authorization": "Bearer token-caregiver-2"},
        )
        self.assertEqual(res_read_cross.status_code, 404)

        # 7. Staff A1 (staff at PHARM-A) reads enquiry -> 200 OK
        res_read_staff_a = self.client.get(
            f"/api/v2/enquiries/{enquiry_id}",
            headers={"Authorization": "Bearer token-staff-a-1"},
        )
        self.assertEqual(res_read_staff_a.status_code, 200)

        # 8. Staff B (staff at PHARM-B) reads enquiry at PHARM-A -> 404 Not Found
        res_read_staff_b = self.client.get(
            f"/api/v2/enquiries/{enquiry_id}",
            headers={"Authorization": "Bearer token-staff-b"},
        )
        self.assertEqual(res_read_staff_b.status_code, 404)

        # 9. List own enquiries: Caregiver 1 has 1 item, Caregiver 2 has 0
        res_list_cg1 = self.client.get(
            "/api/v2/enquiries?limit=20&offset=0",
            headers={"Authorization": "Bearer token-caregiver-1"},
        )
        self.assertEqual(res_list_cg1.status_code, 200)
        self.assertEqual(len(res_list_cg1.json()["items"]), 1)

        res_list_cg2 = self.client.get(
            "/api/v2/enquiries?limit=20&offset=0",
            headers={"Authorization": "Bearer token-caregiver-2"},
        )
        self.assertEqual(res_list_cg2.status_code, 200)
        self.assertEqual(len(res_list_cg2.json()["items"]), 0)

        # 10. Staff queue:
        # Non-staff denied
        res_queue_cg1 = self.client.get(
            "/api/v2/staff/enquiries?pharmacy_id=PHARM-A",
            headers={"Authorization": "Bearer token-caregiver-1"},
        )
        self.assertEqual(res_queue_cg1.status_code, 403)

        # Wrong pharmacy staff denied
        res_queue_sb = self.client.get(
            "/api/v2/staff/enquiries?pharmacy_id=PHARM-A",
            headers={"Authorization": "Bearer token-staff-b"},
        )
        self.assertEqual(res_queue_sb.status_code, 403)

        # Correct pharmacy staff allowed
        res_queue_sa = self.client.get(
            "/api/v2/staff/enquiries?pharmacy_id=PHARM-A",
            headers={"Authorization": "Bearer token-staff-a-1"},
        )
        self.assertEqual(res_queue_sa.status_code, 200)
        self.assertEqual(len(res_queue_sa.json()["items"]), 1)

        # Multi-membership staff can access both queues
        res_queue_m_a = self.client.get(
            "/api/v2/staff/enquiries?pharmacy_id=PHARM-A",
            headers={"Authorization": "Bearer token-staff-multi"},
        )
        self.assertEqual(res_queue_m_a.status_code, 200)
        res_queue_m_b = self.client.get(
            "/api/v2/staff/enquiries?pharmacy_id=PHARM-B",
            headers={"Authorization": "Bearer token-staff-multi"},
        )
        self.assertEqual(res_queue_m_b.status_code, 200)
        self.assertEqual(len(res_queue_m_b.json()["items"]), 0)

        # 11. Submit observation:
        obs_payload = {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": "2026-10-07T05:15:00Z",
            "unresolved_reason": None,
        }

        # Staff B denied on PHARM-A enquiry
        res_obs_sb = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}/observation",
            json=obs_payload,
            headers={"Authorization": "Bearer token-staff-b"},
        )
        self.assertEqual(res_obs_sb.status_code, 403)

        # Revoked staff denied
        res_obs_rev = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}/observation",
            json=obs_payload,
            headers={"Authorization": "Bearer token-staff-revoked"},
        )
        self.assertEqual(res_obs_rev.status_code, 403)

        # Staff A1 submits observation -> 201 Created
        self.clock_time = datetime(2026, 10, 7, 5, 20, 0, tzinfo=timezone.utc)
        res_obs = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}/observation",
            json=obs_payload,
            headers={"Authorization": "Bearer token-staff-a-1"},
        )
        self.assertEqual(res_obs.status_code, 201)
        obs_data = res_obs.json()
        self.assertEqual(obs_data["status"], "answered")
        self.assertEqual(obs_data["answer"]["conclusion"], "insufficient")
        self.assertEqual(obs_data["answer"]["discrepancy_units"], -8)

        # Staff A1 replays identical observation -> 200 OK
        res_obs_replay = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}/observation",
            json=obs_payload,
            headers={"Authorization": "Bearer token-staff-a-1"},
        )
        self.assertEqual(res_obs_replay.status_code, 200)

        # Competing Staff A2 attempts observation on same enquiry -> 409 Conflict
        res_obs_competing = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}/observation",
            json=obs_payload,
            headers={"Authorization": "Bearer token-staff-a-2"},
        )
        self.assertEqual(res_obs_competing.status_code, 409)
        self.assertEqual(res_obs_competing.json()["error"]["code"], "immutable_conflict")

        # Staff A1 attempts observation with different count -> 409 Conflict
        res_obs_changed = self.client.put(
            f"/api/v2/enquiries/{enquiry_id}/observation",
            json={**obs_payload, "obtainable_quantity": 8},
            headers={"Authorization": "Bearer token-staff-a-1"},
        )
        self.assertEqual(res_obs_changed.status_code, 409)

        # 12. Check pending queue now empty
        res_queue_after = self.client.get(
            "/api/v2/staff/enquiries?pharmacy_id=PHARM-A",
            headers={"Authorization": "Bearer token-staff-a-1"},
        )
        self.assertEqual(res_queue_after.status_code, 200)
        self.assertEqual(len(res_queue_after.json()["items"]), 0)

        # 13. Caregiver 1 reads answered enquiry
        res_final = self.client.get(
            f"/api/v2/enquiries/{enquiry_id}",
            headers={"Authorization": "Bearer token-caregiver-1"},
        )
        self.assertEqual(res_final.status_code, 200)
        final_data = res_final.json()
        self.assertEqual(final_data["status"], "answered")
        self.assertEqual(final_data["answer"]["conclusion"], "insufficient")
        self.assertEqual(final_data["observation"]["reported_by_user_id"], str(final_data["observation"]["reported_by_user_id"]))


if __name__ == "__main__":
    unittest.main()
