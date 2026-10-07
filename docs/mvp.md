# Six-Hour Solo MVP: Request-Specific Availability Verification

Planning input: **six hours remaining, one developer: Pantha Protick**. The six-hour allocation below starts at implementation kickoff; it is not a verified countdown or promise of completion.

Sources: [central proposition](proposition.md), [feature candidates](possible_features.md), [team skills](team_skills.md), [comparison](comparison.md), and [preferred stack](prefered_stacks.md).

Filename clarification: `propositions.md` is absent. This plan uses the existing `proposition.md`; no duplicate proposition file is created.

## 1. Smallest credible end-to-end system

**One caregiver selects an exact product and quantity at one demo pharmacy, requests a check, a simulated pharmacy staff actor submits an observation, and the same enquiry returns an evidence-qualified sufficient, insufficient, or unresolved answer.**

The demonstration must preserve the original stock record, expose any discrepancy, and distinguish an observation from future-stock guarantees or clinical approval.

Minimal operating scope:

- One synthetic pharmacy and one explicitly simulated staff actor.
- Three synthetic catalog products, with at least two differing in a meaningful identity attribute such as strength or form. They are fixture identities, not clinical reference data.
- One defined stock/request unit per product; no pack, dose, or concentration conversion.
- Positive whole-unit requests and nonnegative whole-unit observations; unsupported units or fractions do not pass comparison.
- A small fixed set of stock claims seeded locally, not a full inventory management service.
- One staff observation accepted per enquiry. No editing, corrections, rechecks, or reconciliation workflow in the public MVP interaction; mistakes require a new enquiry. This limitation is disclosed.
- A caregiver interaction, staff interaction, and result connected to the same backend enquiry. They may be sections or routes of one minimal interface.
- Ordinary request/response communication and explicit refresh. No live subscriptions or push delivery.
- Local operation with disclosed synthetic data. No real patient information, pharmacy integrations, professional assessments, or production deployment claims.

**What can be proved:** the implemented workflow handles specified evidence correctly and completes the scenario. **What remains to be tested:** whether caregivers interpret it better than clear baseline answers, whether staff burden is acceptable, and whether it improves acquisition in practice.

The system alone cannot prove the user-value hypothesis. A small human comparison can provide preliminary evidence if participants are available; otherwise comprehension improvement must remain unverified.

## 2. Feature removal test and classification

Removal question: **“If this feature is removed, can we still credibly demonstrate the central proposition?”** Equivalent simpler mechanisms count; losing a capability does not. Mandatory behavior is separated from richer presentations and optional subsystems.

- **MUST HAVE:** removing the minimal behavior breaks the complete journey, its evidence boundary, or required validation/disclosure.
- **SHOULD HAVE:** the proposition can still be demonstrated, but reliability or evaluation improves enough to consider after the vertical slice works.
- **COULD HAVE:** optional convenience with a small implementation ceiling; never consumes the validation/demo reserve.
- **DO NOT BUILD DURING MVP:** unnecessary scope, experimental validation, external dependency, or an unjustified claim.

### Core candidate features

| Feature | Can it be removed? | MVP classification | Smallest retained behavior / reason |
|---|---|---|---|
| F01: Exact product and quantity request | No | MUST HAVE | Controlled product selection and quantity; visible distinguishing details; no fuzzy search required |
| F02: Identity/unit validation | No | MUST HAVE | Backend validates exact ID, whole-unit quantity, and compatible units; unknown or malformed input cannot become a match |
| F03: Record-versus-check comparison | No | MUST HAVE | Plain text or compact rows show both amounts, their basis/time, and discrepancy; elaborate charts removed |
| F04: Separate claim/observation storage | No | MUST HAVE | Original claim retained separately from linked observation; no in-place inventory overwrite |
| F05: Check request and status | No | MUST HAVE | Create one targeted enquiry; show pending, answered, or explicitly unresolved checking; refresh same enquiry |
| F06: Pharmacy-bound lifecycle | No | MUST HAVE | Stable request ID, fixed product/quantity/pharmacy, allowed transitions, linked result; request identity cannot change after creation |
| F07: Staff observation submission | No | MUST HAVE | Staff reports checked obtainable amount and observation time, or explicitly cannot complete the check |
| F08: Integrity/reporting authority | No | MUST HAVE | Server associates observation with permitted demo staff/pharmacy; caregiver cannot submit an attributed staff report. Fixed demo access credentials are sufficient locally; identity is simulated, not professionally verified |
| F09: Sufficiency answer | No | MUST HAVE | Sufficient at observation time, insufficient, or unresolved; zero checked differs from missing check |
| F10: Comparison/conflict rules | No | MUST HAVE | One deterministic conclusion path; no guessed conversions or latest-timestamp conflict resolution. Unexpected contradictory evidence fails unresolved; no reconciliation interface |
| F11: Plain-language evidence/limits | No | MUST HAVE | Exact request, reason, check basis/time, discrepancy, uncertainty, and no hold/substitution implication |
| F12: Controlled conclusion wording | No | MUST HAVE | Defined reason codes and templates; no generated medical interpretation or generic disclaimer as substitute for actual evidence |

