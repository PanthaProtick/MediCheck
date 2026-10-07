# Public Multi-User and Multi-Pharmacy Demo: Serialized Upgrade Plan

## 1. Confirmed scope, budget, and source precedence

User-confirmed requirements: **real registration/login**, **public internet hosting**, multiple caregivers, multiple pharmacies. Neon may replace SQLite. This is a new plan, not code implementation, migration, provider provisioning, or deployment completion.

Reuse the existing working local demo. Preserve [the original plan](implementation_plan.md), [MVP](../docs/mvp.md), [v1 contracts](../docs/api_contracts.md), [architecture](../docs/architecture.md), and [validation report](../docs/validation.md). This plan changes identity, authorization, persistence and hosting; exact medicine identity, immutable reports, deterministic comparison, observation times, no reservation and no clinical approval remain.

P01 must produce **api_contracts_v2.md with exact JSON/Pydantic models before functional v2 code**. Its contracts then govern the upgrade. Do not apply the old public-read permission model to public accounts.

One developer: Pantha Protick. Last stated budget was six hours; refreshed remaining time is unknown. The expanded work has a nominal **560-minute module budget plus 100-minute contingency = 11 hours**, planning range **8–14 hours**, not a measured promise. If six hours remain, attempt only with provider/hosting access already ready and aggressive reuse. Do not omit isolation/auth/concurrency tests to claim completion.

Real accounts use synthetic medicine requests/pharmacies. No real patient records, prescription images, clinical advice, purchases, reservations, or professional credential verification. Registration proves account access, not pharmacy authority.

## 2. Current baseline and verified inspection

The original plan now lives in tasks/implementation_plan.md. The current workspace was reread; do not use stale assumptions that only a starter exists.

| Evidence | Current finding | Consequence |
|---|---|---|
| Inspected source | App factory, SQLite four-table schema, strict models, immutable enquiry/report services, pure evaluator exist | Upgrade those boundaries, no rebuild |
| Routes | Caregiver creation/read public; bootstrap one pharmacy | Add identity/ownership and multi-pharmacy bootstrap |
| Security | Fixed token maps STAFF-DEMO to PHARM-A | Remove this mechanism from public runtime |
| Frontend | Production api.js/recovery.js implement deadlines, intent matching, generation guards | Extend with account/pharmacy scope |
| Manifest | React/Vite JavaScript; SQLAlchemy and asyncpg declared | Keep JS; choose a deliberate PostgreSQL driver path |
| Existing validation.md | Reports 56 backend tests,14 client tests and browser smoke | Prior reported evidence, not rerun for this expansion |
| Unknown | Provider accounts, costs/approval, deployment repository/domain, database connectivity, fresh remaining time | Verify at P00; no invented setup success |

Normal sandbox reads/writes failed during planning; an alternate execution path allowed current-file inspection. No existing .env secret values were printed. Planning does not require resetting the SQLite data or running the app.

## 3. Architecture and technology decisions

**Primary:** current React/Vite + FastAPI; **Clerk managed registration/login**; **Neon PostgreSQL** application storage; one HTTPS web service serving built UI and API.

~~~mermaid
flowchart LR
    B[Caregiver and staff browsers] --> A[Clerk registration and login]
    B -->|HTTPS bearer session| W[Hosted FastAPI plus React assets]
    W --> I[Verified identity and local user]
    I --> P[Ownership and pharmacy membership]
    P --> D[(Neon PostgreSQL)]
    W --> E[Existing evidence evaluator]
~~~

These remain modules in one backend. No browser-to-Neon access, model service, workers, websocket, Redis, microservices or pharmacy-per-database.

| Choice | Justification | Simpler alternative / downside |
|---|---|---|
| Managed Clerk UI + Python session verifier | Real signup/login/session handling without homemade password/reset code | Shared tokens do not satisfy confirmed requirement. Provider adds setup/network/cost dependence |
| Neon PostgreSQL | Hosted durable records independent of app filesystem; transactional concurrent writes | SQLite can serve several browser users behind one server; more users alone do not require Neon. Persistent hosted disk is a valid alternative; select Neon for this deployment |
| SQLAlchemy Core synchronous engine + psycopg3 | Reuse sync service/handler shape, explicit SQL and bounded pool; SQLAlchemy already declared | Direct psycopg suffices; async rewrite/ORM hierarchy adds no proven value. Add only needed psycopg[binary] dependency |
| One HTTPS origin | Bundled React/API minimizes integration/CORS surfaces | Separate hosts work but introduce extra configuration |
| App-owned membership table + operator CLI | Account registration must not self-grant staff authority | Editable frontend role/provider metadata insufficient; full organization/admin UI unnecessary |
| Active /api/v2 only | Auth/privacy/bootstrap/identity changes are breaking | Leaving public v1 routes active bypasses isolation |

