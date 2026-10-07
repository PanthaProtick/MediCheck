# Serialized Module Implementation Plan

## 1. Execution contract for the coding agent

**Objective:** implement the MVP's exact request → staff observation → saved evidence comparison → qualified caregiver answer, with one synthetic pharmacy and one local backend/database. This is a plan, not evidence that those behaviors are implemented.

**Planning budget:** six hours from implementation kickoff, one developer, Pantha Protick. No additional people, agents, pharmacy partners, accounts, model services, or data feeds are assumed. The clock has not been independently measured. A coding agent must track actual elapsed time and report slippage rather than declaring this schedule guaranteed.

Read in this order before editing application code:

1. [proposition.md](../docs/proposition.md): claim and evidence limits.
2. [mvp.md](../docs/mvp.md): mandatory behaviors and exclusions.
3. [api_contracts.md](../docs/api_contracts.md): authoritative schemas, enums, routes, errors, timestamps, mocks, and replay semantics.
4. [architecture.md](../docs/architecture.md): deployment and component boundaries; its earlier schema blueprint is superseded by the refined contracts.
5. This plan: implementation sequence, internal function choices, and completion gates.

If documents conflict, preserve the MVP's safety/scope and use the detailed API contract for wire behavior. Do not silently choose a different schema. Resolve a small contract ambiguity explicitly in documentation before implementing it. If a new organizer requirement would change scope or safety, mark it unknown and obtain clarification; do not invent it.

### Non-negotiable agent rules

- Execute **M00 through M09 serially**. Do not start a later module while a required earlier gate fails. Later modules may strengthen already-working code; they do not excuse temporary fabrication of evidence.
- Edit only files necessary for the current module. Reuse the inspected React/FastAPI shell. Do not add a second backend/frontend, TypeScript conversion, ORM, state library, component library, model service, realtime channel, or cloud deployment.
- Preserve exact `/api/v1` contracts. Never add frontend-supplied conclusion, staff identity, hidden conversion, substitution, reservation, confidence percentage, or latest-write-wins behavior.
- No in-memory fallback when SQLite fails. No synthetic response fallback when HTTP fails. Development mocks must be explicitly selected and visibly labeled; they cannot rescue a failed live request.
- Require explicit simulation/time/evidence limits in the result. A staff credential is a simulated actor credential, not professional verification.
- Do not inspect/print existing `.env` secret values. Use `.env.example` and environment-variable names; replace only required settings deliberately. Do not place credentials in frontend files or build variables.
- Tests use a temporary database, fixed test clock, and test-only credential. No wipe endpoint or test mutation against the demo database.
- Add no speculative extensibility frameworks. A few typed functions are the architecture; they are not microservices.
- Completion claims require command/test/browser evidence. “Code written,” “schema validates,” “API works,” “browser journey works,” and “user benefit validated” are distinct claims.

## 2. Inspected starting point and unknowns

Verified from workspace files/environment before writing this plan:

| Finding | Implementation consequence |
|---|---|
| React/Vite JavaScript project, installed modules and lockfile exist | Retain JavaScript and existing build tool; no migration or package upgrade |
| `backend/app/main.py` defines app; `backend/main.py` only prints a greeting | Launch `app.main:app` from backend directory, not `python main.py` |
| Backend settings currently use `/api`, optional PostgreSQL/Gemini configuration | MVP must use `/api/v1`; remove irrelevant service imports from active startup path |
| Current item API uses memory, even with configured database dependency | It is not a working enquiry repository; implement actual SQLite storage |
| Current frontend fabricates item creation after failure and has model/template tabs | Replace active API client/UI behavior; old template components need not be deleted |
| Current Vite config has no API proxy | Add `/api` loopback proxy for development |
| Current root redirects to `/docs`; a `frontend/dist` directory exists | Built output may be stale; rebuild before static demo serving |
| Backend virtual environment can run Python and contains FastAPI, Pydantic, Uvicorn, httpx; pytest absent | Use `unittest` and FastAPI TestClient with existing httpx; no pytest dependency required |
| No root AGENTS.md found during this inspection | Follow the user-provided review instructions; recheck applicable instructions before implementation |

Unknown until M00: actual clean build/startup, free ports, uv/Node command availability, frontend runtime correctness, current process state, and any remote database connectivity. Package import discovery does not prove version compatibility. Do not copy starter claims about real database/model health into the MVP.

## 3. Module order, budget, and progress accounting