### Supporting and enhancing candidates

| Feature | Can it be removed? | MVP classification | Decision |
|---|---|---|---|
| F13: Focused actor interactions | No, in minimal form | MUST HAVE | Actual caregiver input and staff response must be usable; two plain interactions rather than a polished multi-page product |
| F14: Shared formatting/label infrastructure | Yes, as a separate subsystem | SHOULD HAVE | Common terminology remains necessary through F11/F12. Reuse small constants/helpers; no design system or schema-generator project |
| F15: Reopen existing enquiries | Yes, beyond the active journey | COULD HAVE | Keep refresh of the current enquiry through F05. History, saved lists, and cross-session navigation are optional |
| F16: Durable recovery | Yes, for a continuously running demo | SHOULD HAVE | Shared state is mandatory through F04/F06. Local SQLite is the selected low-complexity store and provides persistence incidentally; no offline queue or account-based recovery |
| F17: Corrections and uncertain saves | Partly | MUST HAVE: honest save outcome. DO NOT BUILD: correction workflow | Unknown save result triggers enquiry inspection, not false success or blind resubmission. Completed reports are read-only; no correction editor |
| F18: Atomic/duplicate-safe updates | No, in minimal form | MUST HAVE | One accepted observation per request; duplicate identical submission is harmless, conflicting replacement is rejected; no silent partial answer |
| F19: Baseline evaluation exercise | Not if claiming interpretation improvement | MUST HAVE: evaluation materials; not an in-product tool | Prepare brief clear-listing/direct-answer/workflow cases and questions. Human participation is conditional; if absent, explicitly report user-value validation as incomplete |
| F20: Repeatable fixtures/checks | No, for a credible technical claim | MUST HAVE | A small predefined evidence suite plus actual browser walkthrough; no exhaustive enterprise test framework |
| F21: Show/reuse previous checks | Yes | DO NOT BUILD DURING MVP | New enquiry gets its own check; reuse expands freshness and eligibility semantics |
| F22: Reuse/invalidation rules | Yes | DO NOT BUILD DURING MVP | Cache validity adds operational assumptions without proving the chosen mechanism |
| F23: Interactive inventory-import review | Yes | COULD HAVE | Only a bounded local-file convenience if all must-haves and validation pass; seed fixtures suffice |
| F24: Authorized source adapter | Yes | DO NOT BUILD DURING MVP | No confirmed real source. Preserve metadata in fixtures without constructing a live integration framework |
| F25: Outcome/effort follow-up | Yes | DO NOT BUILD DURING MVP as product functionality | Use a simple external evaluation sheet if people are available; no follow-up service |
| F26: Completion/burden/acquisition analytics | Yes, as an analytics subsystem | SHOULD HAVE: minimal timing evidence. DO NOT BUILD: dashboard | Creation/check timestamps can be recorded with F06/F07. Real task duration requires observation; acquisition remains unmeasured unless independently collected |

### Experimental candidates

