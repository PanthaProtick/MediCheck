# Possible Features and Their Traceability

Prepared: **7 October 2026**.

Sources: [central proposition](proposition.md), [needs](needs.md), [problem decomposition](decomposed_problem.md), [research](background_research.md), [comparison](comparison.md), and the capability tree derived in the conversation.

This is a feature candidate inventory, not an implementation checklist or selected MVP. Features are proposed, not verified as implemented. No technology stack is selected. Before functional implementation, define lightweight request, observation, conclusion, error, and state-transition contracts.

## Classification and evidence boundaries

- **Core:** directly realizes an indispensable part of the proposition or its safety/reliability boundary. Equivalent implementations can satisfy the same requirement; every proposed representation is not mandatory.
- **Supporting:** makes the core operable, recoverable, understandable, or evaluable.
- **Differentiating:** a candidate mechanism or presentation that could improve performance against a simpler baseline. This is a hypothesis, not proof of novelty or superiority.
- **Nice-to-have:** meaningfully traced but not essential to the initial proposition.
- **High-risk experimental:** depends on uncertain input interpretation, modeling, hardware, or substantial validation.

Feature classifications and capability categories answer different questions. A Core feature may also have a **Differentiating hypothesis**; this does not make it globally novel. A capability can be essential while a particular richer interface for it is optional.

Traceability status:

- **JUSTIFIED:** a meaningful connection to the current proposition and original problem is identifiable; benefit still needs evidence.
- **CONDITIONAL:** meaningful connection exists, but a partner, data source, or measurable local gap is unconfirmed.
- **UNJUSTIFIED:** no defensible chain to this proposition, or the proposed feature contradicts its evidence boundaries.
- **OUT OF SCOPE:** addresses a different legitimate need in the broader brief, but is not required by this proposition. This is distinct from being unjustified.

## Traceability references

The following P and L identifiers are local references for this document, not new organizer requirements. A trace must be read together with its behavior and rationale, not as justification by identifier alone.

### Original problem anchors

| ID | Original problem statement anchor |
|---|---|
| P01 | Medicine requests can be incomplete, ambiguous, or inconsistent; form, strength, and quantity matter |
| P02 | Inventory records can differ from physically available stock; recorded information must be distinguished from checked information |
| P03 | Availability changes quickly; information may be stale or uncertain |
| P04 | Apparent alternatives must not be interpreted as medically appropriate without professional judgment |
| P05 | People may repeatedly contact or visit stores; staff answer enquiries alongside other duties |
| P06 | The journey must move from medicine needed through information discovery/evaluation to an appropriate next action |
| P07 | Slow/intermittent connectivity and limited staff update capacity constrain practical use |

### Existing limitations from the research and comparison

These limitations occur in some approaches or contexts; they are not claims about every existing product.

| ID | Limitation | Evidence boundary |
|---|---|---|
| L01 | Name similarity or incomplete reference information does not establish exact product identity | Catalog/matching limitations documented; local error rate unknown |
| L02 | Recorded quantity does not independently establish obtainable physical quantity | Explicit brief premise; local discrepancies unmeasured |
| L03 | Observation, import, and publication times can be confused; past availability does not guarantee future stock | Stock-checker limits and synchronization mechanisms documented; local comprehension unknown |
| L04 | Enquiries may require repeated work or remain without a clear reply/owner | Workflow inference; local frequency unknown |
| L05 | Medical suitability does not follow from identity matching, stock data, or a similarity score | Explicit safety boundary |
| L06 | Another stock system can duplicate staff entry and maintenance | Existing stock tools documented; local installed systems and effort unknown |
| L07 | Uncertainty may be hidden or difficult for the person to interpret | Plausible gap, not a proven absence in existing services |
| L08 | Disconnected/offline work can lag shared information or lose progress | Synchronization limits documented; actual interruptions unknown |
| L09 | A working mock or capability list does not establish comprehension, physical accuracy, acquisition, or acceptable staff burden | Research/validation boundary |
| L10 | Manual checking has a cost, while statistical or sensor signals do not themselves verify stock | Established approaches; local comparative performance unknown |

Need IDs retain their definitions in [needs.md](needs.md). Trace notation is always **FEATURE → CAPABILITY → USER NEED → EXISTING LIMITATION → ORIGINAL PROBLEM**.

## Capability tree covered by the features

