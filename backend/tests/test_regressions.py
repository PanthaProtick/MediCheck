import json
from pathlib import Path
import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from app.core.config import Settings
from app.core.database import connect_database, initialize_database
from app.core.errors import AppError
from app.core.security import require_staff
from app.main import create_app

ID = '00000000-0000-4000-8000-000000000077'
CREATE = dict(pharmacy_id='PHARM-A', product_id='MED-A', requested_quantity=6, unit='tablet')
REPORT = dict(product_id='MED-A', unit='tablet', kind='checked', obtainable_quantity=4,
              observed_at='2026-10-07T05:02:00.123456Z', unresolved_reason=None)
AUTH = {'Authorization': 'Bearer test-only-token'}

class Regressions(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = str(Path(self.temp.name) / 'db.sqlite3')
        self.dist = Path(self.temp.name) / 'dist'
        self.dist.mkdir()
        (self.dist / 'index.html').write_text('<html>demo</html>', encoding='utf-8')
        self.now = datetime(2026, 10, 7, 5, 10, 0, 654321, tzinfo=timezone.utc)
        self.settings = Settings(_env_file=None, DEMO_DATABASE_PATH=self.path,
                                 DEMO_STAFF_TOKEN='test-only-token', STATIC_DIR=str(self.dist), ENV='demo')
        self.client = TestClient(create_app(self.settings, lambda: self.now), raise_server_exceptions=False)
        self.client.__enter__()
        self.addCleanup(self.client.__exit__, None, None, None)

    def create(self, payload=None, id=ID):
        return self.client.put('/api/v1/enquiries/' + id, json=payload or CREATE)

    def report(self, payload=None):
        return self.client.put(f'/api/v1/enquiries/{ID}/observation', json=payload or REPORT, headers=AUTH)

    def mutate(self, sql, params=()):
        conn = connect_database(self.path)
        try:
            conn.execute(sql, params)
            conn.commit()
        finally:
            conn.close()

    def assertError(self, response, status, code):
        self.assertEqual(response.status_code, status, response.text)
        self.assertEqual(response.json()['error']['code'], code)
        self.assertEqual(response.headers['cache-control'], 'no-store')

    def test_invalid_uuid_all_public_paths_return_422(self):
        for invalid in ['bad-id', 'ABCDEF00-0000-4000-8000-000000000077', '{' + ID + '}']:
            self.assertError(self.client.get('/api/v1/enquiries/' + invalid), 422, 'validation_error')
            self.assertError(self.create(id=invalid), 422, 'validation_error')
            self.assertError(self.client.put('/api/v1/enquiries/' + invalid + '/observation', json=REPORT, headers=AUTH), 422, 'validation_error')

    def test_fractional_times_survive_read_and_exact_replay(self):
        created = self.create().json()
        first = self.report().json()
        read = self.client.get('/api/v1/enquiries/' + ID).json()
        self.assertEqual(created['created_at'], read['created_at'])
        self.assertEqual(first['observation'], read['observation'])
        self.assertEqual(read['observation']['observed_at'], REPORT['observed_at'])
        self.assertEqual(self.report().status_code, 200)
        offset = {**REPORT, 'observed_at': '2026-10-07T11:02:00.123456+06:00'}
        self.assertEqual(self.report(offset).status_code, 200)
        changed = {**REPORT, 'observed_at': '2026-10-07T05:02:00.123457Z'}
        self.assertError(self.report(changed), 409, 'immutable_conflict')

    def test_report_at_submission_fraction_is_not_false_conflict(self):
        self.create()
        result = self.report({**REPORT, 'observed_at': self.now.isoformat()}).json()
        read = self.client.get('/api/v1/enquiries/' + ID).json()
        self.assertEqual(result['answer'], read['answer'])
        self.assertEqual(read['answer']['conclusion'], 'insufficient')

    def test_future_and_mismatched_reports_leave_queue_pending(self):
        self.create()
        for report in [{**REPORT, 'observed_at': '2026-10-07T05:10:01Z'}, {**REPORT, 'product_id': 'MED-B'}, {**REPORT, 'unit': 'capsule'}]:
            self.assertError(self.report(report), 422, 'validation_error')
        read = self.client.get('/api/v1/enquiries/' + ID).json()
        self.assertIsNone(read['observation'])
        self.assertEqual(len(self.client.get('/api/v1/staff/enquiries', headers=AUTH).json()), 1)

    def test_invalid_quantities_rejected_by_actual_http(self):
        for quantity in [True, 6.0, '6', 0, -1, 10001]:
            self.assertError(self.create({**CREATE, 'requested_quantity': quantity}), 422, 'validation_error')
        self.create()
        for quantity in [True, 4.0, '4', -1, 10001]:
            self.assertError(self.report({**REPORT, 'obtainable_quantity': quantity}), 422, 'validation_error')
        self.assertEqual(self.report({**REPORT, 'obtainable_quantity': 0}).json()['answer']['discrepancy_units'], -12)

    def test_missing_nullable_and_extra_identity_fields_rejected(self):
        self.create()
        for field in ['observed_at', 'unresolved_reason']:
            payload = dict(REPORT)
            del payload[field]
            self.assertError(self.report(payload), 422, 'validation_error')
        self.assertError(self.report({**REPORT, 'staff_id': 'STAFF-OTHER'}), 422, 'validation_error')

    def test_unknown_time_and_unable_report_are_distinct(self):
        self.create()
        result = self.report({**REPORT, 'observed_at': None}).json()
        self.assertEqual(result['answer']['reason'], 'observation_time_unknown')
        second = '00000000-0000-4000-8000-000000000078'
        self.create(id=second)
        result = self.client.put('/api/v1/enquiries/' + second + '/observation', json={**REPORT,
            'kind': 'unable_to_check', 'obtainable_quantity': None, 'observed_at': None,
            'unresolved_reason': 'cannot_check'}, headers=AUTH).json()
        self.assertEqual(result['answer']['reason'], 'cannot_check')

    def test_missing_claim_does_not_become_zero(self):
        result = self.create({**CREATE, 'product_id': 'MED-B'}).json()
        self.assertIsNone(result['claim'])
        result = self.report({**REPORT, 'product_id': 'MED-B', 'obtainable_quantity': 6}).json()
        self.assertEqual(result['answer']['conclusion'], 'sufficient')
        self.assertIsNone(result['answer']['discrepancy_units'])

    def test_framework_errors_are_json(self):
        self.assertError(self.client.get('/api/v1/missing'), 404, 'not_found')
        self.assertError(self.client.post('/api/v1/health', json={}), 405, 'method_not_allowed')
        self.assertError(self.client.put('/api/v1/enquiries/' + ID, content=json.dumps(CREATE)), 415, 'unsupported_media_type')
        self.assertError(self.client.put('/api/v1/enquiries/' + ID, content='{', headers={'Content-Type': 'application/json'}), 422, 'validation_error')

    def test_readiness_requires_all_tables(self):
        self.mutate('DROP TABLE observations')
        self.assertError(self.client.get('/api/v1/health'), 503, 'storage_unavailable')
        self.assertError(self.client.get('/api/v1/staff/enquiries', headers=AUTH), 503, 'storage_unavailable')

    def test_busy_storage_has_safe_503_no_write(self):
        conn = connect_database(self.path)
        try:
            conn.execute('BEGIN EXCLUSIVE')
            result = self.create()
            self.assertError(result, 503, 'storage_unavailable')
            self.assertNotIn(self.path, result.text)
            self.assertError(self.client.get('/api/v1/bootstrap'), 503, 'storage_unavailable')
        finally:
            conn.rollback()
            conn.close()
        self.assertError(self.client.get('/api/v1/enquiries/' + ID), 404, 'not_found')

    def test_malformed_snapshot_returns_safe_500(self):
        self.create()
        self.mutate('UPDATE enquiries SET product_snapshot_json = ? WHERE id = ?', ('{', ID))
        self.assertError(self.client.get('/api/v1/enquiries/' + ID), 500, 'internal_error')

    def test_malformed_bootstrap_returns_safe_500(self):
        self.mutate("UPDATE products SET name = '' WHERE id = 'MED-A'")
        self.assertError(self.client.get('/api/v1/bootstrap'), 500, 'internal_error')

    def test_saved_enquiry_unit_conflict_cannot_answer_positive(self):
        self.create()
        self.mutate("UPDATE enquiries SET unit = 'capsule' WHERE id = ?", (ID,))
        result = self.client.get('/api/v1/enquiries/' + ID).json()
        self.assertEqual(result['answer']['reason'], 'evidence_conflict')
        self.assertEqual(result['answer']['conclusion'], 'unresolved')

    def test_incompatible_claim_pharmacy_not_used_for_discrepancy(self):
        self.create()
        conn = connect_database(self.path)
        try:
            row = conn.execute('SELECT claim_snapshot_json FROM enquiries WHERE id = ?', (ID,)).fetchone()
        finally:
            conn.close()
        claim = json.loads(row[0]); claim['pharmacy_id'] = 'PHARM-B'
        self.mutate('UPDATE enquiries SET claim_snapshot_json = ? WHERE id = ?', (json.dumps(claim), ID))
        result = self.report().json()
        self.assertEqual(result['answer']['conclusion'], 'insufficient')
        self.assertIsNone(result['answer']['discrepancy_units'])
        self.assertIn('incompatible', result['answer']['message'])

    def test_static_traversal_cannot_read_sibling_file(self):
        (Path(self.temp.name) / 'secret.txt').write_text('do-not-expose', encoding='utf-8')
        result = self.client.get('/%2e%2e/secret.txt')
        self.assertEqual(result.status_code, 404)
        self.assertNotIn('do-not-expose', result.text)
        self.assertEqual(self.client.get('/').status_code, 200)

    def test_unicode_token_is_safe_rejection(self):
        with self.assertRaises(AppError) as error:
            require_staff('Bearer non-ascii-' + chr(233), self.settings)
        self.assertEqual(error.exception.status_code, 401)

    def test_missing_token_and_relative_database_fail_startup(self):
        for overrides in [{'DEMO_STAFF_TOKEN': ''}, {'DEMO_DATABASE_PATH': 'relative.sqlite3'}]:
            settings = self.settings.model_copy(update=overrides)
            with self.assertRaises(RuntimeError):
                with TestClient(create_app(settings)):
                    pass

    def test_storage_rejects_fractional_counts_and_foreign_keys(self):
        self.create()
        conn = connect_database(self.path)
        try:
            for sql in ["UPDATE enquiries SET requested_quantity = 1.5", "UPDATE claims SET quantity = 1.5",
                        "UPDATE enquiries SET product_id = 'MISSING'"]:
                with self.assertRaises(sqlite3.IntegrityError): conn.execute(sql)
                conn.rollback()
        finally:
            conn.close()

    def test_repeated_init_keeps_snapshot_and_report(self):
        self.create(); self.report()
        before = self.client.get('/api/v1/enquiries/' + ID).json()
        initialize_database(self.path)
        after = self.client.get('/api/v1/enquiries/' + ID).json()
        self.assertEqual(before, after)

    def test_timestamp_utc_overflow_is_validation_error(self):
        self.create()
        for timestamp in ['0001-01-01T00:00:00+06:00', '9999-12-31T23:59:59-06:00']:
            self.assertError(self.report({**REPORT, 'observed_at': timestamp}), 422, 'validation_error')

    def test_sql_null_logic_cannot_accept_incoherent_unable_report(self):
        self.create(); self.report()
        conn = connect_database(self.path)
        try:
            with self.assertRaises(sqlite3.IntegrityError):
                conn.execute("UPDATE observations SET kind = 'unable_to_check', obtainable_quantity = NULL, observed_at = NULL, unresolved_reason = NULL, basis = 'unable_to_check'")
            conn.rollback()
        finally:
            conn.close()

    def test_snapshot_identity_corruption_is_not_silently_reinterpreted(self):
        self.create()
        self.mutate("UPDATE enquiries SET product_id = 'MED-B' WHERE id = ?", (ID,))
        self.assertError(self.client.get('/api/v1/enquiries/' + ID), 500, 'internal_error')