| Feature | Can it be removed? | Classification | Reason |
|---|---|---|---|
| F27: Uncertain transcription review | Yes | DO NOT BUILD DURING MVP | Controlled selection resolves the initial input boundary without prescription images |
| F28: OCR/model candidate generation | Yes | DO NOT BUILD DURING MVP | Adds input-error evaluation and dependencies; not required by the central mechanism |
| F29: Suggested checking priorities | Yes | DO NOT BUILD DURING MVP | One targeted enquiry needs no prioritization model |
| F30: Audit-priority modeling | Yes | DO NOT BUILD DURING MVP | No representative discrepancy ground truth or operational benchmark |
| F31: Package scan/sensor review | Yes | DO NOT BUILD DURING MVP | Typed synthetic identifiers/counts suffice; physical validation is unavailable |
| F32: Instrument integration/calibration | Yes | DO NOT BUILD DURING MVP | Hardware and mapping effort cannot establish extra value within this scope |

### Previously rejected or broader-scope features

All can be removed while retaining the central proposition. All are **DO NOT BUILD DURING MVP**.

| Feature | Why |
|---|---|
| U01: Automatic substitute approval | Violates the clinical decision boundary |
| U02: Guaranteed stock on arrival | No enforced commitment supports the promise |
| U03: Reliability percentage from age | No calibrated evidence supports a probability |
| U04: Blockchain badge | Does not prove physical truth; no justified trust mechanism gap |
| U05: General medical chatbot | Unbounded scope and unsupported interpretation |
| U06: Profiles, streaks, leaderboards | No meaningful trace to the selected user outcome |
| O01: Payments/delivery | Creates a fulfillment business and another journey |
| O02: Stock reservations | Requires allocation, expiry, concurrency, and physical enforcement |
| O03: Demand forecasting | Unrelated analytical objective with missing outcome data |
| O04: Complete inventory ledger | Duplicates established operations and increases maintenance |

## 3. Golden path

**INPUT → PROCESSING → DECISION → OUTPUT → USER VALUE**

| Stage | Concrete scenario | Required behavior |
|---|---|---|
| INPUT | Caregiver selects synthetic product `MED-A`, its visible strength/form, and requests **6 tablets** at `PHARM-A`. Stored claim says **12 tablets**, with a recorded-update time. | Exact identity and unit validated; request persisted; record labeled as recorded, not physically confirmed |
| PROCESSING | Caregiver asks for a check. Staff retrieves the **same enquiry**, inspects its product/quantity, and submits a **simulated physical observation of 4 obtainable tablets** with check time. | Attributed observation saved separately; reporting role checked; original quantity of 12 retained |
| DECISION | Identified product matches; units match; 4 < 6. | Conclusion is **insufficient checked quantity at observation time**, with recorded-versus-observed discrepancy. No alternative product is inferred |
| OUTPUT | Caregiver refreshes the enquiry and sees: “You requested 6 tablets. Staff reported 4 obtainable tablets at [time]. This does not meet your requested quantity. The recorded amount was 12. This check does not reserve stock.” | Source, time, exact request, discrepancy, and limits understandable; simulation clearly disclosed |
| USER VALUE | Caregiver can recognize that the record's positive quantity does not establish enough checked stock for this request. | Demonstrable interpretation task; does not claim an actual avoided trip, acquisition, or clinical benefit |

Before the staff response, the same enquiry must show **pending / availability not yet checked**, not “unavailable.”

A second enquiry with a sufficient observation must work too. This prevents a system that always rejects or says unknown from appearing successful.

## 4. Minimal system shape and integration boundary

```text
Caregiver input ──> request validation/storage ──> pending enquiry
                                                    │
Staff reads same enquiry ──> observation validation ─┘
                                      │
                                      v
                         atomic observation storage
                                      │
                                      v
                       deterministic evidence comparison
                                      │
                                      v
                      caregiver retrieves qualified answer
```

Use one backend and one local database, with one minimal frontend. A standalone comparison function is useful for testing, but is not a completed MVP until actual input, staff submission, storage, retrieval, and result explanation are connected.

Minimal data responsibilities:

| Entity / boundary | Necessary contents or rule |
|---|---|
| Catalog item | Stable synthetic product ID; visible brand/identity details, strength, form, and defined stock unit |
| Inventory claim | Pharmacy/product association; recorded quantity/unit; source and recorded-update time; import/seed time kept distinct |
| Enquiry | Stable ID; product/pharmacy/requested amount/unit; creation time; lifecycle status; saved claim reference or snapshot |
| Observation | Request-linked product/pharmacy; demo staff attribution; obtainable quantity/unit or explicit inability to check; observation time/basis; simulation status |
| Derived answer | Conclusion and reason; linked evidence; discrepancy and limits. Generated from saved state rather than trusting a client-supplied “verified” flag |
| Mutation safety | One accepted report per enquiry; transactionally saved result inputs; repeated identical report returns the saved outcome; differing replacement rejected |

