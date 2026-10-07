# Integration Contracts — Availability Verification MVP

Contract version: **v1**. Status: design/fixture specification before implementation, not a running API. Inputs: [architecture](architecture.md), [MVP](mvp.md), and [proposition](proposition.md). Budget: six hours, **one developer, Pantha Protick**. Frontend/backend “teams” below are logical work boundaries; no extra people or model team are assumed.

This document is the detailed integration source of truth. Preserve the architecture's six routes, immutable evidence, local staff role, deterministic answers, and explicit refresh. There is **no model endpoint/event**. Adding a mock model would introduce an unnecessary boundary.

Contract refinements: timestamps must be JSON strings, not numeric epochs; simulated flags must be literal JSON `true`, not integer `1`; canonical enquiry UUIDs are checked before parsing. Storage that fails the exact model, including its cross-field validators, cannot produce a valid evidence view: return `internal_error`, rather than fabricating fields for an unresolved view. Schema-valid but semantically contradictory evidence yields `evidence_conflict`. Framework method/media-type errors also use the standard error envelope.

## 1. Shared standards

| Item | Standard |
|---|---|
| Base path/protocol | Relative `/api/v1`; HTTP JSON on loopback. Development proxy preserves this path; built demo uses one origin. No sockets, events, or background acknowledgements |
| Headers | API requests `Accept: application/json`; PUT additionally `Content-Type: application/json`; staff routes additionally `Authorization: Bearer <demo-staff-token>`. Successful/error API responses `Content-Type: application/json`, `Cache-Control: no-store` |
| Catalog IDs | Case-sensitive strings matching `^[A-Z][A-Z0-9-]{0,63}$`; fixture pharmacy `PHARM-A`, products `MED-A`/`MED-B`/`MED-C`, claim `CLAIM-A`, server staff `STAFF-DEMO`. Valid syntax does not establish catalog existence |
| Enquiry IDs | Canonical lowercase UUID string, `8-4-4-4-12` hex characters. Browser creates UUID once per request intent. Fixtures use version-4-shaped UUIDs. Reject uppercase, whitespace, shortened or brace-wrapped forms; do not silently normalize aliases |
| Observation identity | One report per enquiry; addressed by enquiry ID, no separate observation ID or revision number |
| Naming | JSON/Python fields snake_case, paths plural lowercase, enum values lowercase snake_case. JS functions camelCase. No `medicineId`/`product_id` aliases |
| Timestamp input | ISO 8601 string `YYYY-MM-DDTHH:mm:ss[.ffffff]Z` or explicit `±HH:mm` offset. Seconds required; optional fraction 1–6 digits. Calendar validity/timezone required. No epoch numbers, date-only strings, naive datetimes, empty strings, or more than microsecond precision |
| Timestamp output/storage | UTC `Z`, same grammar, optional microseconds. Normalize offset inputs before replay comparison. Browser may display Asia/Dhaka but includes timezone; never attach a timezone to an unknown time |
| Time ownership | `recorded_at`: source record time; `loaded_at`: fixture ingestion; `observed_at`: reported check time; `submitted_at`: first accepted server report time; `created_at`: first accepted server enquiry time; `served_at`: view construction time. They are not interchangeable |
| Units | `tablet`, `capsule`, singular codes; whole count of the product's canonical unit. No packs, strips, doses, conversions, inferred equivalents, or concentration calculations. Strength is an opaque display string such as `10 mg`, not a conversion input |
| Quantities | JSON integer, strict: requests 1–10,000; claim/report 0–10,000; discrepancy -10,000–10,000. Reject booleans, strings, fractions including JSON `6.0`, negatives where disallowed, non-finite numbers. The maximum is a defensive demo bound |
| Presence/null | Every schema field is required unless explicitly marked optional; **nullable is not optional**. Missing nullable field is 422. Null means unknown/no corresponding evidence; zero is a measured/reported count; `[]` means no items. Empty string is not unknown |
| Extra fields | Reject unexpected object fields. No frontend-supplied answer, status, staff ID, timestamps owned by server, or `simulated:false` |
| Text | Strict string, 1–500 characters; identity labels/source/messages. Render as text, never unsanitized HTML. No freeform clinical advice input |
| Simulation | Every evidence/product-envelope `simulated` field is literal JSON `true`. Do not use this field to indicate transport mock mode: both live local API and mocked data are synthetic |
| Versioning | `/api/v1` plus this shared document. Any field/enum/semantic change updates fixtures and both consumers together; no runtime negotiation/code-generation project |

Optional transport header: `Authorization` on public routes is ignored; on staff routes it is required. No client clock, confidence score, correlation ID, pagination, query filters, or idempotency header is required. Log method/path/enquiry ID without credentials.

### Enum dictionary

| Field | Exact values | Meaning |
|---|---|---|
| `unit` | `tablet`, `capsule` | Canonical whole-item count |
| `kind` | `checked`, `unable_to_check` | Count reported versus check explicitly not completed |
| `status` | `pending`, `answered`, `unresolved` | No report; conclusive accepted report; accepted inconclusive evidence |
| `conclusion` | `sufficient`, `insufficient`, `unresolved` | Meets request at reported time; below request at reported time; required evidence not established |
| `reason` | `awaiting_check`, `checked_meets_request`, `checked_below_request`, `cannot_check`, `observation_time_unknown`, `evidence_conflict` | Machine-readable explanation; UI uses these values, not string parsing of message |
| `unresolved_reason` | `cannot_check` or null | Required field in a report; nonnull only when kind is unable-to-check |
| `basis` | `staff_reported_obtainable_count`, `unable_to_check` | Backend-generated reporting basis, not proof of physical truth |
| health `status` / `storage` | `ready` / `sqlite` | Actual storage readiness, not configured-service badges |

## 2. Schema dictionary: types, units, presence

All rows are **required**; “nullable” explicitly allows null. These tables and the exact Pydantic blueprint below define the same contract.

| Schema | Fields: type and meaning |
|---|---|
| `Pharmacy` | `id: CatalogId`; `name: Text` |
| `Product` | `id: CatalogId`; `name: Text`; `strength: Text` opaque identity detail; `form: Text` display detail; `unit: Unit` |
| `Claim` | `id`, `pharmacy_id`, `product_id: CatalogId`; `quantity: ObservedQty nullable`; `unit: Unit`; `recorded_at: Timestamp nullable`; `loaded_at: Timestamp`; `source: Text`; `simulated: true` |
| `BootstrapResponse` | `pharmacy: Pharmacy`; `products: Product[]`; `claims: Claim[]`; `simulated: true`. No claim for a product is allowed; not a zero claim |
| `CreateEnquiryRequest` | `pharmacy_id`, `product_id: CatalogId`; `requested_quantity: RequestedQty` in `unit`; `unit: Unit` |
| `ObservationRequest` | `product_id: CatalogId`; `unit: Unit`; `kind: ReportKind`; `obtainable_quantity: ObservedQty nullable`; `observed_at: Timestamp nullable`; `unresolved_reason: cannot_check nullable` |
| `Observation` | All `ObservationRequest` fields plus `staff_id: CatalogId`; `submitted_at: Timestamp`; `basis: Basis`; `simulated: true`. Attribution/time/basis assigned by backend |
| `EnquiryRecord` (internal) | `id: EnquiryId`; `pharmacy_id: CatalogId`; `product: Product` snapshot; `requested_quantity: RequestedQty`; `unit: Unit`; `created_at: Timestamp`; `claim: Claim nullable` snapshot; `simulated: true` |
| `Answer` | `conclusion: Conclusion`; `reason: Reason`; `discrepancy_units: SignedQty nullable` in enquiry unit; `message: Text`; `limitations: Text[]` |
| `EnquiryView` | All `EnquiryRecord` fields plus `served_at: Timestamp`; `observation: Observation nullable`; `status: Status`; `answer: Answer` |
| `EvaluationInput` (internal) | `enquiry: EnquiryRecord`; `observation: Observation nullable`. Validated records only; semantic identity/conflict checks belong to evaluator |
| `EvaluationResult` (internal) | `status: Status`; `answer: Answer` |
| `StaffPrincipal` (internal) | `staff_id`, `pharmacy_id: CatalogId`; `simulated: true` |
| `RepositoryWriteResult` (internal) | `created: strict boolean` first insert versus identical replay; `enquiry: EnquiryRecord`; `observation: Observation nullable`. Commit completed before returning |
| `HealthResponse` | `status: ready`; `storage: sqlite` |
| `ErrorResponse` | `error: ErrorDetail` |
| `ErrorDetail` | `code: ErrorCode`; `message: Text`; `fields: Text[]` (empty permitted). Field paths such as `requested_quantity`, `id`, `observed_at`, `body`, `method` |