```text
Request-specific availability verification
├── CORE
│   ├── C1 Exact, interpretable request
│   ├── C2 Distinct claims and provenance
│   ├── C3 Request-specific check coordination
│   ├── C4 Attributed physical observation
│   ├── C5 Bounded availability conclusion
│   └── C6 Honest communication of conclusion and limits
├── SUPPORTING
│   ├── S1 Understandable actor interactions
│   ├── S2 Progress preservation and recovery
│   ├── S3 Corrections and submission-failure handling
│   └── S4 Verification and comparative evaluation
├── ENHANCING
│   ├── E1 Avoidable repeat-check reduction
│   ├── E2 Existing inventory reuse
│   └── E3 Operational/acquisition outcome measurement
└── EXPERIMENTAL
    ├── X1 Difficult name/prescription interpretation
    ├── X2 Check-priority prediction
    └── X3 Instrument-assisted physical observation
```

## CORE capabilities: possible features

### C1 — Establish an exact, interpretable request

Why this capability exists: checking the wrong product or comparing undefined units invalidates the answer.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F01: Exact-product and quantity request | User-visible | Core / JUSTIFIED | Select a controlled product identity with visible distinguishing details; enter requested amount and unit. Unidentified requests remain unresolved rather than defaulting to a plausible medicine. | F01 → C1 → N01/N06 → L01 → P01/P06 |
| F02: Identity and unit validation | Technical | Core / JUSTIFIED | Validate catalog identity, quantity constraints, and unit semantics; unknown or incompatible units cannot generate a sufficiency result. Reject malformed input with an understandable reason. | F02 → C1 → N01/N06 → L01/L02 → P01/P02 |

### C2 — Preserve distinct evidence and provenance

Why this capability exists: replacing a stock record with a check would hide the disagreement and its basis.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F03: Record-versus-check comparison | User-visible | Core; Differentiating hypothesis / JUSTIFIED | Distinguish recorded amount from staff-reported obtainable amount, each with source and relevant time; explicitly explain disagreement. The format could be text rather than a complex dashboard. | F03 → C2 → N04/N05 → L02/L03/L07 → P02/P03 |
| F04: Separate claim and observation storage | Technical | Core / JUSTIFIED | Preserve original claims and separately attributed observations, linked to product/pharmacy/request. Import time and check time remain different fields; missing metadata remains unknown. | F04 → C2 → N04/N05 → L02/L03 → P02/P03 |

### C3 — Coordinate a request-specific check

Why this capability exists: the proposition needs a complete request-to-answer handoff, not disconnected input forms.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F05: Request check and see its status | User-visible | Core / JUSTIFIED | Submit the identified request to one participating pharmacy; see pending, answered, or unresolved status. An acknowledgement is not a completed check; silence is not a stockout. | F05 → C3 → N03/N04/N06 → L04/L07 → P02/P05/P06 |
| F06: Pharmacy-bound enquiry lifecycle | Technical | Core / JUSTIFIED | Stable request ID, target pharmacy, actor responsibilities, allowed transitions, and links to the relevant observations. A changed product/quantity cannot silently inherit an old answer. | F06 → C3 → N03/N04/N06 → L04/L02 → P02/P05/P06 |

### C4 — Capture an attributed physical observation

Why this capability exists: the answer needs evidence about the exact item and obtainable quantity, not a second inventory estimate.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F07: Request-specific staff check submission | User-visible | Core / JUSTIFIED | Staff see the exact request and report obtainable amount, unit, observation time/basis, and unresolved checking issues. Demonstration observations must be identified as simulated. | F07 → C4 → N04/N06/N11 → L02/L04 → P01/P02/P05 |
| F08: Observation integrity and reporting authority | Technical | Core / JUSTIFIED | Attribute reports to the permitted staff actor/pharmacy; validate product, quantity, time, and request association. Requesters cannot invent a staff-confirmed observation. Demo identities can be fixed and disclosed; production identity assurance is not implied. | F08 → C4 → N04/N05 → L02/L07 → P02/P03/P06 |

### C5 — Derive a bounded availability conclusion

Why this capability exists: positive recorded stock is not enough to conclude that the request is met.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F09: Request-specific sufficiency answer | User-visible | Core; Differentiating hypothesis / JUSTIFIED | Explain sufficient or insufficient checked quantity at the observation time, or unresolved evidence. Keep “zero checked” distinct from “not checked”; show the reason and relevant disagreement. | F09 → C5 → N04/N06 → L02/L07 → P01/P02/P06 |
| F10: Deterministic comparison and conflict rules | Technical | Core / JUSTIFIED | Evaluate exact identity and comparable units; retain uncertainty for missing/invalid evidence. Record-versus-check disagreement stays visible; conflicting checks require explicit reconciliation, not automatic latest-timestamp selection. | F10 → C5 → N01/N04/N06 → L01/L02/L07 → P01/P02/P06 |