Request shape, strict quantity/unit validation, timestamps, conclusion/reason enums, role permissions, error responses, and duplicate behavior must be finalized before code. This table is a planning boundary, not the full API contract or Pydantic blueprint.

Minimal transitions: **pending → answered** for valid conclusive observations, or **pending → unresolved** for an explicit inability to establish the required evidence. Pending is retained while no report exists. “Answered” describes workflow completion, not guaranteed stock or acquisition. Malformed submissions are rejected without changing saved state.

No correction/reconciliation UI is promised. Unexpected conflicting evidence supplied in fixtures remains unresolved; it is not silently resolved. A conflicting second write must not overwrite the original report.

## 5. Stack and team fit

Pantha's documented strengths are backend, ML, database, and systems. Frontend proficiency is unlisted, not proven absent. The other three members' skills and parallel work allocations do not apply to this solo event.

Retain the preferred **React/Vite + FastAPI/Pydantic** boundary if the existing starter is usable. Use plain styling and simple request/refresh interactions. Avoid introducing an ORM framework, frontend state framework, or component library purely for this scope.

For this local demonstration, use **SQLite instead of the preferred Neon PostgreSQL**: one process, few records, no production deployment requirement, and no need to add remote provisioning/network dependencies. This is a scoped planning deviation, not a change to the preferred-stack document or a claim about current infrastructure. If a working existing database path is already established, do not migrate it merely to satisfy this plan; verify reuse is simpler first.

**Gemini/other model calls, WebSockets, SSE, vector search, and cloud deployment are unnecessary.** The proposition requires deterministic evidence comparison, not generated intelligence. ML expertise does not justify consuming the deadline with an unrelated model.

## 6. Six-hour execution budget and completion gates

One developer works sequentially; the timetable assumes no other teammate contribution.

| Elapsed time | Work | Gate / scope consequence |
|---|---|---|
| 00:00–00:30 | Freeze scenario, data/API contracts, units, roles, and expected conclusions; inspect/reuse the existing starter | No new requirements after the gate. Use explicit selection and one pharmacy |
| 00:30–01:30 | Connect caregiver request → shared saved state → staff submission → caregiver answer | A thin vertical slice must work, even if explanation is plain. Do not build isolated dashboards first |
| 01:30–03:00 | Complete retained evidence, validated observations, comparison reasons, pending/unresolved behavior, and plain-language result | Main discrepancy journey and a sufficient result both work through the actual interface |
| 03:00–04:00 | Add minimum role boundary, duplicate-safe submission, uncertain-save inspection, and relevant failure behavior | No fake success, overwritten evidence, or unhandled ambiguity. No optional feature work if these fail |
| 04:00–05:00 | Run meaningful behavior tests and browser journeys; prepare baseline questions; fix confirmed failures | Stop scope expansion. Human evaluation only if someone is available; otherwise disclose it as unverified |
| 05:00–06:00 | Rehearse ≤4-minute pitch, verify startup/reset, prepare disclosures and backup evidence | No new features. Stabilize the same working build and repeat the demonstrated journey |

If the vertical slice is not working by 01:30, simplify presentation, fixtures, and navigation immediately. Do not respond by adding dependencies. If frontend setup remains the blocker, a minimal backend-served interface can replace the frontend shell while preserving the defined request/observation/answer behavior; do not maintain two interfaces.

At 04:00, SHOULD/COULD features are closed unless already complete and no required failures remain. Remove optional presentation complexity before removing evidence integrity or uncertainty behavior.

## 7. Definition of done and credible validation

### Technical and browser checks