| Module | Budget | Cumulative gate | Outcome |
|---|---:|---:|---|
| M00 — inspect/freeze/preflight | 10 min | 00:10 | Known entry point, dependencies, scope, and work boundaries |
| M01 — contracts/fixtures/test harness | 20 min | 00:30 | Exact schemas and reproducible fixtures available |
| M02 — connected backend slice | 40 min | 01:10 | Real request/report/read through one database and protected API |
| M03 — minimal browser slice | 20 min | 01:30 | Caregiver and staff complete the same real enquiry |
| M04 — full evidence semantics | 45 min | 02:15 | All required conclusion/uncertainty cases implemented |
| M05 — persistence/auth/mutation hardening | 45 min | 03:00 | Immutability, replay, conflict, concurrency and restart behavior verified |
| M06 — client failure and recovery behavior | 35 min | 03:35 | Unknown saves, truthful errors, and stale-read races handled |
| M07 — final local packaging | 25 min | 04:00 | One-origin built demo, readiness and startup behavior |
| M08 — acceptance validation | 60 min | 05:00 | Focused tests and actual two-context browser checks |
| M09 — runbook/evidence/rehearsal | 60 min | 06:00 | Repeatable startup/reset and ≤4-minute honest demonstration |

Total **360 minutes**. These are target ceilings, not promises. M02/M03 are a thin subset of the final behaviors; M04–M07 complete/harden them. There is no extra optional-feature block. Final two hours are protected for validation and rehearsal.

Status for each module: `not_started`, `in_progress`, `passed`, or `blocked`. Track in the implementation handoff, not a new runtime subsystem. Record files changed, checks actually run, their outcomes, unresolved failures, elapsed time, and exact next step. Never mark later modules complete merely because their code was partially written early.

At the 90-minute gate, simplify presentation if the real browser slice is missing. If React itself remains the blocker, replace its shell with one minimal backend-served page using the same APIs and semantics; do not maintain two UIs. This is the architecture's documented fallback, not permission to remove authorization or stored evidence. At four hours, stop optional changes. If a required gate still fails, report the honest reduced completion boundary and spend the reserve fixing it; do not manufacture success.

## 4. Fixed file ownership and internal interfaces

Planned files may be created only when their module needs them:

```text
backend/app/main.py                 # app factory/lifespan/errors/static serving
backend/app/core/config.py          # local demo settings, no required model/remote DB
backend/app/core/database.py        # SQLite connections, DDL/init/seed/readiness
backend/app/core/errors.py          # small structured domain error
backend/app/core/security.py        # server staff principal
backend/app/models/schemas.py       # exact contract models
backend/app/services/evidence.py    # pure evaluation and controlled wording
backend/app/services/enquiries.py   # transaction-backed create/report/read/view
backend/app/api/routes.py           # only six MVP routes
backend/app/fixtures/bootstrap.json # disclosed seed catalog/claim
backend/tests/fixtures/contracts.json # exact extracted contract fixture container
backend/tests/test_contracts.py
backend/tests/test_evidence.py
backend/tests/test_repository.py
backend/tests/test_api.py
backend/scripts/reset_demo.py       # explicit local maintenance; M09 only
frontend/src/services/api.js        # six HTTP client functions, no fallback data
frontend/src/services/api.mock.js   # optional static adapter only if needed
frontend/src/App.jsx                # minimal actor interactions; extract components if needed
frontend/src/index.css
frontend/src/App.css                # remove/replace template styles only as needed
frontend/vite.config.js             # development proxy
backend/.env.example
frontend/.env.example               # no secrets or old API URL prerequisite
README.md                          # verified launch instructions
docs/validation.md                 # results/evidence boundary
docs/demo_runbook.md                # actual final journey/reset
```

Existing unused Gemini/template files may remain inert. Do not delete unrelated files or alter lockfiles unless a verified dependency need requires it. Do not create alternative schema copies in independent modules. All services import the contract models.

### Explicit function decisions

These are local implementation choices compatible with contract B07–B12, not additional network APIs:

```text
create_app(settings, clock=utc_now) -> FastAPI
utc_now() -> aware UTC datetime
connect_database(database_path) -> sqlite3.Connection  # caller closes
initialize_database(database_path, bootstrap) -> None
check_readiness(database_path) -> None                 # raises on failure
require_staff(authorization, settings) -> StaffPrincipal

evaluate(EvaluationInput) -> EvaluationResult
build_view(record, observation, served_at) -> EnquiryView

create_enquiry(database_path, enquiry_id, request, clock) -> RepositoryWriteResult
accept_observation(database_path, enquiry_id, request, principal, clock)
    -> RepositoryWriteResult
read_enquiry(database_path, enquiry_id) -> (EnquiryRecord, Observation | None)
list_pending(database_path, principal) -> list[(EnquiryRecord, Observation | None)]
read_bootstrap(database_path) -> BootstrapResponse
```

