# RxVerify v2 — Multi-User Medicine Availability Verification

RxVerify is an availability verification platform connecting caregiver requests to immutable, authenticated staff observations across participating pharmacies. It compares digital stock claims with physical observations, evaluating discrepancies and returning deterministic sufficient, insufficient, or unresolved outcomes qualified by exact observation timestamps.

> **Operational Boundary Notice:** Physical stock checks verify current shelf count at the recorded instant. They do not reserve stock, guarantee availability on arrival, or provide clinical dispensation approvals.

---

## Key Features in v2

- **Managed Authentication & Identity:** Clerk integration with JWT Bearer sessions (`/me`) and local conflict-safe identity mapping.
- **Multi-Pharmacy Workflows:** Independent pharmacy queues (`PHARM-A`, `PHARM-B`) with server-enforced staff membership isolation.
- **Strict Cross-Tenant Security:** Caregiver enquiries are strictly isolated; cross-owner read attempts return `404 Not Found` (never 403) to prevent UUID existence probing.
- **Immutable Transactions & Replay Protection:** Conflicting observation submissions return `409 Conflict`; identical submissions from the same staff member are idempotent.
- **Account-Bound Recovery:** `sessionStorage` recovery intents are strictly scoped to the local user UUID (`rxverify_intent_v2_${userId}`). No bearer tokens are persisted by the client.
- **PostgreSQL / Neon Engine:** Schema migrations (`001_multi_user.sql`) and bootstrap seeding with full ACID transaction guarantees.
- **Bounded Public Surface:** 16KiB body ceiling (HTTP 413) and single-worker sliding rate limiter (HTTP 429 + `Retry-After`).

---

## Quickstart

### 1. Build Frontend
```powershell
cd frontend
npm install
npm run build
```

### 2. Run Backend
From `backend/`:
```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser.

In local development mode without Clerk keys set, the application automatically uses `DevFallbackAuthBridge`, providing a one-click account switcher (Caregiver 1, Caregiver 2, Staff PHARM-A, Staff PHARM-B).

---

## Operator Commands

### Database Migrations & Seeding (PostgreSQL / Neon)
```powershell
python backend/scripts/migrate_v2.py --seed
```

Check database schema readiness:
```powershell
python backend/scripts/migrate_v2.py --check-only
```

### Staff Membership Management
Grant pharmacy staff rights:
```powershell
python backend/scripts/manage_memberships.py grant caregiver1@example.com PHARM-A --role staff
```

List active memberships:
```powershell
python backend/scripts/manage_memberships.py list
```

Revoke staff rights:
```powershell
python backend/scripts/manage_memberships.py revoke caregiver1@example.com PHARM-A
```

---

## Verification & Automated Test Suites

### Backend Test Suite (83 Tests)
Runs baseline v1 regression (56 tests), v2 contract freeze (6 tests), database migrations (2 tests), auth (6 tests), v2 API workflow (9 tests), and bounded surface (4 tests):
```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest discover tests
```

### Frontend Transport & Recovery Tests (22 Tests)
Runs deadline bounds, v1 compatibility, v2 transport envelopes, reporter UUID intent matching, and user-scoped recovery:
```powershell
cd frontend
node --test tests/transport.test.js
```

---

## Documentation

- **[Multi-User Demo Runbook](docs/multi_user_demo_runbook.md):** 4-minute demonstration script, operator commands, and fault procedures.
- **[Validation Matrix](docs/multi_user_validation.md):** Empirical test evidence, invariant verification matrix, and limits.
- **[API Contracts v2](docs/api_contracts_v2.md):** Frozen JSON wire contracts and status code matrices for all `/api/v2` endpoints.
- **[Implementation Plan](tasks/multi_user_implementation_plan.md):** Detailed technical plan for modules P00 through P11.
