import { errorText, units, time, localInputTime } from "./services/presentation";
import { useEffect, useRef, useState } from 'react';
import { Pill, ArrowRight, ShieldCheck, RefreshCw, CheckCircle2, Clock3, LogOut } from 'lucide-react';
import { getBootstrap, createEnquiry, getEnquiry, listStaffEnquiries, submitObservation } from './services/api';
import { createReadGuard, matchesIntent, parseQuantity } from './services/recovery';
import { Shell, Evidence, Notice } from "./components/WorkspaceUI";
import { loadLocalIntent, saveLocalIntent } from './services/localRecovery';

const params = new URLSearchParams(window.location.search);
const role = params.get('role');

function Landing() {
  return <Shell><section className="hero"><span className="eyebrow">A clear next step</span><h1>Check the quantity.<br />Understand the evidence.</h1><p>Choose your workspace to request an exact medicine check or answer one at the pharmacy.</p></section>
    <div className="role-cards"><a className="role-card" href="/?role=caregiver"><span className="card-icon"><Pill /></span><h2>I need a medicine</h2><p>Select the exact medicine and quantity, then see the pharmacy's saved response.</p><span className="card-action">Open caregiver workspace <ArrowRight size={18} /></span></a>
    <a className="role-card staff-card" href="/?role=staff"><span className="card-icon"><ShieldCheck /></span><h2>I work at the pharmacy</h2><p>Use your demo access key to view pending requests and record a check.</p><span className="card-action">Open pharmacy workspace <ArrowRight size={18} /></span></a></div>
  </Shell>;
}

