const keyFor = workspace => 'medicine_check_local_intent_' + workspace;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export function isLocalIntent(value, workspace) {
  if (!value || !uuid.test(value.id) || !value.payload || typeof value.payload !== 'object') return false;
  const p = value.payload;
  if (!['tablet', 'capsule'].includes(p.unit) || typeof p.product_id !== 'string') return false;
  if (workspace === 'caregiver') return value.type === 'create' && typeof p.pharmacy_id === 'string' &&
    Number.isSafeInteger(p.requested_quantity) && p.requested_quantity >= 1 && p.requested_quantity <= 10000;
  if (workspace !== 'staff' || value.type !== 'report') return false;
  if (p.kind === 'unable_to_check') return p.obtainable_quantity === null && p.observed_at === null && p.unresolved_reason === 'cannot_check';
  return p.kind === 'checked' && Number.isSafeInteger(p.obtainable_quantity) && p.obtainable_quantity >= 0 &&
    p.obtainable_quantity <= 10000 && p.unresolved_reason === null &&
    (p.observed_at === null || typeof p.observed_at === 'string');
}
export function loadLocalIntent(workspace) {
  try {
    const value = JSON.parse(sessionStorage.getItem(keyFor(workspace)));
    return isLocalIntent(value, workspace) ? value : null;
  } catch { return null; }
}
export function saveLocalIntent(workspace, value) {
  try {
    if (value) {
      // Persist only the idempotent write inputs; never a credential.
      if (!isLocalIntent(value, workspace)) return;
      sessionStorage.setItem(keyFor(workspace), JSON.stringify({ type: value.type, id: value.id, payload: value.payload }));
    } else sessionStorage.removeItem(keyFor(workspace));
  } catch { /* The in-memory intent still protects this page if storage is unavailable. */ }
}