`settings` contains required absolute `DEMO_DATABASE_PATH`, nonempty backend-only `DEMO_STAFF_TOKEN`, and resolved static directory/mode. The latter is internal startup configuration, not an API field. One server mapping `STAFF-DEMO`/`PHARM-A`; one fixture pharmacy constant. Use module functions rather than a generic repository/interface hierarchy.

Clock injection is a single callable for deterministic tests; no time service/dependency framework. `create_app` lets tests supply temporary settings without requiring a real token at import time. Production `app` is constructed from environment settings; validate required demo settings during startup. Tests must enter the app lifespan.

## 5. M00 — inspect, freeze, and preflight

**Depends on:** none. **Allowed files:** documentation/status notes only unless a minimal verified startup issue requires repair. **Budget:** 10 minutes.

Steps:

1. Read source documents/instructions and verify the starting files listed above. Do not reread thousands of mock lines manually: parse the fixture container from contracts.
2. Confirm Python interpreter, Node/npm, uv or usable existing virtual environment, and available ports. Read package manifests/lockfile; do not upgrade packages.
3. Check baseline frontend build and minimal backend imports without relying on real Gemini/Neon. If starter startup contacts/depends on irrelevant services, record it for M02 isolation; do not debug model/network setup.
4. Freeze six routes, one pharmacy/three products, units, no corrections/holds, strict schemas, protected staff writes, and unknown-write recovery. Confirm contract precedence.
5. Establish a dedicated demo database path inside `backend/data` and temporary test databases outside it. Plan backend-only token provisioning without printing a real credential.

**Gate:** agent can name the actual entry point, runtime/build commands, scope, existing blockers, and first implementation file. No remote service is required to continue. Baseline defects may be recorded as pending M02/M07 work; no misleading claim that preflight proves final runtime.

**Do not build:** backend/domain code, UI redesign, infrastructure, dependency updates, real-data import, or a comprehensive environment audit.

## 6. M01 — exact schemas, fixtures, and minimal test harness

**Depends on:** M00. **Files:** schemas, seed JSON, contract fixture JSON, `test_contracts.py`, small error helper if needed. **Budget:** 20 minutes.

Steps:

1. Copy the **Section 9** Pydantic block from `api_contracts.md` into `models/schemas.py`. Preserve names/enums/nullable-required fields/strict types. Do not copy the older architecture block.
2. Parse the first JSON fenced block in contracts: it is the fixture container. Copy it unchanged into `backend/tests/fixtures/contracts.json`. Extract the `bootstrap` case response body into `backend/app/fixtures/bootstrap.json`. Do not wrap bootstrap with mock status/request metadata.
3. Preserve synthetic source times in seed evidence as fixture times. Server creation/submission/serving times are actual runtime times; test clock may be fixed. Never replace `recorded_at`/`observed_at` with load/submission time.
4. Centralize canonical UUID-path validation and UTC serialization. Use the same validation as `EnquiryRecord.id`; accepting any UUID representation in a path would violate the contract. Serialize UUIDs as lowercase strings and aware times as UTC `Z`.
5. Define a minimal domain error carrying status/code/safe message/field names; error helpers must not expose submitted secret values. One type with structured attributes is sufficient, not an exception class hierarchy for every possible fault.
6. Implement built-in `unittest` checks that parse every successful response and request through its model, plus documented invalid quantity/time/flag/UUID/missing/extra cases. Parse error fixtures through `ErrorResponse`. Fixture metadata must not be fed into wire models.

**Required observations:** JSON `6.0`, true, string `"6"`, zero/negative requests rejected; zero report accepted; numeric/naive/date-only times rejected; offset time normalized; nullable field omission rejected; simulated integer1 rejected; extra staff_id/answer rejected; uppercase UUID rejected.

**Gate:** exact models import, all 32 HTTP and three internal fixtures validate, invalid cases reject. This verifies shapes, not comparison behavior or routes. No agent may fix a failing fixture by inventing a new enum or loosening strictness.

**Do not build:** routes, ORM, mock server, automatic type generation, model service, frontend state library.

## 7. M02 — first real backend journey

**Depends on:** M01. **Files:** database/config/errors/security/enquiries/evidence/routes/main; focused repository/API smoke checks. **Budget:** 40 minutes.

This is the first thin slice, not the final acceptance suite. It must already use real SQLite and server permission checks; those are not temporary mock steps.

### Database/init skeleton

1. Replace active remote database dependency with local SQLite helpers. Keep installed unused dependencies, but eliminate Gemini/SQLAlchemy imports from active MVP routes/startup.
2. Create the four contract tables with exactly specified columns. See the storage checklist in Section 14. Do not add a result/status table.
3. Open a fresh connection per operation, enable foreign keys, set lock timeout2 seconds, use rows accessible by name, and always close in `finally`. Do not reuse a cross-thread global connection or broadly set `check_same_thread=False` as a workaround.
4. Initialize schema and validate/insert missing seed records. Existing enquiries/reports survive repeated startup; never reset automatically. Missing required settings/storage causes startup/readiness failure, no standby memory mode.

