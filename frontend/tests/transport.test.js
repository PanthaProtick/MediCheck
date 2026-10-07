import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchWithDeadline, createEnquiry, getEnquiry, submitObservation, listStaffEnquiries } from '../src/services/api.js';
import { parseQuantity, matchesIntent, createReadGuard } from '../src/services/recovery.js';

const id = '00000000-0000-4000-8000-000000000077';
const payload = { pharmacy_id: 'PHARM-A', product_id: 'MED-A', requested_quantity: 6, unit: 'tablet' };
const view = { id, pharmacy_id: 'PHARM-A', product: { id: 'MED-A', name: 'Demo', strength: '10 mg', form: 'tablet', unit: 'tablet' }, requested_quantity: 6, unit: 'tablet', observation: null, claim: null, simulated: true, status: 'pending', created_at: '2026-10-07T05:00:00Z', served_at: '2026-10-07T05:00:00Z', answer: { conclusion: 'unresolved', reason: 'awaiting_check', discrepancy_units: null, message: 'Pending', limitations: [] } };
const originalFetch = globalThis.fetch;
test.afterEach(() => { globalThis.fetch = originalFetch; });
const mock = (status, data) => { globalThis.fetch = async () => ({ ok: status < 400, status, json: async () => data }); };

test('production client preserves structured 401 and 422 errors', async () => {
  for (const status of [401, 422]) {
    mock(status, { error: { code: status === 401 ? 'unauthorized' : 'validation_error', message: 'Rejected', fields: [] } });
    await assert.rejects(() => listStaffEnquiries('test-only-token'), error => error.kind === 'http' && error.status === status);
  }
});
test('write deadline bounds waiting for headers without relying on a live server', async () => {
  globalThis.fetch = () => new Promise(() => {});
  await assert.rejects(() => fetchWithDeadline('/test', {}, 15, true), error => error.code === 'timeout' && error.outcome === 'unknown');
});
test('deadline also bounds response body consumption', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: () => new Promise(() => {}) });
  await assert.rejects(() => fetchWithDeadline('/test', {}, 15, true), error => error.code === 'timeout' && error.outcome === 'unknown');
});
test('invalid JSON after a write leaves its outcome unknown', async () => {
  globalThis.fetch = async () => ({ ok: true, json: async () => { throw new SyntaxError(); } });
  await assert.rejects(() => createEnquiry(id, payload), error => error.code === 'invalid_response' && error.outcome === 'unknown');
});
test('malformed success/error bodies cannot manufacture saved evidence', async () => {
  for (const [status, data] of [[200, null], [200, {}], [502, {}]]) {
    mock(status, data);
    await assert.rejects(() => createEnquiry(id, payload), error => error.code === 'invalid_response' && error.outcome === 'unknown');
  }
});
test('server errors after a write require inspection', async () => {
  mock(500, { error: { code: 'internal_error', message: 'Failed', fields: [] } });
  await assert.rejects(() => createEnquiry(id, payload), error => error.status === 500 && error.outcome === 'unknown');
});
test('read network failure cannot imply a saved write', async () => {
  globalThis.fetch = async () => { throw new Error('offline'); };
  await assert.rejects(() => getEnquiry(id), error => error.code === 'network_error' && error.outcome === 'not_applicable');
});
test('client rejects invalid IDs before dispatch', async () => {
  globalThis.fetch = () => { assert.fail('Invalid UUID reached fetch'); };
  for (const invalid of ['../staff/enquiries', '', id.toUpperCase().replace('000000000077', 'ABCDEF000077')]) {
    await assert.rejects(() => getEnquiry(invalid), error => error.kind === 'client');
  }
});
test('successful client requests use exact route/body and no-store', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `/api/v1/enquiries/${id}`);
    assert.equal(options.method, 'PUT');
    assert.equal(options.cache, 'no-store');
    assert.deepEqual(JSON.parse(options.body), payload);
    assert.equal(options.headers.Authorization, undefined);
    return { ok: true, status: 201, json: async () => view };
  };
  assert.deepEqual(await createEnquiry(id, payload), view);
});
test('staff credential travels only through Authorization header', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `/api/v1/enquiries/${id}/observation`);
    assert.equal(options.headers.Authorization, 'Bearer test-only-token');
    assert.equal(options.body.includes('test-only-token'), false);
    return { ok: true, json: async () => view };
  };
  await submitObservation(id, {}, 'test-only-token');
});
test('whole quantities reject truncation, fractions, empty, overflow and exponent input', () => {
  for (const bad of ['', '6.2', '6x', '-1', '10001', '1e2', ' 6']) assert.equal(parseQuantity(bad, 0), null);
  assert.equal(parseQuantity('0', 0), 0);
  assert.equal(parseQuantity('0', 1), null);
  assert.equal(parseQuantity('10000', 1), 10000);
});
test('lost create response is settled only by inspecting matching immutable fields', async () => {
  let saved;
  let writes = 0;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'PUT') { saved = view; writes++; throw new Error('response lost after commit'); }
    return { ok: true, json: async () => saved };
  };
  const intent = { type: 'create', id, payload };
  await assert.rejects(() => createEnquiry(id, payload));
  assert.equal(matchesIntent(await getEnquiry(id), intent), true);
  assert.equal(matchesIntent({ ...view, requested_quantity: 7 }, intent), false);
  assert.equal(writes, 1);
});
test('report inspection compares every attempted field and microsecond instant', () => {
  const report = { product_id: 'MED-A', unit: 'tablet', kind: 'checked', obtainable_quantity: 4,
    observed_at: '2026-10-07T05:02:00.123456Z', unresolved_reason: null };
  const intent = { type: 'report', id, payload: report };
  const saved = { ...view, observation: { ...report, observed_at: '2026-10-07T11:02:00.123456+06:00' } };
  assert.equal(matchesIntent(saved, intent), true);
  assert.equal(matchesIntent(view, intent), false);
  assert.equal(matchesIntent({ ...saved, observation: { ...report, observed_at: '2026-10-07T05:02:00.123457Z' } }, intent), false);
  assert.equal(matchesIntent({ ...saved, observation: { ...report, obtainable_quantity: 5 } }, intent), false);
});
test('out-of-order reads and reads started before a mutation are ignored', () => {
  const guard = createReadGuard();
  const older = guard.begin();
  const newer = guard.begin();
  assert.equal(guard.isCurrent(older), false);
  assert.equal(guard.isCurrent(newer), true);
  guard.invalidate();
  assert.equal(guard.isCurrent(newer), false);
});