function useWriteRecovery(workspace, onSaved, tokenRef) {
  const [intent, setIntent] = useState(() => loadLocalIntent(workspace));
  const intentRef = useRef(intent);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState(intent ? 'An unfinished save intent was recovered. Inspect it before sending anything else.' : '');
  const [error, setError] = useState(null);
  const [retry, setRetry] = useState(false);
  const [conflict, setConflict] = useState(false);
  const guard = useRef(createReadGuard());
  const remember = value => { intentRef.current = value; setIntent(value); saveLocalIntent(workspace, value); setRetry(false); setConflict(false); };
  useEffect(() => () => guard.current.invalidate(), []);
  const settle = (view, savedIntent) => {
    remember(null); setMessage('Save confirmed by the server.'); setError(null); onSaved(view, savedIntent);
  };
  const send = async next => {
    if (busyRef.current) return;
    if (next.type === 'report' && !tokenRef.current.trim()) { setError({ message: 'Re-enter your pharmacy access key before retrying. The original save intent is preserved.' }); return; }
    busyRef.current = true; setBusy(true); setError(null); setMessage('Saving your request…');
    const wasUncertain = !!intentRef.current;
    remember(next);
    const ticket = guard.current.begin();
    try {
      const view = next.type === 'create' ? await createEnquiry(next.id, next.payload) : await submitObservation(next.id, next.payload, tokenRef.current);
      if (!guard.current.isCurrent(ticket)) return;
      if (!matchesIntent(view, next)) throw { outcome: 'unknown', message: 'The response did not match this save. Inspect the saved outcome.' };
      settle(view, next);
    } catch (failure) {
      if (!guard.current.isCurrent(ticket)) return;
      setError(failure);
      if (wasUncertain || failure.outcome === 'unknown' || failure.status === 409) {
        setMessage('Save outcome requires inspection. Your original ID and inputs are preserved.');
      } else { remember(null); setMessage('Nothing was accepted by this action. Correct the error and try again.'); }
    } finally {
      if (guard.current.isCurrent(ticket)) { busyRef.current = false; setBusy(false); }
    }
  };
  const inspect = async () => {
    const next = intentRef.current;
    if (!next || busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(null); setRetry(false);
    const ticket = guard.current.begin();
    try {
      const view = await getEnquiry(next.id);
      if (!guard.current.isCurrent(ticket)) return;
      if (matchesIntent(view, next)) settle(view, next);
      else if (next.type === 'report' && view.observation === null) {
        setMessage('No report is visible yet. The earlier save might still finish. You may inspect again or explicitly retry the identical report.'); setRetry(true);
      } else { setMessage('Different evidence is already saved. It cannot be overwritten.'); setConflict(true); }
    } catch (failure) {
      if (!guard.current.isCurrent(ticket)) return;
      setError(failure);
      if (failure.status === 404) { setMessage('This enquiry is not currently visible. The earlier save might still finish. Inspect again or retry the same ID and inputs.'); setRetry(true); }
      else setMessage('Inspection failed. The save outcome is still unknown.');
    } finally {
      if (guard.current.isCurrent(ticket)) { busyRef.current = false; setBusy(false); }
    }
  };
  return { intent, busy, message, error, retry, conflict, send, inspect, abandonConflict: () => { remember(null); setMessage('The conflicting attempt was closed. Start a separate enquiry for a correction.'); setError(null); } };
}

function RecoveryPanel({ recovery }) {
  if (!recovery.intent) return recovery.error ? <Notice kind="error">{errorText(recovery.error)}</Notice> : null;
  return <section className="recovery-panel" aria-label="Save recovery"><h3>Check the saved outcome</h3><p>{recovery.message}</p><small>Enquiry <code>{recovery.intent.id}</code></small>
    {recovery.error && <Notice kind="error">{errorText(recovery.error)}</Notice>}
    <div className="button-row"><button disabled={recovery.busy} onClick={recovery.inspect}>Inspect saved outcome</button>
      {recovery.retry && <button className="secondary" disabled={recovery.busy} onClick={() => recovery.send(recovery.intent)}>Retry identical save</button>}
      {recovery.conflict && <button className="secondary" onClick={recovery.abandonConflict}>Close conflicting attempt</button>}</div>
  </section>;
}


function CaregiverWorkspace() {
  const [bootstrap, setBootstrap] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('6');
  const [id, setId] = useState(params.get('enquiry') || '');
  const idRef = useRef(id);
  const [view, setView] = useState(null);
  const [readError, setReadError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [reading, setReading] = useState(false);
  const reads = useRef(createReadGuard());
  const token = useRef('');
  const setActive = next => {
    reads.current.invalidate(); idRef.current = next; setId(next); setView(null); setReadError(null); setReading(false);
    const url = new URL(window.location.href);
    if (next) url.searchParams.set('enquiry', next); else url.searchParams.delete('enquiry');
    window.history.replaceState({}, '', url);
  };
  const recovery = useWriteRecovery('caregiver', saved => { setActive(saved.id); setView(saved); setReadError(null); setReading(false); }, token);
  const refresh = async () => {
    const target = idRef.current;
    if (!target || recovery.busy) return;
    const ticket = reads.current.begin(); setReading(true); setReadError(null);
    try { const saved = await getEnquiry(target); if (reads.current.isCurrent(ticket)) setView(saved); }
    catch (failure) { if (reads.current.isCurrent(ticket)) setReadError(failure); }
    finally { if (reads.current.isCurrent(ticket)) setReading(false); }
  };
  const load = async () => {
    setLoadError(null);
    try { const data = await getBootstrap(); setBootstrap(data); setProductId(previous => previous || data.products[0]?.id || ''); }
    catch (failure) { setLoadError(failure); }
  };
  useEffect(() => { let live = true; const readGuard = reads.current; getBootstrap().then(data => { if (live) { setBootstrap(data); setProductId(data.products[0]?.id || ''); } }).catch(failure => { if (live) setLoadError(failure); }); return () => { live = false; readGuard.invalidate(); }; }, []);
  useEffect(() => {
    if (!idRef.current) return;
    const target = idRef.current; const ticket = reads.current.begin(); setReading(true);
    getEnquiry(target).then(saved => { if (reads.current.isCurrent(ticket)) setView(saved); }).catch(failure => { if (reads.current.isCurrent(ticket)) setReadError(failure); }).finally(() => { if (reads.current.isCurrent(ticket)) setReading(false); });
  }, []);
  const submit = event => {
    event.preventDefault();
    if (recovery.busy || recovery.intent) return;
    const product = bootstrap?.products.find(item => item.id === productId);
    const amount = parseQuantity(quantity, 1);
    if (!product || amount === null) { setFormError({ message: 'Enter a whole quantity from 1 to 10000.' }); return; }
    setFormError(null); const next = crypto.randomUUID(); setActive(next);
    recovery.send({ type: 'create', id: next, payload: { pharmacy_id: bootstrap.pharmacy.id, product_id: product.id, requested_quantity: amount, unit: product.unit } });
  };
  const product = bootstrap?.products.find(item => item.id === productId);
  return <Shell workspace="caregiver"><section className="page-heading"><span className="eyebrow">For caregivers</span><h1>Ask for an exact medicine check.</h1><p>Inventory is a starting point. Request the quantity you need, then read the pharmacy's saved check.</p></section>
    <div className="workspace-grid"><section className="panel"><div className="panel-heading"><span className="step-number">1</span><h2>Your request</h2></div>
      {loadError ? <><Notice kind="error">{errorText(loadError)}</Notice><button className="secondary" onClick={load}>Reload medicines</button></> : !bootstrap ? <p role="status">Loading medicines…</p> :
      <form onSubmit={submit}><fieldset disabled={recovery.busy || !!recovery.intent}><label htmlFor="product-select">Exact medicine</label><select id="product-select" value={productId} onChange={event => setProductId(event.target.value)}>{bootstrap.products.map(item => <option key={item.id} value={item.id}>{item.name} · {item.strength} · {item.form}</option>)}</select>
        <label htmlFor="requested-quantity-input">Quantity ({product?.unit || 'units'}s)</label><input id="requested-quantity-input" type="number" min="1" max="10000" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} />
        <div className="pharmacy-label"><ShieldCheck size={18} /><div><small>Checking with</small><strong>{bootstrap.pharmacy.name}</strong></div></div>
        <button id="submit-enquiry-btn" className="primary" type="submit"><ArrowRight size={17} />{recovery.busy ? 'Saving request…' : 'Request a pharmacy check'}</button></fieldset></form>}
      {formError && <Notice kind="error">{errorText(formError)}</Notice>}
      <RecoveryPanel recovery={recovery} />
      <div className="help-copy"><h3>What happens next?</h3><p>Pharmacy staff open the same enquiry and record a count or explain that the check could not be completed. Refresh to see their answer.</p></div>
    </section>
    <section className="results-column"><div className="results-toolbar"><h2>Pharmacy response</h2>{id && <button id="refresh-enquiry-btn" className="secondary" onClick={refresh} disabled={reading || recovery.busy}><RefreshCw size={16} />{reading ? 'Refreshing…' : 'Refresh response'}</button>}</div>
      {readError && !view && <Notice kind="error">{errorText(readError)}</Notice>}
      {view ? <Evidence view={view} stale={!!readError} /> : <div className="empty-state"><Clock3 size={32} /><h3>{id ? 'Loading your saved enquiry' : 'Your response will appear here'}</h3><p>{id ? 'If loading failed, refresh or inspect the saved outcome.' : 'Create a request using the exact medicine and quantity.'}</p></div>}
    </section></div>
  </Shell>;
}

function StaffWorkspace() {
  const [accessKey, setAccessKey] = useState('');
  const keyRef = useRef('');
  const [queue, setQueue] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [kind, setKind] = useState('checked');
  const [count, setCount] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [unknownTime, setUnknownTime] = useState(false);
  const [formError, setFormError] = useState(null);
  const [result, setResult] = useState(null);
  const queueReads = useRef(createReadGuard());
  const recovery = useWriteRecovery('staff', saved => { queueReads.current.invalidate(); setLoading(false); setResult(saved); setQueue(items => items.filter(item => item.id !== saved.id)); setSelected(null); }, keyRef);
  const locked = recovery.busy || !!recovery.intent;
  useEffect(() => () => queueReads.current.invalidate(), []);
  const changeKey = value => {
    queueReads.current.invalidate(); keyRef.current = value; setAccessKey(value); setQueue([]); setLoaded(false); setLoading(false); setQueueError(null); setSelected(null); setResult(null); setFormError(null);
  };
  const loadQueue = async event => {
    event?.preventDefault();
    if (!keyRef.current.trim()) { setQueueError({ message: 'Enter your pharmacy demo access key first.' }); return; }
    const ticket = queueReads.current.begin(); setLoading(true); setQueueError(null);
    try { const data = await listStaffEnquiries(keyRef.current); if (queueReads.current.isCurrent(ticket)) { setQueue(data); setSelected(previous => previous ? data.find(item => item.id === previous.id) || null : null); setLoaded(true); } }
    catch (failure) { if (queueReads.current.isCurrent(ticket)) { setQueueError(failure); setLoaded(false); setQueue([]); setSelected(null); } }
    finally { if (queueReads.current.isCurrent(ticket)) setLoading(false); }
  };
  const select = item => { if (locked) return; setSelected(item); setKind('checked'); setCount(''); setObservedAt(''); setUnknownTime(false); setFormError(null); setResult(null); };
  const submit = event => {
    event.preventDefault();
    if (!selected || locked) return;
    if (!keyRef.current.trim()) { setFormError({ message: 'Enter an access key before saving a report.' }); return; }
    const amount = kind === 'checked' ? parseQuantity(count, 0) : null;
    if (kind === 'checked' && amount === null) { setFormError({ message: 'Enter a whole obtainable count from 0 to 10000.' }); return; }
    if (kind === 'checked' && !unknownTime && !observedAt.trim()) { setFormError({ message: 'Set the check time, or explicitly choose Time unknown.' }); return; }
    queueReads.current.invalidate(); setLoading(false); setFormError(null);
    recovery.send({ type: 'report', id: selected.id, payload: { product_id: selected.product.id, unit: selected.unit, kind, obtainable_quantity: amount, observed_at: kind === 'checked' && !unknownTime ? observedAt.trim() : null, unresolved_reason: kind === 'unable_to_check' ? 'cannot_check' : null } });
  };
  return <Shell workspace="staff"><section className="page-heading"><span className="eyebrow">For pharmacy staff</span><h1>Answer the request in front of you.</h1><p>Check the exact product and obtainable quantity. Record what you observed, keeping the original inventory claim intact.</p></section>
    <div className="workspace-grid"><aside className="panel"><div className="panel-heading"><span className="step-number">1</span><h2>Pending requests</h2></div>
      <form onSubmit={loadQueue}><label htmlFor="staff-token-input">Pharmacy demo access key</label><input id="staff-token-input" type="password" autoComplete="off" value={accessKey} disabled={recovery.busy} onChange={event => changeKey(event.target.value)} /><p className="field-hint">The key is checked by the backend. It is kept only in this page's memory.</p><button id="refresh-queue-btn" className="primary" disabled={loading || recovery.busy || !!recovery.intent}><RefreshCw size={17} />{loading ? 'Loading requests…' : 'Open / refresh queue'}</button></form>
      {accessKey && <button className="text-button" disabled={recovery.busy} onClick={() => changeKey('')}><LogOut size={15} />Clear access key</button>}
      {queueError && <Notice kind="error">{errorText(queueError)}</Notice>}
      {loaded && !queue.length && <div className="queue-empty"><CheckCircle2 size={23} /><p>No pending requests.</p></div>}
      {!loaded && !queueError && <p className="field-hint">Enter the key and load the queue to begin.</p>}
      <div className="queue-list">{queue.map(item => <button className={'queue-item ' + (selected?.id === item.id ? 'selected' : '')} key={item.id} disabled={locked} onClick={() => select(item)}><strong>{item.product.name}</strong><span>{item.product.strength} · {item.product.form}</span><span>{units(item.requested_quantity, item.unit)} requested</span><small>{time(item.created_at)}</small><code>{item.id}</code></button>)}</div>
      <RecoveryPanel recovery={recovery} />
    </aside>
    <section className="panel staff-report"><div className="panel-heading"><span className="step-number">2</span><h2>Record a check</h2></div>
      {result && <><Notice kind="success">Report Accepted. It is saved and cannot be edited. The caregiver can refresh their response.</Notice><Evidence view={result} /></>}
      {!selected && !result && <div className="empty-state"><ShieldCheck size={32} /><h3>Select a pending request</h3><p>Choose the exact enquiry from the queue. Its medicine and requested quantity appear here.</p></div>}
      {selected && <><div className="request-summary"><h3>{selected.product.name}</h3><p>{selected.product.strength} · {selected.product.form}</p><strong>{units(selected.requested_quantity, selected.unit)} requested</strong><small>Enquiry {selected.id}</small></div>
      <form onSubmit={submit}><fieldset disabled={locked}><legend>Check outcome</legend><div className="radio-options"><label><input type="radio" name="report-kind" checked={kind === 'checked'} onChange={() => setKind('checked')} />I checked the stock</label><label><input type="radio" name="report-kind" checked={kind === 'unable_to_check'} onChange={() => setKind('unable_to_check')} />I could not complete the check</label></div>
        {kind === 'checked' && <><label htmlFor="obtainable-count-input">Obtainable quantity ({selected.unit}s)</label><input id="obtainable-count-input" type="number" min="0" max="10000" step="1" required value={count} onChange={event => setCount(event.target.value)} /><p className="field-hint">Zero means none obtainable. It is different from not checking.</p>
          <label htmlFor="observation-time-input">Check time (your device's local timezone)</label><input id="observation-time-input" type="datetime-local" step="1" value={localInputTime(observedAt)} disabled={unknownTime} onChange={event => setObservedAt(event.target.value && Number.isFinite(Date.parse(event.target.value)) ? new Date(event.target.value).toISOString() : '')} />
          <div className="time-controls"><button type="button" className="secondary" onClick={() => { setUnknownTime(false); setObservedAt(new Date().toISOString()); }}>Set simulated check time to now</button><label className="checkbox-label"><input id="time-unknown-input" type="checkbox" checked={unknownTime} onChange={event => setUnknownTime(event.target.checked)} />Time unknown</label></div></>}
        {kind === 'unable_to_check' && <Notice>No count or check time will be reported. The caregiver's answer will remain unresolved.</Notice>}
        <button id="submit-observation-btn" className="primary" type="submit" disabled={!accessKey.trim()}>{recovery.busy ? 'Saving report…' : 'Save this check'}</button></fieldset></form>{formError && <Notice kind="error">{errorText(formError)}</Notice>}
      </>}
    </section></div>
  </Shell>;
}

export default function App() {
  // Role-specific pages use the local SQLite/v1 workflow, without auth-provider fallback.
  return role === 'caregiver' ? <CaregiverWorkspace /> : role === 'staff' ? <StaffWorkspace /> : <Landing />;
}