### Minimal create/report/read path

5. Create validates canonical ID, known pharmacy/product, request unit/count; under `BEGIN IMMEDIATE`, return matching existing request or409, otherwise insert immutable snapshots/creation time and commit.
6. Read decodes stored snapshots/report through contract models. Pending view comes from no report, with null discrepancy and `awaiting_check`.
7. Protected queue lists pending entries for principal's pharmacy; actual server mapping supplies staff identity. Report validates exact enquiry identity/unit, then atomically accepts one checked observation. Save server submission time and reporting basis; record itself remains untouched.
8. First report/check time validation and commit happen under the transaction; use a server timestamp for both first-write validation and saved `submitted_at`. Report duplicate identical semantic body returns200; changed body409. These minimal semantics are required immediately, although concurrency tests come later.
9. Add initial pure evaluation for no report and valid checked report, returning sufficient/insufficient at observation time. Count4/request6/record12 returns discrepancy -8. Server constructs messages; frontend cannot post answers.
10. Wire the six routes with exact201/200 behavior and model responses. At minimum catch domain/validation errors safely; full framework envelopes/static serving are finished in M07. Never claim all negative paths pass at this module.

**Gate:** through actual HTTP/TestClient: health/bootstrap; create request6; queue contains same ID; unauthorized write401; protected report4 succeeds; read returns insufficient with both claim12/report4; identical request/report replay200 and changed payload409. Row counts prove real saved state, not a returned hardcoded card.

**Still incomplete:** full uncertainty/conflict evidence branches, broad boundary cases, concurrent writer tests, unknown-save frontend, final packaging. Represent unsupported yet-unimplemented branches honestly during development; do not expose a completed demo claim.

**Do not build:** rich UI, async SQL driver, full inventory ledger, notification delivery, model inference, unprotected staff shortcut.

## 8. M03 — minimal two-actor browser journey

**Depends on:** M02. **Files:** `api.js`, App, minimal CSS, Vite proxy. **Budget:** 20 minutes.

Steps:

1. Replace active starter tabs with a plain caregiver section and a plain staff section. Old files may remain unused; remove their imports and ten-second starter health polling from active App.
2. `api.js` exports the six contract client functions only. Use relative `/api/v1`, native fetch, GET3-second/PUT5-second deadlines. No fallback records, auto-retries, or model responses. Preserve errors even if rendering is initially simple.
3. Add Vite `/api` proxy to loopback backend8000 without rewriting `/v1`. Retain build configuration otherwise.
4. Caregiver loads bootstrap, selects exact identity showing name/strength/form/unit, enters positive integer quantity, generates one `crypto.randomUUID()` per new intent, and stores active ID in URL (`?enquiry=<uuid>`) before PUT. Freeze the body while submitting.
5. Staff enters token in a password-style field stored only in memory; manually refreshes queue, selects by ID, sees exact request, and submits count4. Reported time is explicit input: UTC ISO text or a button **Set simulated check time to now** that updates that field intentionally. Do not silently equate submission time with observation time.
6. Caregiver manually refreshes the same ID and sees saved count/time/source/recorded-versus-checked evidence and qualified answer. Disable busy mutation buttons. Keep synthetic/no-reservation/no-clinical-approval disclosure visible.
7. Use two separate browser contexts for caregiver/staff so credential state is not accidentally shared. No routes/account login library required.

**Gate by 90 minutes:** actual browser request6 → protected staff report4 → refresh insufficient, same ID, record12 preserved. A fresh sufficient check must also work through backend; full extra UI inputs are added in M04/M06.

If this gate misses: reduce layout/style and fixture rendering. If frontend setup itself blocks progress, use the architecture's backend-served plain UI fallback with unchanged HTTP contract; document decision. Never replace real storage/reporting with a static demo card.

**Do not build:** design system, icons/animation work, history dashboard, mappings, proactive polling, mock transport if live path already works.

## 9. M04 — complete evidence semantics and result rendering

**Depends on:** M03. **Files:** evidence service, schemas only if contract-preserving fix necessary, enquiry view builder, result UI, `test_evidence.py`. **Budget:** 45 minutes.

Implement evaluator precedence exactly:

