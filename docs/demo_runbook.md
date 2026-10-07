# RxVerify Demonstration Runbook

## Overview & Demo Timing
- **Total Duration:** <= 4 minutes.
- **Presenter:** Pantha Protick (Solo Developer).
- **Goal:** Walk through the end-to-end request-specific availability verification workflow, demonstrate separate claim and observation storage, deterministic evidence comparison, and transparent boundary disclosures.

---

## 1. Local Launch Instructions

### Pre-requisites
- Python 3.12+ (existing `.venv` in `backend/`)
- Node.js 20+ / npm (in `frontend/`)
- No internet access, external API keys, or remote database services required.

### Step 1: Build Frontend Assets (One-Time / When Frontend Changes)
In `frontend/`:
```powershell
npm run build
```
*(Builds the current static assets into `frontend/dist`; timing depends on the machine.)*

### Step 2: Launch Single-Origin Backend
In `backend/`, configure the backend-only credential and absolute database path first:
```powershell
$env:ENV = 'demo'
$env:DEMO_DATABASE_PATH = 'E:/Hackathon Demo/backend/data/demo.sqlite3'
$env:DEMO_STAFF_TOKEN = '<choose-a-private-demo-token>'
uv run uvicorn app.main:app --host 127.0.0.1 --port 8000
```
*Or using the verified venv interpreter directly:*
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### Step 3: Open Application in Browser
Navigate to:
```text
http://127.0.0.1:8000/
```
The single-origin server serves both the built React client at `/` and the `/api/v1` endpoints.

---

## 2. Demonstration Journey Script (≤ 4 Minutes)

### Phase 1: Context & Disclosures (0:00 – 0:30)
1. Point out the top header:
   - **RxVerify** Availability Verification MVP.
   - **SQLite Ready • Synthetic Demo** badge.
2. Highlight the Operational Boundaries banner:
   - Synthetic catalog and inventory claims.
   - Staff checks are simulated actor observations, not verified clinical approval.
   - Verification checks physical obtainable count; it **does not reserve stock** or guarantee availability upon future arrival.

### Phase 2: Caregiver Requests Verification (0:30 – 1:30)
1. In the **Caregiver Actor** section:
   - Target Pharmacy is set to **Synthetic Demo Pharmacy (PHARM-A)**.
   - Select Medicine: **Demo Medicine A • 10 mg (tablet)**.
   - Note the catalog claim: Recorded inventory claim shows **12 tablets**.
   - Enter Requested Quantity: **6 tablets**.
2. Click **Submit Verification Request**:
   - Client generates a canonical UUID and updates URL parameter `?enquiry=<uuid>`.
   - Creation returns HTTP 201.
   - Active enquiry view displays status: `PENDING`, conclusion: `UNRESOLVED`, reason: `awaiting_check`.
   - Emphasize: *The system does not claim the medicine is unavailable or available; it is awaiting a simulated staff-reported check.*

### Phase 3: Simulated Staff Submits Physical Observation (1:30 – 2:45)
1. Switch to the **Simulated Staff Actor** tab:
   - Enter the same private credential configured in the backend. The password field starts empty; the credential remains in memory only.
2. Click **Fetch Pending Enquiries**:
   - The queue displays the exact enquiry created in Phase 2.
3. Select the enquiry from the queue:
   - Review the requested item: Demo Medicine A, 6 tablets.
   - Select **Count Checked at Shelf**.
   - Enter Obtainable Quantity: **4 tablets** (less than the requested 6).
   - Click **Set simulated check time to now** to populate observation timestamp.
4. Click **Commit Staff Observation**:
   - Backend commits the observation atomically and associates it with `STAFF-DEMO` and basis `staff_reported_obtainable_count`.
   - Returns confirmation: *Report Accepted by Backend!*

### Phase 4: Caregiver Retrieves Qualified Result (2:45 – 3:30)
1. Switch back to the **Caregiver Actor** tab.
2. Click **Refresh Status**:
   - View updates to:
     - **Status:** `ANSWERED`
     - **Conclusion:** `INSUFFICIENT` (amber/rose callout)
     - **Discrepancy:** `-8 tablets` *(Observed 4 tablets - Recorded 12 tablets)*
     - **Evidence Breakdown:** Shows both original recorded claim (12 tablets) and shelf observation (4 tablets at observation time).
   - Emphasize the key distinction: *The recorded inventory said 12 tablets, but physical shelf count was only 4. The caregiver receives an honest, evidence-based answer showing why their request for 6 cannot be met.*

### Phase 5: Alternative Case / Boundaries (3:30 – 4:00)
1. Mention supported alternative branches:
   - A check of 8 tablets produces `SUFFICIENT` with discrepancy `-4`.
   - A check of 0 tablets produces `INSUFFICIENT` with discrepancy `-12`.
   - "Unable to check" or missing observation time produces `UNRESOLVED` with explicit distinct machine-readable reasons.
2. Conclude with immutable safety:
   - Observations are one-time immutable writes; replays return existing evidence, conflicts reject with 409.

---

## 3. Maintenance & Clean Reset

To reset the database back to clean seeded catalog fixtures between demonstrations:

1. Stop the backend server process (`Ctrl+C`).
2. Run the reset script from `backend/`:
   ```powershell
   .\.venv\Scripts\python.exe scripts\reset_demo.py
   ```
3. Restart the backend server.

## 4. Uncertain-save recovery

If submission times out or its response is lost, do not create a replacement request or report. The interface freezes the attempted ID/body and offers **Inspect saved outcome**. A matching saved result confirms the save. Pending/404 still leaves the outcome unknown; an explicit retry reuses the same frozen address/body. A confirmed conflicting immutable result may be left intact while explicitly starting a separate enquiry. Session storage preserves an unfinished intent across reload where browser storage is available; staff credentials are never persisted.

The automated two-context smoke test passed on 7 October 2026. The four-minute presentation timing and human interpretation benefits have not been measured; see [validation.md](validation.md).
