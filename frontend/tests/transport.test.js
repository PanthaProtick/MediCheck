import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchWithDeadline,
  createEnquiry,
  createEnquiryV2,
  getEnquiry,
  getEnquiryV2,
  submitObservation,
  submitObservationV2,
  listStaffEnquiries,
  getCurrentUser,
  getBootstrapV2,
  listOwnEnquiries,
  listPharmacyQueue,
} from '../src/services/api.js';
import {
  parseQuantity,
  matchesIntent,
  createReadGuard,
  saveUserIntent,
  loadUserIntent,
  clearUserSessionData,
  getIntentStorageKey,
} from '../src/services/recovery.js';

// Polyfill sessionStorage for Node.js test runner if not present
if (typeof globalThis.sessionStorage === 'undefined') {
  const store = new Map();
  globalThis.sessionStorage = {
    getItem: key => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    clear: () => store.clear(),
  };
}

const id = '00000000-0000-4000-8000-000000000077';
const userId = 'c1000000-0000-4000-8000-000000000001';
const staffId = 'a1000000-0000-4000-8000-000000000001';
const otherStaffId = 'b1000000-0000-4000-8000-000000000003';
const payload = { pharmacy_id: 'PHARM-A', product_id: 'MED-A', requested_quantity: 6, unit: 'tablet' };

const view = {
  id,
  pharmacy_id: 'PHARM-A',
  product: { id: 'MED-A', name: 'Demo', strength: '10 mg', form: 'tablet', unit: 'tablet' },
  requested_quantity: 6,
  unit: 'tablet',
  observation: null,
  claim: null,
  simulated: true,
  status: 'pending',
  created_at: '2026-10-07T05:00:00Z',
  served_at: '2026-10-07T05:00:00Z',
  answer: { conclusion: 'unresolved', reason: 'awaiting_check', discrepancy_units: null, message: 'Pending', limitations: [] },
};

const viewV2 = {
  id,
  owner_user_id: userId,
  pharmacy_id: 'PHARM-A',
  product: { id: 'MED-A', name: 'Demo', strength: '10 mg', form: 'tablet', unit: 'tablet' },
  requested_quantity: 6,
  unit: 'tablet',
  observation: null,
  claim: null,
  simulated: true,
  status: 'pending',
  created_at: '2026-10-07T05:00:00Z',
  served_at: '2026-10-07T05:00:00Z',
  answer: { conclusion: 'unresolved', reason: 'awaiting_check', discrepancy_units: null, message: 'Pending', limitations: [] },
};

const originalFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.sessionStorage.clear();
});

const mock = (status, data) => {
  globalThis.fetch = async () => ({ ok: status < 400, status, json: async () => data });
};

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

// ==========================================
// V2 Transport & Account Scoping (P06 / P07)
// ==========================================

test('v2 getCurrentUser loads user identity and memberships with Bearer token', async () => {
  const userPayload = {
    user_id: userId,
    active: true,
    auth_subject: 'user_clerk_123',
    email: 'test@example.com',
    full_name: 'Test Caregiver',
    status: 'active',
    memberships: [
      { pharmacy_id: 'PHARM-A', pharmacy_name: 'Pharmacy A', role: 'staff', active: true, created_at: '2026-10-07T05:00:00Z' }
    ]
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/v2/me');
    assert.equal(options.headers.Authorization, 'Bearer v2-token');
    return { ok: true, json: async () => userPayload };
  };
  const res = await getCurrentUser('v2-token');
  assert.equal(res.user_id, userId);
  assert.equal(res.memberships.length, 1);
});

test('v2 getBootstrap loads multi-pharmacy catalog and claims', async () => {
  const bootPayload = {
    simulated: true,
    timestamp: '2026-10-07T05:00:00Z',
    pharmacies: [
      { id: 'PHARM-A', name: 'Downtown A', active: true, simulated: true },
      { id: 'PHARM-B', name: 'Westside B', active: true, simulated: true }
    ],
    products: [
      { id: 'MED-A', name: 'Med A', strength: '10mg', form: 'tablet', unit: 'tablet' },
      { id: 'MED-B', name: 'Med B', strength: '20mg', form: 'capsule', unit: 'capsule' }
    ],
    claims: [
      { id: 'CLAIM-A', pharmacy_id: 'PHARM-A', product_id: 'MED-A', quantity: 12, unit: 'tablet', recorded_at: '2026-10-07T05:00:00Z', loaded_at: '2026-10-07T05:00:00Z', source: 'Synthetic', simulated: true }
    ]
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/v2/bootstrap');
    assert.equal(options.headers.Authorization, 'Bearer v2-token');
    return { ok: true, json: async () => bootPayload };
  };
  const res = await getBootstrapV2('v2-token');
  assert.equal(res.pharmacies.length, 2);
  assert.equal(res.products.length, 2);
});

