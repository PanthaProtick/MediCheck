export function parseQuantity(value, minimum) {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= minimum && quantity <= 10000 ? quantity : null;
}

export function matchesIntent(view, intent) {
  if (!view || !intent) return false;
  const { payload } = intent;
  if (view.id !== intent.id) return false;
  if (intent.type === 'create') {
    return view.pharmacy_id === payload.pharmacy_id &&
      (view.product?.id || view.product_id) === payload.product_id &&
      view.unit === payload.unit &&
      view.requested_quantity === payload.requested_quantity;
  }
  const observation = view.observation;
  if (!observation) return false;

  // Account-bound check: if intent has a userId and observation has a reporter_id,
  // ensure another staff member's report is NOT treated as this user's submission.
  if (intent.userId && observation.reporter_id && observation.reporter_id !== intent.userId) {
    return false;
  }

  return ['product_id', 'unit', 'kind', 'obtainable_quantity', 'unresolved_reason'].every(
    key => observation[key] === payload[key]) && sameInstant(observation.observed_at, payload.observed_at);
}

export function sameInstant(left, right) {
  if (left === null || right === null) return left === right;
  // Compare microseconds as well as JS millisecond timestamps.
  const parse = value => {
    const match = /^(.*?)(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
    if (!match) return null;
    const milliseconds = Date.parse(match[1] + match[3]);
    if (!Number.isFinite(milliseconds)) return null;
    return BigInt(milliseconds) * 1000n + BigInt((match[2] || '').padEnd(6, '0'));
  };
  const instant = parse(left);
  return instant !== null && instant === parse(right);
}

export function createReadGuard() {
  let generation = 0;
  let activeUserId = null;
  let activePharmacyId = null;
  let activeEnquiryId = null;

  return {
    begin: (userId = null, pharmacyId = null, enquiryId = null) => {
      generation++;
      if (userId || pharmacyId || enquiryId) {
        activeUserId = userId;
        activePharmacyId = pharmacyId;
        activeEnquiryId = enquiryId;
        return { generation, userId, pharmacyId, enquiryId };
      }
      return generation;
    },
    invalidate: () => {
      generation++;
      activeUserId = null;
      activePharmacyId = null;
      activeEnquiryId = null;
    },
    isCurrent: (handleOrGen, userId = null, pharmacyId = null, enquiryId = null) => {
      if (typeof handleOrGen === 'number') {
        return handleOrGen === generation;
      }
      if (!handleOrGen || typeof handleOrGen !== 'object') return false;
      if (handleOrGen.generation !== generation) return false;
      if (userId && handleOrGen.userId && handleOrGen.userId !== userId) return false;
      if (pharmacyId && handleOrGen.pharmacyId && handleOrGen.pharmacyId !== pharmacyId) return false;
      if (enquiryId && handleOrGen.enquiryId && handleOrGen.enquiryId !== enquiryId) return false;
      return true;
    }
  };
}

export function getIntentStorageKey(userId) {
  return userId ? `rxverify_intent_v2_${userId}` : 'rxverify_intent_v2';
}

export function saveUserIntent(intent, userId) {
  try {
    const key = getIntentStorageKey(userId || intent?.userId);
    if (intent) {
      sessionStorage.setItem(key, JSON.stringify(intent));
    } else {
      sessionStorage.removeItem(key);
    }
  } catch { /* Memory still holds the intent when storage blocked. */ }
}

export function loadUserIntent(userId) {
  try {
    const key = getIntentStorageKey(userId);
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && ['create', 'report'].includes(value.type) && value.id && value.payload ? value : null;
  } catch { return null; }
}

export function clearUserSessionData(userId) {
  try {
    if (userId) {
      sessionStorage.removeItem(getIntentStorageKey(userId));
    }
    sessionStorage.removeItem('pending_intent');
    sessionStorage.removeItem('rxverify_intent_v2');
  } catch { /* ignore */ }
}