| Case | Required evidence |
|---|---|
| Main discrepancy journey | Request 6, record 12, check 4 → insufficient; record and observation both retained through the actual interface |
| Sufficient checked quantity | Exact product/unit with checked amount ≥ requested → sufficient at observation time; not reserved |
| Zero checked versus no check | Zero observation → insufficient; pending enquiry → not yet checked, not a stockout |
| Explicit failed check | Staff cannot establish amount/identity/time → unresolved explanation; no successful-verification label |
| Wrong identity/unit or invalid quantity | Backend rejects malformed/mismatched input; saved state unchanged; caregiver sees no false match |
| Missing or stale time | Missing physical-check time cannot establish freshness; old time shown accurately without an invented guarantee or reliability percentage |
| Contradictory observations | Fixture-level evaluator test remains unresolved unless explained reconciliation exists; no such workflow is built |
| Repeated/conflicting submission | Same report does not create extra evidence; different replacement does not overwrite it |
| Uncertain response after submission | Retrieval establishes saved status before another action; cannot claim success solely from a click |
| Actor boundary | Caregiver cannot submit an accepted staff-attributed report; demo credential limits disclosed |

Run focused rules/storage/API checks and a full browser journey with the two actor contexts. A backend test alone is insufficient evidence that the requester can reach and interpret the actual result. Fixtures must identify synthetic values and expected outcomes before tests are run.

### User-value evidence

Prepare matched cases in three forms: a listing with clear caveats, an accurate direct staff answer, and the proposed workflow. Ask about exact quantity sufficiency, observation basis/time, discrepancy, and whether stock is held. Include both supported and unsupported positive cases; measure raw correct counts and denominators.

If participants are available, record a small, clearly described comparison and limitations; distinguish evaluation interaction from actual clinical use. If only the developer walks through it, report **technical demonstration completed; caregiver comprehension benefit unverified**. Do not present developer expectations as user evidence.

The MVP is credible when one complete journey, supported-positive recognition, relevant uncertainty handling, saved-state integrity, and honest disclosures work. The stronger proposition of improved real caregiver interpretation requires participant evidence; real acquisition/time savings require field evidence beyond this MVP.

## 8. Attractive but dangerous time sinks

| Temptation | Why attractive | Why dangerous here |
|---|---|---|
| AI/OCR prescription interpretation | Uses the developer's ML strengths and looks impressive | Expands identity uncertainty, validation, privacy, and external-service handling before the core is proven |
| Multi-pharmacy maps/search ranking | Appears to solve the whole search journey | Adds geography, coverage, filtering, and stale-data complexity; one-store evidence comparison is enough |
| Live pharmacy/POS integration | Makes the demo appear operational | No source access confirmed; mapping, permissions, credentials, and synchronization can consume the event |
| Reservation/hold workflow | Seems to turn an answer into certainty | Requires physical enforcement, concurrency, expiration, and unfair/no-show allocation decisions |
| Full login/onboarding | Looks production-ready | Accounts, recovery, roles, and partner verification are another product; use narrowly protected, disclosed demo roles |
| WebSockets, notifications, SMS | Makes responses look live | Adds channel delivery and disconnect failure modes; explicit refresh completes the mechanism |
| Correction/reconciliation editor | Appears to handle every mistake | Adds mutable history and invalidation paths; keep one accepted observation and immutable evidence for this demo |
| Inventory ledger/cloud migration | Plays to backend skills | Duplicates existing tools and adds operational dependencies unrelated to the selected claim |
| Risk scores/demand dashboard | Creates visually persuasive insights | No representative labels/outcomes justify accuracy, calibration, or usefulness |
| Hardware sensing/scanning | Visually tangible novelty | Calibration and identifier mapping do not automatically establish obtainable stock |
| UI design-system work | Makes the product feel complete | Frontend capacity is unknown; visual breadth can displace testing and rehearsal |
| Interactive A/B analytics product | Looks like rigorous validation | A short external comparison sheet is enough; building evaluation software consumes time needed to evaluate |

## 9. Scope freeze

The MVP delivers **exact request → staff check → evidence comparison → qualified caregiver answer**, with local shared state and a focused validation package.

It does not promise correct physical reports, medical suitability, availability on arrival, professional participation, full connectivity resilience, lower real travel cost, or improved health outcomes. These limits must be visible in the technical explanation and demo.

The smallest credible system is a connected evidence workflow, not a catalog plus unrelated forms. If it cannot outperform a clear baseline answer in interpretation or acceptable effort, revise or reject the proposition rather than adding features to hide the result.