test('v2 createEnquiryV2 dispatches to /api/v2/enquiries and validates v2 view with owner_id', async () => {
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `/api/v2/enquiries/${id}`);
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers.Authorization, 'Bearer v2-token');
    assert.deepEqual(JSON.parse(options.body), payload);
    return { ok: true, status: 201, json: async () => viewV2 };
  };
  const res = await createEnquiryV2(id, payload, 'v2-token');
  assert.equal(res.owner_user_id, userId);
  assert.equal(res.pharmacy_id, 'PHARM-A');
});

test('v2 listOwnEnquiries and listPharmacyQueue validate paginated envelopes', async () => {
  const pagePayload = {
    items: [viewV2],
    limit: 10,
    offset: 0,
    has_more: false
  };
  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/api\/v2\/enquiries\?limit=10/);
    assert.equal(options.headers.Authorization, 'Bearer v2-token');
    return { ok: true, json: async () => pagePayload };
  };
  const ownPage = await listOwnEnquiries('v2-token', null, 10);
  assert.equal(ownPage.items.length, 1);
  assert.equal(ownPage.has_more, false);

  globalThis.fetch = async (url, options) => {
    assert.match(url, /\/api\/v2\/pharmacies\/PHARM-A\/queue\?limit=5/);
    assert.equal(options.headers.Authorization, 'Bearer staff-token');
    return { ok: true, json: async () => ({ ...pagePayload, limit: 5 }) };
  };
  const queuePage = await listPharmacyQueue('PHARM-A', 'staff-token', null, 5);
  assert.equal(queuePage.items.length, 1);
});

test('v2 submitObservationV2 dispatches to /api/v2/enquiries/{id}/observation', async () => {
  const obsPayload = {
    product_id: 'MED-A',
    unit: 'tablet',
    kind: 'checked',
    obtainable_quantity: 4,
    observed_at: '2026-10-07T05:02:00Z',
    unresolved_reason: null
  };
  const answeredView = {
    ...viewV2,
    status: 'answered',
    observation: {
      id: 'o1000000-0000-4000-8000-000000000001',
      enquiry_id: id,
      reported_by_user_id: staffId,
      product_id: 'MED-A',
      unit: 'tablet',
      kind: 'checked',
      obtainable_quantity: 4,
      observed_at: '2026-10-07T05:02:00Z',
      unresolved_reason: null,
      submitted_at: '2026-10-07T05:02:00Z', basis: 'staff_reported_obtainable_count', simulated: true
    },
    answer: {
      conclusion: 'insufficient',
      reason: 'checked_below_request',
      discrepancy_units: -8,
      message: 'Physical stock insufficient',
      limitations: []
    }
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, `/api/v2/enquiries/${id}/observation`);
    assert.equal(options.method, 'PUT');
    assert.equal(options.headers.Authorization, 'Bearer staff-token');
    return { ok: true, status: 200, json: async () => answeredView };
  };
  const res = await submitObservationV2(id, obsPayload, 'staff-token');
  assert.equal(res.status, 'answered');
  assert.equal(res.observation.reported_by_user_id, staffId);
});

test('P07: lost report inspection rejects match if reporter UUID is different staff member', () => {
  const reportPayload = {
    product_id: 'MED-A',
    unit: 'tablet',
    kind: 'checked',
    obtainable_quantity: 4,
    observed_at: '2026-10-07T05:02:00Z',
    unresolved_reason: null
  };
  const intent = {
    type: 'report',
    id,
    userId: staffId, // This staff member attempted the submission
    payload: reportPayload
  };

  // Another staff member reported matching count at the exact same time
  const observationByOther = {
    ...reportPayload,
    id: 'o2000000-0000-4000-8000-000000000002',
    reporter_id: otherStaffId,
  };
  const viewOtherStaff = {
    ...viewV2,
    observation: observationByOther,
  };

  // Must NOT match because reporter_id is other staff member
  assert.equal(matchesIntent(viewOtherStaff, intent), false);

  // When reporter_id matches this staff member, it does match
  const observationByThisStaff = {
    ...reportPayload,
    id: 'o1000000-0000-4000-8000-000000000001',
    reported_by_user_id: staffId,
  };
  const viewThisStaff = {
    ...viewV2,
    observation: observationByThisStaff,
  };
  assert.equal(matchesIntent(viewThisStaff, intent), true);
});

test('P07: intent storage is scoped by user UUID and cleared on account switch', () => {
  const intentA = { type: 'create', id, userId, payload };
  const intentB = { type: 'create', id: '00000000-0000-4000-8000-000000000088', userId: 'user-b', payload };

  saveUserIntent(intentA, userId);
  saveUserIntent(intentB, 'user-b');

  // Key is strictly user-scoped
  assert.equal(getIntentStorageKey(userId), `rxverify_intent_v2_${userId}`);
  assert.equal(loadUserIntent(userId)?.id, id);
  assert.equal(loadUserIntent('user-b')?.id, '00000000-0000-4000-8000-000000000088');

  // Switching or clearing user A does not pollute or leak to user B
  clearUserSessionData(userId);
  assert.equal(loadUserIntent(userId), null);
  assert.equal(loadUserIntent('user-b')?.id, '00000000-0000-4000-8000-000000000088');
});