### C6 — Communicate conclusions without overstatement

Why this capability exists: correct internal data handling fails the proposition if the caregiver misunderstands it.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F11: Plain-language evidence and limits | User-visible | Core / JUSTIFIED | State exact request, conclusion, checking basis/time, and unanswered issues. A sufficient observation means sufficient then; it does not mean held until arrival or professionally approved for use. | F11 → C6 → N05/N06/N07/N09 → L03/L05/L07 → P01/P03/P04/P06 |
| F12: Controlled conclusion wording | Technical | Core / JUSTIFIED | Render defined conclusion/reason types consistently. Never generate unsupported “safe substitute,” “guaranteed,” or “currently verified” claims from incomplete evidence. Explain the actual uncertainty rather than relying only on a general disclaimer. | F12 → C6 → N05/N07/N09 → L03/L05/L07 → P03/P04/P06 |

## SUPPORTING capabilities: possible features

### S1 — Make actor interactions understandable

Why this capability exists: caregivers must understand the answer and staff must be able to provide it without excessive interaction effort.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F13: Focused requester and staff interactions | User-visible | Supporting / JUSTIFIED | Each actor sees the next responsibility, clear error/status text, and the minimum required fields. Use text as well as color for outcomes; do not bury uncertainty behind optional detail. | F13 → S1 → N03/N05/N11 → L04/L07 → P05/P06 |
| F14: Consistent field and status semantics | Technical | Supporting / JUSTIFIED | Share defined labels, unit formatting, validation messages, and meaning across requester/staff paths so the same evidence is not described differently. Does not require a large design system. | F14 → S1 → N05/N06/N11 → L07/L04 → P01/P05/P06 |

### S2 — Preserve and recover enquiry progress

Why this capability exists: the enquiry spans multiple steps; accidental interruption should not force another request.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F15: Reopen an existing enquiry | User-visible | Supporting / JUSTIFIED | Recover the request and known status after navigation or refresh. A previously retrieved answer retains its observation time; reopening it is not a fresh check. | F15 → S2 → N03/N09/N11 → L08/L03/L04 → P03/P05/P07 |
| F16: Durable enquiry and evidence retrieval | Technical | Supporting / JUSTIFIED | Persist stable references and retrieve current saved state with actor-appropriate access. Explicitly distinguish stored state from live physical availability; full offline synchronization is not implied. | F16 → S2 → N04/N09/N11 → L08/L03 → P02/P03/P07 |

### S3 — Handle corrections and submission failures

Why this capability exists: ordinary input errors or uncertain submission results should not silently corrupt evidence.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F17: Explain corrections and uncertain saves | User-visible | Supporting / JUSTIFIED | Staff can correct a mistaken report with a reason while the earlier report remains traceable. When save success is unknown, the interaction checks saved state rather than declaring success or immediately creating another report. | F17 → S3 → N04/N05/N11 → L02/L07/L04 → P02/P03/P05 |
| F18: Atomic, duplicate-safe evidence updates | Technical | Supporting / JUSTIFIED | Apply report/state changes atomically; reject stale conflicting edits or reconcile explicitly; use submission identifiers to avoid duplicate reports. Unknown submission outcome is inspected before retry. | F18 → S3 → N04/N11 → L02/L04 → P02/P05 |

### S4 — Enable verification and comparative evaluation

Why this capability exists: the proposition's interpretation benefit is a hypothesis and must be tested against strong baselines.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F19: Baseline-versus-workflow evaluation exercise | User-visible to evaluator/participant | Supporting / JUSTIFIED as validation | Present equivalent cases using a clear-caveat listing, accurate direct-staff answer, and proposed workflow; ask predefined evidence questions. This is an evaluation instrument, not a mandatory customer feature. | F19 → S4 → N04/N05/N06 → L09/L07 → P02/P03/P06 |
| F20: Repeatable evidence fixtures and checks | Technical | Supporting / JUSTIFIED as validation | Predetermine sufficient, insufficient, ambiguous, unanswered, missing-time/unit, and conflicting cases. Check conclusions and preservation of evidence; report failures honestly. Passing tests does not prove user comprehension. | F20 → S4 → N01/N04/N05/N06/N07 → L09/L01/L02/L05 → P01/P02/P03/P04/P06 |

## ENHANCING capabilities: possible features

### E1 — Reduce avoidable repeated checking

