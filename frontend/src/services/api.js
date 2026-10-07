const BASE_URL = '/api/v1';

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

function enquiryPath(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id)) {
    throw { kind: 'client', message: 'Enter a canonical lowercase enquiry UUID.' };
  }
  return `${BASE_URL}/enquiries/${id}`;
}

const isProduct = data => data && ['id', 'name', 'strength', 'form'].every(key => typeof data[key] === 'string') && ['tablet', 'capsule'].includes(data.unit);
const isView = (data, id) => data && data.id === id && isProduct(data.product) &&
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

export async function getHealth() {
  return fetchWithDeadline(`${BASE_URL}/health`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, 3000, false, data => data.status === 'ready' && data.storage === 'sqlite');
}

export async function getBootstrap() {
  return fetchWithDeadline(`${BASE_URL}/bootstrap`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, 3000, false, data => data.simulated === true && typeof data.pharmacy?.id === 'string' && typeof data.pharmacy?.name === 'string' && Array.isArray(data.products) && data.products.every(isProduct) && Array.isArray(data.claims));
}

export async function createEnquiry(id, request) {
  return fetchWithDeadline(enquiryPath(id), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(request),
  }, 5000, true, data => isView(data, id));
}

export async function getEnquiry(id) {
  return fetchWithDeadline(enquiryPath(id), {
    method: 'GET',
    headers: { Accept: 'application/json' },
  }, 3000, false, data => isView(data, id));
}

export async function listStaffEnquiries(token) {
  return fetchWithDeadline(`${BASE_URL}/staff/enquiries`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  }, 3000, false, data => Array.isArray(data) && data.every(view => isView(view, view.id)));
}

export async function submitObservation(id, request, token) {
  return fetchWithDeadline(`${enquiryPath(id)}/observation`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(request),
  }, 5000, true, data => isView(data, id));
}
