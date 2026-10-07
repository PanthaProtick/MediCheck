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
  Building2,
  LogOut,
  ChevronRight,
  History,
  Shield,
  Layers,
} from 'lucide-react';
import { useAppAuth } from './components/AuthWrapper';
import {
  getHealth,
  getBootstrap,
  createEnquiry,
  getEnquiry,
  getCurrentUser,
  listOwnEnquiries,
  listPharmacyQueue,
  submitObservationV2,
} from './services/api';
import {
  parseQuantity,
  matchesIntent,
  createReadGuard,
  saveUserIntent,
  loadUserIntent,
  clearUserSessionData,
} from './services/recovery';

export default function App() {
  const { isSignedIn, isLoaded, user, getToken, signOut } = useAppAuth();
  const currentUserId = user?.id || '';

  const [activeRole, setActiveRole] = useState('caregiver'); // 'caregiver' | 'staff'
  const [health, setHealth] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [bootstrap, setBootstrap] = useState(null);
  const [bootstrapError, setBootstrapError] = useState(null);

  // Caregiver state
  const [selectedPharmacyId, setSelectedPharmacyId] = useState('');
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

  // Caregiver Own Enquiries
  const [ownEnquiries, setOwnEnquiries] = useState([]);
  const [ownEnquiriesLoading, setOwnEnquiriesLoading] = useState(false);

  // Staff state
  const [staffPharmacyId, setStaffPharmacyId] = useState('');
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

  // Guards & Recovery
  const readGuard = useRef(createReadGuard());
  const queueGuard = useRef(createReadGuard());
  const activeId = useRef(activeEnquiryId);
  const mutationBusy = useRef(false);

  const [pendingIntent, setPendingIntent] = useState(() => loadUserIntent(currentUserId));
  const pendingRef = useRef(pendingIntent);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [inspecting, setInspecting] = useState(false);
  const [canStartSeparate, setCanStartSeparate] = useState(false);

  // Track user switch to enforce P07 account isolation
  const previousUserIdRef = useRef(currentUserId);

  const rememberIntent = (intent) => {
    pendingRef.current = intent;
    setPendingIntent(intent);
    setRetryAllowed(false);
    setCanStartSeparate(false);
    saveUserIntent(intent, currentUserId);
  };

  // Invalidate all prior data and intent on account switch
  useEffect(() => {
    if (previousUserIdRef.current && previousUserIdRef.current !== currentUserId) {
      readGuard.current.invalidate();
      queueGuard.current.invalidate();
      setEnquiryView(null);
      setEnquiryError(null);
      setActiveEnquiryId('');
      setStaffQueue([]);
      setSelectedQueueEnquiry(null);
      setSelectedQueueId('');
      setReportResult(null);
      setReportError(null);
      setOwnEnquiries([]);
      setRecoveryMessage('');
      setPendingIntent(null);
      pendingRef.current = null;
      if (typeof window !== 'undefined') {
        const url = new URL(window.location);
        url.searchParams.delete('enquiry');
        window.history.replaceState({}, '', url);
      }
    }
    previousUserIdRef.current = currentUserId;
    if (currentUserId) {
      const recovered = loadUserIntent(currentUserId);
      setPendingIntent(recovered);
      pendingRef.current = recovered;
    }
  }, [currentUserId]);

  // Load health, user profile, and bootstrap data
  useEffect(() => {
    let active = true;
    const read = readGuard.current;
    const queue = queueGuard.current;

    getHealth()
      .then(data => { if (active) setHealth(data); })
      .catch(error => { if (active) setHealth({ status: 'error', error }); });

    const loadUserData = async () => {
      try {
        const token = await getToken();
        if (!token) return;

        const [profile, boot] = await Promise.all([
          getCurrentUser(token),
          getBootstrap(token),
        ]);

        if (!active) return;
        setUserProfile(profile);
        setBootstrap(boot);

        if (boot.pharmacies?.length && !selectedPharmacyId) {
          setSelectedPharmacyId(boot.pharmacies[0].id);
        }
        if (boot.products?.length && !selectedProductId) {
          setSelectedProductId(boot.products[0].id);
        }
        if (profile.memberships?.length && !staffPharmacyId) {
          setStaffPharmacyId(profile.memberships[0].pharmacy_id);
        }
      } catch (err) {
        if (active) setBootstrapError(err);
      }
    };

    loadUserData();

    return () => {
      active = false;
      read.invalidate();
      queue.invalidate();
    };
  }, [currentUserId, getToken]);

  // Caregiver Pharmacy selector change handler: resets incompatible inputs
  const handlePharmacyChange = (newPharmacyId) => {
    setSelectedPharmacyId(newPharmacyId);
    setEnquiryError(null);
    // If active enquiry belonged to another pharmacy, reset active enquiry
    if (enquiryView && enquiryView.pharmacy_id !== newPharmacyId) {
      setEnquiryView(null);
      setActiveEnquiryId('');
      const url = new URL(window.location);
      url.searchParams.delete('enquiry');
      window.history.replaceState({}, '', url);
    }
  };

  // Fetch single enquiry
  const fetchActiveEnquiry = useCallback(async (idToFetch) => {
    const id = idToFetch || activeId.current;
    if (!id || mutationBusy.current) return;
    const ticket = readGuard.current.begin(currentUserId, selectedPharmacyId, id);
    setEnquiryLoading(true);
    setEnquiryError(null);
    try {
      const token = await getToken();
      const view = await getEnquiry(id, token);
      if (readGuard.current.isCurrent(ticket, currentUserId, selectedPharmacyId, id) && activeId.current === id) {
        setEnquiryView(view);
      }
    } catch (error) {
      if (readGuard.current.isCurrent(ticket, currentUserId, selectedPharmacyId, id)) {
        setEnquiryError(error);
      }
    } finally {
      if (readGuard.current.isCurrent(ticket, currentUserId, selectedPharmacyId, id)) {
        setEnquiryLoading(false);
      }
    }
  }, [currentUserId, selectedPharmacyId, getToken]);

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

  // Load own enquiries
  const handleLoadOwnEnquiries = useCallback(async () => {
    if (!currentUserId) return;
    setOwnEnquiriesLoading(true);
    try {
      const token = await getToken();
      const page = await listOwnEnquiries(token, null, 10);
      setOwnEnquiries(page.items || []);
    } catch {
      // Non-fatal list fetch
    } finally {
      setOwnEnquiriesLoading(false);
    }
  }, [currentUserId, getToken]);

  useEffect(() => {
    if (activeRole === 'caregiver' && currentUserId) {
      handleLoadOwnEnquiries();
    }
  }, [activeRole, currentUserId, handleLoadOwnEnquiries]);

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
    handleLoadOwnEnquiries();
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
      const token = await getToken();
      const view = intent.type === 'create'
        ? await createEnquiry(intent.id, intent.payload, token)
        : await submitObservationV2(intent.id, intent.payload, token);

      if (!matchesIntent(view, intent)) {
        throw { kind: 'transport', outcome: 'unknown', message: 'Saved response does not match the attempted payload.' };
      }
      finishWrite(view, intent);
    } catch (error) {
      if (error.outcome === 'unknown' || error.status === 409) {
        setRecoveryMessage('Save outcome requires inspection. The attempted ID and payload are preserved; do not submit a new request.');
      } else {
        rememberIntent(null);
      }
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
    if (!selectedPharmacyId) {
      setEnquiryError({ message: 'Select a target pharmacy.' });
      return;
    }

    const intent = {
      type: 'create',
      id: crypto.randomUUID(),
      userId: currentUserId,
      payload: {
        pharmacy_id: selectedPharmacyId,
        product_id: product.id,
        requested_quantity: quantity,
        unit: product.unit,
      },
    };

    selectActiveEnquiry(intent.id);
    rememberIntent(intent);
    await sendIntent(intent);
  };

  // Staff queue loading
  const handleLoadQueue = async () => {
    if (mutationBusy.current || pendingRef.current?.type === 'report') return;
    if (!staffPharmacyId) {
      setQueueError({ message: 'No pharmacy selected or no approved memberships.' });
      return;
    }

    const ticket = queueGuard.current.begin(currentUserId, staffPharmacyId, null);
    setQueueLoading(true);
    setQueueError(null);
    try {
      const token = await getToken();
      const page = await listPharmacyQueue(staffPharmacyId, token, null, 20);
      if (!queueGuard.current.isCurrent(ticket, currentUserId, staffPharmacyId, null)) return;

      const items = page.items || [];
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
      if (!queueGuard.current.isCurrent(ticket, currentUserId, staffPharmacyId, null)) return;
      setQueueError(error);
      setQueueLoaded(false);
      setStaffQueue([]);
      setSelectedQueueId('');
      setSelectedQueueEnquiry(null);
    } finally {
      if (queueGuard.current.isCurrent(ticket, currentUserId, staffPharmacyId, null)) {
        setQueueLoading(false);
      }
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

    const count = parseQuantity(obtainableCount, 0);
    if (reportKind === 'checked' && count === null) {
      setReportError({ message: 'Obtainable quantity must be a whole number from 0 to 10000.' });
      return;
    }

    const intent = {
      type: 'report',
      id: selectedQueueId,
      userId: currentUserId,
      payload: {
        product_id: selectedQueueEnquiry.product.id,
        unit: selectedQueueEnquiry.unit,
        kind: reportKind,
        obtainable_quantity: reportKind === 'checked' ? count : null,
        observed_at: reportKind === 'checked' && !timeUnknown ? (observationTime || new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')) : null,
        unresolved_reason: reportKind === 'checked' ? null : 'cannot_check',
      },
    };

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
      const token = await getToken();
      const view = await getEnquiry(intent.id, token);
      if (matchesIntent(view, intent)) {
        finishWrite(view, intent);
      } else if (intent.type === 'report' && view.observation === null) {
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
      } else {
        setRecoveryMessage('Inspection failed. The save outcome remains unknown; retry inspection when the server is reachable.');
      }
    } finally {
      setInspecting(false);
    }
  };

  const handleSetTimeToNow = () => {
    setObservationTime(new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'));
    setTimeUnknown(false);
  };

  // Find active claim for the currently selected pharmacy & medicine
  const activeClaim = bootstrap?.claims?.find(
    c => c.pharmacy_id === selectedPharmacyId && c.product_id === selectedProductId
  );

  const userMemberships = userProfile?.memberships || [];
  const isStaffUser = userMemberships.length > 0;

  return (
    <div className="app-container">
      {/* Top Navigation & User Identity Header */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <Pill size={24} color="#ffffff" />
          </div>
          <div className="brand-text">
            <h1>RxVerify v2</h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Multi-Pharmacy Availability Verification
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {/* Health Status Indicator */}
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
            <span>
              {health?.status === 'ready'
                ? `${health.storage === 'postgres' ? 'PostgreSQL (Neon)' : 'SQLite'} Ready • Live System`
                : health?.status === 'error'
                ? 'Backend unreachable'
                : 'Connecting...'}
            </span>
          </div>

          {/* User Profile Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '4px 12px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                {userProfile?.full_name || user?.fullName || 'User'}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {userProfile?.email || user?.email || currentUserId.slice(0, 8)}
              </span>
            </div>
            {isStaffUser && (
              <span style={{
                fontSize: '0.7rem',
                padding: '2px 8px',
                borderRadius: '10px',
                background: 'rgba(217, 119, 6, 0.2)',
                color: '#fbbf24',
                border: '1px solid rgba(217, 119, 6, 0.4)',
                fontWeight: 600,
              }}>
                Staff ({userMemberships.length})
              </span>
            )}
            <button
              onClick={signOut}
              title="Sign Out"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LogOut size={15} />
            </button>
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
              Caregiver Portal
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
              Pharmacy Staff Queue
            </button>
          </div>
        </div>
      </header>

      {/* Synthetic Disclosure & Limitations Banner */}
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
        <ShieldAlert size={18} color="#818cf8" shrink={0} />
        <span>
          <strong>Operational Boundaries:</strong> Exact medicine availability checks compare physical stock observations against digital catalog claims. Physical verification does NOT reserve stock, hold medication, or provide clinical dispensation approval.
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
          Failed to load bootstrap data: {bootstrapError.message || 'Service unavailable'}
        </div>
      )}

      {/* P07 Recovery and Lost Intent Settlement Bar */}
      {(pendingIntent || recoveryMessage) && (
        <div role="status" style={{
          padding: '16px',
          marginBottom: '20px',
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid #fbbf24',
          borderRadius: 'var(--radius-sm)',
        }}>
          <p style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '8px' }}>
            {recoveryMessage || 'An unfinished save intent was recovered from your session. Inspect its saved outcome before submitting a new request.'}
          </p>
          {pendingIntent && (
            <div style={{ fontSize: '0.85rem', color: '#e2e8f0' }}>
              <p style={{ marginBottom: '10px' }}>
                Attempted <strong>{pendingIntent.type}</strong> for enquiry ID:{' '}
                <code style={{ color: '#93c5fd' }}>{pendingIntent.id}</code>
              </p>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={inspectSave}
                  disabled={inspecting || createSubmitting || reportSubmitting}
                  style={{
                    padding: '6px 14px',
                    background: '#d97706',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {inspecting ? 'Inspecting Server...' : 'Inspect saved outcome'}
                </button>
                {canStartSeparate && (
                  <button
                    type="button"
                    onClick={() => {
                      rememberIntent(null);
                      setRecoveryMessage('Inspected conflict retained in saved history. You may start a separate enquiry.');
                    }}
                    style={{
                      padding: '6px 14px',
                      background: 'rgba(255,255,255,0.1)',
                      color: '#fff',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                    }}
                  >
                    Start separate enquiry
                  </button>
                )}
                {retryAllowed && (
                  <button
                    type="button"
                    disabled={createSubmitting || reportSubmitting}
                    onClick={() => { setRetryAllowed(false); sendIntent(pendingIntent); }}
                    style={{
                      padding: '6px 14px',
                      background: '#10b981',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Retry same frozen payload
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CAREGIVER VIEW */}
      {activeRole === 'caregiver' && (
        <div style={{ display: 'grid', gridTemplateColumns: '400px 1fr', gap: '24px' }}>
          {/* Left Column: Form & History */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Create Request Card */}
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
                Select a participating pharmacy and required whole-unit medicine count.
              </p>

              <form onSubmit={handleCreateEnquiry}>
                {/* Pharmacy Selection */}
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="pharmacy-select" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Select Target Pharmacy
                  </label>
                  <select
                    id="pharmacy-select"
                    value={selectedPharmacyId}
                    onChange={(e) => handlePharmacyChange(e.target.value)}
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
                    {bootstrap?.pharmacies?.map((pharm) => (
                      <option key={pharm.id} value={pharm.id} style={{ background: '#0a0e17' }}>
                        {pharm.name} ({pharm.id})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Medicine Selection */}
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
                    {bootstrap?.products?.map((p) => (
                      <option key={p.id} value={p.id} style={{ background: '#0a0e17' }}>
                        {p.name} • {p.strength} ({p.form}) — Unit: {p.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Current Pharmacy Claim Preview */}
                <div style={{
                  padding: '10px 12px',
                  background: 'rgba(10, 14, 23, 0.6)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  marginBottom: '16px',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                }}>
                  <div style={{ fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
                    Digital Claim at {selectedPharmacyId}:
                  </div>
                  {activeClaim ? (
                    <div>
                      System stock claim: <strong style={{ color: '#38bdf8' }}>{activeClaim.stock_count} units</strong>
                      <span style={{ color: 'var(--text-muted)' }}> (Source timestamp: {activeClaim.source_timestamp})</span>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>
                      No prior stock claim found for this medicine at {selectedPharmacyId}.
                    </div>
                  )}
                </div>

                {/* Quantity Input */}
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

              {/* UUID Lookup */}
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

            {/* Own Enquiries History Card */}
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '0.95rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <History size={16} color="#94a3b8" />
                  Your Recent Requests
                </h3>
                <button
                  type="button"
                  onClick={handleLoadOwnEnquiries}
                  disabled={ownEnquiriesLoading}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  <RefreshCw size={12} className={ownEnquiriesLoading ? 'spin' : ''} />
                  Refresh
                </button>
              </div>

              {ownEnquiries.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  No requests submitted under this account yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
                  {ownEnquiries.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectActiveEnquiry(item.id)}
                      style={{
                        padding: '10px 12px',
                        background: activeEnquiryId === item.id ? 'rgba(99, 102, 241, 0.15)' : 'rgba(10, 14, 23, 0.6)',
                        border: `1px solid ${activeEnquiryId === item.id ? 'var(--primary-accent)' : 'var(--border-subtle)'}`,
                        borderRadius: '6px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#f8fafc' }}>
                          {item.product?.name} ({item.requested_quantity} {item.unit}s)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {item.pharmacy_id} • {item.created_at.slice(11, 19)}
                        </div>
                      </div>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background:
                          item.status === 'answered'
                            ? 'rgba(16, 185, 129, 0.15)'
                            : item.status === 'pending'
                            ? 'rgba(245, 158, 11, 0.15)'
                            : 'rgba(148, 163, 184, 0.15)',
                        color:
                          item.status === 'answered'
                            ? '#34d399'
                            : item.status === 'pending'
                            ? '#fbbf24'
                            : '#cbd5e1',
                      }}>
                        {item.status}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Evidence & Result View */}
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
                <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Submit a request on the left or select an item from your request history.</p>
              </div>
            )}

            {enquiryView && (
              <div>
                <p style={{ fontSize: '0.88rem', color: '#e2e8f0', marginBottom: '4px' }}>
                  Exact request: <strong>{enquiryView.product.name}</strong> · {enquiryView.product.strength} · {enquiryView.product.form} · {enquiryView.requested_quantity} {enquiryView.unit}s at <strong>{enquiryView.pharmacy_id}</strong>
                </p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
                  Created: {enquiryView.created_at} · Last successful read: {enquiryView.served_at}
                </p>
                {enquiryError && <p style={{ color: '#fda4af', fontSize: '0.8rem' }}>Showing previously saved evidence; the latest refresh failed.</p>}

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
                        <div><strong style={{ color: '#e2e8f0' }}>Recorded Quantity:</strong> {enquiryView.claim.stock_count ?? 'Unknown'} {enquiryView.unit}s</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Source Timestamp:</strong> {enquiryView.claim.source_timestamp ?? 'None'}</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Pharmacy:</strong> {enquiryView.claim.pharmacy_id}</div>
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
                        <div><strong style={{ color: '#e2e8f0' }}>Observed At:</strong> {enquiryView.observation.observed_at ?? 'Unknown'}</div>
                        <div><strong style={{ color: '#e2e8f0' }}>Reporter:</strong> <span style={{ fontFamily: 'var(--font-mono)' }}>{enquiryView.observation.reporter_id.slice(0, 8)}...</span></div>
                        <div><strong style={{ color: '#e2e8f0' }}>Check Kind:</strong> {enquiryView.observation.kind}</div>
                        {enquiryView.observation.unresolved_reason && (
                          <div><strong style={{ color: '#e2e8f0' }}>Unresolved Reason:</strong> {enquiryView.observation.unresolved_reason}</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.82rem', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                        <Clock size={14} />
                        awaiting_check: Pending physical verification by pharmacy staff...
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
                    {enquiryView.answer.limitations?.map((limit, idx) => (
                      <li key={idx} style={{ marginBottom: '4px' }}>{limit}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PHARMACY STAFF VIEW */}
      {activeRole === 'staff' && (
        <div>
          {!isStaffUser ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '36px',
              textAlign: 'center',
              maxWidth: '600px',
              margin: '40px auto',
            }}>
              <Shield size={40} color="#fbbf24" style={{ margin: '0 auto 16px' }} />
              <h2 style={{ fontSize: '1.2rem', color: '#f8fafc', marginBottom: '8px' }}>
                No Approved Staff Memberships
              </h2>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                Your account (<code style={{ color: '#93c5fd' }}>{userProfile?.email || currentUserId}</code>) is currently authenticated as a Caregiver. Staff queue operations require an administrator-approved membership for a specific pharmacy.
              </p>
              <div style={{ marginTop: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Use the operator CLI script: <code>python backend/scripts/manage_memberships.py grant &lt;email&gt; &lt;pharmacy_id&gt;</code>
              </div>
            </div>
          ) : (
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
                  Authenticated queue access scoped strictly to your approved pharmacy memberships.
                </p>

                {/* Membership Pharmacy Selector */}
                <div style={{ marginBottom: '16px' }}>
                  <label htmlFor="staff-pharmacy-select" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    Active Pharmacy Membership
                  </label>
                  <select
                    id="staff-pharmacy-select"
                    value={staffPharmacyId}
                    onChange={(e) => {
                      setStaffPharmacyId(e.target.value);
                      setStaffQueue([]);
                      setSelectedQueueId('');
                      setSelectedQueueEnquiry(null);
                      setQueueLoaded(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--bg-input)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '6px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  >
                    {userMemberships.map((m) => (
                      <option key={m.pharmacy_id} value={m.pharmacy_id} style={{ background: '#0a0e17' }}>
                        {m.pharmacy_name || m.pharmacy_id} ({m.role})
                      </option>
                    ))}
                  </select>
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
                    {queueError.error?.message || queueError.message || 'Error fetching queue.'}
                  </div>
                )}

                {/* Queue List */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                  {queueLoaded && staffQueue.length === 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                      No pending enquiries for {staffPharmacyId}.
                    </div>
                  )}

                  {staffQueue.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectQueueItem(item)}
                      style={{
                        padding: '12px 14px',
                        background: selectedQueueId === item.id ? 'rgba(217, 119, 6, 0.18)' : 'rgba(10, 14, 23, 0.6)',
                        border: `1px solid ${selectedQueueId === item.id ? '#d97706' : 'var(--border-subtle)'}`,
                        borderRadius: '6px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                          {item.product?.name} ({item.requested_quantity} {item.unit}s)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          ID: <span style={{ fontFamily: 'var(--font-mono)' }}>{item.id.slice(0, 13)}...</span>
                        </div>
                      </div>
                      <ChevronRight size={16} color={selectedQueueId === item.id ? '#fbbf24' : '#64748b'} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Staff Report Form Column */}
              <div style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '24px',
              }}>
                <h2 style={{ fontSize: '1.15rem', color: '#f8fafc', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="#d97706" />
                  Physical Observation Report
                </h2>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
                  Submit an authoritative, immutable physical shelf check for the selected enquiry.
                </p>

                {reportResult && (
                  <div style={{
                    padding: '14px',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#34d399',
                    fontSize: '0.88rem',
                    marginBottom: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    <CheckCircle2 size={18} />
                    <span>Report Accepted and Recorded for Enquiry <strong>{reportResult.id.slice(0, 8)}...</strong></span>
                  </div>
                )}

                {reportError && (
                  <div style={{
                    padding: '12px 14px',
                    background: 'rgba(244, 63, 94, 0.1)',
                    border: '1px solid rgba(244, 63, 94, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    color: '#fda4af',
                    fontSize: '0.85rem',
                    marginBottom: '20px',
                  }}>
                    {reportError.error?.message || reportError.message || 'Error submitting report.'}
                  </div>
                )}

                {!selectedQueueEnquiry ? (
                  <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Select an enquiry from the queue to record an observation.
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReport}>
                    {/* Target enquiry summary (immutable) */}
                    <div style={{
                      padding: '14px 16px',
                      background: 'rgba(10, 14, 23, 0.6)',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      marginBottom: '20px',
                      fontSize: '0.84rem',
                      lineHeight: '1.6',
                    }}>
                      <div><strong style={{ color: '#cbd5e1' }}>Target Enquiry ID:</strong> <span style={{ fontFamily: 'var(--font-mono)', color: '#93c5fd' }}>{selectedQueueEnquiry.id}</span></div>
                      <div><strong style={{ color: '#cbd5e1' }}>Medicine:</strong> {selectedQueueEnquiry.product.name} ({selectedQueueEnquiry.product.strength}, {selectedQueueEnquiry.product.form})</div>
                      <div><strong style={{ color: '#cbd5e1' }}>Caregiver Requested:</strong> {selectedQueueEnquiry.requested_quantity} {selectedQueueEnquiry.unit}s</div>
                      <div><strong style={{ color: '#cbd5e1' }}>Received At:</strong> {selectedQueueEnquiry.created_at}</div>
                    </div>

                    {/* Report kind toggle */}
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                        Observation Outcome
                      </label>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button
                          type="button"
                          onClick={() => setReportKind('checked')}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: reportKind === 'checked' ? 'rgba(217, 119, 6, 0.2)' : 'var(--bg-input)',
                            border: `1px solid ${reportKind === 'checked' ? '#d97706' : 'var(--border-subtle)'}`,
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            fontWeight: reportKind === 'checked' ? 600 : 400,
                          }}
                        >
                          Stock Checked
                        </button>
                        <button
                          type="button"
                          onClick={() => setReportKind('unable_to_check')}
                          style={{
                            flex: 1,
                            padding: '10px',
                            background: reportKind === 'unable_to_check' ? 'rgba(244, 63, 94, 0.15)' : 'var(--bg-input)',
                            border: `1px solid ${reportKind === 'unable_to_check' ? '#f43f5e' : 'var(--border-subtle)'}`,
                            borderRadius: '6px',
                            color: '#f8fafc',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            fontWeight: reportKind === 'unable_to_check' ? 600 : 400,
                          }}
                        >
                          Unable to Check
                        </button>
                      </div>
                    </div>

                    {reportKind === 'checked' && (
                      <>
                        <div style={{ marginBottom: '16px' }}>
                          <label htmlFor="obtainable-count-input" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            Obtainable Quantity on Shelf (Units)
                          </label>
                          <input
                            id="obtainable-count-input"
                            type="number"
                            min="0"
                            max="10000"
                            step="1"
                            value={obtainableCount}
                            onChange={(e) => setObtainableCount(e.target.value)}
                            placeholder="e.g. 4"
                            disabled={reportSubmitting || !!pendingIntent}
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

                        <div style={{ marginBottom: '20px' }}>
                          <label htmlFor="observation-time-input" style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            Simulated Observation Timestamp (ISO 8601)
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              id="observation-time-input"
                              type="text"
                              value={timeUnknown ? 'Unknown' : observationTime}
                              onChange={(e) => setObservationTime(e.target.value)}
                              placeholder="2026-10-07T05:02:00Z"
                              disabled={timeUnknown || reportSubmitting || !!pendingIntent}
                              style={{
                                flex: 1,
                                padding: '10px 12px',
                                background: 'var(--bg-input)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '6px',
                                color: '#f8fafc',
                                fontSize: '0.82rem',
                                fontFamily: 'var(--font-mono)',
                                outline: 'none',
                              }}
                            />
                            <button
                              type="button"
                              onClick={handleSetTimeToNow}
                              disabled={reportSubmitting || !!pendingIntent}
                              style={{
                                padding: '10px 14px',
                                background: 'rgba(255, 255, 255, 0.08)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: '6px',
                                color: '#e2e8f0',
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Set simulated check time to now
                            </button>
                          </div>
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
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                      }}
                    >
                      {reportSubmitting ? (
                        <>
                          <RefreshCw size={16} className="spin" />
                          <span>Submitting Physical Observation...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>Commit Staff Physical Observation</span>
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
