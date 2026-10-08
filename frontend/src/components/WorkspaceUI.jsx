import { Pill, ShieldCheck, AlertCircle } from "lucide-react";

import { units, time, titleFor } from "../services/presentation";

export function Notice({ children, kind = 'info' }) {
  return <div className={'notice ' + kind} role={kind === 'error' ? 'alert' : 'status'}><AlertCircle size={18} /><div>{children}</div></div>;
}

export function Shell({ children, workspace, hosted = false, account }) {
  return <div className={'app-shell ' + (workspace || '')}>
    <header className="topbar"><a className="brand" href="/"><span className="brand-icon"><Pill size={23} /></span><span>Medicine Check<small>Request-specific availability</small></span></a>
      <nav aria-label="Workspace navigation">{account}{workspace && <><span className="workspace-label">{workspace === 'caregiver' ? 'Caregiver workspace' : 'Pharmacy workspace'}</span><a className="text-link" href="/">Change workspace</a></>}</nav>
    </header>
    <div className="demo-banner"><ShieldCheck size={17} /><span>{hosted ? "Hosted demo" : "Local demo"} · Synthetic medicines and stock. A check does not reserve medicine or approve treatment.</span></div>
    <main>{children}</main>
    <footer>Recorded stock and staff observations remain separate. This demo uses synthetic data and simulated observations.</footer>
  </div>;
}

export function Evidence({ view, stale = false }) {
  const conclusion = view.answer.conclusion;
  const tone = view.status === 'pending' ? 'pending' : conclusion;
  return <article className={'result-card ' + tone} aria-label="Saved enquiry result">
    <div className="result-heading"><span className={'status-pill ' + tone}>{view.status === 'pending' ? 'Pending' : conclusion === 'sufficient' ? 'Sufficient' : conclusion === 'insufficient' ? 'Insufficient' : 'Unresolved'}</span><span className="small muted">{time(view.served_at)}</span></div>
    <h2>{titleFor(view)}</h2><p className="exact-request">Exact request: {view.product.name} · {view.product.strength} · {view.product.form}</p>
    {stale && <Notice kind="error">The latest refresh failed. This is previously loaded evidence.</Notice>}
    <div className="quantity-grid"><div><span>You requested</span><strong>{units(view.requested_quantity, view.unit)}</strong></div>
      <div><span>Recorded inventory</span><strong>{view.claim?.quantity == null ? 'Unknown' : units(view.claim.quantity, view.claim.unit)}</strong><small>{view.claim ? time(view.claim.recorded_at) : 'No inventory claim'}</small></div>
      <div><span>Staff-reported count</span><strong>{view.observation?.obtainable_quantity == null ? 'Not established' : units(view.observation.obtainable_quantity, view.observation.unit)}</strong><small>{view.observation ? time(view.observation.observed_at) : 'Check not yet saved'}</small></div></div>
    <p className="answer-copy">{view.answer.message}</p>
    {view.answer.discrepancy_units !== null && <p className="discrepancy">Discrepancy: {view.answer.discrepancy_units} {view.unit}s <span>(staff count − recorded inventory)</span></p>}
    <ul className="limits">{view.answer.limitations.map(item => <li key={item}>{item}</li>)}</ul>
    <details><summary>Evidence details and enquiry ID</summary><dl><dt>Enquiry ID</dt><dd><code>{view.id}</code></dd><dt>Inventory source</dt><dd>{view.claim?.source || 'No recorded source'}</dd><dt>Staff attribution</dt><dd>{view.observation?.reported_by_user_id || view.observation?.staff_id || 'No saved report'}</dd><dt>Observation time (UTC)</dt><dd>{view.observation?.observed_at || 'Unknown'}</dd><dt>Report received (UTC)</dt><dd>{view.observation?.submitted_at || 'Not received'}</dd></dl></details>
  </article>;
}