test('P07: context-bound read guards drop responses if user or pharmacy changed', () => {
  const guard = createReadGuard();
  const ticket = guard.begin('user-1', 'PHARM-A', 'enquiry-1');

  // Same context is current
  assert.equal(guard.isCurrent(ticket, 'user-1', 'PHARM-A', 'enquiry-1'), true);

  // If user changed, not current
  assert.equal(guard.isCurrent(ticket, 'user-2', 'PHARM-A', 'enquiry-1'), false);

  // If pharmacy changed, not current
  assert.equal(guard.isCurrent(ticket, 'user-1', 'PHARM-B', 'enquiry-1'), false);

  // Invalidation drops ticket
  guard.invalidate();
  assert.equal(guard.isCurrent(ticket, 'user-1', 'PHARM-A', 'enquiry-1'), false);
});

import { isView } from '../src/services/api.js';
import { isLocalIntent, loadLocalIntent, saveLocalIntent } from '../src/services/localRecovery.js';

test('malformed local evidence is rejected before display, including nested counts and timestamps', async () => {
  const claim = { id: 'CLAIM-A', pharmacy_id: 'PHARM-A', product_id: 'MED-A', quantity: 12, unit: 'tablet',
    recorded_at: view.created_at, loaded_at: view.created_at, source: 'Synthetic', simulated: true };
  const observation = { product_id: 'MED-A', unit: 'tablet', kind: 'checked', obtainable_quantity: 4,
    observed_at: view.created_at, unresolved_reason: null, staff_id: 'STAFF-DEMO', submitted_at: view.served_at,
    basis: 'staff_reported_obtainable_count', simulated: true };
  assert.equal(!!isView({ ...view, claim, observation }, id), true);
  for (const bad of [
    { ...view, claim: { id: 'CLAIM-A' } },
    { ...view, claim: { ...claim, quantity: '12' } },
    { ...view, observation: { kind: 'checked' } },
    { ...view, observation: { ...observation, obtainable_quantity: -1 } },
    { ...view, observation: { ...observation, observed_at: 'bad time' } },
    { ...view, served_at: 'bad time' },
    { ...view, requested_quantity: 0 },
    { ...view, answer: { ...view.answer, reason: 'invented' } },
  ]) {
    mock(200, bad);
    await assert.rejects(() => getEnquiry(id), error => error.code === 'invalid_response');
  }
});

test('local recovered writes are role-separated and never persist access credentials', () => {
  const create = { type: 'create', id, payload, accessKey: 'must-not-persist' };
  const report = { type: 'report', id, payload: { product_id: 'MED-A', unit: 'tablet', kind: 'checked',
    obtainable_quantity: 0, observed_at: null, unresolved_reason: null } };
  saveLocalIntent('caregiver', create);
  saveLocalIntent('staff', report);
  assert.deepEqual(loadLocalIntent('caregiver'), { type: 'create', id, payload });
  assert.deepEqual(loadLocalIntent('staff'), report);
  assert.equal(isLocalIntent(report, 'caregiver'), false);
  assert.equal(isLocalIntent(create, 'staff'), false);
  saveLocalIntent('staff', null);
  assert.equal(loadLocalIntent('staff'), null);
  assert.equal(loadLocalIntent('caregiver').id, id);
});

test('corrupt local recovery storage and incomplete intents cannot trigger writes', () => {
  sessionStorage.setItem('medicine_check_local_intent_staff', '{broken');
  assert.equal(loadLocalIntent('staff'), null);
  for (const bad of [null, {}, { type: 'report', id, payload: {} },
    { type: 'report', id, payload: { product_id: 'MED-A', unit: 'tablet', kind: 'checked',
      obtainable_quantity: null, observed_at: null, unresolved_reason: null } }]) {
    assert.equal(isLocalIntent(bad, 'staff'), false);
  }
  assert.equal(matchesIntent(view, { type: 'create', id }), false);
});


test('every hosted transport rejects empty credentials before fetching', async () => {
  let calls = 0;
  globalThis.fetch = async () => { calls++; throw new Error('Must not fetch'); };
  try {
    for (const call of [() => getCurrentUser(''), () => getBootstrapV2(null),
      () => getEnquiryV2(id, ' '), () => createEnquiryV2(id, payload, null),
      () => submitObservationV2(id, {}, ''), () => listOwnEnquiries(''),
      () => listPharmacyQueue('PHARM-A', null)]) await assert.rejects(call);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test('hosted reads reject absent canonical ownership', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify(view), {status:200});
  try { await assert.rejects(() => getEnquiryV2(id, 'session')); }
  finally { globalThis.fetch = originalFetch; }
});

test('hosted pagination uses offsets and rejects mismatching pages', async () => {
  let path;
  globalThis.fetch = async url => { path = url; return new Response(JSON.stringify({items:[],limit:10,offset:10,has_more:false}), {status:200}); };
  try {
    await listOwnEnquiries('session', 10, 10);
    assert.equal(path, '/api/v2/enquiries?limit=10&offset=10');
    await assert.rejects(() => listOwnEnquiries('session', 20, 10));
  } finally { globalThis.fetch = originalFetch; }
});