Why this capability exists: some repeated enquiries may be answered from the same evidence without pretending a new check occurred.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F21: Show a relevant previous check before requesting another | User-visible | Differentiating hypothesis / CONDITIONAL | Present a previous exact-product observation with age, quantity, and limitations, and allow an explicit fresh-check request. Does not silently turn past evidence into current confirmation. | F21 → E1 → N05/N09/N11 → L03/L04/L10 → P03/P05 |
| F22: Bounded evidence reuse/invalidation | Technical | Nice-to-have / CONDITIONAL | Match reusable evidence only under explicit identity, quantity, and policy conditions; known changes invalidate reuse. Age thresholds are operational policies, not correctness probabilities. | F22 → E1 → N04/N09/N11 → L03/L04/L10 → P02/P03/P05 |

### E2 — Reuse existing inventory information

Why this capability exists: another full ledger can add work without improving physical accuracy.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F23: Review a bounded inventory import | User-visible | Nice-to-have / CONDITIONAL | Staff inspect accepted/rejected source records and unresolved mappings. In the hackathon this may be a disclosed synthetic file; no real pharmacy connection is implied. | F23 → E2 → N04/N11 → L06/L02 → P02/P05/P07 |
| F24: Authorized source adapter with provenance | Technical | Nice-to-have; Differentiating hypothesis / CONDITIONAL | Import permitted fields with explicit product/unit mappings, source record IDs, and separate import/source-update times. Reject ambiguous records; do not overwrite checks. | F24 → E2 → N04/N05/N11 → L06/L03/L01 → P01/P02/P03/P05 |

The added-value hypothesis is less duplicate work with preserved evidence semantics, not merely “we support CSV.” A reliable authorized source is unconfirmed.

### E3 — Measure burden and acquisition outcomes

Why this capability exists: interpretation benefit may be outweighed by staff effort, and an answer is not proof of acquisition.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F25: Optional outcome and effort follow-up | User-visible | Nice-to-have / CONDITIONAL | Ask whether the requested medicine was obtained and why not, or measure staff task duration with consent. Nonresponse remains unknown; avoid requesting unnecessary medical details. | F25 → E3 → N10/N11 → L09/L10 → P05/P06 |
| F26: Separate completion, delay, burden, and acquisition measures | Technical | Supporting for evaluation; richer reporting Nice-to-have / CONDITIONAL | Record request/answer times, include unresolved enquiries, and retain acquisition as a separate known/unknown outcome. Baseline measurements distinguish added value from transferred workload. | F26 → E3 → N03/N10/N11 → L09/L04/L10 → P05/P06 |

Minimal timestamps can reuse F06 rather than require another analytics subsystem. Click counts alone are not measured labour or health benefit.

## EXPERIMENTAL capabilities: possible features

### X1 — Interpret difficult name or prescription input

Why this capability exists: input coverage could expand beyond the controlled catalog journey; it is unnecessary for the initial proposition.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F27: Review uncertain transcription/candidate identities | User-visible | High-risk experimental / CONDITIONAL | Show original synthetic input and competing interpretations for explicit clarification. Never auto-accept a product or hide omitted strength/form. | F27 → X1 → N01/N06 → L01 → P01 |
| F28: Candidate generation with abstention | Technical | High-risk experimental / CONDITIONAL | Approximate matching or OCR/model assistance produces candidates, not a medical fact. Benchmark false matches and unresolved cases against simple aliases and human clarification. | F28 → X1 → N01/N06/N07 → L01/L05/L09 → P01/P04 |

### X2 — Predict which stock claims need checking

Why this capability exists: prioritization might focus staff effort where records are least dependable, if representative evidence exists.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F29: Suggested check priorities with reasons | User-visible | High-risk experimental / CONDITIONAL | Suggest records to investigate, exposing signals and allowing staff override. Absence from the list is not stock certification. | F29 → X2 → N04/N11 → L10/L02 → P02/P05 |
| F30: Rule/model audit-priority evaluation | Technical | High-risk experimental / CONDITIONAL | Compare simple rules and, only with adequate data, statistical models against actual discrepancies. Predictions remain separate from observations; do not fabricate calibrated reliability scores. | F30 → X2 → N04/N11 → L10/L09 → P02/P05 |

### X3 — Instrument-assisted physical observation

Why this capability exists: package capture or measurement might reduce entry/counting effort, but requires real physical validation.