### Cross-field rules

1. Create request must reference known pharmacy/product and exact canonical unit. Product name/strength/form are not supplied by client; backend snapshots catalog identity.
2. Report product/unit must match the immutable enquiry; pharmacy permission comes from principal. Rejection leaves enquiry pending, not an accepted unresolved report.
3. `kind:checked` requires integer `obtainable_quantity`, null `unresolved_reason`, and timestamp or null `observed_at`. `kind:unable_to_check` requires null quantity/time and `unresolved_reason:cannot_check`.
4. Future reported time (> server validation instant) is 422. Unknown time is a valid inconclusive report, not an invented present time. Historical checks can be accepted; conclusions refer to observation time and do not establish current stock.
5. If no report: pending/unresolved/awaiting_check. Unable report: unresolved/unresolved/cannot_check. Checked unknown time: unresolved/unresolved/observation_time_unknown. Otherwise count >= request: answered/sufficient/checked_meets_request; count < request: answered/insufficient/checked_below_request.
6. Contradictory identity/time linkage in schema-valid saved evidence: unresolved/unresolved/evidence_conflict. Report time later than its server submission time is a conflict. Ordinary claim/count discrepancy is not that conflict. Basis/kind mismatch fails the `Observation.matching_basis` model validator; unreadable or cross-field-invalid stored models return500/internal_error rather than a fabricated valid observation.
7. Conclusive compatible observed/recorded counts produce `discrepancy_units = observed - recorded`. Missing claim/count, incompatible claim identity/unit, or unresolved result → null discrepancy. Unknown recorded time alone does not change the count arithmetic; show missing time visibly.
8. Missing/incompatible claim does not invalidate an otherwise exact checked report. Incompatible claim is not used for quantity comparison; display its limitations. Invalid check/enquiry linkage prevents a conclusion.
9. Original request/snapshots and accepted report are immutable. Stored status/result is not an independent source of truth; derive from stored evidence on each view.
10. UI must show time, simulation, evidence basis, discrepancy when meaningful, and limits. `sufficient` must never be labeled “available now,” “reserved,” or clinically suitable.

## 3. HTTP boundaries

Each response travels backend → the initiating frontend consumer. Each request travels the named frontend producer → backend. All schemas use Section 2 types/units/null rules. JSON mock examples are fully expanded in Section 8; request/response envelopes there are fixture metadata, **not extra fields sent on the wire**.

### B01 — readiness

| Contract item | Specification |
|---|---|
| Producer → Consumer | Browser API client → FastAPI readiness handler → SQLite read check |
| Protocol / endpoint | HTTP `GET /api/v1/health`; no event |
| Request schema | No body/query fields |
| Response schema | 200 `HealthResponse` |
| Data types / units | Two string literals; no units |
| Required/optional | Required response fields `status`, `storage`; no auth required |
| Error response | 503 `storage_unavailable`, unexpected 500 `internal_error` |
| Timeout behavior | 3-second browser deadline; offline/unreachable not healthy. Does not establish write readiness forever |
| Example payload | `{"status":"ready","storage":"sqlite"}`; exact mock `health` |

### B02 — catalog and recorded evidence

| Contract item | Specification |
|---|---|
| Producer → Consumer | Caregiver/staff browser → bootstrap handler → local catalog/claims repository |
| Protocol / endpoint | HTTP `GET /api/v1/bootstrap` |
| Request schema | No body/query |
| Response schema | 200 `BootstrapResponse`; products ordered by ID, claims ordered by ID |
| Data types / units | Catalog strings, product arrays, nullable integer recorded counts in product units, timestamps, true simulation flag |
| Required/optional | Every field required; claim quantity/time nullable. Empty claims allowed; no auth |
| Error response | 503 storage failure, 500 invalid stored fixture/internal error |
| Timeout behavior | 3-second browser deadline; show load error, do not fabricate empty catalog or zero stock |
| Example payload | Complete `bootstrap` fixture; MED-A record 12 tablets, no claim for MED-B/C |

### B03 — immutable enquiry creation

| Contract item | Specification |
|---|---|
| Producer → Consumer | Caregiver browser → FastAPI validation → enquiry service/repository |
| Protocol / endpoint | HTTP `PUT /api/v1/enquiries/{id}` |
| Request schema | Canonical UUID path plus `CreateEnquiryRequest` |
| Response schema | 201 `EnquiryView` after first committed creation; 200 current `EnquiryView` on identical replay, even if since answered |
| Data types / units | IDs strings, integer amount in exact `unit`, server timestamps/snapshots |
| Required/optional | All four body fields required; no auth; no server-owned fields accepted |
| Error response | 422 malformed ID/input/catalog/unit; 409 changed body for existing ID; 503 storage; 500 unexpected |
| Timeout behavior | 5 seconds; unknown outcome → freeze intent and inspect same ID. No new ID or blind retry |
| Example payload | `{"pharmacy_id":"PHARM-A","product_id":"MED-A","requested_quantity":6,"unit":"tablet"}`; `create_pending`/`creation_replay` mocks |

Creation replay checks immutable request fields, not changing current catalog/claims. It must not refresh snapshots or creation time. Canonical-ID parsing, syntax validation, and normalized timestamp representation eliminate aliases; property order in JSON is irrelevant.

### B04 — retrieve saved evidence/result

| Contract item | Specification |
|---|---|
| Producer → Consumer | Caregiver/staff browser or recovery inspector → enquiry service/view builder |
| Protocol / endpoint | HTTP `GET /api/v1/enquiries/{id}` |
| Request schema | UUID path; no body/query |
| Response schema | 200 `EnquiryView` from saved evidence, fresh `served_at` |
| Data types / units | Full nested schema, nullable evidence, count/discrepancy in same unit |
| Required/optional | All view fields required; null report means pending; no auth for disclosed synthetic records |
| Error response | 422 malformed ID; 404 absent; 503 storage; 500 unreadable record/unexpected failure |
| Timeout behavior | 3 seconds; preserve last displayed evidence labeled as last loaded; do not invent updated result |
| Example payload | `get_pending`, `get_insufficient`, `get_sufficient`, `get_zero`, `get_unable`, `get_unknown_time`, `get_missing_claim`, `get_conflict` mocks |

