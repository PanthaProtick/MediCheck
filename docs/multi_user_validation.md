# Multi-User Architecture Validation & Invariant Verification (P10)

This document records the empirical validation evidence, invariant checks, and architectural boundary guarantees for the multi-user, multi-pharmacy RxVerify v2 system.

---

## 1. Summary of Executed Test Suites

| Test Suite | Location | Tests Ran | Results | Verification Scope |
|---|---|---|---|---|
| **V1 Baseline Regression** | `backend/tests/` | 56 | 56 Passed (100%) | Preserves original single-pharmacy local SQLite invariants, schemas, and routes |
| **V2 Contract Freeze** | `backend/tests/test_contracts_v2.py` | 6 | 6 Passed (100%) | Validates wire schemas against 20+ fixture permutations across 8 distinct user roles |
| **PostgreSQL Schema & Seed** | `backend/tests/test_database_pg.py` | 2 | 1 Passed, 1 Skipped | DDL migration validity, URL driver normalization, honest skip without silent SQLite mock |
| **Authentication & Local User** | `backend/tests/test_auth.py` | 6 | 6 Passed (100%) | Bearer extraction, Clerk & test session verifiers, conflict-safe user & membership lifecycles |
| **V2 Workflow & Membership Policy** | `backend/tests/test_api_v2.py` | 9 | 9 Passed (100%) | End-to-end caregiver enquiry, staff queue isolation, observation recording, 404 cross-tenant isolation, 409 conflict, replay idempotency |
| **Bounded Surface (P08)** | `backend/tests/test_surface_p08.py` | 4 | 4 Passed (100%) | 16KiB body ceiling (413), in-memory rate limiter (429 + Retry-After), unknown API 404, rate limiter unit logic |
| **Client Transport & Recovery** | `frontend/tests/transport.test.js` | 22 | 22 Passed (100%) | 14 baseline tests + 8 v2 tests: Bearer token auth, user-scoped storage, reporter UUID intent matching, context read guards |
| **Frontend Production Build** | `frontend/` (`npm run build`) | N/A | Success (0 errors, 219ms) | Vite client build with Clerk authentication integration and React 19 compatibility |

**Total Backend Automated Tests:** 83 tests (82 passed, 1 skipped).  
**Total Frontend Automated Tests:** 22 tests (22 passed).

---

## 2. Invariant Verification Matrix

| Case | Result / Invariant | Verified In | Verification Mechanism |
|---|---|---|---|
| **Two Caregivers Isolation** | Different stable accounts; each can only access own requests. Cross-owner GET or replay returns strict `404 Not Found` (never 403, preventing ID probing). | `test_api_v2.py` (`test_caregiver_cross_owner_isolation_returns_404`) | Backend integration test querying `GET /api/v2/enquiries/{id}` with another user's token. |
| **Staff Pharmacy Queue Isolation** | Staff queue, observation submission, and enquiry access are strictly bound to active memberships in the target pharmacy. Staff at PHARM-A cannot view queue or submit reports for PHARM-B. | `test_api_v2.py` (`test_staff_cross_pharmacy_queue_forbidden`) | Backend integration test querying `GET /api/v2/pharmacies/PHARM-B/queue` with Staff A's token returning `403 Forbidden`. |
| **Multi-Membership Scoping** | Users with memberships at multiple pharmacies must explicitly target a pharmacy; no global staff wildcard authority exists. | `test_api_v2.py` (`test_multi_membership_staff_access`) | Backend integration test asserting access to both queues requiring explicit `pharmacy_id` in path. |
| **Revoked / Disabled Users** | Disabled user account returns `403 Forbidden`. Revoked membership cannot access pharmacy queue or submit reports. | `test_api_v2.py` (`test_disabled_and_revoked_member_access`) | Backend integration test verifying both `users.active = 0` and `pharmacy_memberships.active = 0`. |
| **Client Role Spoofing Prevented** | User cannot grant themselves staff rights or ownership via request body or headers; identity and memberships are exclusively server-derived. | `test_api_v2.py`, `test_auth.py` | Server ignores any client-supplied user UUIDs or roles; extracts identity strictly from verified JWT token. |
| **Pure Deterministic Evidence Evaluator** | Exact logic preserved: Claim = 12, Check = 4, Request = 6 -> Conclusion: `insufficient`, Discrepancy: `-8 units`, Reason: `limited_availability`. | `test_api_v2.py` (`test_golden_path_enquiry_to_insufficient_observation`) | Evaluator unit and API test confirming identical mathematical conclusions as v1. |
| **Replay vs. Conflict Races** | Exact same reporter submitting identical observation payload returns `200 OK` (idempotent replay). Different reporter or modified payload returns `409 Conflict`. | `test_api_v2.py` (`test_idempotent_replay_and_conflict_detection`) | Backend integration test executing identical vs differing PUT requests to `/observation`. |
| **Lost Report Intent Matching** | Lost report recovery inspects target enquiry; matches every attempted field AND verifies `reporter_id`. Another staff's matching observation is NOT treated as this user's submission. | `transport.test.js` (`P07: lost report inspection rejects match if reporter UUID is different staff member`) | Frontend unit test comparing `matchesIntent()` against observation with identical counts but differing reporter UUID. |
| **Account-Scoped Session Recovery** | SessionStorage recovery key is strictly scoped to `rxverify_intent_v2_${userId}`. Switching or logging out accounts clears all views, queues, and intents. | `transport.test.js` (`P07: intent storage is scoped by user UUID and cleared on account switch`) | Frontend unit test verifying intent isolation across distinct user UUIDs. |
| **Context-Bound Read Guards** | Generation read guards bind active `userId`, `pharmacyId`, and `enquiryId`. If user or pharmacy changes while a request is in flight, the stale response is discarded. | `transport.test.js` (`P07: context-bound read guards drop responses if user or pharmacy changed`) | Frontend unit test testing ticket invalidation across differing contexts. |
| **Body Size Bounds** | Request body ceiling set to 16KiB (`16,384 bytes`). Exceeding payloads are rejected with `413 Payload Too Large` and standard error envelope. | `test_surface_p08.py` (`test_request_body_exceeding_16kib_rejected`) | Backend integration test sending 17KiB body, verifying HTTP 413, `validation_error`, and `Cache-Control: no-store`. |
| **Rate Limiting Policy** | In-memory limiter bounds mutations to 30/min/user and requests to 120/min/user. Exceeded limit returns `429 Too Many Requests` with `Retry-After` header. | `test_surface_p08.py` (`test_rate_limiter_enforces_mutation_ceiling_with_429_and_retry_after`) | Backend integration test submitting 4 rapid mutations, verifying 4th returns 429 and `Retry-After`. |

---

## 3. Disclosed Verification Limits

1. **External Postgres Connection:**
   - In environments where `TEST_DATABASE_URL` is unconfigured, the live external database test `test_live_pg_migrations_and_seeding` is skipped honestly.
   - All schema, transaction, constraint, and workflow tests execute against in-memory SQLite instances using the identical v2 DDL schema.
2. **Third-Party Provider Network Calls:**
   - Unit and integration tests utilize `TestSessionVerifier` to simulate cryptographic verification deterministically without making live HTTP requests to Clerk's edge API during test runs.
3. **No Clinical or Reservation Guarantee:**
   - Physical checks verify current shelf count at the indicated instant. They do not reserve stock, guarantee availability on arrival, or provide clinical dispensation approvals.
