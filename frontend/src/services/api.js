const V1_BASE_URL = '/api/v1';
const V2_BASE_URL = '/api/v2';

export async function fetchWithDeadline(url, options = {}, deadlineMs = 3000, isWrite = false, validate = () => true) {
  const outcome = isWrite ? 'unknown' : 'not_applicable';
  const controller = new AbortController();
  let timeoutId;
  const timer = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject({ kind: 'transport', code: 'timeout', message: `Request timed out after ${deadlineMs}ms.`, outcome });
      controller.abort();
    }, deadlineMs);
  });
  try {
    return await Promise.race([(async () => {
      const res = await fetch(url, { ...options, cache: 'no-store', signal: controller.signal });
      let data;
      try { data = await res.json(); } catch {
        throw { kind: 'transport', code: 'invalid_response', message: 'Server response is not valid JSON.', outcome };
      }
      if (!res.ok) {
        if (!data?.error || typeof data.error.code !== 'string' || typeof data.error.message !== 'string') {
          throw { kind: 'transport', code: 'invalid_response', message: 'Server error response is malformed.', outcome };
        }
        throw { kind: 'http', status: res.status, error: data.error,
          outcome: isWrite && res.status >= 500 ? 'unknown' : 'not_applicable' };
      }
      if (data === null || typeof data !== 'object' || !validate(data)) {
        throw { kind: 'transport', code: 'invalid_response', message: 'Server response is malformed.', outcome };
      }
      return data;
    })(), timer]);
  } catch (err) {
    if (err?.kind === 'http' || err?.kind === 'transport') throw err;
    throw { kind: 'transport', code: 'network_error', message: err.message || 'Network error encountered.', outcome };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function enquiryPath(id, baseUrl = V1_BASE_URL) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw { kind: 'client', message: 'Enter a canonical lowercase enquiry UUID.' };
  }
  return `${baseUrl}/enquiries/${id}`;
}

export const isProduct = data => data && ['id', 'name', 'strength', 'form'].every(key => typeof data[key] === 'string') && ['tablet', 'capsule'].includes(data.unit);

const isTime = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value));
const isCount = value => Number.isSafeInteger(value) && value >= 0 && value <= 10000;
const isUnit = value => ['tablet', 'capsule'].includes(value);
const isClaim = value => value && ['id', 'pharmacy_id', 'product_id', 'source'].every(key => typeof value[key] === 'string') &&
  (value.quantity === null || isCount(value.quantity)) && isUnit(value.unit) &&
  (value.recorded_at === null || isTime(value.recorded_at)) && isTime(value.loaded_at) && value.simulated === true;
const isObservation = value => value && typeof value.product_id === 'string' && typeof value.staff_id === 'string' &&
  isUnit(value.unit) && isTime(value.submitted_at) && value.simulated === true &&
  (value.kind === 'checked' ? isCount(value.obtainable_quantity) &&
    (value.observed_at === null || isTime(value.observed_at)) && value.unresolved_reason === null && value.basis === 'staff_reported_obtainable_count' :
    value.kind === 'unable_to_check' && value.obtainable_quantity === null && value.observed_at === null &&
    value.unresolved_reason === 'cannot_check' && value.basis === 'unable_to_check');
export const isView = (data, id) => data && data.id === id && isProduct(data.product) &&
  typeof data.pharmacy_id === 'string' && isCount(data.requested_quantity) && data.requested_quantity > 0 &&
  isUnit(data.unit) && isTime(data.created_at) && isTime(data.served_at) && data.simulated === true &&
  ['pending', 'answered', 'unresolved'].includes(data.status) &&
  (data.claim === null || isClaim(data.claim)) && (data.observation === null || isObservation(data.observation)) &&
  data.answer && ['sufficient', 'insufficient', 'unresolved'].includes(data.answer.conclusion) &&
  ['awaiting_check', 'checked_meets_request', 'checked_below_request', 'cannot_check', 'observation_time_unknown', 'evidence_conflict'].includes(data.answer.reason) &&
  typeof data.answer.message === 'string' &&
  (data.answer.discrepancy_units === null || Number.isSafeInteger(data.answer.discrepancy_units) && Math.abs(data.answer.discrepancy_units) <= 10000) &&
  Array.isArray(data.answer.limitations) && data.answer.limitations.every(value => typeof value === 'string');

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const isPharmacyV2 = data => data && typeof data.id === 'string' && typeof data.name === 'string' && data.active === true && data.simulated === true;
export const isMembershipV2 = data => data && typeof data.pharmacy_id === 'string' && data.role === 'staff' && data.active === true && isTime(data.created_at);
export const isUserResponseV2 = data => data && uuid(data.user_id) && typeof data.auth_subject === 'string' && data.active === true &&
  Array.isArray(data.memberships) && data.memberships.every(isMembershipV2);
export const isBootstrapV2 = data => data && data.simulated === true &&
  Array.isArray(data.pharmacies) && data.pharmacies.every(isPharmacyV2) &&
  Array.isArray(data.products) && data.products.every(isProduct) &&
  Array.isArray(data.claims) && data.claims.every(isClaim);
