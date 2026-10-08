import { errorText, units, time, localInputTime } from "./services/presentation";
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ShieldCheck, RefreshCw, Clock3 } from 'lucide-react';
import { getCurrentUser, getBootstrapV2, getEnquiryV2, listOwnEnquiries, listPharmacyQueue } from './services/api';
import { createReadGuard, parseQuantity } from './services/recovery';
import { useHostedRecovery } from './hooks/useHostedRecovery';
import { Shell, Notice, Evidence } from './components/WorkspaceUI';

function Recovery({ state }) {
  if (!state.intent) return state.error ? <Notice kind="error">{errorText(state.error)}</Notice> : null;
  return <section className="recovery-panel"><h3>Check the saved outcome</h3><p>{state.message}</p><small>Enquiry <code>{state.intent.id}</code></small>
    {state.error && <Notice kind="error">{errorText(state.error)}</Notice>}
    <div className="button-row"><button disabled={state.busy} onClick={state.inspect}>Inspect saved outcome</button>
      {state.retry && <button disabled={state.busy} className="secondary" onClick={() => state.send(state.intent)}>Retry identical save</button>}
      {state.conflict && <button disabled={state.busy} className="secondary" onClick={state.closeConflict}>Close conflicting attempt</button>}</div>
  </section>;
}
function Pagination({ page, busy, onPage }) {
  if (!page) return null;
  return <div className="button-row"><button className="secondary" disabled={busy || page.offset === 0} onClick={() => onPage(Math.max(0, page.offset - page.limit))}>Previous</button>
    <span className="small muted">Page {Math.floor(page.offset / page.limit) + 1}</span>
    <button className="secondary" disabled={busy || !page.has_more || page.offset + page.limit > 1000} onClick={() => onPage(page.offset + page.limit)}>Next</button>
    {page.has_more && page.offset + page.limit > 1000 && <small>This demo's browsing limit has been reached.</small>}</div>;
}
function RequestList({ page, selected, disabled, onSelect }) {
  return <div className="queue-list">{page?.items.map(item => <button className={'queue-item ' + (selected === item.id ? 'selected' : '')} disabled={disabled} key={item.id} onClick={() => onSelect(item)}>
    <strong>{item.product.name}</strong><span>{item.product.strength} · {item.product.form}</span><span>{item.pharmacy_id} · {units(item.requested_quantity, item.unit)} requested</span>
    <small>{time(item.created_at)} · {item.status}</small><code>{item.id}</code></button>)}</div>;
}

function Caregiver({ me, bootstrap, getToken }) {
  const [productId, setProductId] = useState(bootstrap.products[0]?.id || '');
  const [pharmacyId, setPharmacyId] = useState(bootstrap.pharmacies[0]?.id || '');
  const [quantity, setQuantity] = useState('6');
  const [view, setView] = useState(null);
  const [id, setId] = useState(new URLSearchParams(location.search).get('enquiry') || '');
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [page, setPage] = useState(null);
  const [listError, setListError] = useState(null);
  const [listing, setListing] = useState(false);
  const reads = useRef(createReadGuard());
  const lists = useRef(createReadGuard());
  const tokenProvider = useRef(getToken);
  useEffect(() => { tokenProvider.current = getToken; }, [getToken]);
  const setActive = next => {
    reads.current.invalidate(); setId(next); setView(null); setReadError(null); setReading(false);
    const url = new URL(location.href); url.searchParams.set('enquiry', next); history.replaceState({}, '', url);
  };
  const loadList = async (offset = 0) => {
    const ticket = lists.current.begin(); setListing(true); setListError(null);
    try { const token = await tokenProvider.current(); if (!lists.current.isCurrent(ticket)) return;
      const result = await listOwnEnquiries(token, offset, 10); if (lists.current.isCurrent(ticket)) setPage(result);
    } catch (failure) { if (lists.current.isCurrent(ticket)) { setListError(failure); setPage(null); } }
    finally { if (lists.current.isCurrent(ticket)) setListing(false); }
  };
  const recovery = useHostedRecovery(me.user_id, 'caregiver', getToken, saved => {
    setActive(saved.id); setView(saved); lists.current.invalidate(); loadList(0);
  });
  const refresh = async target => {
    if (!target || recovery.busy) return;
    const ticket = reads.current.begin(); setReading(true); setReadError(null);
    try { const token = await tokenProvider.current(); if (!reads.current.isCurrent(ticket)) return;
      const saved = await getEnquiryV2(target, token); if (reads.current.isCurrent(ticket)) setView(saved);
    } catch (failure) { if (reads.current.isCurrent(ticket)) {
      setReadError(failure); if ([401,403,404].includes(failure.status)) setView(null);
    } } finally { if (reads.current.isCurrent(ticket)) setReading(false); }
  };
  useEffect(() => {
    const readGuard = reads.current, listGuard = lists.current;
    loadList(0); if (id) refresh(id);
    return () => { readGuard.invalidate(); listGuard.invalidate(); };
    // This component is keyed by the authenticated local user id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const submit = event => {
    event.preventDefault(); if (recovery.busy || recovery.intent) return;
    const product = bootstrap.products.find(item => item.id === productId);
    const amount = parseQuantity(quantity, 1);
    if (!product || !pharmacyId || amount === null) { setFormError({ message: 'Select a pharmacy and medicine, and enter a whole quantity from 1 to 10000.' }); return; }
    setFormError(null); const next = crypto.randomUUID(); setActive(next); lists.current.invalidate(); setListing(false);
    recovery.send({ type: 'create', id: next, userId: me.user_id, pharmacyId,
      payload: { pharmacy_id: pharmacyId, product_id: product.id, requested_quantity: amount, unit: product.unit } });
  };
  const product = bootstrap.products.find(item => item.id === productId);
  return <><section className="page-heading"><span className="eyebrow">For caregivers</span><h1>Ask for an exact medicine check.</h1><p>Your requests belong to your account. Choose the pharmacy, medicine and quantity you need.</p></section>
    <div className="workspace-grid"><section className="panel"><div className="panel-heading"><span className="step-number">1</span><h2>Your request</h2></div>
      <form onSubmit={submit}><fieldset disabled={recovery.busy || !!recovery.intent}>
        <label htmlFor="pharmacy-select">Pharmacy</label><select id="pharmacy-select" value={pharmacyId} onChange={event => setPharmacyId(event.target.value)}>{bootstrap.pharmacies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <label htmlFor="product-select">Exact medicine</label><select id="product-select" value={productId} onChange={event => setProductId(event.target.value)}>{bootstrap.products.map(item => <option key={item.id} value={item.id}>{item.name} · {item.strength} · {item.form}</option>)}</select>
        <label htmlFor="requested-quantity-input">Quantity ({product?.unit || 'unit'}s)</label><input id="requested-quantity-input" type="number" min="1" max="10000" step="1" required value={quantity} onChange={event => setQuantity(event.target.value)} />
        <button id="submit-enquiry-btn" className="primary" type="submit" disabled={!bootstrap.pharmacies.length || !product}>{recovery.busy ? 'Saving request…' : 'Request a pharmacy check'}<ArrowRight size={17} /></button>
      </fieldset></form>{formError && <Notice kind="error">{errorText(formError)}</Notice>}<Recovery state={recovery} />
      <div className="help-copy"><h3>Your saved requests</h3><button className="secondary" disabled={listing || recovery.busy} onClick={() => loadList(0)}>Refresh my requests</button>
        {listError && <Notice kind="error">{errorText(listError)}</Notice>}{listing && <p role="status">Loading requests…</p>}
        {page && !page.items.length && <p>No saved requests on this page.</p>}
        <RequestList page={page} selected={id} disabled={recovery.busy || !!recovery.intent} onSelect={item => { setActive(item.id); setView(item); }} />
        <Pagination page={page} busy={listing || recovery.busy || !!recovery.intent} onPage={offset => loadList(offset)} /></div>
    </section><section className="results-column"><div className="results-toolbar"><h2>Pharmacy response</h2>{id && <button id="refresh-enquiry-btn" className="secondary" disabled={reading || recovery.busy} onClick={() => refresh(id)}><RefreshCw size={16} />{reading ? 'Refreshing…' : 'Refresh response'}</button>}</div>
      {readError && !view && <Notice kind="error">{errorText(readError)}</Notice>}{view ? <Evidence view={view} stale={!!readError} /> : <div className="empty-state"><Clock3 size={32} /><h3>Your response will appear here</h3><p>Create a request or select one from your saved requests.</p></div>}
    </section></div></>;
}

function Pharmacy({ me, bootstrap, getToken }) {
  const pharmacies = bootstrap.pharmacies.filter(item => me.memberships.some(member => member.pharmacy_id === item.id && member.active));
  const [pharmacyId, setPharmacyId] = useState(pharmacies[0]?.id || '');
  const [page, setPage] = useState(null);
  const [selected, setSelected] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formError, setFormError] = useState(null);
  const [kind, setKind] = useState('checked');
  const [count, setCount] = useState('');
  const [stamp, setStamp] = useState('');
  const [unknown, setUnknown] = useState(false);
  const reads = useRef(createReadGuard());
  const tokenProvider = useRef(getToken);
  useEffect(() => { tokenProvider.current = getToken; }, [getToken]);
  const recovery = useHostedRecovery(me.user_id, 'staff', getToken, saved => {
    reads.current.invalidate(); setLoading(false); setResult(saved); setSelected(null);
    setPage(previous => previous ? { ...previous, items: previous.items.filter(item => item.id !== saved.id) } : null);
  });
  const locked = recovery.busy || !!recovery.intent;
  const load = async (offset = 0) => {
    if (!pharmacyId || locked) return;
    const ticket = reads.current.begin(); setLoading(true); setError(null);
    try { const token = await tokenProvider.current(); if (!reads.current.isCurrent(ticket)) return;
      const value = await listPharmacyQueue(pharmacyId, token, offset, 10);
      if (reads.current.isCurrent(ticket)) { setPage(value); setSelected(previous => previous ? value.items.find(item => item.id === previous.id) || null : null); }
    } catch (failure) { if (reads.current.isCurrent(ticket)) { setError(failure); setPage(null); setSelected(null); setResult(null); } }
    finally { if (reads.current.isCurrent(ticket)) setLoading(false); }
  };
  useEffect(() => { const guard = reads.current; return () => guard.invalidate(); }, []);
  const choosePharmacy = next => { reads.current.invalidate(); setPharmacyId(next); setPage(null); setSelected(null); setResult(null); setError(null); setLoading(false); setFormError(null); setCount(''); setStamp(''); setUnknown(false); setKind('checked'); };
  const select = item => { reads.current.invalidate(); setLoading(false); setSelected(item); setResult(null); setFormError(null); setCount(''); setStamp(''); setUnknown(false); setKind('checked'); };
  const submit = event => {
    event.preventDefault(); if (!selected || locked) return;
    const amount = kind === 'checked' ? parseQuantity(count, 0) : null;
    if (kind === 'checked' && (amount === null || (!unknown && !stamp))) { setFormError({ message: 'Enter a whole count from 0 to 10000 and set the check time, or choose Time unknown.' }); return; }
    reads.current.invalidate(); setLoading(false); setFormError(null);
    recovery.send({ type: 'report', id: selected.id, userId: me.user_id, pharmacyId: selected.pharmacy_id, payload: {
      product_id: selected.product.id, unit: selected.unit, kind, obtainable_quantity: amount,
      observed_at: kind === 'checked' && !unknown ? stamp : null, unresolved_reason: kind === 'unable_to_check' ? 'cannot_check' : null,
    } });
  };
  return <><section className="page-heading"><span className="eyebrow">For pharmacy staff</span><h1>Answer the request in front of you.</h1><p>Your access is limited to pharmacies assigned to your account.</p></section>
    <div className="workspace-grid"><aside className="panel"><div className="panel-heading"><span className="step-number">1</span><h2>Pending requests</h2></div>
      {!pharmacies.length ? <Notice>Your account has no active pharmacy assignment. An operator must grant staff membership.</Notice> : <>
        <label htmlFor="staff-pharmacy-select">Assigned pharmacy</label><select id="staff-pharmacy-select" value={pharmacyId} disabled={locked} onChange={event => choosePharmacy(event.target.value)}>{pharmacies.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
        <button id="refresh-queue-btn" className="primary" disabled={loading || locked} onClick={() => load(0)}><RefreshCw size={17} />{loading ? 'Loading requests…' : 'Open / refresh queue'}</button>
        {error && <Notice kind="error">{errorText(error)}</Notice>}{!page && !error && <p className="field-hint">Load the queue to begin.</p>}{page && !page.items.length && <p className="queue-empty">No pending requests on this page.</p>}
        <RequestList page={page} selected={selected?.id} disabled={locked} onSelect={select} /><Pagination page={page} busy={loading || locked} onPage={offset => load(offset)} />
      </>}<Recovery state={recovery} />
    </aside><section className="panel staff-report"><div className="panel-heading"><span className="step-number">2</span><h2>Record a check</h2></div>
      {result && <><Notice kind="success">Report Accepted. The caregiver can refresh their response.</Notice><Evidence view={result} /></>}
      {!selected && !result && <div className="empty-state"><ShieldCheck size={32} /><h3>Select a pending request</h3><p>Choose an enquiry from your pharmacy queue.</p></div>}
      {selected && <><div className="request-summary"><h3>{selected.product.name}</h3><p>{selected.product.strength} · {selected.product.form}</p><strong>{units(selected.requested_quantity, selected.unit)} requested</strong><small>Enquiry {selected.id}</small></div>
        <form onSubmit={submit}><fieldset disabled={locked}><legend>Check outcome</legend><div className="radio-options"><label><input type="radio" name="report-kind" checked={kind === 'checked'} onChange={() => setKind('checked')} />I checked the stock</label><label><input type="radio" name="report-kind" checked={kind === 'unable_to_check'} onChange={() => setKind('unable_to_check')} />I could not complete the check</label></div>
          {kind === 'checked' && <><label htmlFor="obtainable-count-input">Obtainable quantity ({selected.unit}s)</label><input id="obtainable-count-input" type="number" min="0" max="10000" step="1" required value={count} onChange={event => setCount(event.target.value)} /><p className="field-hint">Zero means none obtainable. It is different from not checking.</p>
            <label htmlFor="observation-time-input">Check time (your device's local timezone)</label><input id="observation-time-input" type="datetime-local" step="1" disabled={unknown} value={localInputTime(stamp)} onChange={event => setStamp(event.target.value && Number.isFinite(Date.parse(event.target.value)) ? new Date(event.target.value).toISOString() : '')} />
            <div className="time-controls"><button className="secondary" type="button" onClick={() => { setStamp(new Date().toISOString()); setUnknown(false); }}>Set simulated check time to now</button><label className="checkbox-label"><input id="time-unknown-input" type="checkbox" checked={unknown} onChange={event => setUnknown(event.target.checked)} />Time unknown</label></div></>}
          {kind === 'unable_to_check' && <Notice>No count or check time will be established. The response remains unresolved.</Notice>}
          <button id="submit-observation-btn" type="submit" className="primary">{recovery.busy ? 'Saving report…' : 'Save this check'}</button>
        </fieldset></form>{formError && <Notice kind="error">{errorText(formError)}</Notice>}
      </>}
    </section></div></>;
}

// getToken is supplied by Clerk in production; test harnesses inject it explicitly.
export default function HostedWorkspace({ authSubject, getToken, accountControl }) {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const [role, setRole] = useState(new URLSearchParams(location.search).get('role') || '');
  const tokens = useRef(getToken);
  useEffect(() => { tokens.current = getToken; }, [getToken]);
  useEffect(() => {
    let current = true;
    const load = async () => {
      try { const token = await tokens.current();
        const me = await getCurrentUser(token);
        if (!current) return;
        const bootstrap = await getBootstrapV2(token);
        if (current) {
          if (me.auth_subject !== authSubject) throw { message: 'Account response did not match your signed-in identity.' };
          try { sessionStorage.setItem('medicine_check_auth_user_' + authSubject, me.user_id); } catch { /* storage unavailable */ }
          setState({ me, bootstrap }); setError(null);
        }
      } catch (failure) { if (current) { setState(null); setError(failure); } }
    };
    load(); return () => { current = false; };
  }, [authSubject, attempt]);
  const choose = next => {
    setRole(next); const url = new URL(location.href); url.searchParams.set('role', next); url.searchParams.delete('enquiry'); history.replaceState({}, '', url);
  };
  const nav = <><button className="text-button" onClick={() => { setState(null); setAttempt(value => value + 1); }}>Refresh account access</button>{accountControl}</>;
  if (!state) return <Shell hosted account={nav}>{error ? <Notice kind="error">{errorText(error)}</Notice> : <p role="status">Loading your account and pharmacies…</p>}</Shell>;
  const { me, bootstrap } = state;
  return <Shell hosted workspace={role === 'staff' ? 'staff' : role === 'caregiver' ? 'caregiver' : undefined} account={nav}>
    <div className="hosted-role-nav"><button className="secondary" onClick={() => choose('caregiver')}>Caregiver workspace</button><button className="secondary" onClick={() => choose('staff')}>Pharmacy workspace</button></div>
    {role === 'caregiver' ? <Caregiver key={me.user_id + 'caregiver'} me={me} bootstrap={bootstrap} getToken={getToken} /> : role === 'staff' ? <Pharmacy key={me.user_id + 'staff'} me={me} bootstrap={bootstrap} getToken={getToken} /> :
      <section className="hero"><span className="eyebrow">Your account is ready</span><h1>Choose your workspace.</h1><p>Request a medicine check as a caregiver, or answer requests at a pharmacy assigned to you.</p></section>}
    <details className="account-details"><summary>Account reference for pharmacy assignment</summary><p className="small">Give this local user ID to your operator: <code>{me.user_id}</code></p></details>
  </Shell>;
}