1. Validate enquiry semantic identity/unit. If schema-valid but contradictory, return unresolved/evidence_conflict.
2. If no report, pending/unresolved/awaiting_check.
3. If report product/unit does not match enquiry, or reported time exceeds its saved server submission time, unresolved/evidence_conflict. Do not inspect counts first and accidentally return sufficient.
4. If report kind unable_to_check, unresolved/unresolved/cannot_check.
5. If checked time null, unresolved/unresolved/observation_time_unknown, preserving reported count but null discrepancy.
6. Otherwise integer count >= requested is sufficient; below, including zero, is insufficient. Workflow status answered in both cases.
7. Compute discrepancy only for conclusive check and compatible known claim count/unit/identity; otherwise null. Missing/old claim time does not create a fake count or invalidate a valid exact report.
8. Build controlled message and limitation arrays. Unknown/mismatched claim evidence is described honestly; no guessed substitution, age-confidence score, or availability-now promise.

**Storage decoding boundary:** basis/kind mismatch violates the exact `Observation` model's cross-field validator, so cannot be returned as that invalid object in an otherwise schema-valid view. It is an unreadable/cross-field-invalid saved record and returns500/internal_error. Identity/time mismatch that models can represent remains unresolved/evidence_conflict. This refinement is documented in the contracts; do not loosen validators or fabricate a corrected observation to force a200.

Add UI report kinds: checked amount/time, explicit unknown-time input, or cannot-check. Require nullable fields to be sent as null, never omitted. Add UI rendering for pending, sufficient, insufficient/zero, unable, unknown time, claim absent/unknown, and valid historical checks. Display observation time separately from submission time.

**Required evaluator tests:** no report; count4/count8/count0 with request6; count equal6; unable report; checked unknown time; missing claim; claim quantity null; claim time null; old check; schema-valid product mismatch; check time after submission. Verify status/conclusion/reason and discrepancy independently of exact English punctuation. Assert count4/request6/record12 has discrepancy -8, not -2.

**Gate:** all required evidence cases are implemented and UI distinguishes unknown from zero/unavailable. Exact reported identity and clinical suitability remain separate. Tests are real rule tests; mocked view rendering alone is insufficient.

**Do not build:** multiple accepted reports, corrections/reconciliation UI, confidence scoring, professional decision automation, current-stock TTL inference.

## 10. M05 — harden immutable writes, role boundary, and storage

**Depends on:** M04. **Files:** database/enquiries/security; `test_repository.py` and targeted API checks. **Budget:** 45 minutes.

### Exact first/replay/conflict algorithms

Creation:

1. Validate wire shape and canonical ID before mutation.
2. Open connection, begin immediate transaction, look up the existing enquiry **before** rebuilding snapshots from today's catalog.
3. If existing immutable request fields equal the supplied fields: no changes, no new clock time/snapshot; return existing record/report with `created:false` after transaction ends.
4. If existing request differs:409, rollback/no changes.
5. If new: validate catalog/pharmacy/unit; capture snapshots; assign creation time; insert once; commit; return `created:true`.

Observation:

1. Authenticate fixed credential; validate request shape/canonical ID.
2. Under immediate transaction, load enquiry; enforce principal pharmacy permission before accepting/writing.
3. If existing report: compare **only** normalized `ObservationRequest` fields; exclude server staff/submitted_at/basis. Identical → replay with original metadata; different →409. Do not retimestamp or overwrite.
4. If first report: validate exact product/unit; take server timestamp, reject future check time; construct valid backend observation; insert once; commit.
5. After successful commit build current view from persisted inputs. If response construction fails after commit, error/connection loss must not imply the write rolled back; client inspection is mandatory.

Normalize offset timestamps to UTC; JSON key ordering does not affect replay. A changed reported time is a changed report. Do not add a second idempotency-key store.

### Storage/security checks

- Parameterized SQL, quantity/null coherence checks, PK/FK constraints, strict row/model decoding, explicit rollback/connection closure on exceptions.
- Token comparison uses a constant-time built-in; backend derives STAFF-DEMO/PHARM-A. No token in logs/response objects. Missing configuration fails startup.
- Map lock and availability errors503; corrupted stored shapes/internal programming errors500. Do not label every sqlite exception as a conflict or silently replace data.
- Readiness checks schema/read access, not a settings boolean. Restart/seed does not replace snapshots or reports.
- Queue derives pending from absence of accepted report, orders by creation then ID, and is pharmacy-scoped.

**Required tests:** two independent connections concurrently submitting identical reports → one201/one200; different reports → one accepted/other409; original remains unchanged. Use synchronization in a test, not sleeps as a concurrency oracle. Also test changed creation, offset-equivalent replay, seed twice, restart/reopen, foreign-key rejection, snapshot preservation after catalog fixture change, busy database mapping, unauthorized401 and injected wrong-pharmacy403.

**Gate:** immutable evidence survives replay/concurrency/restart. An unavailable file does not cause memory fallback. Permission tests include direct API writes, not merely hidden staff buttons.

**Do not build:** auth accounts/JWT, shared global DB connection, migrations framework, event sourcing, multi-worker deployment, remote database.

