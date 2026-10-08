import { useEffect, useRef, useState } from 'react';
import { createEnquiryV2, getEnquiryV2, submitObservationV2 } from '../services/api';
import { createReadGuard, matchesIntent } from '../services/recovery';
import { isLocalIntent } from '../services/localRecovery';
const keyFor = (userId, workspace) => 'medicine_check_hosted_' + userId + '_' + workspace;
export function clearHostedRecovery(userId) {
  for (const workspace of ['caregiver', 'staff']) {
    try { sessionStorage.removeItem(keyFor(userId, workspace)); } catch { /* storage unavailable */ }
  }
}
export function loadHostedIntent(userId, workspace) {
  try {
    const intent = JSON.parse(sessionStorage.getItem(keyFor(userId, workspace)));
    return intent?.userId === userId && typeof intent.pharmacyId === 'string' && isLocalIntent(intent, workspace) ? intent : null;
  } catch { return null; }
}
export function persistHostedIntent(userId, workspace, intent) {
  try {
    if (!intent) sessionStorage.removeItem(keyFor(userId, workspace));
    else sessionStorage.setItem(keyFor(userId, workspace), JSON.stringify({
      type: intent.type, id: intent.id, userId, pharmacyId: intent.pharmacyId, payload: intent.payload,
    }));
  } catch { /* in-memory intent still protects this tab */ }
}
export function useHostedRecovery(userId, workspace, getToken, onSaved) {
  const [intent, setIntent] = useState(() => loadHostedIntent(userId, workspace));
  const pending = useRef(intent);
  const busyRef = useRef(false);
  const guard = useRef(createReadGuard());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(intent ? 'An unfinished save intent was recovered. Inspect it before continuing.' : '');
  const [retry, setRetry] = useState(false);
  const [conflict, setConflict] = useState(false);
  useEffect(() => { const current = guard.current; return () => current.invalidate(); }, []);
  const remember = next => {
    pending.current = next; setIntent(next); persistHostedIntent(userId, workspace, next);
    setRetry(false); setConflict(false);
  };
  const saved = (view, next) => { remember(null); setError(null); setMessage('Save confirmed by the server.'); onSaved(view, next); };
  const send = async next => {
    if (busyRef.current || next.userId !== userId) return;
    const uncertain = !!pending.current;
    busyRef.current = true; setBusy(true); setError(null);
    const ticket = guard.current.begin(); remember(next); setMessage('Saving…');
    try {
      const token = await getToken();
      if (!guard.current.isCurrent(ticket)) return;
      const view = next.type === 'create' ? await createEnquiryV2(next.id, next.payload, token) :
        await submitObservationV2(next.id, next.payload, token);
      if (!guard.current.isCurrent(ticket)) return;
      if (!matchesIntent(view, next)) throw { outcome: 'unknown', message: 'The saved response did not match this attempt.' };
      saved(view, next);
    } catch (failure) {
      if (!guard.current.isCurrent(ticket)) return;
      setError(failure);
      if (uncertain || failure.outcome === 'unknown' || failure.status === 409) setMessage('Save outcome requires inspection. Your original ID and inputs are preserved.');
      else { remember(null); setMessage('The action was rejected. Correct the error before continuing.'); }
    } finally { if (guard.current.isCurrent(ticket)) { busyRef.current = false; setBusy(false); } }
  };
  const inspect = async () => {
    const next = pending.current;
    if (!next || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null); setRetry(false);
    const ticket = guard.current.begin();
    try {
      const token = await getToken();
      if (!guard.current.isCurrent(ticket)) return;
      const view = await getEnquiryV2(next.id, token);
      if (!guard.current.isCurrent(ticket)) return;
      if (matchesIntent(view, next)) saved(view, next);
      else if (next.type === 'report' && view.observation === null && view.pharmacy_id === next.pharmacyId) {
        setMessage('No report is visible yet. The earlier save might still finish. Inspect again or explicitly retry the identical report.'); setRetry(true);
      } else { setMessage('Different immutable evidence is saved. It cannot be overwritten.'); setConflict(true); }
    } catch (failure) {
      if (!guard.current.isCurrent(ticket)) return;
      setError(failure);
      if (failure.status === 404 && next.type === 'create') { setRetry(true); setMessage('This enquiry is not visible to this account. The earlier save might still finish. Inspect again or retry the same ID and inputs.'); }
      else setMessage('Inspection failed or access has changed. The original attempt remains preserved.');
    } finally { if (guard.current.isCurrent(ticket)) { busyRef.current = false; setBusy(false); } }
  };
  return { intent, busy, error, message, retry, conflict, send, inspect,
    closeConflict: () => { remember(null); setError(null); setMessage('The conflicting attempt was closed.'); } };
}
