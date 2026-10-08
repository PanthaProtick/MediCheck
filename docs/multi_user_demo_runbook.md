> Historical implementation-track document. Superseded for current setup by [deployment_setup.md](deployment_setup.md) and [hosted_validation.md](hosted_validation.md). Older auth/config and email-based operator commands below are not current.

# Multi-User Demonstration Runbook (P11)

This runbook provides the operational guide and rehearsal script for demonstrating the multi-user, multi-pharmacy RxVerify v2 system in under 4 minutes.

---

## 1. Architecture & Deployment Modes

RxVerify v2 operates in two verified modes:

1. **Cloud Managed Mode (Production):**
   - **Frontend & Server:** FastAPI on HTTPS (e.g. Render / Docker).
   - **Authentication:** Clerk Managed Auth (JWT Bearer tokens via `ClerkProvider` / `useUser`).
   - **Database:** PostgreSQL on Neon Serverless (`postgresql+psycopg://...`).
2. **Local Dev / Evaluation Mode (Default Local):**
   - **Frontend & Server:** `npm run dev` + `uvicorn app.main:app`.
   - **Authentication:** `DevFallbackAuthBridge` with instant one-click account switcher (Caregiver 1, Caregiver 2, Staff PHARM-A, Staff PHARM-B).
   - **Database:** SQLite v2 in-memory or PostgreSQL when `DATABASE_URL` is configured.

---

## 2. Operator Procedures

### Database Migration & Seeding
To initialize or update the PostgreSQL (Neon) database schema:
```powershell
python backend/scripts/migrate_v2.py --seed
```
This applies `001_multi_user.sql`, creates all required tables, and seeds catalog products and initial pharmacy stock claims.

To verify database readiness without modifying data:
```powershell
python backend/scripts/migrate_v2.py --check-only
```

### Staff Membership Management
Staff privileges are **never** granted via signup role dropdowns or client headers. They are strictly operator-assigned:

To grant staff membership to a user for a specific pharmacy:
```powershell
python backend/scripts/manage_memberships.py grant caregiver1@example.com PHARM-A --role staff
```

To list all current memberships:
```powershell
python backend/scripts/manage_memberships.py list
```

To revoke a user's staff access:
```powershell
python backend/scripts/manage_memberships.py revoke caregiver1@example.com PHARM-A
```

---

## 3. Demonstration Script (<= 4 Minutes)

### Step 1: Caregiver 1 Submits Enquiry at Pharmacy A (45 seconds)
1. Open the application at `http://localhost:5173` (or the live URL).
2. Ensure active account is **Caregiver 1**.
3. In the **Caregiver Portal**:
   - Target Pharmacy: Select `Synthetic Demo Pharmacy A (PHARM-A)`.
   - Medicine: Select `Demo Medicine A • 10 mg (tablet)`.
   - Note the digital stock claim displayed: `12 units`.
   - Requested Quantity: Enter `6`.
   - Click **Submit Verification Request**.
4. The enquiry view updates immediately:
   - Status: `PENDING`
   - Conclusion: `UNRESOLVED`
   - Reason code: `awaiting_check`
   - Copy or note the Enquiry UUID (e.g., `a1b2c3d4-...`).

### Step 2: Strict Cross-Owner Isolation Check (30 seconds)
1. Switch account to **Caregiver 2** (using the top Dev Switcher bar or re-logging).
2. Notice that Caregiver 1's enquiry view and recent requests list are completely cleared (P07 account isolation).
3. Paste Caregiver 1's Enquiry UUID into the **Lookup Existing Enquiry (UUID)** input and click search.
4. **Observed Result:** Returns `404 Not Found`. Caregiver 2 cannot view, probe, or access Caregiver 1's request.

### Step 3: Pharmacy Queue Isolation Check (30 seconds)
1. Switch account to **Staff Member 2 (Pharmacy B)**.
2. In the top navbar, select the **Pharmacy Staff Queue** tab.
3. Active Pharmacy Membership displays `Pharmacy B (Staff)`.
4. Click **Fetch Pending Enquiries**.
5. **Observed Result:** Caregiver 1's enquiry does NOT appear in Pharmacy B's queue. The queue is strictly filtered to `pharmacy_id = 'PHARM-B'`.

### Step 4: Staff Member 1 Records Physical Check (45 seconds)
1. Switch account to **Staff Member 1 (Pharmacy A)**.
2. Open the **Pharmacy Staff Queue** tab.
3. Click **Fetch Pending Enquiries**.
4. Caregiver 1's enquiry appears in the queue. Click on it to select it.
5. Notice that the target enquiry details (Medicine, Caregiver Requested Quantity, Time) are displayed immutably.
6. Under **Physical Observation Report**:
   - Outcome: Leave as `Stock Checked`.
   - Obtainable Quantity on Shelf: Enter `4`.
   - Click **Set simulated check time to now**.
   - Click **Commit Staff Physical Observation**.
7. **Observed Result:** Banner displays `Report Accepted and Recorded`. The enquiry is removed from the pending queue.

### Step 5: Caregiver 1 Reviews Saved Evidence & Discrepancy (30 seconds)
1. Switch account back to **Caregiver 1**.
2. Select the recent enquiry from **Your Recent Requests** or click **Refresh Status**.
3. **Observed Result:**
   - Status: `ANSWERED`
   - Conclusion: `INSUFFICIENT` (red alert badge)
   - Discrepancy: `-8 tablets` (Digital Claim 12 vs Physical Stock 4)
   - Reason code: `limited_availability`
   - Staff Observation box displays: Obtainable Quantity `4 tablets`, exact observation timestamp, and Staff reporter UUID.
   - Standard scope notice: Discloses that physical check does not reserve medication.

### Step 6: Account-Bound Recovery & Immutability (30 seconds)
1. Attempt to resubmit or alter the report: the server returns `409 Conflict` (immutable winner).
2. Check `sessionStorage`: recovery intent is scoped strictly under `rxverify_intent_v2_${userId}` with zero bearer tokens or credentials persisted.

---

## 4. Troubleshooting & Fallback Procedures

| Symptom | Cause | Solution |
|---|---|---|
| `503 Storage Unavailable` | Neon connection string invalid or schema migration unapplied | Run `python backend/scripts/migrate_v2.py --check-only` to verify connection and migrations. |
| `401 Unauthorized` | Missing or expired Bearer token | Re-authenticate via Clerk or select an account from the local dev bar. |
| `403 Forbidden` on Staff Queue | User has no active membership at the selected pharmacy | Use `python backend/scripts/manage_memberships.py grant <email> <pharmacy>` to assign membership. |
| `429 Rate Limit Exceeded` | More than 30 mutations or 120 requests submitted in 60s | Wait for duration indicated by `Retry-After` header. Counters reset after 60 seconds. |
| Blank page in demo mode | Frontend assets unbuilt | Run `npm run build` in `frontend/` directory. |