404 means no saved enquiry **at that read instant**, not unavailable medicine or definitive proof an in-flight PUT cannot later commit. User manually refreshes; no polling requirement.

### B05 — staff queue

| Contract item | Specification |
|---|---|
| Producer → Consumer | Staff browser → protected queue handler → saved evidence repository |
| Protocol / endpoint | HTTP `GET /api/v1/staff/enquiries` |
| Request schema | Required staff bearer header; no body/query |
| Response schema | 200 array of `EnquiryView`, only pending and authorized pharmacy; oldest creation first, ID breaks timestamp ties |
| Data types / units | Array of full views, same nested units/null rules; `[]` means no pending entries |
| Required/optional | Header required; no pagination/filter fields; no assumed infinite-scale queue |
| Error response | 401 missing/invalid token; 503 storage; 500 corruption/unexpected |
| Timeout behavior | 3 seconds; show error, not an empty queue disguised as success |
| Example payload | `staff_queue` returns one pending view; `staff_queue_empty` returns `[]` |

Queue must derive pending from no accepted report. Unresolved completed reports do not stay pending and cannot be edited. Select by enquiry ID, never the latest row position.

### B06 — staff report acceptance

| Contract item | Specification |
|---|---|
| Producer → Consumer | Staff browser → server permission/validation → transactional report service |
| Protocol / endpoint | HTTP `PUT /api/v1/enquiries/{id}/observation` |
| Request schema | UUID path + bearer header + `ObservationRequest` |
| Response schema | 201 `EnquiryView` on first committed report; 200 current view on identical replay; never overwrite report |
| Data types / units | Exact product/unit, kind enum, nullable integer/time/reason; server adds staff/basis/submission time |
| Required/optional | Six body fields all required; credential required. Count/time may be null only under stated rules |
| Error response | 401 invalid token; 403 wrong pharmacy; 404 absent enquiry; 422 bad/mismatched input/future time; 409 differing report; 503 storage; 500 unexpected |
| Timeout behavior | 5 seconds; inspect saved report and compare attempted fields; unknown remains unknown until inspected |
| Example payload | Checked `4` example in `submit_insufficient`; unable/unknown-time examples and full responses in fixture pack |

Authorization must occur before revealing protected queue/report state; authenticate before report domain checks. Syntax failure may still be surfaced by framework validation, but must not bypass authorization or mutate state. Evaluate first-write future-time validation using a server timestamp no later than saved `submitted_at`. Replay checks normalized original payload first and retains original server attribution/time.

## 4. Internal boundaries — no new network services

The following are synchronous in-process calls inside FastAPI. Names specify small function contracts, not a framework of interfaces. Errors are exceptions until translated at the HTTP boundary; do not return fake `EnquiryView` successes from helpers.

### B07 — credential → staff principal

| Contract item | Specification |
|---|---|
| Producer / Consumer | Request handler/header parser → permission helper; helper produces principal for enquiry service |
| Protocol / endpoint/event | In-process `require_staff(authorization: str | None) -> StaffPrincipal`; no event |
| Request / response schema | Raw header or null → `StaffPrincipal` |
| Data types / units | String credential in memory; catalog IDs, literal true; no units |
| Required/optional | Header nullable at parser, required for permission; principal fields all required |
| Error response | Missing/invalid token raises Unauthorized → 401 standard envelope; pharmacy mismatch raises Forbidden → 403 |
| Timeout behavior | No network/wait; completes within route deadline. Missing configured token fails startup, not permissive access |
| Example payload | Output `{"staff_id":"STAFF-DEMO","pharmacy_id":"PHARM-A","simulated":true}`. Header documentation uses placeholder only; no real credential in mocks |

No credential in logs, fixtures, returned principal wire objects, query strings, or frontend build configuration. A valid fixed token proves possession only, not professional identity.

### B08 — routes → enquiry service/repository

| Contract item | Specification |
|---|---|
| Producer / Consumer | Validated route models/principal → enquiry service → repository |
| Protocol / endpoint/event | In-process `create_enquiry(id, CreateEnquiryRequest)`, `accept_observation(id, ObservationRequest, StaffPrincipal)`, `read_enquiry(id)`, `list_pending(StaffPrincipal)`, `read_bootstrap()` |
| Request schema | Canonical UUID string; models above. On creation service passes server-built `EnquiryRecord` snapshot to insert. On report service builds `Observation` with server metadata |
| Response schema | Writes `RepositoryWriteResult`; read `(EnquiryRecord, Observation | None)`; queue list of those pairs; bootstrap `BootstrapResponse` |
| Data types / units | Model instances; strict counts/canonical units; aware UTC times; tuples/lists internal, not JSON wire envelopes |
| Required/optional | Same required fields; null claim/report allowed; principal mandatory only protected operations |
| Error response | Validation/NotFound/ImmutableConflict/Forbidden/StorageUnavailable/InternalError exceptions → standard HTTP mapping |
| Timeout behavior | Short synchronous calls; storage lock wait <=2 seconds; route client deadline remains 3/5 seconds. No network calls inside writes |
| Example payload | `EnquiryRecord` extracted from `create_pending`; report from `submit_insufficient`; result metadata `created:true` first time, false replay |

This boundary must preserve creation/report timestamps on replay. Returning from write means commit complete. If commit outcome cannot be determined, raise storage error and caller treats save outcome as unknown until inspection.

### B09 — repository → SQLite

| Contract item | Specification |
|---|---|
| Producer / Consumer | Repository → local SQLite connection; row decoder returns validated models |
| Protocol / endpoint/event | Parameterized SQL, one local file, short transaction; no remote address/event |
| Request schema | Schema/table bindings below; validated snapshot JSON and normalized UTC timestamp TEXT, not raw unvalidated browser JSON |
| Response schema | Rows mapped to `EnquiryRecord`/`Observation`/`BootstrapResponse`; write outcome first insert/replay/conflict |
| Data types / units | TEXT IDs/enums/times/snapshots; INTEGER counts/simulated=1; SQL NULL ↔ JSON null. Convert SQL flag back to strict JSON true |
| Required/optional | SQL NOT NULL for nonnullable fields; null only for documented nullable columns; enforce one report per enquiry |
| Error response | Missing row → NotFound; changed payload → ImmutableConflict; lock/I/O availability → StorageUnavailable; malformed stored structure → InternalError |
| Timeout behavior | 2-second lock timeout; rollback/close on failure; no silent memory fallback |
| Example payload | Quantity INTEGER 6, unit TEXT `tablet`, enquiry ID TEXT fixture UUID; claim snapshot has record12; report row has count4, time and staff ID |

Storage contract:

| Table | Columns / invariants |
|---|---|
| `products` | `id` PK TEXT, `name`, `strength`, `form`, `unit` TEXT NOT NULL; allowed canonical units |
| `claims` | `id` PK TEXT; pharmacy/product/unit/source/loaded_at NOT NULL; quantity INTEGER nullable 0–10000; recorded_at TEXT nullable; simulated INTEGER=1; unique pharmacy/product; product FK |
| `enquiries` | `id` PK TEXT; pharmacy_id/product_id/unit/created_at NOT NULL; requested_quantity INTEGER 1–10000; product_snapshot_json TEXT NOT NULL; claim_snapshot_json TEXT nullable; product FK |
| `observations` | `enquiry_id` PK/FK TEXT; product_id/unit/kind/staff_id/submitted_at/basis NOT NULL; obtainable_quantity INTEGER nullable 0–10000; observed_at/unresolved_reason TEXT nullable; simulated INTEGER=1; report-kind/null coherence constraints |