## 11. M06 — truthful client failures and uncertain-save recovery

**Depends on:** M05. **Files:** API client/App or small extracted actor/result components; narrow frontend checks. **Budget:** 35 minutes.

Transport behavior:

- Parse response status before treating body as success. Standard error envelope rejects with `kind:http`; network/timeout/malformed successful response rejects with `kind:transport` and correct outcome field.
- Never return `[]`, fake item, generic success, invented timestamp, or a mocked conclusion after live failure.
- Read failure preserves last-loaded evidence and marks it as last loaded; it does not advance saved status.
- Write timeout/loss or ambiguous500/503 means save outcome unknown. Freeze exact attempted ID/body; no automatic retry and no automatic new ID.
- Inspect through GET. If immutable request/report fields match attempted values, saved success is established. A different report is conflict. Pending/404 can race in-flight work, so leave outcome unknown; explicit same-address/identical-body retry is safe and permitted, not automatic.

Client state decisions:

- Separate per-actor loading/error state, active saved view, selected queue ID, and frozen mutation intent. No global store needed.
- User changes after a completed report create a deliberate new enquiry, not edits to old evidence. Do not silently start a replacement enquiry while the prior save is unresolved.
- Preserve active ID in URL. Preserve frozen request in memory; for page-reload recovery, a small sessionStorage record keyed by enquiry ID may retain synthetic attempted payload only, **never token**. This is limited recovery bookkeeping, not account history/offline queue. Clear settled intents and validate restored data before reuse.
- Protect against stale responses: before applying an async result confirm active ID/request-generation marker still matches the caller. Older refresh for another selection cannot replace current view. Token re-entry/selection change also invalidates old queue loads.
- React StrictMode may rerun effects: effects perform reads only, mutations originate from explicit user actions. Dispose/ignore stale read results; do not cancel a write then assume rollback.
- Distinguish cannot-check from count0; show absent/unknown metadata explicitly and render text safely. No HTML injection.

**Verification:** successful save followed by deliberately lost client response → inspect same ID finds saved report. Failure before send → no manufactured evidence. Busy backend/read503 → error, not empty queue. Double click → at most one report. Slow response to old ID cannot replace current ID. Credential absent/invalid surfaces401 rather than a fake empty queue.

Injection is test-only (mock fetch/local test harness), not an exposed fault endpoint. If no existing frontend test framework, use Node's built-in tests for transport logic or focused browser instrumentation; do not install a large runner merely to reproduce these few failures.

**Gate:** the client can tell “not saved because validation rejected” from “save outcome unknown,” and uses inspection to settle uncertainty.

**Do not build:** service worker, offline sync queue, optimistic authoritative conclusions, global caching system, automatic mutation retry, full enquiry history.

## 12. M07 — final same-origin packaging and error surface

**Depends on:** M06. **Files:** main/routes/config, Vite config if needed, env examples, packaging notes/API tests. **Budget:** 25 minutes.

Steps:

1. Complete normalized API errors: validation422, unauthorized401 with WWW-Authenticate, forbidden403, missing404, immutable409, unsupported method405 with Allow, non-JSON PUT415, storage503, internal500. All under `/api/v1` use ErrorResponse and no-store; no submitted values in fields/messages/logs.
2. Accept JSON PUT content type, including standard charset parameter; reject text/plain rather than relying on framework coercion. Malformed JSON is422, not internal500. Do not add parser middleware that silently consumes bodies or breaks FastAPI validation.
3. Register API routes before static app routes. Unknown `/api/v1/...` remains JSON404; it must not serve index.html. Static-file failures are outside API JSON contract.
4. Build frontend from current source; existing dist is not evidence. Serve index at `/` and build assets/public files safely from the resolved build directory. Do not mount a catch-all at root that shadows API routes or permits path traversal.
5. Replace root `/docs` redirect. Keep API docs for debugging; demo golden path must not depend on their externally loaded assets.
6. Development permits API/startup without built assets if explicitly in development mode; **final demo mode** requires built assets/index and fails clearly if absent. Do not report “ready full demo” for an absent UI.
7. Bind demo to127.0.0.1:8000, one worker, no reload. No remote database/model/environment URL requirement. Startup initializes storage without resetting it; readiness checks required schema/readability.
8. Use env examples containing placeholder token, path/mode conventions, and no real keys. Frontend uses relative prefix, no old absolute API_BASE setting requirement. Record verified fallback to existing interpreter if uv command is unavailable.

**Gate:** rebuilt UI and API run on one local origin; same two-context journey works without Vite running. Unknown API paths/methods/media types return correct JSON errors. Model/remote database settings can be absent. No third-party HTTP request is required for the journey.

**Do not build:** Docker, HTTPS/cloud host, LAN exposure, CI pipeline, CDN, credential provisioning service.