export const isViewV2 = (data, id = data?.id) => data && uuid(data.owner_user_id) &&
  (data.observation === null || uuid(data.observation?.reported_by_user_id)) &&
  isView({ ...data, observation: data.observation === null ? null :
    { ...data.observation, staff_id: data.observation.reported_by_user_id } }, id);
export const isPageV2 = data => data && Array.isArray(data.items) && data.items.every(v => isViewV2(v)) &&
  Number.isInteger(data.limit) && data.limit >= 1 && data.limit <= 100 && Number.isInteger(data.offset) &&
  data.offset >= 0 && data.offset <= 1000 && typeof data.has_more === 'boolean';
function requireToken(token) {
  if (typeof token !== 'string' || !token.trim()) throw { kind: 'client', message: 'Sign in again before continuing.', outcome: 'not_applicable' };
  return token;
}
export async function getPublicConfig() {
  return fetchWithDeadline('/api/config', { headers: { Accept: 'application/json' } }, 3000, false,
    data => ['local', 'hosted'].includes(data.mode) && data.simulated === true &&
      (data.mode === 'local' ? data.clerk_publishable_key === null : typeof data.clerk_publishable_key === 'string' && /^pk_(test|live)_/.test(data.clerk_publishable_key)));
}

// --- Health ---
export async function getHealth(version = 'v2') {
  if (version === 'v1') {
    return fetchWithDeadline(`${V1_BASE_URL}/health`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    }, 3000, false, data => data.status === 'ready' && data.storage === 'sqlite');
  }
  return fetchWithDeadline(`${V2_BASE_URL}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, 3000, false, data => data.status === 'ready' && ['postgres', 'postgresql', 'sqlite'].includes(data.storage));
}

// --- V2 Auth & Bootstrap ---
export async function getCurrentUser(token) {
  token = requireToken(token);
  return fetchWithDeadline(`${V2_BASE_URL}/me`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, isUserResponseV2);
}

export async function getBootstrap(token = null) {
  if (token) {
    return getBootstrapV2(token);
  }
  return fetchWithDeadline(`${V1_BASE_URL}/bootstrap`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, 3000, false, data => data.simulated === true && typeof data.pharmacy?.id === 'string' && typeof data.pharmacy?.name === 'string' && Array.isArray(data.products) && data.products.every(isProduct) && Array.isArray(data.claims));
}

export async function getBootstrapV2(token) {
  token = requireToken(token);
  return fetchWithDeadline(`${V2_BASE_URL}/bootstrap`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, isBootstrapV2);
}

// --- Enquiries ---
export async function createEnquiry(id, request, token = null) {
  if (token) {
    return createEnquiryV2(id, request, token);
  }
  return fetchWithDeadline(enquiryPath(id, V1_BASE_URL), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  }, 5000, true, data => isView(data, id));
}

export async function createEnquiryV2(id, request, token) {
  token = requireToken(token);
  return fetchWithDeadline(enquiryPath(id, V2_BASE_URL), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  }, 5000, true, data => isViewV2(data, id));
}

export async function getEnquiry(id, token = null) {
  if (token) {
    return getEnquiryV2(id, token);
  }
  return fetchWithDeadline(enquiryPath(id, V1_BASE_URL), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, 3000, false, data => isView(data, id));
}

export async function getEnquiryV2(id, token) {
  token = requireToken(token);
  return fetchWithDeadline(enquiryPath(id, V2_BASE_URL), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, data => isViewV2(data, id));
}

export async function listOwnEnquiries(token, offset = 0, limit = 10) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  params.set('offset', offset ?? 0);
  token = requireToken(token);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithDeadline(`${V2_BASE_URL}/enquiries${query}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, data => isPageV2(data) && data.offset === (offset ?? 0) && data.limit === limit);
}

export async function listPharmacyQueue(pharmacyId, token, offset = 0, limit = 10) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  params.set('offset', offset ?? 0);
  token = requireToken(token);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithDeadline(`${V2_BASE_URL}/pharmacies/${encodeURIComponent(pharmacyId)}/queue${query}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, data => isPageV2(data) && data.offset === (offset ?? 0) && data.limit === limit);
}

export async function submitObservation(id, request, token, version = 'v1') {
  if (version === 'v2') {
    return submitObservationV2(id, request, token);
  }
  return fetchWithDeadline(`${enquiryPath(id, V1_BASE_URL)}/observation`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  }, 5000, true, data => isView(data, id));
}

export async function submitObservationV2(id, request, token) {
  token = requireToken(token);
  return fetchWithDeadline(`${enquiryPath(id, V2_BASE_URL)}/observation`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  }, 5000, true, data => isViewV2(data, id));
}

// V1 compatibility helper
export async function listStaffEnquiries(token) {
  return fetchWithDeadline(`${V1_BASE_URL}/staff/enquiries`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, data => Array.isArray(data) && data.every(view => isView(view, view.id)));
}