Verify SDK imports/options for the selected locked version; do not invent method names. Current official docs use @clerk/react and clerk-backend-api. No second auth provider is added. Consolidating everything in Supabase is a different viable design, not a mid-implementation fallback.

Source facts: [Clerk React](https://clerk.com/docs/react/getting-started/quickstart), [Python integration](https://clerk.com/articles/how-to-add-authentication-to-a-python-backend), [session verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification); [Neon official connection guide](https://github.com/neondatabase/website/blob/main/content/docs/get-started/connect-neon.md); [SQLite concurrency guidance](https://www.sqlite.org/whentouse.html). These establish mechanisms, not this app's measured performance. Provider pricing/authorized spending remain unknown; do not buy resources without authorization.

## 4. Actors, memberships and access policy

Acceptance dataset: two pharmacies PHARM-A/PHARM-B, three shared exact products, separate per-pharmacy claims; two registered caregivers, two approved staff at A, one staff at B, one ordinary registrant without membership.

Every active user may create their own caregiver enquiries. Staff is an **additional pharmacy membership**, not a global role. Multiple memberships are allowed. No self-service owner/admin capability.

| Action | Anonymous | Active user | Active member staff |
|---|---|---|---|
| Provider signup/login | Allowed per provider configuration | Allowed | Allowed |
| App health | Minimal public result | Allowed | Allowed |
| /me and bootstrap | Denied | Allowed | Allowed |
| Create request | Denied | Server assigns self as owner | Allowed as own request |
| List own requests | Denied | Own only | Own only |
| Read other request | Denied | Denied | Only member pharmacy |
| Staff queue/report | Denied | Denied without membership | Target member pharmacy only |
| Create pharmacy/grant staff | Denied | Denied | Denied |

Authenticated but locally disabled user =>403. Invalid session =>401. Inaccessible individual enquiry =>404 without revealing existence. Nonmember requesting an explicit staff pharmacy collection =>403. Revoked staff may still access their personal caregiver requests if account active, but loses pharmacy authority.

A trusted deployment-operator CLI creates pharmacies and approves/revokes memberships for existing local UUIDs. Approval means intended demo assignment, not licensed professional validation. Client/signup metadata cannot grant membership. No public admin/reset endpoint.

## 5. Exact PostgreSQL data model

Use PostgreSQL only for upgraded runtime. Preserve old SQLite unchanged; no dual writes or automatic fallback.

| Table | Required columns/invariants |
|---|---|
| users | id UUID PK; auth_subject TEXT UNIQUE NOT NULL; active BOOLEAN default true; created_at TIMESTAMPTZ. No passwords/tokens/email required |
| pharmacies | id TEXT PK; name; active BOOLEAN; simulated BOOLEAN true |
| pharmacy_memberships | user_id UUID FK, pharmacy_id TEXT FK, role TEXT CHECK staff, active BOOLEAN, created_at TIMESTAMPTZ; composite PK(user_id,pharmacy_id) |
| products | Existing exact id/name/strength/form/unit |
| claims | Existing source/count/unit/times; pharmacy/product FKs; unique pair; integer nullable0–10000; UTC timestamp columns; simulated true |
| enquiries | id UUID PK; owner_user_id UUID NOT NULL FK users; pharmacy/product FKs; requested integer1–10000; unit; created_at; product_snapshot_json TEXT; claim_snapshot_json nullable TEXT |
| observations | enquiry_id UUID PK/FK; reported_by_user_id UUID FK; existing product/unit/kind/count/check-time/reason/basis/simulation; first submitted_at TIMESTAMPTZ |
| schema_migrations | Version key and applied_at; explicit deployment migration ledger |

Snapshot JSON stays validated TEXT to reuse current decoders; JSONB is unnecessary for current queries. v2 reporter UUID replaces fixed staff_id. Provider sub is opaque TEXT, never parsed as UUID or trusted role.

Indexes: owner/created_at DESC/id DESC; pharmacy/created_at/id; membership composite PK; unique claim/report constraints. Preserve explicit kind/null/basis coherence, strict counts and microseconds. PostgreSQL does not accept copied SQLite PRAGMA/typeof/BEGIN IMMEDIATE syntax. Never store independently mutable status/conclusion.

Verified provider session -> conflict-safe local user upsert by unique subject -> stable local UUID. Existing disabled user is not re-enabled by login. New user has zero memberships. Operator grants memberships only after genuine registration. Past observation attribution remains after revocation.

## 6. v2 contracts to freeze in P01

All paths below are relative to /api/v2. Preserve snake_case, exact catalog IDs, canonical enquiry UUIDs, timezone strings, whole-unit counts, required-nullable fields and existing conclusion/reason codes.

| Endpoint | Permission/input | Response |
|---|---|---|
| GET /health | Public/no body | Minimal ready/postgresql;503 on storage/schema failure |
| GET /me | Verified session | Local user_id and active memberships; no secrets/email required |
| GET /bootstrap | Verified session | pharmacies[] replacing singleton; products and per-pharmacy claims; no enquiries |
| GET /enquiries | Verified session; limit20 default/max100,offset0/max1000 | Own page {items,limit,offset,has_more}; newest first |
| PUT /enquiries/{id} | Verified session; existing exact pharmacy/product/quantity/unit request | Owner server-derived;201 first,200 same-owner replay,409 changed same-owner request,404 other owner's ID |
| GET /enquiries/{id} | Owner or active target-pharmacy staff | EnquiryViewV2;otherwise404 |
| GET /staff/enquiries | Membership; required pharmacy_id + page bounds | Pending-only scoped page;oldest first;403 nonmember |
| PUT /enquiries/{id}/observation | Target membership; existing observation request | Server reporter UUID;201 first,200 same-reporter identical replay,409 different reporter/body |

Page order breaks ties by ID; fetch limit+1 for has_more. Do not expose total counts of private records or fetch all records then filter in browser. Update client shape validators from arrays to page objects.

EnquiryViewV2 adds owner_user_id; ObservationV2 replaces staff_id with reported_by_user_id. Neither is accepted in client body. AuthenticatedPrincipal carries local UUID/verified subject internally; memberships are database-derived. Preserve ErrorResponse; add auth_unavailable503 and rate_limited429.

Example creation body remains:
~~~json
{"pharmacy_id":"PHARM-B","product_id":"MED-A","requested_quantity":6,"unit":"tablet"}
~~~

P01 must generate exact full Pydantic schemas and JSON mocks, not patch-only responses. Fixtures: own/cross-owner, staff A/B/multi-membership/revoked, expired/forged token, auth/Neon unavailable, same reporter replay, different reporter identical count conflict, empty/paginated queue. Test-only verifier cannot be enabled via a public-runtime bypass setting.

No legacy public v1 endpoints mounted in hosted app. Preserve old baseline in source/snapshot, not an exposed compatibility route.


## 7. Managed-auth integration and session rules

Use Clerk prebuilt signup/signin plus official Python verification adapter. Configure actual registration/email-verification flow and test delivery before public signup. Do not infer verified email from client metadata or merely unchecked JWT decoding. Neon stores no passwords or refresh tokens.

Backend verifies trusted issuer/key/algorithm, signature, expiration/not-before, expected session-token type, and authorized application origins. Validate audience when configured/required by chosen provider session configuration; do not invent an audience or skip checks to accept a token. Use current SDK-supported key/JWKS behavior with bounded acquisition and fail closed. Credential invalid401; required verification material unavailable503/auth_unavailable. Cached keys do not bypass expiry. If choosing a pinned public key, document rotation; never accept an unknown key.

React obtains a current session token through SDK for each API action. No custom token store or provider-refresh implementation. SDK credential refresh does not authorize automatic replay of uncertain mutations. After reauthentication, inspect frozen intent before deliberate same-address/body retry.

Local disabled account/membership checks happen on each protected action. Provider registration never grants pharmacy authority. No claim of instant remote-session revocation solely from offline JWT validation; local account disabling controls application access.

Logout/account switch clears previous views, queue, pending reads and custom recovery data. Recovery keys include v2 and local user UUID. Never keep custom provider/staff tokens in sessionStorage. Former account's request cannot reappear under another account.

## 8. Database concurrency and replay algorithms

Keep synchronous handlers and one bounded SQLAlchemy Core pool. Starting demo settings: pool_size5,max_overflow0,pool_timeout2s,pool_pre_ping true. Measure before tuning; these numbers are not a capacity claim. [SQLAlchemy pooling](https://docs.sqlalchemy.org/en/20/core/pooling.html).

Use console-provided Neon TLS URI without printing it. Direct connection with this small bounded pool is sufficient; pooled Neon URI also works after validating selected driver/session behavior. Do not assume transaction-pooled session settings persist. Use transaction-local lock_timeout2s and statement_timeout5s. Proposed hosted client deadlines: GET8s,mutation12s; freeze in contracts. Timeout is not server cancellation.

### Creation

1. Verify session and active local user.
2. In transaction guard active user state. Validate target active pharmacy and exact product/unit for new request.
3. UUID remains globally unique. INSERT ON CONFLICT DO NOTHING then authorized lookup handles races: same-owner/same-body replay; same-owner changed409; other owner's ID404 without saved fields.
4. Preserve first creation time/product/claim snapshots. An ownerless SQLite record is not a v2 request.
5. Commit before success; response-building/connection failure after commit still requires inspection.

### Observation

1. Verify token outside transaction. Inside transaction check active user/membership/pharmacy and lock relevant rows in consistent order: user,membership,pharmacy,enquiry.
2. Lock existing enquiry FOR UPDATE; parent is serialization point before first observation. Observation PK adds invariant.
3. Existing report: only normalized identical body **and same reported_by_user_id** replays200. Another reporter, even identical quantity/time, gets409. Keep original actor/time.
4. First report: validate exact product/unit, future-time boundary, derive actor/basis and insert once. No auth-provider network calls under DB locks.
5. Membership/pharmacy revocation uses compatible locks. An already locked/authorized report may finish before revocation commits; later actions denied. Do not promise cancelling in-flight work.

PostgreSQL row locks support this mechanism ([locking docs](https://www.postgresql.org/docs/current/explicit-locking.html)). Avoid app-global write mutex; different pharmacy enquiries should not serialize globally. Lock/network/pool availability failures503, immutable conflicts409; no silent retry on unknown commit.

A stock check never decrements or reserves quantity. Multiple caregivers requesting the same medicine do not establish allocation; every answer remains at its observation time. Do not smuggle reservations into concurrency support.

## 9. Migration and public deployment

Start a fresh versioned PostgreSQL schema using synthetic seeds. Existing SQLite enquiries lack owners: preserve them locally, do not assign to first registered account or publish them. Explicit verified operator-owned import can be a later separate task; not required here.

Run explicit migration/seed with management credentials; runtime role has only application DML permissions, not blanket DDL. Startup checks schema/readiness rather than automatic destructive upgrade. Never use production DATABASE_URL as implicit TEST_DATABASE_URL. Tests use dedicated isolated PostgreSQL target; no reset/wipe API or dual-write fallback.

Reference hosting: one HTTPS Render web service serving React build and FastAPI. Hosted start binds0.0.0.0 at platform PORT, initially one worker. [Render FastAPI guide](https://render.com/docs/deploy-fastapi). Verify mixed Node/Python build availability; do not assume a Python host has usable Node. Use one deterministic multi-stage Docker image only if native mixed build unavailable; not multiple new services.

Configuration:

- Backend secrets: DATABASE_URL and provider verification/backend key if required by selected SDK. PUBLIC_APP_ORIGIN exact, v2 prefix, resolved static path, rate-limit settings.
- Frontend: documented provider publishable identifier only; same-origin /api/v2. No database/provider secret in VITE variables.
- Provider: real allowed HTTPS domain/redirects/origins and matching environment/issuer mode; verification flow exercised.
- Database: runtime/management/test identities distinct; schema version verified; source timestamps/snapshots not regenerated per deploy.

Region/cost/quota/domain/repository access are unknown until P00. Place app and DB near each other when practical; no precise latency promise. Render free services idle-spin down after15 minutes ([free-tier documentation](https://render.com/docs/free)); verify actual chosen tier/warmup before demo. Do not buy an always-on plan without authorized spending.

Public version depends on auth/Neon/host networks; it cannot claim baseline offline reliability. Test outage behavior and preserve local baseline as separately disclosed fallback demonstration.

## 10. Serial modules and budget

| Module | Minutes | Cumulative | Gate |
|---|---:|---:|---|
| P00 provider/environment feasibility |25|25|Access,domain,build and preserved baseline known|
| P01 v2 contract/model/mock freeze |40|65|Exact shapes and permissions before functional code|
| P02 PostgreSQL schema/connection |35|100|Versioned constrained storage and test isolation|
| P03 auth/local identity |50|150|Real registration and verified principal|
| P04 membership/ownership |40|190|Server-enforced user/pharmacy isolation|
| P05 PostgreSQL workflow |60|250|Immutable transactions/replay/concurrency|
| P06 authenticated multi-pharmacy UI |60|310|Two-account real golden paths|
| P07 account-scoped recovery |45|355|No cross-user stale state or auto replay|
| P08 bounded public surface |35|390|Errors,limits,secrets,legacy route isolation|
| P09 deployed provider/domain integration |40|430|Working HTTPS URL using real providers|
| P10 regression/negative/browser checks |90|520|Verified permissions and public workflow|
| P11 runbook/rehearsal/handoff |40|560|Repeatable honest demo|

560-minute work +100 contingency =660-minute nominal budget. Provider waits/migration defects can exceed it. Execute sequentially; do not declare later gates passed merely because code was written early.

Six-hour constrained route: require providers/host already usable; reuse evaluator/client safeguards, managed auth UI and operator CLI. Cut optional styling/profile/admin/import work (already excluded). If mandatory identity/isolation/deployment testing cannot finish, report partial expansion and retain local demo; do not relabel shared tokens as real registration.

## 11. Detailed modules P00–P05

### P00 — feasibility and baseline

**Depends:** none. **Allowed:** source inspection/status notes; no reset.

1. Read current code, original tasks plan/contracts/validation; inspect instructions; verify current test/build commands.
2. Check available time, authorized provider/hosting access, cost constraints, deployment repository, HTTPS domain/mode, mixed build support and Neon connectivity.
3. Test provider signup/email verification with actual mailbox; document actual SDK version/imports. Do not invent email delivery or account/domain access.
4. Preserve source/build/SQLite through safe snapshot/commit if Git exists. No reset of others' changes, no assumption repository exists.
5. Confirm primary provider setup; record blocker before switching architectures. Do not configure competing auth products.

**Acceptance:** required external configuration is known/demonstrated or named as unavailable; no claimed integration based on placeholders. If unavailable, complete independent contract work but do not implement a bypass to pass public gates.

### P01 — contracts before implementation

**Depends:** P00. **Files:** docs/api_contracts_v2.md, exact v2 fixture/model blueprint.

1. Expand Section6 into full producer/consumer/interfaces with exact Pydantic/JSON models, enums/nulls, principal/reporter IDs, page bounds/error and hosted deadlines.
2. Freeze current user versus pharmacy membership, hidden individual404 and collection403, same-reporter replay, owner collision semantics.
3. Generate complete fixtures for two users/pharmacies, competing staff, revocation, token failure and network failure. No placeholder partial view bodies.
4. Verify all payloads via models; preserve strict quantity/time/null behavior. Test-verifier override only constructed in test app, no production environment flag.
5. Track contract changes explicitly; old v1 wire expectations are not compatibility requirements in hosted version.

**Acceptance:** every UI/backend boundary has exact expected shape/permission/failure. No functional v2 route/UI/storage implementation until this gate.

**Exclude:** mock auth server, custom password/token schema, generated client project.

### P02 — PostgreSQL schema and seed

**Depends:** P01. **Files:** database/config/dependency manifests, migrations/001_multi_user.sql, seed maintenance script/tests.

1. Add chosen compatible psycopg3 dependency; create one sync SQLAlchemy Core engine/pool/context-managed connection.
2. Explicit schema/migration ledger from Section5. Replace SQLite-specific checks with proper PG constraints; preserve timestamps/microseconds.
3. Seed A/B catalog/claims repeatably, no guessed user UUIDs or default memberships. Existing enquiries/reports never replaced by startup.
4. Readiness validates schema/version/connectivity; no DDL per request or memory fallback; no secrets logged.
5. Dedicated TEST_DATABASE_URL with isolated test schema/database; validate test-owned identifier before cleanup. Never silently use public app URL.

**Acceptance:** actual PG rows/types/constraints work; no leak of connections; baseline file intact. URI configured is not connectivity verified.

**Exclude:** JSONB refactor, ORM entity hierarchy, dual writes, automatic import of anonymous old records.

### P03 — real auth and local identity

**Depends:** P02. **Files:** frontend auth wrapper/main, backend core/auth.py and users mapping, env examples/auth tests.

1. Add current Clerk managed signup/signin UI to existing React; no project recreation/password store.
2. Implement supported Python session verifier with issuer/signature/time/type/origin requirements. No unchecked sub/body identity accepted.
3. Conflict-safe user mapping by opaque provider subject; stable local UUID; inactive remains inactive; new memberships empty.
4. Implement /me and authenticated app bootstrap. Remove shared DEMO_STAFF_TOKEN requirement/fallback from hosted runtime.
5. Exercise real provider signup/verification/login/logout and two accounts; test expired/forged/wrong-issuer sessions and unavailable verification material.

**Acceptance:** two genuine registered sessions -> different stable users; nobody becomes staff by registering. Unit fake-token tests plus real provider smoke.

**Exclude:** homemade JWT signing/reset/refresh, automatic privileged signup metadata, two identity providers.

### P04 — membership and ownership policy

**Depends:** P03. **Files:** authorization helper/operator membership script/services/tests.

1. Trusted CLI creates/deactivates demo pharmacies and grants/revokes active staff membership to existing user UUID; validates role/user/pharmacy.
2. Implement active-user checks, own/member scoped reads, own lists, explicit pharmacy queue/report checks.
3. Pass principal through every enquiry service; server assigns owner. No hardcoded PHARM-A authorization/claim selection.
4. Query membership currently from DB; do not use frontend/provider role metadata as authority. SQL scopes ownership/pharmacy before returning rows.
5. Implement limit+1 paged own list/newest and queue/oldest; validate filter bounds and tie-break IDs.

**Acceptance:** A/B caregiver IDs cannot read/replay each other's records; wrong pharmacy staff deny; approved multiple memberships usable; revoked deny. Direct APIs tested, not only UI hiding.

**Exclude:** public admin endpoint, owner dashboard, invitation/organization UI, automatic professional verification.

### P05 — transaction-backed PG workflow

**Depends:** P04. **Files:** enquiries repository/service, evidence integration, PG repository/API tests.

1. Port actual create/read/report logic to PG transactions; preserve source snapshots/count/unit/time semantics.
2. Global ID collision cannot transfer owner or expose other user's evidence; repeat requests retain first snapshot/time.
3. Lock parent enquiry; validate user/membership/pharmacy; same actor identical replay200,other actor/body409; first report insert/commit.
4. Consistent revocation/report lock order, bounded timeouts, no provider calls while DB locks held.
5. Keep pure evaluator outcomes; v2 owner/reporter metadata does not add clinical/current-stock guarantees.
6. Concurrent actual PG connections: identical same staff =>201/200; differing staff/body =>one winner/409; different enquiries do not use global app mutex.

**Acceptance:** real request6/record12/check4 ->insufficient/-8; positive/unresolved/null branches remain; connection/concurrency invariants verified. SQLite tests are not PG transaction proof.

**Exclude:** reservation/allocation, overwrite/correction, async rewrite merely for fashion.


## 12. Detailed modules P06–P11

### P06 — multi-account multi-pharmacy UI

**Depends:** P05. **Files:** App, small actor components, auth wrapper, API client, minimal styles.

1. Signed-out users see managed signup/login. Signed-in app loads /me and bootstrap; no token text or old shared staff credential field.
2. Caregiver selects exact pharmacy/product/amount. Pharmacy change resets incompatible claim/request inputs; MED-A claim at A never substituted for B.
3. Staff chooses only current approved memberships, requests queue with explicit pharmacy_id, selects UUID and reports from immutable target request.
4. Own request history is a bounded page; update client success-shape checks for v2 bootstrap/page/user/report IDs.
5. Every data action obtains current SDK bearer session. Server still rejects manipulated UI requests.
6. Preserve exact source/check times, simulation, discrepancy/limits and sufficient/insufficient/unresolved results.

**Acceptance:** independently signed-in caregivers create A/B enquiries; scoped staff reports and owners refresh correct saved evidence. Two tabs sharing the same login are not two-account validation.

**Exclude:** maps, fuzzy search, component library, organization management, general inventory dashboard.

### P07 — account-bound recovery and stale reads

**Depends:** P06. **Files:** shipped api.js/recovery.js, actor state cleanup, actual-client transport tests.

1. Frozen intent stores v2/current local user UUID/enquiry ID/exact body; custom sessionStorage key is user-scoped. No bearer/session tokens stored by app.
2. Logout/account switch invalidates all prior reads and clears views/queue/intents. Account change takes precedence over preserving old last-loaded data.
3. Generation guards include current account, pharmacy and request; response for old selection/account cannot replace current view.
4. Lost report response inspects same authorized enquiry; compare immutable fields **and reporter UUID**. Another staff's matching count is not this user's successful submission.
5. Reauthentication/SDK refresh does not cause app auto-PUT. Inspect prior intent then allow deliberate identical same-address retry.
6. Read failure labels last-loaded evidence; auth loss hides private old state. Auth unavailable, rate limit, Neon timeout, validation and409 remain distinct errors.
7. No live failure changes transport into mocks. Pending/404 can race a delayed write, so neither proves rollback.

**Acceptance:** account A data cannot appear under B; actual committed/lost response recoverable by A without second automatic PUT; rejected/lost session doesn't submit duplicate intent.

**Exclude:** offline queue/service worker, global caching, optimistic authoritative answers, custom token persistence.

### P08 — bounded public surface

**Depends:** P07. **Files:** middleware/errors/config, public startup/settings, targeted tests.

1. V2 JSON ErrorResponse/no-store applied to validation/auth/domain/framework failures. No password/token/request payload dumps in logs.
2. Set body ceiling16KiB and list bounds. Starting single-worker limiter:30 mutations/min/user,120 API calls/min/user;429/Retry-After. Document settings as unmeasured demo policy.
3. Limiter has bounded entries/TTL; one-worker restart resets counters. No distributed-abuse-proof claim. Registration abuse handled with provider settings.
4. Limit failed unauthenticated calls with proxy-aware trusted client identity; do not trust caller's arbitrary X-Forwarded-For. Edge/proxy configuration must be verified.
5. Exact allowed origin/provider redirects; no permissive wildcard identity policy. CORS is not access control.
6. Retain constrained static paths; unknown API returns JSON404. Hosted app does not mount legacy v1/shared token/reset/debug data routes.
7. App pool is created once per lifespan and disposed on teardown; no connections carried into unrelated threads/processes or network work under locks.

**Acceptance:** direct HTTP can't bypass membership/ownership; oversized/rate-limited requests truthful; secrets absent from public artifacts/logs.

**Exclude:** Redis, distributed rate limiter, multi-worker tuning, enterprise security checklist unrelated to demonstrated scope.

### P09 — real HTTPS deployment/provider domain

**Depends:** P08. **Files:** deploy manifest/scripts, env examples, README; optional one Dockerfile only if mixed native build unavailable.

1. Reproducible frontend/Python build with locked dependencies. Use existing app.main:app, not backend/main.py greeting entry point.
2. Explicit migration/seed using management role, runtime separate role. One worker at platform PORT; built UI required.
3. Set actual public HTTPS origin in app/provider; dev/prod key/issuer modes match. No assumed paid-domain entitlement or localhost-only redirect in live setup.
4. Verify TLS health/register/verification/login/me/assets/protected request/report/read. Anonymous enquiries denied; no direct browser DB URI.
5. Restart/redeploy retains Neon records; no startup wipe. Measure warm/cold startup with chosen service tier.
6. Don't provision purchased resources or send invitations/messages merely because this plan describes them; this task requested planning.

**Acceptance:** live URL works from independent browser/device with actual auth/provider/DB. Environment variables or local TestClient don't prove deployment.

### P10 — negative paths, regression and public-browser evidence

**Depends:** P09. **Files:** PG test fixtures/suites, actual-client tests, browser checks, docs/multi_user_validation.md; confirmed fixes only.

Required evidence:

| Case | Result/invariant | Verification |
|---|---|---|
| Two caregivers | Different stable accounts; own requests only; cross-owner GET/replay404 | API plus real browser |
| Staff A/B | Queue/read/report limited to current membership pharmacy | API plus real browser |
| Multi-membership | Explicit chosen pharmacy; no global staff authority | API/UI |
| Revoked/disabled | Current permissions enforced; disabled403; inaccessible record404 | Transaction/API tests |
| Signup role spoof | Metadata/body owner/reporter can't grant identity/authority | Auth/API negative tests |
| Evidence | Request6/record12/check4 ->insufficient/-8;positive/equal/zero/null-time/unable cases preserved | Evaluator/API; key browser cases |
| Replay/races | Same reporter identical200;other reporter or changed body409;immutable winner | Real PG concurrent connections |
| Revocation race | Consistent lock order; already-authorized write may finish before revocation, future denied | PG transaction test |
| Timestamp | Offset-equivalent replay;microseconds;naive/epoch/future rejected | Models/API/repository |
| Missing/old claim | No fabricated count or new current-stock certainty | Evaluator/browser rendering |
| Storage/auth outage |503 unavailable,unknown save honest;no memory/mock fallback | Fault tests/client |
| Account switch |No stale private data,intent or queue under new identity | Production recovery helpers/browser |
| Commit/lost reply |Inspect same owned ID settles save;no automatic resubmit | Controlled transport plus browser |
| Paging |Scope/order/limit/offset/has_more and empty-success distinguish errors | API/client shapes |
| Public deployment |Actual signup/login/provider email verification and full HTTPS workflow | Real provider/live browser |
| Restart |Hosted process restart retains evidence;no schema/reset surprise | Actual deployed check |

Do not silently substitute SQLite for missing TEST_DATABASE_URL; report PG tests unavailable. Do not point tests at public app DB. Preserve independent temporary test targets and controlled provider verifier fixtures; actual auth smoke remains required.

Test the **shipped** client/recovery helpers, not copies. Existing reported test totals don't predict v2 coverage. Browser evidence uses actual signed-in profiles, not a mocked session label. Include expired/forged token, wrong issuer/origin, auth verification failure and attempted private UUID fetch.

Record actual commands/results, provider/deployed checks performed, failures/unperformed checks and implemented-versus-synthetic boundaries. No invented signup, email delivery, measured capacity or caregiver improvement. No broad repeated test run once necessary checks pass unless changes/new risks warrant it.

**Acceptance:** all required permission/concurrency tests plus actual public golden path pass; known verification limits explicit. Failing ownership/membership gate blocks complete public-demo claim.

### P11 — runbook, rehearsal and handoff

**Depends:** P10. **Files:** docs/multi_user_demo_runbook.md, validation/status docs.

1. Record live URL, build revision, migration version, provider mode, verified start/deploy commands and operator membership procedures; no secrets.
2. Dedicated registered accounts for demonstrations; new public registrants are caregivers unless separately operator-approved. Do not expose admin/staff shared credentials.
3. Rehearse two caregivers/two pharmacies/isolated staff queues, mismatch/positive-or-unknown branch, denied cross-account request, and recovery.
4. <=4-minute presentation; clearly distinguish real identity/hosted persistence from synthetic pharmacies/checks and unverified physical/user benefit.
5. Record disabling/revoking procedure, host/DB/auth outages, and separate preserved local fallback. Local fallback is a different mode, not fabricated live success.

**Acceptance:** another coding agent/presenter can reproduce/support the deployment without unstated services, automatic privilege grants or token-bearing logs.

## 13. File boundaries and function responsibilities

Extend existing app/core/config.py,database.py,errors.py; models/schemas.py; api/routes.py; services/enquiries.py,evidence.py; app/main.py. Replace/retire fixed-token core/security.py in hosted runtime. Add small core/auth.py and authorization.py only as readability requires.

New planned artifacts: docs/api_contracts_v2.md; migrations/001_multi_user.sql; controlled seed/membership CLI; v2 fixtures/tests; frontend auth wrapper; deployment manifest; validation/runbook. Reuse current recovery.js/read guards and actual-client tests. No general ORM/entity framework, provider adapter zoo or two-dialect write repository.

~~~text
verify_session(request) -> VerifiedIdentity
get_or_create_local_user(identity, connection) -> AuthenticatedPrincipal
require_staff_membership(principal, pharmacy_id, connection) -> Membership
create_enquiry(engine, id, request, principal, clock) -> write result
read_enquiry(engine, id, principal) -> authorized saved evidence
list_own_enquiries(engine, principal, page) -> Page[EnquiryViewV2]
list_pending(engine, principal, pharmacy_id, page) -> Page[EnquiryViewV2]
accept_observation(engine, id, request, principal, clock) -> write result
~~~

Authentication answers who; authorization decides access; evaluator compares evidence. Provider subject/current local account/member state cannot be supplied by client. Clock injection remains a small deterministic-test helper. Source snapshots and report inputs are immutable.

Per-module handoff:
~~~text
Module/status:
Actual minutes/total elapsed:
Files changed:
Contract changes and reason:
Behaviors implemented:
Checks actually run/results:
Checks unperformed:
Known blockers/limits:
Exact next action:
~~~

Execute P00–P11 serially. No added developers/subagents assumed. Independent contracts/mocks let UI/backend work remain separable, not create extra developer time. Do not mark future modules complete merely because code landed.

## 14. Exclusions, reduction order, and release blockers

Excluded: self-service pharmacy ownership/registration, public admin/invitations/dashboard, custom password/reset/MFA, billing, account profile editor, full imports of old anonymous enquiries, real patient records/prescriptions, stock reservations/decrements, mutable corrections, AI/search/model service, SMS/notifications, websocket, multi-region/sharding, Redis.

Reduction order: styling -> optional account profile -> optional general imports -> organization/admin UI -> provider-independent abstraction. Core managed signup/login, ownership/membership, immutable transactions, honest uncertainty and deployed tests are not optional.

Public release blocked if:

- Anonymous/other account can read someone else's requests or submit staff evidence.
- Signup metadata/role dropdown can grant pharmacy rights.
- Wrong pharmacy queue/report accessible without approved membership.
- Other reporter/changed payload overwrites or falsely claims original evidence.
- Old v1 public route/shared staff token still exposed.
- Credentials in frontend/logs, or tests operate on deployed database.
- Actual registration/login/domain issuance is untested and only seeded tokens work.

These are consequences of the confirmed public multi-account requirement, not enterprise-scale extras. If provider/authorization gates cannot finish within actual remaining time, retain tested local baseline and report expansion partial. Do not call shared tokens real accounts or switch off isolation to make the demo appear complete.

## 15. Verification limits of this planning artifact

This plan was based on current source and official provider/database/hosting documentation. No auth project, Neon project, purchase, migration, or public deployment was performed. Prior validation report was read, not rerun. Exact v2 contracts are deliberately the first implementation deliverable; no coding agent may invent them while building downstream components.

