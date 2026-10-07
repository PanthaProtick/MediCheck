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

export const isView = (data, id) => data && data.id === id && isProduct(data.product) &&
  typeof data.pharmacy_id === 'string' && Number.isInteger(data.requested_quantity) &&
  ['tablet', 'capsule'].includes(data.unit) && typeof data.created_at === 'string' &&
  typeof data.served_at === 'string' && data.simulated === true &&
  ['pending', 'answered', 'unresolved'].includes(data.status) &&
  (data.claim === null || (data.claim && typeof data.claim.id === 'string')) &&
  (data.observation === null || (data.observation && typeof data.observation.kind === 'string')) &&
  data.answer && ['sufficient', 'insufficient', 'unresolved'].includes(data.answer.conclusion) &&
  typeof data.answer.message === 'string' && typeof data.answer.reason === 'string' &&
  (data.answer.discrepancy_units === null || Number.isInteger(data.answer.discrepancy_units)) &&
  Array.isArray(data.answer.limitations) && data.answer.limitations.every(value => typeof value === 'string');

export const isPharmacyV2 = data => data && typeof data.id === 'string' && typeof data.name === 'string';

export const isMembershipV2 = data => data && typeof data.pharmacy_id === 'string' && typeof data.role === 'string' && typeof data.status === 'string';

export const isUserResponseV2 = data => data && typeof data.id === 'string' && typeof data.email === 'string' && Array.isArray(data.memberships) && data.memberships.every(isMembershipV2);

export const isBootstrapV2 = data => data && data.simulated === true &&
  Array.isArray(data.pharmacies) && data.pharmacies.every(isPharmacyV2) &&
  Array.isArray(data.products) && data.products.every(isProduct) &&
  Array.isArray(data.claims);

export const isViewV2 = (data, id) => data && (!id || data.id === id) &&
  typeof data.owner_id === 'string' &&
  typeof data.pharmacy_id === 'string' &&
  isProduct(data.product) &&
  Number.isInteger(data.requested_quantity) &&
  ['tablet', 'capsule'].includes(data.unit) &&
  typeof data.created_at === 'string' &&
  typeof data.served_at === 'string' &&
  data.simulated === true &&
  ['pending', 'answered', 'unresolved'].includes(data.status) &&
  (data.claim === null || (data.claim && typeof data.claim.pharmacy_id === 'string' && typeof data.claim.product_id === 'string')) &&
  (data.observation === null || (data.observation && typeof data.observation.kind === 'string' && typeof data.observation.reporter_id === 'string')) &&
  data.answer && ['sufficient', 'insufficient', 'unresolved'].includes(data.answer.conclusion) &&
  typeof data.answer.message === 'string' && typeof data.answer.reason === 'string' &&
  (data.answer.discrepancy_units === null || Number.isInteger(data.answer.discrepancy_units)) &&
  Array.isArray(data.answer.limitations) && data.answer.limitations.every(v => typeof v === 'string');

export const isPageV2 = data => data && Array.isArray(data.items) &&
  data.items.every(v => isViewV2(v)) &&
  typeof data.has_more === 'boolean';

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
  }, 3000, false, data => data.status === 'ready' && ['postgres', 'sqlite'].includes(data.storage));
}

// --- V2 Auth & Bootstrap ---
export async function getCurrentUser(token) {
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
  return fetchWithDeadline(enquiryPath(id, V2_BASE_URL), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, data => isViewV2(data, id));
}

export async function listOwnEnquiries(token, cursor = null, limit = 10) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithDeadline(`${V2_BASE_URL}/enquiries${query}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, isPageV2);
}

export async function listPharmacyQueue(pharmacyId, token, cursor = null, limit = 10) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', limit);
  if (cursor) params.set('cursor', cursor);
  const query = params.toString() ? `?${params.toString()}` : '';
  return fetchWithDeadline(`${V2_BASE_URL}/pharmacies/${encodeURIComponent(pharmacyId)}/queue${query}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, isPageV2);
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
