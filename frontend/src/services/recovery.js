export function parseQuantity(value, minimum) {
  if (!/^\d+$/.test(value)) return null;
  const quantity = Number(value);
  return Number.isSafeInteger(quantity) && quantity >= minimum && quantity <= 10000 ? quantity : null;
}

export function matchesIntent(view, intent) {
  const { payload } = intent;
  if (view.id !== intent.id) return false;
  if (intent.type === 'create') return view.pharmacy_id === payload.pharmacy_id &&
    view.product.id === payload.product_id && view.unit === payload.unit &&
    view.requested_quantity === payload.requested_quantity;
  const observation = view.observation;
  if (!observation) return false;
  return ['product_id', 'unit', 'kind', 'obtainable_quantity', 'unresolved_reason'].every(
    key => observation[key] === payload[key]) && sameInstant(observation.observed_at, payload.observed_at);
}

function sameInstant(left, right) {
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
  return { begin: () => ++generation, invalidate: () => { generation++; },
    isCurrent: value => value === generation };
}