| Feature | Kind | Classification / status | Behavior and rationale | Full trace |
|---|---|---|---|---|
| F31: Scan package details or review a measured count | User-visible | High-risk experimental / CONDITIONAL | Staff review supported package identifiers or sensor estimates before reporting obtainable quantity; unresolved mappings and condition/reservation questions stay explicit. | F31 → X3 → N01/N04/N06/N11 → L01/L02/L10 → P01/P02/P05 |
| F32: Instrument adapter and calibration/mapping checks | Technical | High-risk experimental / CONDITIONAL | Decode identifiers or ingest calibrated measurements with device/source/time metadata. Weight or scan events cannot automatically establish usable saleable quantity. Simulated readings prove only adapter behavior. | F32 → X3 → N04/N06/N11 → L02/L09/L10 → P01/P02/P05 |

## Features rejected or outside the central proposition

These entries are deliberate scope checks, not suggestions to implement. Their claimed chains fail or point to a different intervention.

| Candidate feature | Classification | Attempted trace | Status and reason |
|---|---|---|---|
| U01: Automatic substitute approval | High-risk experimental label does not make it acceptable | U01 → claimed C1/C5 → N07 → L05 → P04 | **UNJUSTIFIED:** C1/C5 establish identity and stock evidence, not medical authority; contradicts the proposition and safety boundary. |
| U02: “Guaranteed available on arrival” after a check | No justified category | U02 → claimed C6 → N09 → L03 → P03 | **UNJUSTIFIED:** no operational stock commitment or enforcement capability exists; a past observation cannot support this claim. |
| U03: Pharmacy reliability percentage from a chosen age threshold | High-risk experimental if treated as a future research idea | U03 → claimed X2 → N04/N05 → L02/L03 → P02/P03 | **UNJUSTIFIED in this form:** no representative labels or calibration establish a probability; a timestamp is not a reliability percentage. |
| U04: Blockchain verification badge | No justified category | U04 → claimed C2 → N04 → L02 → P02 | **UNJUSTIFIED:** tamper evidence does not establish physical accuracy; no observed multi-party ledger-trust gap warrants this mechanism. |
| U05: General medical chatbot | High-risk experimental | U05 → no current capability → broad health assistance → no identified limitation for this proposition → no specific original journey failure | **UNJUSTIFIED:** no bounded role or measurable contribution; invites unsupported medical interpretation and expands scope. |
| U06: Social profiles, streaks, leaderboards | Nice-to-have label would be misleading | U06 → no capability → no documented need → no existing limitation → no meaningful original problem anchor | **UNJUSTIFIED:** cannot complete the traceability chain; engagement alone is not our outcome. |
| O01: Payments and home delivery | Not classified for this scope | O01 → requires new fulfillment capability → N10 → access barriers → P06 | **OUT OF SCOPE:** legitimate broader acquisition needs, but requires logistics and operating authority beyond this proposition. |
| O02: Time-limited stock reservation | Potentially Core to a different proposition | O02 → requires enforced allocation capability → N09 → L03 → P03 | **OUT OF SCOPE:** changes the promise from observation to commitment; introduces expiry, concurrency, and physical enforcement. |
| O03: Unmet-demand forecasting dashboard | High-risk experimental | O03 → requires separate demand capability → N12 → missing outcome linkage → broader pharmacy demand problem | **OUT OF SCOPE:** N12 exists in the broader brief, but does not justify a forecasting subsystem in this proposition. |
| O04: New complete pharmacy inventory ledger | Not classified for this scope | O04 → requires full stock-management capability → N04/N11 → L06 → P02/P05 | **OUT OF SCOPE; likely counterproductive without evidence:** established tools already cover it; the current mechanism records evidence without replacing inventory operations. |

## Six-hour planning interpretation

- The viable candidate set is F01–F12 with minimal S1–S4 support. This is still a set of behaviors to scope, not permission to build every rich variant.
- Reuse shared request IDs, timestamps, rules, and explanation semantics rather than implement separate subsystems for every row.
- A small controlled catalog, synthetic records, one pharmacy, fixed disclosed demo actors, and one complete journey can realize the proposition. Production authentication, partner onboarding, and live integrations must not be implied by this demonstration.
- Experimental features are not needed to prove the central mechanism. Enhancements require evidence that they improve value rather than add another workflow.
- Differentiation must be evaluated against a clear-caveat listing and an accurate direct staff answer. If those baselines perform equally well at less effort, the corresponding feature has not earned its complexity.
- No feature may claim real physical verification, safe substitution, guaranteed stock, or improved acquisition merely because a synthetic scenario or software test passes.

Every F01–F32 candidate has a stated chain and a reason. Conditional traces identify missing evidence or resources; they do not establish effectiveness. Rejected U entries expose broken chains, while O entries preserve the distinction between a real broader need and the selected proposition.