## 13. M08 — focused acceptance tests and browser evidence

**Depends on:** M07. **Files:** test files, confirmed fixes in owning modules, `docs/validation.md`. **Budget:** 60 minutes; no new optional features.

Backend command from backend directory, using the verified environment:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

Use TestClient/httpx already available, and `unittest`/temporary directories. If implementation introduces a missing mandatory dependency, verify it and use the existing project manager; record the change. Do not assume pytest, Playwright, Docker, or other tools are installed.

| Acceptance case | Must establish | Evidence level |
|---|---|---|
| Golden mismatch | request6/record12/check4 same saved ID; insufficient at reported time; discrepancy -8 | Backend + actual browser |
| Supported positive | fresh request6/check8 and equality6 return sufficient at time, no future guarantee | Backend + browser |
| Zero versus unknown | check0 insufficient; no check pending; cannot-check and null-time distinct unresolved reasons | Backend + browser |
| Missing/old claim | count comparison can work without a claim; dates/unknown remain explicit | Backend + browser |
| Invalid input | strict ID/count/time/unit/extra fields reject without accepted report | Contract + API |
| Semantic conflict | schema-valid stored identity/time contradiction unresolved; bad model structure500 | Evaluator + decoding/API |
| Staff boundary | missing/invalid token401; wrong pharmacy403 via injected principal; attribution server-owned | API |
| Immutable retry | first201, identical200, changed409; saved metadata retained | API + database |
| Concurrent writers | one immutable winning report; identical harmless, different rejected | Repository/API |
| Lost response | same-ID inspection finds committed write, no local fabricated success | Controlled transport + browser |
| DB failure |503/no memory fallback/no fake queue/result; client save uncertainty honest | Fault test + browser |
| Restart/init | existing enquiry/snapshots/report survive startup and seed-repeat | Repository + actual process restart |
| Built offline demo | one-origin build, no remote runtime requests, no Vite prerequisite | Actual browser/process |

Run appropriate frontend build and lint. Fix confirmed correctness faults; do not rewrite unrelated template files to satisfy a new broad cleanup objective. If existing unused files cause lint warnings/failures, report their status and make only necessary scoped changes.

Use available browser tooling for real UI; if unavailable, mark browser verification unperformed, not inferred from TestClient. Verify two independent contexts, field entry, token entry, selection, submission, refresh, result text. Screenshots alone do not prove persistence or authorization.

Record test commands/counts/failures, current browser status, startup/offline evidence, and implemented-versus-simulated boundaries. Do not invent participants or quantitative user improvement. Prepare clear-baseline comprehension questions; conduct preliminary human comparison only if actual participants/time are available, otherwise report it unverified.

**Gate:** required acceptance checks pass or remaining failures are explicitly named with their affected claims. A failing must-have blocks a complete-MVP claim. No broad test repetition once checks pass unless a change/new uncertainty warrants it.

## 14. Storage and API implementation checklist

Use this checklist to avoid interpretation drift while coding M02/M05/M07:

| Item | Exact requirement |
|---|---|
| tables | products, claims, enquiries, observations only; pharmacy/staff fixture constants permitted |
| products | id/name/strength/form/unit; immutable seeded catalog in demo operation |
| claims | id/pharmacy_id/product_id/quantity/unit/recorded_at/loaded_at/source/simulated; unique pharmacy/product; nullable quantity/time |
| enquiries | id/pharmacy_id/product_id/requested_quantity/unit/created_at/product_snapshot_json/claim_snapshot_json; positive integer quantity; nullable claim snapshot |
| observations | enquiry_id PK/FK, product_id/unit/kind/obtainable_quantity/observed_at/unresolved_reason/staff_id/submitted_at/basis/simulated; null coherence checks; one report |
| numeric SQL checks | correct range and INTEGER type for nonnull numeric columns; input validation stays strict regardless of SQLite affinity |
| SQL flags | INTEGER1 for simulated, mapped to boolean true before wire-model validation |
| timestamps | UTC TEXT; decoder validates timestamp strings/calendar/timezone; replay compares normalized values |
| snapshots | validated server-generated JSON; original claim never overwritten by check; product identity frozen |
| report foreign link | FK to existing enquiry; no report creation under absent parent |
| transaction | immediate transaction, compare and insert while locked, no awaited I/O, commit before success; rollback/close failures |
| status | derived from accepted evidence; no independent status table/column required |
| errors | safe ErrorResponse; no SQL exception/string dump, submitted values, or token |
| responses | no-store JSON for API; required nullable fields present; UUID/time canonical |

Six routes, with no aliases or extra product services:

```text
GET /api/v1/health
GET /api/v1/bootstrap
PUT /api/v1/enquiries/{id}
GET /api/v1/enquiries/{id}
GET /api/v1/staff/enquiries
PUT /api/v1/enquiries/{id}/observation
```

