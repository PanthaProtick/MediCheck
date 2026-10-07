import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Pill,
  ShieldAlert,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Lock,
  User,
  Search,
  Check,
  FileText,
} from 'lucide-react';
import {
  getHealth,
  getBootstrap,
  createEnquiry,
  getEnquiry,
  listStaffEnquiries,
  submitObservation,
} from './services/api';

import { parseQuantity, matchesIntent, createReadGuard } from './services/recovery';

export default function App() {
  const [activeRole, setActiveRole] = useState('caregiver'); // 'caregiver' | 'staff'
  const [health, setHealth] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapError, setBootstrapError] = useState(null);

  // Caregiver state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [requestedQuantity, setRequestedQuantity] = useState('6');
  const [activeEnquiryId, setActiveEnquiryId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('enquiry') || '';
    }
    return '';
  });
  const [enquiryView, setEnquiryView] = useState(null);
  const [enquiryLoading, setEnquiryLoading] = useState(false);
  const [enquiryError, setEnquiryError] = useState(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Staff state
  const [staffToken, setStaffToken] = useState('');
  const [staffQueue, setStaffQueue] = useState([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueLoaded, setQueueLoaded] = useState(false);
  const [queueError, setQueueError] = useState(null);
  const [selectedQueueId, setSelectedQueueId] = useState('');
  const [selectedQueueEnquiry, setSelectedQueueEnquiry] = useState(null);
  const [reportKind, setReportKind] = useState('checked'); // 'checked' | 'unable_to_check'
  const [obtainableCount, setObtainableCount] = useState('');
  const [observationTime, setObservationTime] = useState('');
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportResult, setReportResult] = useState(null);
  const [reportError, setReportError] = useState(null);

  const readGuard = useRef(createReadGuard());
  const queueGuard = useRef(createReadGuard());
  const activeId = useRef(activeEnquiryId);
  const mutationBusy = useRef(false);
  const [pendingIntent, setPendingIntent] = useState(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem('pending_intent'));
      return value && ['create', 'report'].includes(value.type) && value.id && value.payload ? value : null;
    } catch { return null; }
  });
  const pendingRef = useRef(pendingIntent);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [canStartSeparate, setCanStartSeparate] = useState(false);

  const rememberIntent = (intent) => {
    pendingRef.current = intent;
    setPendingIntent(intent);
    setRetryAllowed(false);
    setCanStartSeparate(false);
    try {
      if (intent) sessionStorage.setItem('pending_intent', JSON.stringify(intent));
      else sessionStorage.removeItem('pending_intent');
    } catch { /* Memory still holds the intent when browser storage is blocked. */ }
  };

  useEffect(() => {
    let active = true;
    const read = readGuard.current;
    const queue = queueGuard.current;
    getHealth().then(data => { if (active) setHealth(data); })
      .catch(error => { if (active) setHealth({ status: 'error', error }); });
    getBootstrap().then(data => {
      if (!active) return;
      setBootstrap(data);
      if (data.products?.length) setSelectedProductId(data.products[0].id);
    }).catch(error => { if (active) setBootstrapError(error); });
    return () => { active = false; read.invalidate(); queue.invalidate(); };
  }, []);

  const fetchActiveEnquiry = useCallback(async (idToFetch) => {
    const id = idToFetch || activeId.current;
    if (!id || mutationBusy.current) return;
    const generation = readGuard.current.begin();
    setEnquiryLoading(true);
    setEnquiryError(null);
    try {
      const view = await getEnquiry(id);
      if (readGuard.current.isCurrent(generation) && activeId.current === id) setEnquiryView(view);
    } catch (error) {
      if (readGuard.current.isCurrent(generation)) setEnquiryError(error);
    } finally {
      if (readGuard.current.isCurrent(generation)) setEnquiryLoading(false);
    }
  }, []);

  useEffect(() => {
    activeId.current = activeEnquiryId;
    readGuard.current.invalidate();
    if (activeEnquiryId) fetchActiveEnquiry(activeEnquiryId);
  }, [activeEnquiryId, fetchActiveEnquiry]);

  const selectActiveEnquiry = (id) => {
    if (mutationBusy.current) return;
    activeId.current = id;
    readGuard.current.invalidate();
    setEnquiryView(null);
    setEnquiryLoading(false);
    setEnquiryError(null);
    setActiveEnquiryId(id);
    const url = new URL(window.location);
    if (id) url.searchParams.set('enquiry', id);
    else url.searchParams.delete('enquiry');
    window.history.replaceState({}, '', url);
  };

  const finishWrite = (view, intent) => {
    rememberIntent(null);
    setRecoveryMessage('Save confirmed by the server.');
    if (intent.type === 'report') {
      queueGuard.current.invalidate();
      setQueueLoading(false);
      setReportResult(view);
      setStaffQueue(items => items.filter(item => item.id !== intent.id));
      setSelectedQueueEnquiry(null);
      setSelectedQueueId('');
    }
    if (activeId.current === intent.id) {
      readGuard.current.invalidate();
      setEnquiryLoading(false);
      setEnquiryView(view);
      setEnquiryError(null);
    }
  };

  const sendIntent = async (intent) => {
    if (mutationBusy.current) return;
    mutationBusy.current = true;
    readGuard.current.invalidate();
    setEnquiryLoading(false);
    setCreateSubmitting(intent.type === 'create');
    setReportSubmitting(intent.type === 'report');
    setEnquiryError(null);
    setReportError(null);
    try {
      const view = intent.type === 'create'
        ? await createEnquiry(intent.id, intent.payload)
        : await submitObservation(intent.id, intent.payload, staffToken);
      if (!matchesIntent(view, intent)) throw { kind: 'transport', outcome: 'unknown', message: 'Saved response does not match the attempted payload.' };
      finishWrite(view, intent);
    } catch (error) {
      if (error.outcome === 'unknown' || error.status === 409) {
        setRecoveryMessage('Save outcome requires inspection. The attempted ID and payload are preserved; do not submit a new request.');
      } else rememberIntent(null);
      if (intent.type === 'create') setEnquiryError(error);
      else setReportError(error);
    } finally {
      mutationBusy.current = false;
      setCreateSubmitting(false);
      setReportSubmitting(false);
    }
  };

  const handleCreateEnquiry = async (event) => {
    event.preventDefault();
    if (mutationBusy.current || pendingRef.current || !bootstrap) return;
    const product = bootstrap.products.find(item => item.id === selectedProductId);
    const quantity = parseQuantity(requestedQuantity, 1);
    if (!product || quantity === null) {
      setEnquiryError({ message: 'Requested quantity must be a whole number from 1 to 10000.' });
      return;
    }
    const intent = { type: 'create', id: crypto.randomUUID(), payload: {
      pharmacy_id: bootstrap.pharmacy.id, product_id: product.id, requested_quantity: quantity, unit: product.unit,
    } };
    selectActiveEnquiry(intent.id);
    rememberIntent(intent);
    await sendIntent(intent);
  };

  const handleLoadQueue = async () => {
    if (mutationBusy.current || pendingRef.current?.type === 'report') return;
    if (!staffToken) { setQueueError({ message: 'Enter the simulated staff token.' }); return; }
    const generation = queueGuard.current.begin();
    setQueueLoading(true);
    setQueueError(null);
    try {
      const items = await listStaffEnquiries(staffToken);
      if (!queueGuard.current.isCurrent(generation)) return;
      setStaffQueue(items);
      setQueueLoaded(true);
      const selected = items.find(item => item.id === selectedQueueId) || items[0] || null;
      if (selected?.id !== selectedQueueId) {
        setObtainableCount('');
        setObservationTime('');
        setTimeUnknown(false);
        setReportKind('checked');
        setReportResult(null);
        setReportError(null);
      }
      setSelectedQueueId(selected?.id || '');
      setSelectedQueueEnquiry(selected);
    } catch (error) {
      if (!queueGuard.current.isCurrent(generation)) return;
      setQueueError(error);
      setQueueLoaded(false);
      setStaffQueue([]);
      setSelectedQueueId('');
      setSelectedQueueEnquiry(null);
    } finally {
      if (queueGuard.current.isCurrent(generation)) setQueueLoading(false);
    }
  };

  const handleSelectQueueItem = (item) => {
    if (mutationBusy.current || pendingRef.current?.type === 'report') return;
    queueGuard.current.invalidate();
    setQueueLoading(false);
    setSelectedQueueId(item.id);
    setSelectedQueueEnquiry(item);
    setReportResult(null);
    setReportError(null);
    setObservationTime('');
    setObtainableCount('');
    setTimeUnknown(false);
  };

  const handleSubmitReport = async (event) => {
    event.preventDefault();
    if (mutationBusy.current || pendingRef.current || !selectedQueueEnquiry) return;
    if (!staffToken) { setReportError({ message: 'Staff token is required.' }); return; }
    const count = parseQuantity(obtainableCount, 0);
    if (reportKind === 'checked' && count === null) {
      setReportError({ message: 'Obtainable quantity must be a whole number from 0 to 10000.' }); return;
    }
    const intent = { type: 'report', id: selectedQueueId, payload: {
      product_id: selectedQueueEnquiry.product.id, unit: selectedQueueEnquiry.unit, kind: reportKind,
      obtainable_quantity: reportKind === 'checked' ? count : null,
      observed_at: reportKind === 'checked' && !timeUnknown ? observationTime : null,
      unresolved_reason: reportKind === 'checked' ? null : 'cannot_check',
    } };
    rememberIntent(intent);
    setReportResult(null);
    await sendIntent(intent);
  };

  const inspectSave = async () => {
    const intent = pendingRef.current;
    if (!intent || mutationBusy.current) return;
    setInspecting(true);
    setRetryAllowed(false);
    setCanStartSeparate(false);
    try {
      const view = await getEnquiry(intent.id);
      if (matchesIntent(view, intent)) finishWrite(view, intent);
      else if (intent.type === 'report' && view.observation === null) {
        setRecoveryMessage('Inspection found no saved report yet; the outcome remains unknown. You may explicitly retry the same frozen report.');
        setRetryAllowed(true);
      } else {
        setRecoveryMessage('Inspection found different saved evidence. Replacement is prohibited; you may explicitly start a separate enquiry.');
        setCanStartSeparate(true);
      }
    } catch (error) {
      if (intent.type === 'create' && error.status === 404) {
        setRecoveryMessage('Inspection found no saved enquiry yet; the outcome remains unknown. You may explicitly retry the same ID and frozen request.');
        setRetryAllowed(true);
      } else if (intent.type === 'report' && error.status === 404) {
        setRecoveryMessage('The parent enquiry is absent; no report can be attached to it. You may start a separate enquiry.');
        setCanStartSeparate(true);
      } else setRecoveryMessage('Inspection failed. The save outcome remains unknown; retry inspection when the server is reachable.');
    } finally { setInspecting(false); }
  };

  const handleSetTimeToNow = () => {
    setObservationTime(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
    setTimeUnknown(false);
  };

  return (
    <div className="app-container">
      {/* Top Navigation & Disclosures */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <Pill size={24} color="#ffffff" />
          </div>
          <div className="brand-text">
            <h1>RxVerify</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Request-Specific Availability Verification
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            color: '#34d399',
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: health?.status === 'ready' ? '#10b981' : '#f59e0b' }} />
            <span>{health?.status === 'ready' ? 'SQLite Ready • Synthetic Demo' : health?.status === 'error' ? 'SQLite unavailable' : 'Checking SQLite...'}</span>
          </div>

          {/* Actor Navigation Tabs */}
          <div style={{
            display: 'flex',
            background: 'rgba(10, 14, 23, 0.8)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
          }}>
            <button
              id="role-caregiver-btn"
              type="button"
              onClick={() => setActiveRole('caregiver')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeRole === 'caregiver' ? 'var(--primary-accent)' : 'transparent',
                color: activeRole === 'caregiver' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: activeRole === 'caregiver' ? 600 : 400,
                fontSize: '0.85rem',
              }}
            >
              <User size={15} />
              Caregiver Actor
            </button>
            <button
              id="role-staff-btn"
              type="button"
              onClick={() => setActiveRole('staff')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 16px',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                background: activeRole === 'staff' ? '#d97706' : 'transparent',
                color: activeRole === 'staff' ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: activeRole === 'staff' ? 600 : 400,
                fontSize: '0.85rem',
              }}
            >
              <Lock size={15} />
              Simulated Staff Actor
            </button>
          </div>
        </div>
      </header>

      {/* Synthetic Disclosure Banner */}
      <div style={{
        marginBottom: '24px',
        padding: '12px 18px',
        background: 'rgba(99, 102, 241, 0.08)',
        border: '1px solid rgba(99, 102, 241, 0.25)',
        borderRadius: 'var(--radius-sm)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '0.84rem',
        color: '#c7d2fe',
      }}>
        <ShieldAlert size={18} color="#818cf8" />
        <span>
          <strong>Operational Boundaries:</strong> Disclosed synthetic catalog & stock claims. Staff checks reflect simulated actor observations, not verified healthcare professional clinical approval. Checks do not reserve stock or guarantee availability on arrival.
        </span>
      </div>

      {bootstrapError && (
        <div style={{
          marginBottom: '20px',
          padding: '14px',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.3)',
          borderRadius: 'var(--radius-sm)',
          color: '#fda4af',
          fontSize: '0.85rem',
        }}>
          Failed to load bootstrap catalog: {bootstrapError.message || 'Storage unavailable'}
        </div>
      )}

      {(pendingIntent || recoveryMessage) && <div role="status" style={{ padding: '16px', marginBottom: '20px', border: '1px solid #fbbf24' }}>
        <p>{recoveryMessage || 'An unfinished save intent was recovered. Inspect its saved outcome before retry.'}</p>
        {pendingIntent && <>
          <p>Attempted {pendingIntent.type} for enquiry {pendingIntent.id}</p>
          <button type="button" onClick={inspectSave} disabled={inspecting || createSubmitting || reportSubmitting}>Inspect saved outcome</button>
          {canStartSeparate && <button type="button" onClick={() => { rememberIntent(null); setRecoveryMessage('Inspected conflict retained in saved history. You may start a separate enquiry.'); }}>Start separate enquiry</button>}
          {retryAllowed && <button type="button" disabled={createSubmitting || reportSubmitting || (pendingIntent.type === 'report' && !staffToken)}
            onClick={() => { setRetryAllowed(false); sendIntent(pendingIntent); }}>Retry same frozen payload</button>}
        </>}
      </div>}

      {/* CAREGIVER VIEW */}
      {activeRole === 'caregiver' && (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: '24px' }}>
          {/* Create Request Column */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '8px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={18} color="#6366f1" />
              1. Request Availability Check
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Select an exact medicine and requested whole-unit amount at the demonstration pharmacy.
            </p>

            <form onSubmit={handleCreateEnquiry}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Target Pharmacy
                </label>
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(10, 14, 23, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  fontSize: '0.88rem',
                  color: '#e2e8f0',
                }}>
                  {bootstrap ? `${bootstrap.pharmacy.name} (${bootstrap.pharmacy.id})` : 'Loading...'}
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="product-select" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Select Medicine & Strength
                </label>
                <select
                  id="product-select"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={createSubmitting || !!pendingIntent || !bootstrap}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                >
                  {bootstrap?.products.map((p) => (
                    <option key={p.id} value={p.id} style={{ background: '#0a0e17' }}>
                      {p.name} • {p.strength} ({p.form}) — Unit: {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="quantity-input" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Requested Quantity (Units)
                </label>
                <input
                  id="quantity-input"
                  type="number"
                  min="1"
                  max="10000"
                  step="1"
                  value={requestedQuantity}
                  onChange={(e) => setRequestedQuantity(e.target.value)}
                  disabled={createSubmitting || !!pendingIntent}
                  placeholder="e.g. 6"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.88rem',
                    outline: 'none',
                  }}
                />
              </div>

              <button
                id="submit-enquiry-btn"
                type="submit"
                disabled={createSubmitting || !!pendingIntent || !bootstrap}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'var(--primary-accent)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: createSubmitting ? 'not-allowed' : 'pointer',
                  opacity: createSubmitting ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {createSubmitting ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Transmitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send size={16} />
                    <span>Submit Verification Request</span>
                  </>
                )}
              </button>
            </form>

            <hr style={{ borderColor: 'var(--border-subtle)', margin: '24px 0 20px' }} />

            <div>
              <label htmlFor="lookup-id-input" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Lookup Existing Enquiry (UUID)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="lookup-id-input"
                  type="text"
                  value={activeEnquiryId}
                  onChange={(e) => selectActiveEnquiry(e.target.value.trim())}
                  disabled={createSubmitting || !!pendingIntent}
                  placeholder="00000000-0000-4000-8000-..."
                  style={{
                    flex: 1,
                    padding: '8px 10px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#f8fafc',
                    fontSize: '0.78rem',
                    fontFamily: 'var(--font-mono)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => fetchActiveEnquiry()}
                  style={{
                    padding: '8px 12px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#e2e8f0',
                    cursor: 'pointer',
                  }}
                >
                  <Search size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Active Enquiry & Evidence Result Column */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.15rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} color="#06b6d4" />
                2. Verification Evidence & Result
              </h2>
              {activeEnquiryId && (
                <button
                  id="refresh-enquiry-btn"
                  type="button"
                  onClick={() => fetchActiveEnquiry()}
                  disabled={enquiryLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 14px',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '6px',
                    color: '#cbd5e1',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <RefreshCw size={14} className={enquiryLoading ? 'spin' : ''} />
                  <span>Refresh Status</span>
                </button>
              )}
            </div>

            {enquiryError && (
              <div style={{
                padding: '14px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: 'var(--radius-sm)',
                color: '#fda4af',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}>
                <strong>Enquiry Error:</strong> {enquiryError.error?.message || enquiryError.message || 'Error occurred.'}
              </div>
            )}

            {!activeEnquiryId && !enquiryView && (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}>
                <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p>No enquiry currently active.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Submit a request on the left or enter a known UUID to inspect saved evidence.</p>
              </div>
            )}

            {enquiryView && enquiryView.id === activeEnquiryId && (
              <div>
                <p>Exact request: {enquiryView.product.name} · {enquiryView.product.strength} · {enquiryView.product.form} · {enquiryView.requested_quantity} {enquiryView.unit}s</p>
                <p>Created: {enquiryView.created_at} · Last successful read: {enquiryView.served_at}</p>
                {enquiryError && <p>Showing previously saved evidence; the latest refresh failed.</p>}
                {/* Meta details bar */}
                <div style={{
                  padding: '12px 16px',
                  background: 'rgba(10, 14, 23, 0.6)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '20px',
                  fontSize: '0.82rem',
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Enquiry ID: </span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{enquiryView.id}</span>
                  </div>
                  <div>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background:
                        enquiryView.status === 'answered'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : enquiryView.status === 'pending'
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'rgba(148, 163, 184, 0.15)',
                      color:
                        enquiryView.status === 'answered'
                          ? '#34d399'
                          : enquiryView.status === 'pending'
                          ? '#fbbf24'
                          : '#cbd5e1',
                      border: `1px solid ${
                        enquiryView.status === 'answered'
                          ? 'rgba(16, 185, 129, 0.3)'
                          : enquiryView.status === 'pending'
                          ? 'rgba(245, 158, 11, 0.3)'
                          : 'rgba(148, 163, 184, 0.3)'
                      }`,
                    }}>
                      Status: {enquiryView.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Conclusion Callout Banner */}
                <div style={{
                  padding: '18px 20px',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '24px',
                  background:
                    enquiryView.answer.conclusion === 'sufficient'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : enquiryView.answer.conclusion === 'insufficient'
                      ? 'rgba(244, 63, 94, 0.1)'
                      : 'rgba(100, 116, 139, 0.12)',
                  border: `1px solid ${
                    enquiryView.answer.conclusion === 'sufficient'
                      ? 'rgba(16, 185, 129, 0.35)'
                      : enquiryView.answer.conclusion === 'insufficient'
                      ? 'rgba(244, 63, 94, 0.35)'
                      : 'rgba(100, 116, 139, 0.3)'
                  }`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {enquiryView.answer.conclusion === 'sufficient' && <CheckCircle2 size={20} color="#10b981" />}
                      {enquiryView.answer.conclusion === 'insufficient' && <AlertCircle size={20} color="#f43f5e" />}
                      {enquiryView.answer.conclusion === 'unresolved' && <Clock size={20} color="#94a3b8" />}
                      <span style={{
                        fontSize: '1.05rem',
                        fontWeight: 700,
                        color:
                          enquiryView.answer.conclusion === 'sufficient'
                            ? '#34d399'
                            : enquiryView.answer.conclusion === 'insufficient'
                            ? '#fda4af'
                            : '#e2e8f0',
                      }}>
                        Conclusion: {enquiryView.answer.conclusion.toUpperCase()}
                      </span>
                    </div>

                    {enquiryView.answer.discrepancy_units !== null && (
                      <div style={{
                        padding: '4px 12px',
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.85rem',
                        color: enquiryView.answer.discrepancy_units < 0 ? '#fda4af' : '#6ee7b7',
                      }}>
                        Discrepancy: {enquiryView.answer.discrepancy_units} {enquiryView.unit}s
                      </div>
                    )}
                  </div>

                  <p style={{ fontSize: '0.92rem', color: '#f1f5f9', margin: '8px 0 12px' }}>
                    {enquiryView.answer.message}
                  </p>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Reason code: <code style={{ color: '#c7d2fe' }}>{enquiryView.answer.reason}</code>
                  </div>
                </div>

                {/* Evidence Comparison Grid */}
                <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '12px' }}>
                  Recorded vs. Checked Stored Evidence
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '16px',
                  marginBottom: '24px',
                }}>
                  {/* Claim Box */}
                  <div style={{
                    padding: '16px',
                    background: 'rgba(10, 14, 23, 0.6)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#93c5fd', fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>
                      <FileText size={16} />
                      Recorded Inventory Claim
                    </div>
                    {enquiryView.claim ? (
                      <div style={{ fontSize: '0.82rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                        <div><strong style={{ color: '#e2e8f0' }}>Recorded Quantity:</strong> {enquiryView.claim.quantity ?? 'Unknown'} {enquiryView.claim.unit}s</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Recorded At:</strong> {enquiryView.claim.recorded_at ?? 'None'}</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Ingested:</strong> {enquiryView.claim.loaded_at}</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Source:</strong> {enquiryView.claim.source}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        No stock claim recorded for this product in catalog.
                      </div>
                    )}
                  </div>

                  {/* Observation Box */}
                  <div style={{
                    padding: '16px',
                    background: 'rgba(10, 14, 23, 0.6)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600, marginBottom: '10px' }}>
                      <Clock size={16} />
                      Staff Physical Observation
                    </div>
                    {enquiryView.observation ? (
                      <div style={{ fontSize: '0.82rem', lineHeight: '1.7', color: 'var(--text-secondary)' }}>
                        <div><strong style={{ color: '#e2e8f0' }}>Obtainable Quantity:</strong> {enquiryView.observation.obtainable_quantity ?? 'None'} {enquiryView.observation.unit}s</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Observation Time:</strong> {enquiryView.observation.observed_at ?? 'Unknown'}</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Submitted Time:</strong> {enquiryView.observation.submitted_at}</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Staff ID:</strong> {enquiryView.observation.staff_id}</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Basis:</strong> {enquiryView.observation.basis}</div>
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                        <Clock size={14} />
                        Awaiting physical check by pharmacy staff...
                      </div>
                    )}
                  </div>
                </div>

                {/* Limitations List */}
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(15, 23, 42, 0.5)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Standard Limitations & Scope Notice:
                  </div>
                  <ul style={{ paddingLeft: '18px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {enquiryView.answer.limitations.map((limit, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{limit}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SIMULATED STAFF VIEW */}
      {activeRole === 'staff' && (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
          {/* Staff Queue Column */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '8px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock size={18} color="#d97706" />
              Staff Verification Queue
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Authenticated pharmacy staff access to pending caregiver verification requests.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="staff-token-input" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                Simulated Staff Bearer Token
              </label>
              <input
                id="staff-token-input"
                type="password"
                value={staffToken}
                disabled={reportSubmitting}
                onChange={(e) => {
                  queueGuard.current.invalidate();
                  setQueueLoading(false);
                  setStaffToken(e.target.value);
                  setQueueLoaded(false);
                  setQueueError(null);
                  setStaffQueue([]);
                  setSelectedQueueId('');
                  setSelectedQueueEnquiry(null);
                }}
                placeholder="Enter staff demo secret"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  outline: 'none',
                  fontFamily: 'var(--font-mono)',
                }}
              />
            </div>

            <button
              id="refresh-queue-btn"
              type="button"
              onClick={handleLoadQueue}
              disabled={queueLoading}
              style={{
                width: '100%',
                padding: '10px',
                background: 'rgba(217, 119, 6, 0.15)',
                border: '1px solid rgba(217, 119, 6, 0.4)',
                borderRadius: '6px',
                color: '#fbbf24',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                marginBottom: '16px',
              }}
            >
              <RefreshCw size={15} className={queueLoading ? 'spin' : ''} />
              <span>Fetch Pending Enquiries</span>
            </button>

            {queueError && (
              <div style={{
                padding: '10px 12px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '6px',
                color: '#fda4af',
                fontSize: '0.82rem',
                marginBottom: '16px',
              }}>
                {queueError.error?.message || queueError.message || 'Failed to load queue'}
              </div>
            )}

            {/* Queue List */}
            <div style={{
              maxHeight: '400px',
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              background: 'rgba(10, 14, 23, 0.5)',
            }}>
              {staffQueue.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {queueLoading ? 'Loading queue...' : queueError ? 'Queue unavailable; no current list established.' : queueLoaded ? 'No pending enquiries for PHARM-A.' : 'Enter a staff credential and fetch the pending queue.'}
                </div>
              ) : (
                staffQueue.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectQueueItem(item)}
                    style={{
                      padding: '12px 14px',
                      borderBottom: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      background: selectedQueueId === item.id ? 'rgba(217, 119, 6, 0.15)' : 'transparent',
                      borderLeft: selectedQueueId === item.id ? '3px solid #d97706' : '3px solid transparent',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc' }}>
                        {item.product.name}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: '#fbbf24', fontWeight: 600 }}>
                        {item.requested_quantity} {item.unit}s
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {item.id}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Report Submission Column */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
          }}>
            <h2 style={{ fontSize: '1.15rem', marginBottom: '8px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} color="#10b981" />
              Submit Physical Shelf Observation
            </h2>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Record the simulated staff-reported obtainable count and observation time.
            </p>

            {reportError && (
              <div style={{
                padding: '12px 14px',
                background: 'rgba(244, 63, 94, 0.1)',
                border: '1px solid rgba(244, 63, 94, 0.3)',
                borderRadius: '6px',
                color: '#fda4af',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}>
                <strong>Submission Error:</strong> {reportError.error?.message || reportError.message || 'Error occurred'}
              </div>
            )}

            {reportResult && (
              <div style={{
                padding: '14px 16px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '6px',
                color: '#34d399',
                fontSize: '0.88rem',
                marginBottom: '20px',
              }}>
                <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                  Report Accepted by Backend!
                </div>
                <div>Status: {reportResult.status} • Conclusion: {reportResult.answer.conclusion}</div>
              </div>
            )}

            {!selectedQueueEnquiry ? (
              <div style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}>
                <Search size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
                <p>Select a pending enquiry from the queue on the left to submit an observation.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport}>
                {/* Selected item summary */}
                <div style={{
                  padding: '14px 16px',
                  background: 'rgba(10, 14, 23, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '20px',
                  fontSize: '0.84rem',
                }}>
                  <div style={{ marginBottom: '6px' }}>
                    <strong style={{ color: '#e2e8f0' }}>Enquiry ID:</strong>{' '}
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{selectedQueueEnquiry.id}</span>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <strong style={{ color: '#e2e8f0' }}>Medicine Requested:</strong> {selectedQueueEnquiry.product.name} ({selectedQueueEnquiry.product.strength}, {selectedQueueEnquiry.product.form})
                  </div>
                  <div>
                    <strong style={{ color: '#e2e8f0' }}>Requested Amount:</strong>{' '}
                    <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                      {selectedQueueEnquiry.requested_quantity} {selectedQueueEnquiry.unit}s
                    </span>
                  </div>
                </div>

                {/* Report Kind Selection */}
                <div style={{ marginBottom: '18px' }}>
                  <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Observation Outcome
                  </label>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <label style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: reportKind === 'checked' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-input)',
                      border: reportKind === 'checked' ? '1px solid #10b981' : '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: reportKind === 'checked' ? '#34d399' : 'var(--text-secondary)',
                    }}>
                      <input
                        type="radio"
                        name="reportKind"
                        value="checked"
                        checked={reportKind === 'checked'}
                        onChange={() => setReportKind('checked')}
                      />
                      Count Checked at Shelf
                    </label>

                    <label style={{
                      flex: 1,
                      padding: '10px 14px',
                      background: reportKind === 'unable_to_check' ? 'rgba(244, 63, 94, 0.15)' : 'var(--bg-input)',
                      border: reportKind === 'unable_to_check' ? '1px solid #f43f5e' : '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.84rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      color: reportKind === 'unable_to_check' ? '#fda4af' : 'var(--text-secondary)',
                    }}>
                      <input
                        type="radio"
                        name="reportKind"
                        value="unable_to_check"
                        checked={reportKind === 'unable_to_check'}
                        onChange={() => setReportKind('unable_to_check')}
                      />
                      Unable to Complete Check
                    </label>
                  </div>
                </div>

                {/* Checked Inputs */}
                {reportKind === 'checked' && (
                  <>
                    <div style={{ marginBottom: '18px' }}>
                      <label htmlFor="obtainable-count-input" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                        Obtainable Quantity Counted (Units)
                      </label>
                      <input
                        id="obtainable-count-input"
                        type="number"
                        min="0"
                        max="10000"
                        step="1"
                        value={obtainableCount}
                        onChange={(e) => setObtainableCount(e.target.value)}
                        placeholder="e.g. 4 (0 if out of stock)"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: '#f8fafc',
                          fontSize: '0.88rem',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                        Zero is an explicit counted stockout; missing check is uncompleted.
                      </span>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <label htmlFor="obs-time-input" style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          Observed Timestamp (ISO UTC)
                        </label>
                        <button
                          type="button"
                          onClick={handleSetTimeToNow}
                          style={{
                            fontSize: '0.75rem',
                            color: '#6366f1',
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                          }}
                        >
                          Set simulated check time to now
                        </button>
                      </div>
                      <input
                        id="obs-time-input"
                        type="text"
                        disabled={timeUnknown}
                        value={timeUnknown ? 'Unknown (time null)' : observationTime}
                        onChange={(e) => setObservationTime(e.target.value)}
                        placeholder="2026-10-07T05:02:00Z"
                        style={{
                          width: '100%',
                          padding: '10px 12px',
                          background: timeUnknown ? 'rgba(15,23,42,0.4)' : 'var(--bg-input)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '6px',
                          color: timeUnknown ? 'var(--text-muted)' : '#f8fafc',
                          fontSize: '0.85rem',
                          fontFamily: 'var(--font-mono)',
                          outline: 'none',
                        }}
                      />

                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '8px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={timeUnknown}
                          onChange={(e) => setTimeUnknown(e.target.checked)}
                        />
                        Check completed but exact observation time is unknown
                      </label>
                    </div>
                  </>
                )}

                <button
                  id="submit-observation-btn"
                  type="submit"
                  disabled={reportSubmitting || !!pendingIntent}
                  style={{
                    width: '100%',
                    padding: '12px',
                    background: '#d97706',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    cursor: reportSubmitting ? 'not-allowed' : 'pointer',
                    opacity: reportSubmitting ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                  }}
                >
                  {reportSubmitting ? (
                    <>
                      <RefreshCw size={16} className="spin" />
                      <span>Recording Observation...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Commit Staff Observation</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <footer style={{
        marginTop: '48px',
        paddingTop: '24px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
      }}>
        <div>RxVerify • Solo 6-Hour Hackathon Implementation • Pantha Protick</div>
        <div>Standard: /api/v1 • SQLite Storage • Pure Deterministic Evaluator</div>
      </footer>
    </div>
  );
}