Use foreign keys on each connection, `BEGIN IMMEDIATE` for writes, identical-payload comparison under that lock, and commit before success. Both uniqueness and payload checks are required: catching duplicate keys alone cannot distinguish harmless replay from changed evidence. Snapshot validation and semantic comparison stay server-owned. No separate conclusion/status table.

### B10 — evidence → evaluator/answer builder

| Contract item | Specification |
|---|---|
| Producer / Consumer | Repository-backed enquiry service → pure evidence evaluator/answer builder |
| Protocol / endpoint/event | In-process `evaluate(EvaluationInput) -> EvaluationResult`; no event/model call |
| Request / response schema | `EvaluationInput` → `EvaluationResult` |
| Data types / units | Validated model objects; integer comparison in exact unit; structured enums/reasons/templates |
| Required/optional | Input fields required; observation nullable; claim may be null; result status/answer required |
| Error response | Semantic conflicts return unresolved/evidence_conflict; unexpected programming failure raises InternalError → 500. Structurally undecodable DB evidence is handled before this call |
| Timeout behavior | Pure bounded local work, no waits/retries. Network/service timeout is inapplicable |
| Example payload | Input: enquiry request6/claim12 plus observed4 → output answered/insufficient/checked_below_request/discrepancy -8; exact internal fixture below |

Evaluate the same saved input identically. Missing claim is not missing check. Record discrepancy alone is not contradictory check evidence. Controlled message templates are backend-owned; frontend must not reconstruct an independent answer.

### B11 — evidence/view → frontend rendering

| Contract item | Specification |
|---|---|
| Producer / Consumer | View builder → HTTP adapter → React caregiver/staff components |
| Protocol / endpoint/event | `build_view(record, report, served_at) -> EnquiryView`; client functions listed below; no pub/sub event |
| Request / response schema | Internal record/report + server served_at → `EnquiryView`; HTTP methods consume it unchanged |
| Data types / units | Nested models serialized to JSON; UTC strings; output numbers retain unit; UI renders text |
| Required/optional | All view fields required; null handled explicitly. Auth token not part of view |
| Error response | Builder/invariant error → 500. Client propagates HTTP failure or distinct transport failure, never mock-success fallback |
| Timeout behavior | Builder no wait; client inherits GET3s/PUT5s. Rendering does not recalculate freshness/sufficiency |
| Example payload | `get_insufficient` fixture, including full evidence/reason/limits; use `answer.reason`, never parse message text |

Client interface shared by mock and HTTP adapters:

```text
getHealth()                         -> Promise<HealthResponse>
getBootstrap()                      -> Promise<BootstrapResponse>
createEnquiry(id, request)           -> Promise<EnquiryView>
getEnquiry(id)                       -> Promise<EnquiryView>
listStaffEnquiries(token)            -> Promise<EnquiryView[]>
submitObservation(id, request, token)-> Promise<EnquiryView>
```

Success resolves with body only. Failure rejects with `{kind:"http", status:number, error:ErrorDetail}` or `{kind:"transport", code:"timeout"|"network_error"|"invalid_response", message:string, outcome:"unknown"|"not_applicable"}`. These are client-local objects, not API schemas. Write timeout/network/non-JSON response means outcome unknown; reads use not_applicable. A complete 409 requires inspection, not overwriting. Empty HTTP responses or invalid success JSON are transport/protocol failures, not success. Disable busy forms; enforce correctness in backend too.

### B12 — static build/config/seed → runtime

| Contract item | Specification |
|---|---|
| Producer / Consumer | Vite build/local environment/seed fixtures → FastAPI startup and browser |
| Protocol / endpoint/event | Local files/environment; browser GET `/` and built asset paths; startup initialization, no remote event |
| Request schema | Existing build directory; absolute `DEMO_DATABASE_PATH`; nonempty `DEMO_STAFF_TOKEN`; seed data matching `BootstrapResponse` |
| Response schema | Static HTML/assets (not JSON API); startup success + ready health or clear startup failure; seeds validated before insertion |
| Data types / units | Files/strings for config, JSON schema for seeds; units/times unchanged. Config field names are proposed application env names |
| Required/optional | Database path/token required; built files required for final demo UI. Test DB separate. No model/remote DB credentials required |
| Error response | Missing token/path/schema/invalid seed fails startup; missing static file HTTP404 outside JSON API. Unknown `/api/v1` path returns standard JSON404, never app HTML |
| Timeout behavior | No remote wait; startup must finish before declaring ready. Filesystem errors stop readiness, not fallback mode |
| Example payload | `DEMO_DATABASE_PATH=E:\\Hackathon Demo\\backend\\data\\demo.sqlite3`; token supplied out-of-band; `bootstrap` fixture seed |

Same contract prefix in dev proxy and built demo. Startup creates schema/inserts missing fixture records without resetting enquiries. No browser reset endpoint. No credential in frontend `VITE_*`. The HTML shell and API error formats are different boundaries, so JSON error requirements apply to API routes only.

## 5. Error and timeout semantics

| HTTP | ErrorCode | Example fields | Meaning |
|---|---|---|---|
| 422 | validation_error | `["requested_quantity"]` | Invalid syntax/schema/unknown ID/mismatch/future time; known rejection, no commit |
| 401 | unauthorized | `[]` | Missing/invalid staff credential; include `WWW-Authenticate: Bearer`; no report saved |
| 403 | forbidden | `[]` | Valid principal not permitted for pharmacy; no report saved |
| 404 | not_found | `["id"]` | Missing enquiry/API path; not a medicine availability conclusion |
| 409 | immutable_conflict | `["id"]` or `["observation"]` | Different body under immutable identity; prior evidence preserved |
| 405 | method_not_allowed | `["method"]` | Unsupported method; include appropriate Allow header |
| 415 | unsupported_media_type | `["body"]` | Non-JSON PUT content type; no commit |
| 503 | storage_unavailable | `[]` | Busy/unavailable/readiness failure; inspect if received after a write attempt |
| 500 | internal_error | `[]` | Unexpected fault/corrupt structure; safe message; inspect uncertain write |

All error examples use `{"error":{"code":...,"message":...,"fields":[...]}}`. Normalize framework validation/errors to that envelope on `/api/v1`; no raw Pydantic input dumps or stack traces. `fields` names identify fields; they must not contain submitted values or credentials. Different validation messages may be helpful but clients branch on status/code, not exact English wording.

| Situation | Required handling |
|---|---|
| Read timeout | Preserve last evidence as last loaded; offer manual refresh; no fabricated empty response |
| Mutation response timeout/loss | Preserve ID and exact original body; save outcome unknown; inspect GET; do not assume browser abort cancels server work |
| Inspect finds matching immutable request/report | Treat as saved; render saved server evidence |
| Inspect finds different accepted report | Conflict; show saved evidence; new enquiry for correction |
| Inspect returns pending/404 while first PUT may still run | Not settled; retain unknown; manual identical same-address retry permitted, no automatic new intent |
| Storage503/internal500 after write | Cannot assume rollback just from generic error; inspect same saved address |
| Replay | Compare normalized semantic body; object-key order/offset representation not significant; preserve first saved server times |
| Concurrent different reports | Exactly one wins; other409. No last-write-wins |

Timeouts are client deadlines, not server cancellation or guaranteed response SLAs. SQLite waits at most2s per lock attempt; no unbounded retry loop. No automatic mutations are retried. Mock failure injection must distinguish “reject before save” from “save then lose response.”