Use synchronous `def` handlers for blocking SQLite work, keeping simple local bounded operations off the async event loop. Do not convert to async merely because the starter used async. Factory/test clock injection must remain small and comprehensible.

## 15. M09 — reset, runbook, evidence, and rehearsal

**Depends on:** M08. **Files:** local reset script, README, validation/runbook docs; necessary confirmed bug fixes only. **Budget:** 60 minutes.

Steps:

1. Write verified launch instructions with exact working directories and commands. Expected path is backend `uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`; use local interpreter alternative if verified uv cannot run. Document required backend settings and current build command, without real credentials.
2. Provide a narrowly scoped reset script for local maintenance only. Require presenter to stop backend first; verify configured absolute target is the intended `backend/data/demo.sqlite3` inside workspace before deleting/recreating. No computed recursive deletion, no HTTP wipe endpoint, no automatic startup wipe. If path differs, fail clearly rather than widening deletion scope.
3. Reset/reseed, restart, and complete real golden journey from a clean state. Restart again with saved state and verify evidence remains. Retain one tested build; no package upgrades or new dependencies.
4. Demo script <=4 minutes: exact request/record limitation; caregiver creates; staff reads same ID/submits simulated4; caregiver refreshes insufficient with original12; show fresh sufficient or explicit unknown; explain immutable/time/no-reservation/clinical limits and actual checks performed.
5. Prepare backup screenshots/recording if useful; label recorded material. Offline startup/browser verification must be performed, not merely assumed from no external API design.
6. Record known limits: simulated staff/physical evidence, one pharmacy, no edits/holds/substitutions, no actual purchase/travel/health improvement proof, limited concurrency scale, local-only credential design, human comprehension unverified unless conducted.

**Gate:** another coding agent/presenter can follow the runbook without unstated services, secret values in source, or hidden mock mode. Final report links actual validation evidence and names any required check still unperformed.

**Do not build:** more features, deployment migration, pitch claims beyond evidence, automated judging analytics, user studies with invented responses.

## 16. Failure handling and reduction order

| Trigger | Response |
|---|---|
| React setup/formatting dominates before90min | Reduce to two plain interactions; use documented single backend-page fallback only if necessary |
| Local SQLite startup fails | Diagnose absolute path/schema/permissions; fix real store; never fall back to memory |
| Existing remote/model configuration blocks import | Disconnect it from active MVP path; do not spend deadline on vendor credentials |
| Test tooling absent | Built-in unittest/direct API/browser checks; add only demonstrably required minimal dependency |
| Contract mismatch discovered | Correct authoritative contract/fixtures together before dependent edits; note changed behavior and why |
| Replay/conflict race fails | Preserve immutable write gate; fix transaction/uniqueness, not frontend button disabling alone |
| Lost response cannot be settled | Show unknown, retain intent and inspect; do not claim failed/saved without evidence |
| Four-hour gate missed | Stop optional work; use remaining time for required failures/tests/demo. Report partial status if full must-haves do not pass |
| No human evaluator available | Mark user-value validation unverified; technical mechanism can still be demonstrated |

Remove in this order if needed: style/polish → unnecessary component decomposition → optional mock adapter → convenience recovery/history beyond active-intent needs → any optional analytics. Do not remove exact identity, shared saved evidence, staff permission, uncertainty, immutable report acceptance, or honest failures.

## 17. Coding-agent module handoff template

At the end of each module, report:

```text
Module: Mxx / status: passed | blocked
Actual time spent / total elapsed:
Files changed:
Behaviors now implemented:
Checks actually run and outcomes:
Checks not run:
Known failures/limits:
Contract changes, if any:
Next module and exact first action:
```

If a required check fails, use blocked for that module and explain the fixable blocker; this is progress reporting, not a request to stop all authorized work. Continue resolving it within scope. Do not use goal-management status tools merely because this template says blocked.

The final completion boundary is **working local evidence workflow plus verified acceptance evidence**, with simulated physical inputs clearly disclosed. The central user-benefit hypothesis remains separate. Feature volume and model novelty do not compensate for a disconnected or misleading demonstration.

## Post-implementation review - 7 October 2026

The completed implementation was rechecked and repaired. Current evidence: 56 backend tests, 14 production-client/recovery tests, successful build, lint exit 0 with five inactive-template warnings, and an isolated two-context Chrome run including committed-response loss and failed-read recovery. This does not certify a measured six-hour implementation, all module browser gates, human benefit, or the four-minute rehearsal. See [the current validation report](../docs/validation.md) and [launch/runbook updates](../docs/demo_runbook.md). Startup now requires an explicit backend-only token and absolute database path.
