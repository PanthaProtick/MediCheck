# Local SQLite repair and UI verification — 7 October 2026

This report describes the active local UI after the user's request to repair the SQLite demo before expanding it. It supersedes earlier reports for current frontend routing and browser behavior. No Neon migration, public deployment, or registration implementation was performed.

## Findings and repairs

| Finding | Evidence | Repair |
|---|---|---|
| Default UI was wired to account/v2 routes rather than the local SQLite workflow | The original Chrome smoke failed because the local staff access-key field did not exist; entry point mounted AuthWrapper and App used v2 calls with fabricated fallback tokens | Active entry point now mounts the local v1 App. Previous account UI remains in AccountApp.jsx as an inactive draft |
| Role controls and draft state were mixed into the account shell | Source inspection; the original local browser journey could not proceed | Separate caregiver and pharmacy pages, reached from a role-selection home page, with full-page navigation and independent state |
| Local success-shape validation accepted incomplete nested claims and observations, and invalid timestamps | Existing isView only checked a claim ID and observation kind; targeted malformed-response regression cases | Validate required nested evidence fields, bounded integer counts, report coherence, timestamps and reason enums before rendering |
| Answer prose dropped fractional observation timestamps | Evaluator used strftime without fractions despite microseconds in stored evidence | Use ISO formatting retaining observation microseconds; backend regression checks the exact instant |
| Incomplete recovery intents could throw during comparison | matchesIntent dereferenced an absent payload | Reject incomplete intents; validate and separate local recovery storage by workspace |
| Save and read error handling needed protection in the new screens | Expanded real-browser fault injection | Preserve original IDs/bodies across unknown results, reloads, and rejected retries; no automatic retry; stale refresh retains labeled evidence; queue errors are not displayed as empty success |

The recovery guards were also tested while implementing the new UI. An early draft missed a recovery variable declaration; browser failure exposed it and it was corrected before the final passing run. This was an implementation defect caught during this change, not a claimed pre-existing backend defect.

## UI behavior

- Home page presents distinct caregiver/pharmacy choices.
- Caregiver page contains exact medicine and quantity input, a request action, refresh, and an evidence result. Staff credentials, queues and reporting controls are absent.
- Pharmacy page contains a password-style demo access-key input, pending queue, explicit enquiry selection and report form. Caregiver creation controls are absent.
- Date/time uses a device-local date/time picker, translated to an ISO UTC instant for the API. Unknown time requires an explicit choice.
- Counts of zero, unknown counts, inability to check and pending responses remain distinct. Inventory and staff evidence are displayed separately.
- Display timestamps use Dhaka time with a visible label; full saved UTC timestamps and IDs appear in evidence details.
- Full-page workspace navigation/reload clears the credential. Only the immutable write intent is stored in session storage; no key is persisted by this client.
- Responsive layouts, visible keyboard focus, semantic forms and labeled errors. Desktop and 390px mobile screenshots were visually inspected.

## Final verification

| Check | Result | Scope |
|---|---|---|
| Backend unittest discovery | 84 run: 83 passed, 1 skipped | Temporary test databases, existing contract/API/storage/replay/concurrency checks, new exact timestamp regression |
| Frontend transport/recovery tests | 25 passed | Production client/helpers, malformed evidence and corrupt recovery-storage cases |
| Frontend production build | Passed | Current assets rebuilt in frontend/dist |
| Frontend lint | Exit 0 with existing warnings | No active App warning; warnings remain in the inactive account/templates and legacy helper declarations |
| Isolated Chrome browser check | Passed | Actual production build and v1 backend using temporary SQLite and independent browser contexts |
| git diff --check | Passed | No whitespace errors |

Browser checks passed for request 6 / recorded 12 / checked 4 (discrepancy -8), checked zero (discrepancy -12), lost committed report response, credential-free reload inspection without another PUT, offline refresh retaining previous evidence, rejected retries preserving the original intent, unknown observation time remaining unresolved, inability to check remaining distinct from zero, invalid credentials clearing queue/report controls, caregiver URL restoration, 390px layouts, and lost committed creation response with no duplicate creation. The run captured no external runtime HTTP requests and no uncaught browser exceptions.

## Limits and preserved work

This is role-specific local UI isolation. The v1 backend still uses a single simulated staff principal, seeded pharmacy and shared synthetic enquiry reads. It is not per-account privacy or multi-pharmacy authorization.

A passing test suite does not prove all bugs absent. Public hosting, live Clerk/Neon integration, load/capacity, physical stock accuracy, measured user benefit and timed human presentation remain unverified. The actual PostgreSQL integration test was skipped because no TEST_DATABASE_URL was configured. Existing dependency deprecation warnings remain.

The demo SQLite file was already marked modified when the working tree was inspected; it was not reset or used by these tests. Existing v2 backend code, contracts and account UI draft were retained. Shell execution used approved escalation because the normal Windows execution sandbox could not initialize.