## 6. Mock use and swap boundary

Section 8 provides copyable full JSON responses plus requests and expected HTTP status. Extract its `http_cases` into a local fixture map for UI work; a separate JSON-server/model-server installation is unnecessary. `internal_cases` allow backend evaluator and repository tests to proceed without the UI. There is no model-server task.

- Choose mock adapter **explicitly** at development startup; show a visible “transport mocked” label independent of synthetic-data disclosure. Network failures never switch live mode to mocks.
- Use the exact six client functions in B11. Mock adapter returns a deep copy of the chosen response body or rejects with the same client error shape; mock metadata stays outside the wire body.
- Rendering mocks are static scenarios. They do not prove the workflow or persistence. An optional stateful transport mock can maintain an in-memory map keyed by ID and use predetermined outcomes; do not write a second comparison engine in React.
- Mock first-create/report201, identical replay200, changed body409, authorized queue, unauthorized401, read404, validation422, and database503. Saved-report scenario uses the same enquiry ID/request as pending to exercise refresh.
- Fixed fixture times use a test clock `2026-10-07T05:10:00Z`; they are not instructions to use hardcoded time in a live staff check. A live form reports actual check time or null; backend server times are actual UTC.
- Cases are independently selectable scenarios, not a sequence to execute in array order. Creation cases start with no saved enquiry; report cases start with a pending enquiry matching their response's immutable request fields. Replay cases start with that same request/report already saved; conflict cases start with the earlier accepted evidence. GET cases use the supplied saved view. Reset the mock scenario explicitly between independent cases, never the real backend as an error fallback.
- `wrong_pharmacy` tests an injected valid principal for another pharmacy; the MVP's single fixed principal cannot produce it through its ordinary UI. `get_conflict` is a rendering/integrity fixture, not evidence that the public report API permits mismatched writes. Error scenarios may simulate repository failures; they are not requests to add fault-injection production endpoints.
- For a dropped-response simulation, commit fixture state then throw client transport timeout; subsequent GET returns saved report. For pre-save failure, throw without changing state. Backend tests exercise real transactions independently.
- Replace the selected mock module with HTTP module using relative `/api/v1`, leaving consumers unchanged. Verify through actual caregiver/staff contexts early; contract fixtures alone are not integration completion.

For solo implementation, freeze contracts, develop one backend path, use static views only while necessary, and connect by the 90-minute vertical-slice gate. Do not spend the deadline building mock infrastructure or automated client generation.

## 7. Acceptance checks before integration claims

1. Every mock payload parses through exact models, including nested nullable fields; extras/omissions and coercions are rejected.
2. Stable-ID creation/replay and one-report transaction behavior preserve snapshots, first timestamps, and attribution.
3. Caller cannot submit staff identity/conclusion or write without credential; mismatched identity/unit cannot become a saved valid report.
4. Count4/request6/record12 → insufficient and discrepancy -8; count8 → sufficient; zero → insufficient; missing time/unable/pending → distinct unresolved reasons.
5. Missing claim still allows exact checked comparison; old recorded/check times remain visible without new current-stock certainty.
6. Error envelopes agree across validation/auth/conflict/readiness and client does not manufacture success.
7. Dropped write response is inspectable by stable ID; a delayed pending/404 read is not treated as definitive rollback.
8. Concurrent differing report attempts produce one accepted immutable report and one409.
9. Real browser journey uses actual backend storage/evaluator, no transport mock; third-party connectivity is unnecessary.

The schema and fixtures below are reviewable artifacts. Route/database implementation and browser validation remain future work.

## 8. Complete mock fixture pack

The following JSON is a **fixture container**, not an endpoint response schema. Each `request.body` is exactly the body to send; each `response.body` is exactly what the corresponding endpoint returns. All full views include required fields and nulls; no ellipses or patch-only responses. Header `auth_role:staff` is test-harness metadata, not an actual bearer token or HTTP header. Live tokens are supplied out-of-band.

