> Historical verification snapshot. For the current local UI, role routing and checks, see [local_repair_validation.md](local_repair_validation.md).

# MVP implementation recheck - 7 October 2026

This report supersedes the earlier blanket completion claim. The original 33 backend tests passed before review, but the original frontend tests copied the transport function and depended on a running server, including writes to its database. They did not establish the shipped UI's recovery behavior. Those tests have been replaced with isolated checks that import the production client and shared recovery helpers.

## Confirmed fixes

- Removed the bundled and prefilled staff credential. An empty backend token or relative database path now fails startup. Credential comparison safely handles non-ASCII input.
- Invalid canonical UUID paths now return structured 422 errors. Missing/wrong JSON media types, framework errors, storage faults, and malformed saved evidence use safe JSON envelopes.
- Preserved microseconds in stored creation/submission/observation timestamps. Equivalent offset timestamps replay correctly; changing one microsecond is an immutable conflict. UTC overflow is validation failure.
- Static-file paths are resolved and constrained to the build directory. Readiness checks columns in all four required tables.
- Added integer and report-coherence guards for existing databases as well as new schemas. SQLite NULL semantics cannot bypass unable-report coherence. Conflicting snapshot/row identity is unreadable storage (500); schema-valid product/unit/check-time conflicts remain unresolved evidence. An incompatible or unknown claim is visibly excluded from discrepancy arithmetic.
- Client deadlines cover both headers and response bodies. Malformed endpoint success shapes cannot become apparent saves. Ambiguous 500/503 responses retain unknown write outcomes.
- Caregiver and queue reads use generation guards. New selections invalidate old responses, and mutations invalidate earlier reads. Failed refresh keeps and labels previously loaded evidence.
- Uncertain writes freeze ID/body in memory and, when available, session storage. Inspection compares immutable fields before confirming a save. Retry requires inspection and an explicit same-address/body action. Reload recovery does not persist staff credentials. Confirmed conflicts permit an explicit separate enquiry rather than trapping the interface.
- Queue failure/unloaded states are distinguished from an empty queue. A new queue selection clears prior count/time/outcome inputs.
- Removed remote font requests and starter metadata; rebuilt the production assets. Result rendering includes exact product/request identity and server timestamps.

## Commands and current results

| Check | Result | Boundary |
|---|---|---|
| `backend/.venv/Scripts/python.exe -m unittest discover -s tests -p "test_*.py"` from backend | 56 passed | Temporary databases, fixed clocks, strict contracts/evaluator, golden API journey, replay/concurrency, faults and storage integrity |
| `node --test tests/transport.test.js` from frontend | 14 passed | Actual production client and recovery helpers; controlled fetch responses; no running server/demo mutations |
| `npm run build` from frontend | Passed | Current source compiled and `frontend/dist` rebuilt |
| `npm run lint` from frontend | Exit 0 | Five existing unused-import warnings in inactive Header/TeamRoster templates; no active MVP lint warning |
| `backend/.venv/Scripts/python.exe backend/scripts/check_browser.py` from root | Passed | Headless Chrome, built single origin, temporary server/database, independent caregiver/staff contexts |

The optional browser runner checks the actual rendered interactions: empty staff credential field, manual credential entry, caregiver creation, staff queue selection, report submission, caregiver refresh, exact request rendering, insufficient count 4/request 6/record 12 and discrepancy -8. It then drops a real 201 report response after commit, verifies mutations are frozen, reloads, inspects the saved report, and confirms no automatic second PUT. A failed caregiver refresh preserves and labels the last-loaded result. Captured page requests include no external runtime HTTP traffic, and there are no uncaught browser exceptions. Browser processes and temporary profiles were cleaned up successfully on the final run.

The standard desktop/browser tool failed at sandbox startup, so browser checks used the installed Chrome through its debugging protocol. Shell checks ran outside the failing execution sandbox. No existing `.env` values were printed and the demo SQLite data was not reset or used by tests.

## Remaining verification limits

- Backend concurrency/restart checks establish transaction behavior and fresh-connection persistence; the review did not perform a manual process-restart demo rehearsal.
- Stale-read rejection is covered by the production helper test and code review; this browser script does not force every possible response ordering.
- The browser smoke covers the golden mismatch, zero, lost committed report response, reload recovery, and failed refresh. Supported positive, unknown-time, cannot-check, missing claim, and other negative paths are automated API/evaluator checks, not all separately demonstrated in a browser.
- This is bounded local synthetic operation, not load/capacity testing, public deployment assurance, physical-stock validation, or measured caregiver benefit. Human baseline comparisons and a timed presentation rehearsal remain unverified.
- Tests emit an existing Starlette/httpx deprecation warning. Dependency upgrades were outside this bug-fix scope.

No review can establish that every conceivable defect is absent. The completion claim is limited to the fixes and checks above.