```json
{
  "contract_version": "v1",
  "fixture_clock": "2026-10-07T05:10:00Z",
  "http_cases": [
    {
      "name": "health",
      "request": {
        "method": "GET",
        "path": "/api/v1/health",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "status": "ready",
          "storage": "sqlite"
        }
      }
    },
    {
      "name": "bootstrap",
      "request": {
        "method": "GET",
        "path": "/api/v1/bootstrap",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "pharmacy": {
            "id": "PHARM-A",
            "name": "Synthetic Demo Pharmacy"
          },
          "products": [
            {
              "id": "MED-A",
              "name": "Demo Medicine A",
              "strength": "10 mg",
              "form": "tablet",
              "unit": "tablet"
            },
            {
              "id": "MED-B",
              "name": "Demo Medicine A",
              "strength": "20 mg",
              "form": "tablet",
              "unit": "tablet"
            },
            {
              "id": "MED-C",
              "name": "Demo Medicine C",
              "strength": "10 mg",
              "form": "capsule",
              "unit": "capsule"
            }
          ],
          "claims": [
            {
              "id": "CLAIM-A",
              "pharmacy_id": "PHARM-A",
              "product_id": "MED-A",
              "quantity": 12,
              "unit": "tablet",
              "recorded_at": "2026-10-07T03:10:00Z",
              "loaded_at": "2026-10-07T03:15:00Z",
              "source": "synthetic inventory fixture",
              "simulated": true
            }
          ],
          "simulated": true
        }
      }
    },
    {
      "name": "create_pending",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001",
        "body": {
          "pharmacy_id": "PHARM-A",
          "product_id": "MED-A",
          "requested_quantity": 6,
          "unit": "tablet"
        },
        "auth_role": "public"
      },
      "response": {
        "status": 201,
        "body": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:00:00Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": null,
          "status": "pending",
          "answer": {
            "conclusion": "unresolved",
            "reason": "awaiting_check",
            "discrepancy_units": null,
            "message": "You requested 6 tablets. No staff check has been saved.",
            "limitations": [
              "Synthetic demonstration.",
              "Recorded stock is not a physical check.",
              "No stock reservation or clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "creation_replay",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001",
        "body": {
          "pharmacy_id": "PHARM-A",
          "product_id": "MED-A",
          "requested_quantity": 6,
          "unit": "tablet"
        },
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:00:00Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": null,
          "status": "pending",
          "answer": {
            "conclusion": "unresolved",
            "reason": "awaiting_check",
            "discrepancy_units": null,
            "message": "You requested 6 tablets. No staff check has been saved.",
            "limitations": [
              "Synthetic demonstration.",
              "Recorded stock is not a physical check.",
              "No stock reservation or clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_pending",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:00:00Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": null,
          "status": "pending",
          "answer": {
            "conclusion": "unresolved",
            "reason": "awaiting_check",
            "discrepancy_units": null,
            "message": "You requested 6 tablets. No staff check has been saved.",
            "limitations": [
              "Synthetic demonstration.",
              "Recorded stock is not a physical check.",
              "No stock reservation or clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "staff_queue",
      "request": {
        "method": "GET",
        "path": "/api/v1/staff/enquiries",
        "body": null,
        "auth_role": "staff"
      },
      "response": {
        "status": 200,
        "body": [
          {
            "id": "00000000-0000-4000-8000-000000000001",
            "pharmacy_id": "PHARM-A",
            "product": {
              "id": "MED-A",
              "name": "Demo Medicine A",
              "strength": "10 mg",
              "form": "tablet",
              "unit": "tablet"
            },
            "requested_quantity": 6,
            "unit": "tablet",
            "created_at": "2026-10-07T05:00:00Z",
            "served_at": "2026-10-07T05:00:00Z",
            "claim": {
              "id": "CLAIM-A",
              "pharmacy_id": "PHARM-A",
              "product_id": "MED-A",
              "quantity": 12,
              "unit": "tablet",
              "recorded_at": "2026-10-07T03:10:00Z",
              "loaded_at": "2026-10-07T03:15:00Z",
              "source": "synthetic inventory fixture",
              "simulated": true
            },
            "observation": null,
            "status": "pending",
            "answer": {
              "conclusion": "unresolved",
              "reason": "awaiting_check",
              "discrepancy_units": null,
              "message": "You requested 6 tablets. No staff check has been saved.",
              "limitations": [
                "Synthetic demonstration.",
                "Recorded stock is not a physical check.",
                "No stock reservation or clinical approval."
              ]
            },
            "simulated": true
          }
        ]
      }
    },
    {
      "name": "staff_queue_empty",
      "request": {
        "method": "GET",
        "path": "/api/v1/staff/enquiries",
        "body": null,
        "auth_role": "staff"
      },
      "response": {
        "status": 200,
        "body": []
      }
    },
    {
      "name": "submit_insufficient",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 4,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 201,
        "body": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "insufficient",
            "reason": "checked_below_request",
            "discrepancy_units": -8,
            "message": "You requested 6 tablets. Staff reported 4 obtainable tablets at 2026-10-07T05:02:00Z. This did not meet the requested quantity at that time. Recorded stock was 12 tablets.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "report_replay",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 4,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "insufficient",
            "reason": "checked_below_request",
            "discrepancy_units": -8,
            "message": "You requested 6 tablets. Staff reported 4 obtainable tablets at 2026-10-07T05:02:00Z. This did not meet the requested quantity at that time. Recorded stock was 12 tablets.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_insufficient",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "insufficient",
            "reason": "checked_below_request",
            "discrepancy_units": -8,
            "message": "You requested 6 tablets. Staff reported 4 obtainable tablets at 2026-10-07T05:02:00Z. This did not meet the requested quantity at that time. Recorded stock was 12 tablets.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_sufficient",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000002",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000002",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 8,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "sufficient",
            "reason": "checked_meets_request",
            "discrepancy_units": -4,
            "message": "You requested 6 tablets. Staff reported 8 obtainable tablets at 2026-10-07T05:02:00Z. This met the requested quantity at that time. Recorded stock was 12 tablets.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "submit_sufficient",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000002/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 8,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 201,
        "body": {
          "id": "00000000-0000-4000-8000-000000000002",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 8,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "sufficient",
            "reason": "checked_meets_request",
            "discrepancy_units": -4,
            "message": "You requested 6 tablets. Staff reported 8 obtainable tablets at 2026-10-07T05:02:00Z. This met the requested quantity at that time. Recorded stock was 12 tablets.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_zero",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000003",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000003",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 0,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "insufficient",
            "reason": "checked_below_request",
            "discrepancy_units": -12,
            "message": "You requested 6 tablets. Staff reported 0 obtainable tablets at 2026-10-07T05:02:00Z. This did not meet the requested quantity at that time. Recorded stock was 12 tablets.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "submit_zero",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000003/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 0,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 201,
        "body": {
          "id": "00000000-0000-4000-8000-000000000003",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 0,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "insufficient",
            "reason": "checked_below_request",
            "discrepancy_units": -12,
            "message": "You requested 6 tablets. Staff reported 0 obtainable tablets at 2026-10-07T05:02:00Z. This did not meet the requested quantity at that time. Recorded stock was 12 tablets.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_unable",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000004",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000004",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "unable_to_check",
            "obtainable_quantity": null,
            "observed_at": null,
            "unresolved_reason": "cannot_check",
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "unable_to_check",
            "simulated": true
          },
          "status": "unresolved",
          "answer": {
            "conclusion": "unresolved",
            "reason": "cannot_check",
            "discrepancy_units": null,
            "message": "Staff could not complete the check. Availability for this request remains unresolved.",
            "limitations": [
              "Synthetic demonstration.",
              "No obtainable quantity established.",
              "No stock reservation or clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "submit_unable",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000004/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "unable_to_check",
          "obtainable_quantity": null,
          "observed_at": null,
          "unresolved_reason": "cannot_check"
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 201,
        "body": {
          "id": "00000000-0000-4000-8000-000000000004",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "unable_to_check",
            "obtainable_quantity": null,
            "observed_at": null,
            "unresolved_reason": "cannot_check",
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "unable_to_check",
            "simulated": true
          },
          "status": "unresolved",
          "answer": {
            "conclusion": "unresolved",
            "reason": "cannot_check",
            "discrepancy_units": null,
            "message": "Staff could not complete the check. Availability for this request remains unresolved.",
            "limitations": [
              "Synthetic demonstration.",
              "No obtainable quantity established.",
              "No stock reservation or clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_unknown_time",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000005",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000005",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": null,
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "unresolved",
          "answer": {
            "conclusion": "unresolved",
            "reason": "observation_time_unknown",
            "discrepancy_units": null,
            "message": "Staff reported a count but the observation time is unknown. Availability for this request remains unresolved.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "submit_unknown_time",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000005/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 4,
          "observed_at": null,
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 201,
        "body": {
          "id": "00000000-0000-4000-8000-000000000005",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-A",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": null,
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "unresolved",
          "answer": {
            "conclusion": "unresolved",
            "reason": "observation_time_unknown",
            "discrepancy_units": null,
            "message": "Staff reported a count but the observation time is unknown. Availability for this request remains unresolved.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_missing_claim",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000006",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000006",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-B",
            "name": "Demo Medicine A",
            "strength": "20 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": null,
          "observation": {
            "product_id": "MED-B",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 8,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "sufficient",
            "reason": "checked_meets_request",
            "discrepancy_units": null,
            "message": "You requested 6 tablets. Staff reported 8 obtainable tablets at 2026-10-07T05:02:00Z. This met the requested quantity at that time. No recorded stock claim was supplied.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "submit_missing_claim",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000006/observation",
        "body": {
          "product_id": "MED-B",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 8,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 201,
        "body": {
          "id": "00000000-0000-4000-8000-000000000006",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-B",
            "name": "Demo Medicine A",
            "strength": "20 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": null,
          "observation": {
            "product_id": "MED-B",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 8,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "answered",
          "answer": {
            "conclusion": "sufficient",
            "reason": "checked_meets_request",
            "discrepancy_units": null,
            "message": "You requested 6 tablets. Staff reported 8 obtainable tablets at 2026-10-07T05:02:00Z. This met the requested quantity at that time. No recorded stock claim was supplied.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "get_conflict",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000007",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 200,
        "body": {
          "id": "00000000-0000-4000-8000-000000000007",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "served_at": "2026-10-07T05:02:01Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "observation": {
            "product_id": "MED-B",
            "unit": "tablet",
            "kind": "checked",
            "obtainable_quantity": 4,
            "observed_at": "2026-10-07T05:02:00Z",
            "unresolved_reason": null,
            "staff_id": "STAFF-DEMO",
            "submitted_at": "2026-10-07T05:02:01Z",
            "basis": "staff_reported_obtainable_count",
            "simulated": true
          },
          "status": "unresolved",
          "answer": {
            "conclusion": "unresolved",
            "reason": "evidence_conflict",
            "discrepancy_units": null,
            "message": "Saved check identity conflicts with this enquiry. Availability for this request remains unresolved.",
            "limitations": [
              "Synthetic demonstration.",
              "Staff report is not independently verified.",
              "This check does not reserve stock or guarantee availability on arrival.",
              "Exact identity matching is not clinical approval."
            ]
          },
          "simulated": true
        }
      }
    },
    {
      "name": "invalid_quantity",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000008",
        "body": {
          "pharmacy_id": "PHARM-A",
          "product_id": "MED-A",
          "requested_quantity": 0,
          "unit": "tablet"
        },
        "auth_role": "public"
      },
      "response": {
        "status": 422,
        "body": {
          "error": {
            "code": "validation_error",
            "message": "requested_quantity must be a positive whole number.",
            "fields": [
              "requested_quantity"
            ]
          }
        }
      }
    },
    {
      "name": "wrong_unit",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000008",
        "body": {
          "pharmacy_id": "PHARM-A",
          "product_id": "MED-A",
          "requested_quantity": 6,
          "unit": "capsule"
        },
        "auth_role": "public"
      },
      "response": {
        "status": 422,
        "body": {
          "error": {
            "code": "validation_error",
            "message": "unit does not match the selected product.",
            "fields": [
              "unit"
            ]
          }
        }
      }
    },
    {
      "name": "unknown_enquiry",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000009",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 404,
        "body": {
          "error": {
            "code": "not_found",
            "message": "Enquiry is not currently saved.",
            "fields": [
              "id"
            ]
          }
        }
      }
    },
    {
      "name": "missing_credential",
      "request": {
        "method": "GET",
        "path": "/api/v1/staff/enquiries",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 401,
        "body": {
          "error": {
            "code": "unauthorized",
            "message": "Staff credential required.",
            "fields": []
          }
        }
      }
    },
    {
      "name": "wrong_pharmacy",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 4,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 403,
        "body": {
          "error": {
            "code": "forbidden",
            "message": "Staff actor is not permitted for this pharmacy.",
            "fields": []
          }
        }
      }
    },
    {
      "name": "changed_creation",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001",
        "body": {
          "pharmacy_id": "PHARM-A",
          "product_id": "MED-A",
          "requested_quantity": 7,
          "unit": "tablet"
        },
        "auth_role": "public"
      },
      "response": {
        "status": 409,
        "body": {
          "error": {
            "code": "immutable_conflict",
            "message": "Existing enquiry cannot be changed.",
            "fields": [
              "id"
            ]
          }
        }
      }
    },
    {
      "name": "changed_report",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001/observation",
        "body": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 5,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null
        },
        "auth_role": "staff"
      },
      "response": {
        "status": 409,
        "body": {
          "error": {
            "code": "immutable_conflict",
            "message": "Accepted report cannot be replaced.",
            "fields": [
              "observation"
            ]
          }
        }
      }
    },
    {
      "name": "storage_failure",
      "request": {
        "method": "GET",
        "path": "/api/v1/health",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 503,
        "body": {
          "error": {
            "code": "storage_unavailable",
            "message": "Local storage is unavailable.",
            "fields": []
          }
        }
      }
    },
    {
      "name": "internal_failure",
      "request": {
        "method": "GET",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000001",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 500,
        "body": {
          "error": {
            "code": "internal_error",
            "message": "Unable to construct saved evidence view.",
            "fields": []
          }
        }
      }
    },
    {
      "name": "wrong_method",
      "request": {
        "method": "POST",
        "path": "/api/v1/bootstrap",
        "body": null,
        "auth_role": "public"
      },
      "response": {
        "status": 405,
        "body": {
          "error": {
            "code": "method_not_allowed",
            "message": "Method is not supported.",
            "fields": [
              "method"
            ]
          }
        }
      }
    },
    {
      "name": "wrong_media_type",
      "request": {
        "method": "PUT",
        "path": "/api/v1/enquiries/00000000-0000-4000-8000-000000000008",
        "body": {
          "pharmacy_id": "PHARM-A",
          "product_id": "MED-A",
          "requested_quantity": 6,
          "unit": "tablet"
        },
        "auth_role": "public",
        "content_type": "text/plain"
      },
      "response": {
        "status": 415,
        "body": {
          "error": {
            "code": "unsupported_media_type",
            "message": "JSON content type required.",
            "fields": [
              "body"
            ]
          }
        }
      }
    }
  ],
  "internal_cases": [
    {
      "name": "evaluate_insufficient",
      "input": {
        "enquiry": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "simulated": true
        },
        "observation": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 4,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null,
          "staff_id": "STAFF-DEMO",
          "submitted_at": "2026-10-07T05:02:01Z",
          "basis": "staff_reported_obtainable_count",
          "simulated": true
        }
      },
      "output": {
        "status": "answered",
        "answer": {
          "conclusion": "insufficient",
          "reason": "checked_below_request",
          "discrepancy_units": -8,
          "message": "You requested 6 tablets. Staff reported 4 obtainable tablets at 2026-10-07T05:02:00Z. This did not meet the requested quantity at that time. Recorded stock was 12 tablets.",
          "limitations": [
            "Synthetic demonstration.",
            "Staff report is not independently verified.",
            "This check does not reserve stock or guarantee availability on arrival.",
            "Exact identity matching is not clinical approval."
          ]
        }
      }
    },
    {
      "name": "accepted_report_write",
      "output": {
        "created": true,
        "enquiry": {
          "id": "00000000-0000-4000-8000-000000000001",
          "pharmacy_id": "PHARM-A",
          "product": {
            "id": "MED-A",
            "name": "Demo Medicine A",
            "strength": "10 mg",
            "form": "tablet",
            "unit": "tablet"
          },
          "requested_quantity": 6,
          "unit": "tablet",
          "created_at": "2026-10-07T05:00:00Z",
          "claim": {
            "id": "CLAIM-A",
            "pharmacy_id": "PHARM-A",
            "product_id": "MED-A",
            "quantity": 12,
            "unit": "tablet",
            "recorded_at": "2026-10-07T03:10:00Z",
            "loaded_at": "2026-10-07T03:15:00Z",
            "source": "synthetic inventory fixture",
            "simulated": true
          },
          "simulated": true
        },
        "observation": {
          "product_id": "MED-A",
          "unit": "tablet",
          "kind": "checked",
          "obtainable_quantity": 4,
          "observed_at": "2026-10-07T05:02:00Z",
          "unresolved_reason": null,
          "staff_id": "STAFF-DEMO",
          "submitted_at": "2026-10-07T05:02:01Z",
          "basis": "staff_reported_obtainable_count",
          "simulated": true
        }
      }
    },
    {
      "name": "staff_principal",
      "output": {
        "staff_id": "STAFF-DEMO",
        "pharmacy_id": "PHARM-A",
        "simulated": true
      }
    }
  ],
  "transport_faults": [
    {
      "name": "save_then_response_lost",
      "sequence": [
        "save enquiry/report under original ID",
        "reject client promise: transport timeout, outcome unknown",
        "GET original ID returns saved report"
      ]
    },
    {
      "name": "fail_before_save",
      "sequence": [
        "reject client promise: transport network_error, outcome unknown",
        "GET original ID returns pending/404 at read time",
        "do not infer guaranteed rollback if original request might be in flight"
      ]
    }
  ]
}
```

## 9. Exact schema blueprint

The Pydantic block appended below defines wire models and the small internal DTOs. It deliberately does not implement routes, SQL, UI, or comparison logic. Service constraints in Section 2 must also be enforced; schema validity alone cannot establish evidence truth.

```python
from datetime import datetime, timezone
import re
from enum import Enum
from typing import Annotated, Literal
from uuid import UUID
from pydantic import (
    AwareDatetime, BaseModel, ConfigDict, Field,
    StringConstraints, field_validator, model_validator,
)

Id = Annotated[str, StringConstraints(
    strict=True, pattern=r"^[A-Z][A-Z0-9-]{0,63}$"
)]
Text = Annotated[str, StringConstraints(strict=True, min_length=1, max_length=500)]
RequestedQty = Annotated[int, Field(strict=True, ge=1, le=10000)]
ObservedQty = Annotated[int, Field(strict=True, ge=0, le=10000)]
SignedQty = Annotated[int, Field(strict=True, ge=-10000, le=10000)]

class WireModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    @field_validator("*", mode="before")
    @classmethod
    def wire_primitives(cls, value, info):
        time_fields = {
            "recorded_at", "loaded_at", "observed_at",
            "submitted_at", "created_at", "served_at",
        }
        if info.field_name in time_fields and value is not None:
            # Server-side Python construction may use datetime objects.
            # JSON cannot contain datetime objects; wire inputs must be strings.
            if not isinstance(value, datetime):
                pattern = (r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}"
                           r"(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})")
                if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
                    raise ValueError("timestamp must be an ISO string with seconds/timezone")
        if info.field_name == "simulated" and value is not True:
            raise ValueError("simulated must be literal true")
        return value

    @field_validator("*", mode="after")
    @classmethod
    def normalize_times(cls, value, info):
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc)
        return value

class Unit(str, Enum):
    tablet = "tablet"
    capsule = "capsule"

class Status(str, Enum):
    pending = "pending"
    answered = "answered"
    unresolved = "unresolved"

class Conclusion(str, Enum):
    sufficient = "sufficient"
    insufficient = "insufficient"
    unresolved = "unresolved"

class Reason(str, Enum):
    awaiting_check = "awaiting_check"
    checked_meets_request = "checked_meets_request"
    checked_below_request = "checked_below_request"
    cannot_check = "cannot_check"
    observation_time_unknown = "observation_time_unknown"
    evidence_conflict = "evidence_conflict"

class ReportKind(str, Enum):
    checked = "checked"
    unable_to_check = "unable_to_check"

class Pharmacy(WireModel):
    id: Id
    name: Text

class Product(WireModel):
    id: Id
    name: Text
    strength: Text
    form: Text
    unit: Unit

class Claim(WireModel):
    id: Id
    pharmacy_id: Id
    product_id: Id
    quantity: ObservedQty | None
    unit: Unit
    recorded_at: AwareDatetime | None
    loaded_at: AwareDatetime
    source: Text
    simulated: Literal[True]

class BootstrapResponse(WireModel):
    pharmacy: Pharmacy
    products: list[Product]
    claims: list[Claim]
    simulated: Literal[True]

class CreateEnquiryRequest(WireModel):
    pharmacy_id: Id
    product_id: Id
    requested_quantity: RequestedQty
    unit: Unit

class ObservationRequest(WireModel):
    product_id: Id
    unit: Unit
    kind: ReportKind
    obtainable_quantity: ObservedQty | None
    observed_at: AwareDatetime | None
    unresolved_reason: Literal["cannot_check"] | None

    @field_validator("observed_at")
    @classmethod
    def utc_time(cls, value):
        return value.astimezone(timezone.utc) if value is not None else None

    @model_validator(mode="after")
    def coherent_report(self):
        if self.kind == ReportKind.checked:
            if self.obtainable_quantity is None or self.unresolved_reason is not None:
                raise ValueError("checked requires count and null unresolved_reason")
        else:
            if (self.obtainable_quantity is not None or self.observed_at is not None
                    or self.unresolved_reason != "cannot_check"):
                raise ValueError("unable_to_check requires null count/time and cannot_check")
        return self

class Observation(ObservationRequest):
    staff_id: Id
    submitted_at: AwareDatetime
    basis: Literal["staff_reported_obtainable_count", "unable_to_check"]
    simulated: Literal[True]

    @model_validator(mode="after")
    def matching_basis(self):
        expected = ("staff_reported_obtainable_count"
                    if self.kind == ReportKind.checked else "unable_to_check")
        if self.basis != expected:
            raise ValueError("basis does not match report kind")
        return self

class Answer(WireModel):
    conclusion: Conclusion
    reason: Reason
    discrepancy_units: SignedQty | None
    message: Text
    limitations: list[Text]

class EnquiryRecord(WireModel):
    id: UUID
    pharmacy_id: Id
    product: Product
    requested_quantity: RequestedQty
    unit: Unit
    created_at: AwareDatetime
    claim: Claim | None
    simulated: Literal[True]

    @field_validator("id", mode="before")
    @classmethod
    def canonical_uuid(cls, value):
        if isinstance(value, UUID):  # Internal Python construction only.
            return value
        pattern = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
        if not isinstance(value, str) or re.fullmatch(pattern, value) is None:
            raise ValueError("id must be a canonical lowercase UUID string")
        return value

class EnquiryView(EnquiryRecord):
    served_at: AwareDatetime
    observation: Observation | None
    status: Status
    answer: Answer

class ErrorDetail(WireModel):
    code: Literal[
        "validation_error", "unauthorized", "forbidden", "not_found",
        "immutable_conflict", "storage_unavailable", "internal_error",
        "method_not_allowed", "unsupported_media_type"
    ]
    message: Text
    fields: list[Text]

class ErrorResponse(WireModel):
    error: ErrorDetail

class HealthResponse(WireModel):
    status: Literal["ready"]
    storage: Literal["sqlite"]

class StaffPrincipal(WireModel):
    staff_id: Id
    pharmacy_id: Id
    simulated: Literal[True]

class EvaluationInput(WireModel):
    enquiry: EnquiryRecord
    observation: Observation | None

class EvaluationResult(WireModel):
    status: Status
    answer: Answer

class RepositoryWriteResult(WireModel):
    created: Annotated[bool, Field(strict=True)]
    enquiry: EnquiryRecord
    observation: Observation | None

```

Path parameters use the same canonical UUID validation as `EnquiryRecord.id`. JSON serialization uses UTC `Z`; internal Python construction may supply aware `datetime`/`UUID` objects. Repository code converts SQL simulation flag 1 to boolean true before model construction. Field coercion tests must cover JSON inputs, not just Python objects.

The HTTP wire contract is unchanged from the architecture except the explicit timestamp/flag validation and standardized method/media-type errors described above. No functional system code has been generated by this document.

## Implementation integrity clarification - 7 October 2026

Timestamp normalization rejects instants outside Python's representable UTC range with 422, rather than allowing overflow to become 500. Timestamp fractions are retained in SQLite and replay comparison. Snapshot product identity that disagrees with the separately stored enquiry product ID cannot be decoded into a trustworthy record and returns safe 500/internal_error. Schema-valid evidence conflicts represented by the wire models retain the existing unresolved/evidence_conflict semantics. An incompatible claim remains separate evidence and is excluded from discrepancy computation, including a mismatched pharmacy.

Local startup requires an explicitly configured backend-only nonempty staff credential and absolute SQLite path. Client endpoint-success shape checks and full response-body deadlines classify ambiguous writes as unknown. These changes do not add or change routes, enums, or wire fields.
