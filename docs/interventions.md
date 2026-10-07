# Intervention Alternatives: The Last-Mile Medicine Gap

Sources: [needs.md](needs.md), [decomposed_problem.md](decomposed_problem.md), and [organizer brief](solo_hackathon_6h_problem.md).

Purpose: explore fundamentally different ways to address each need. These are concepts, not selected features, implementation plans, or a recommended winner. Each section follows **Need → Intervention concept → How it would work → Required resources → Main advantage → Main weakness → Hackathon feasibility**.

## Interpretation and feasibility boundaries

- All benefits are hypotheses. The brief provides synthetic scenarios, not measured evidence of effectiveness or adoption.
- Feasibility is assessed for **one participant within a total six-hour event**, with documented backend, database, ML, and systems strengths. Frontend proficiency and actual time remaining are unknown.
- **High:** a narrow demonstrator could plausibly fit the event with simple local data and limited interaction. This does not mean the whole intervention is deployable.
- **Conditional:** feasible only with a ready dependency, tightly bounded scope, or disclosed simulation; otherwise significant integration or validation risk.
- **Low:** a workflow illustration may fit, but credible physical, institutional, or operational validation is unlikely within six hours.
- Assessments apply to an individual bounded concept. Building all alternatives or all needs is not feasible within the event.
- Process-only alternatives can reveal simpler ways of addressing the problem. On their own they do not satisfy the organizer's requirement for a practical digital prototype.
- Existing inventory access, partner participation, professional availability, hardware, service accounts, validated catalogs, and labeled training data are **not established**. None is assumed to exist.
- Software prototypes need lightweight input/output contracts before implementation. No technology stack is selected here.
- Recorded stock, physical observation, future stock commitment, product identity, and medical suitability are distinct claims. No approach may silently collapse them.
- Real prescriptions or enquiries can be sensitive. Use disclosed synthetic examples for the hackathon; real data handling requires appropriate permissions and minimization.
- AI is optional. None of the concepts gives software independent authority to approve medicine substitution or interpret uncertain output as medical fact.

## N01 — Establish the requested product without hiding ambiguity

**Need:** The request must be accurately understood, or remain explicitly unresolved. **Priority: Critical.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N01-A: Structured read-back process | Staff repeat the name, strength, form, and other necessary identifying details back to the person; missing or conflicting details trigger clarification rather than guessing. | Agreed checklist, staff participation, sample requests. | Changes communication at the point ambiguity enters; requires no complex technology. | Staff time and cooperation; read-back cannot resolve information nobody possesses. | **High** for a role-play; **Conditional** for a digital record of the process. Real error reduction requires observation. |
| N01-B: Curated catalog and deterministic matching | Compare entered details against controlled product identities and documented aliases. Return possible identities or unresolved status; never silently map an ambiguous name to one product. | Bounded synthetic catalog, alias rules, explicit identity distinctions, ambiguity test cases. | Inspectable decisions and predictable behavior on a known catalog. | Maintenance burden; missing aliases and catalog errors; lexical similarity does not establish identity. | **High** for a small catalog; full catalog coverage is unverified. |
| N01-C: Direct identifier capture | When original packaging is available, staff capture its identifier and verify the label details against a catalog. An unknown identifier remains unknown. | Packaging or synthetic identifiers, phone/scanner if available, identifier-to-product mapping. | Avoids some transcription and name ambiguity. | Unavailable packaging; catalog gaps; identifies a package, not prescription suitability. | **Conditional** using ready equipment or typed synthetic identifiers; real catalog integration is outside the demonstrated boundary. |
| N01-D: AI-assisted transcription with human confirmation | A model proposes text or candidate identities from synthetic prescription images or typed input. A person checks the original and confirms details; unresolved candidates are retained. | Ready model access, synthetic examples, source display, human review, error evaluation. | Could assist with input that strict text matching cannot interpret. | Hallucinations, missed distinctions, anchoring the reviewer to a wrong suggestion, privacy and dependency risks. | **Conditional** if access is ready; handwritten-input performance and clinical interpretation cannot be claimed from a few examples. |

## N02 — Find credible availability information with less repeated searching

**Need:** Reach a relevant next action with less unnecessary enquiry and travel. **Priority: Important.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N02-A: Human enquiry coordinator | One coordinator receives a sufficiently identified request, contacts participating stores, and relays answers with their checking basis and times. | Coordinator time, store contacts, participation agreements, enquiry log. | Removes repeated explanation from the searcher's workload and handles unusual cases. | Transfers rather than eliminates work; coordinator becomes a bottleneck; limited operating hours. | **High** for a synthetic role-play; **Low** for demonstrating sustainable service coverage. |
| N02-B: Shared stock-information index | Participating stores contribute records or exports; a shared lookup presents relevant claims while preserving source, uncertainty, and missing coverage. | Consented data access, common product identities, imports, source metadata. | Reuses information across enquiries instead of contacting each store every time. | Aggregation can spread stale errors; stores outside the index remain invisible. | **High** on supplied synthetic records; **Conditional** for real imports and participation. |
| N02-C: Request-driven store enquiry | Send one bounded request to relevant participating stores; collect explicit replies until a deadline. Silence means no answer, not unavailable. | Store directory, communication channel, response ownership, deadlines and request IDs. | Seeks answers about the specific request instead of relying only on standing listings. | Interrupts several stores, response delays, message overload, and coverage gaps. | **Conditional** with local simulated responders; actual messaging access and staff response rates are unknown. |

## N03 — Obtain an answer within a workable time

**Need:** Get a dependable answer without excessive waiting or disruption of other duties. **Priority: Important.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N03-A: Enquiry duty and scheduled callbacks | Assign an enquiry owner during a shift; acknowledge unanswered requests and give a realistic callback window, without implying stock confirmation. | Staff roster, workload agreement, callback log. | Reduces unclear responsibility and repeated interruptions. | May be impossible for a very small store; scheduling delays answers and does not reduce total work. | **High** for a simulated workflow; staffing feasibility requires real observations. |
| N03-B: Automatic factual reply from existing records | Provide an immediate, clearly qualified recorded answer when product identity and data are sufficient; uncertain cases remain awaiting checking. | Accessible records, deterministic reply conditions, uncertainty handling. | Fast response for straightforward enquiries. | A quick recorded answer may be useless if physical verification is essential; stale data risk persists. | **High** with synthetic records; real-system access is **Conditional**. |
| N03-C: Asynchronous request ownership | Record the request once; assign it to staff, retain pending/unanswered status, and communicate a completed answer when available. | Request lifecycle, staff ownership, timestamps, communication channel or local simulation. | Searcher does not have to stay on a call; unanswered work is visible. | Does not guarantee faster service; creates another queue and possible forgotten handoffs. | **High** for a local lifecycle demo; external delivery is **Conditional**. |

## N04 — Distinguish recorded stock from checked usable stock

**Need:** Know what a stock claim establishes and whether discrepancies remain unresolved. **Priority: Critical.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N04-A: Targeted physical verification | Staff check the specific requested product, usable quantity, and relevant reservations when a record is doubtful; record the observation separately from the inventory entry. | Staff time, access to shelves, agreed counting definitions and observation log. | Direct evidence for the specific enquiry. | Interruptions and human counting errors; observation can immediately become outdated. | **High** for a synthetic discrepancy walkthrough; operational burden is unverified. |
| N04-B: Transaction and adjustment reconciliation | Account for sales, reservations, releases, damage, and adjustments as separate events; expose disagreements rather than overwriting evidence silently. | Existing transaction access or simulated events, product IDs, event ordering and duplicate handling. | Helps explain why records diverge and can reduce missed updates. | Unrecorded physical events remain invisible; lost, duplicated, or late events cause new errors. | **Conditional** for a bounded simulation; real integration and reconciliation are substantial work. |
| N04-C: Risk-based stock checking | Use rule-based discrepancies, frequent changes, or previous mismatches to decide which records deserve a physical check first. Signals request checking rather than certifying stock. | Historical checks or disclosed synthetic history, simple risk rules, staff checking capacity. | Concentrates scarce checking effort on potentially unreliable records. | Quiet records can still be wrong; prioritization cannot establish truth and thresholds need evidence. | **High** for illustrative rules; effectiveness is unverified without actual discrepancy data. |
| N04-D: Instrumented shelf observation | A dedicated shelf or bin uses weight or scan events to estimate quantity; staff separately assess damage, reservations, and unidentified changes. | Sensor/scanner, calibration, product-specific assumptions, physical setup, maintenance. | Provides another observation channel independent of manual inventory entry. | Movement or weight does not prove identity, usability, or saleable quantity; mixed packaging and calibration errors. | **Low** for credible hardware validation; simulated signals must be disclosed and do not prove sensor accuracy. |

## N05 — Understand the basis and age of an availability claim

**Need:** Judge whether a claim supports the intended action without mistaking record updates for verification. **Priority: Critical.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N05-A: Standard communication wording | Staff state whether an answer comes from records or a physical check, when it was checked, and any limits before the person relies on it. | Staff script, agreed terminology, training, sample enquiries. | Addresses misleading certainty at the moment of communication. | Inconsistent adherence; users may not remember caveats; not independently auditable. | **High** for role-play; comprehension improvement needs user evidence. |
| N05-B: Claim provenance and expiry rules | Keep observation time, import time, source, and verification type distinct. Apply disclosed age rules to mark claims as needing rechecking; missing times remain unknown. | Metadata, time conventions, simple policy rules, clock test cases. | Makes the basis of a claim inspectable and avoids “recent import equals recent check.” | A chosen age threshold is not a calibrated probability of correctness; metadata can be false. | **High** for synthetic cases; real thresholds and metadata trust are unvalidated. |
| N05-C: Confirmation at the moment of decision | Before a planned visit, seek a new check for that exact product and quantity; unanswered requests remain unresolved. | Responsive staff, identified request, agreed confirmation process. | Reduces reliance on an older standing claim. | Adds work and waiting; even a new check does not guarantee future availability. | **Conditional** with simulated checks; real response capacity is unknown. |

## N06 — Know whether availability meets the exact request

**Need:** Distinguish obtainable requested stock from related products or insufficient quantities. **Priority: Critical.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N06-A: Counter-level comparison and read-back | Staff compare the identified request with the actual package and obtainable quantity, describing differences before any decision. | Original request, package details, quantity definitions, staff checklist. | Handles contextual discrepancies directly with a person. | Staff expertise and time; verbal comparisons may omit important distinctions. | **High** for synthetic examples; real professional performance is not demonstrated. |
| N06-B: Deterministic attribute comparison | Compare catalog identity, strength, form, and quantity using defined units. Classify exact match, mismatch, or unresolved; unknown conversion does not pass. | Controlled identities and units, comparison rules, contradictory and incomplete cases. | Transparent and testable; preserves missing information. | Incorrect catalog data or conversions produce incorrect matches; product matching is not medical approval. | **High** for a limited synthetic catalog; wider semantics need domain review. |
| N06-C: Package-led comparison | Capture the offered package identifier and label, then compare against the requested identity and quantity with human confirmation. | Packaging, ready capture equipment, reliable identifier mapping, reviewer. | Ties the comparison to the offered physical item rather than only a stock name. | Packaging may be unavailable or unmapped; does not certify condition, future stock, or suitability. | **Conditional** for ready identifiers/equipment; synthetic capture can illustrate only the workflow. |

## N07 — Distinguish similarity from professionally assessed suitability

**Need:** Related products must not appear medically approved without an appropriate assessment. **Priority: Critical.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N07-A: Exact-product-only boundary | Limit the search process to the identified requested product. If it is unavailable or uncertain, say so rather than suggesting substitutions. | Product identity definitions, explicit exclusions, ambiguity handling. | Avoids introducing substitution judgments into the process. | Leaves people without an alternative path; exact matching still needs reliable data. | **High** for a narrow demonstrator; does not resolve alternative-suitability needs itself. |
| N07-B: Professional comparison process | An appropriately authorized professional assesses a specific proposed alternative with the necessary context; records distinguish assessment from merely listing a related item. | Qualified participant, role boundaries, necessary context, consent and assessment record. | Allows contextual judgment beyond catalog similarity. | Professional access and authority are unknown; workflow record is not proof of competence or adequate context. | **Conditional** for a clearly simulated decision; clinical validation is **Low** without a qualified participant. |
| N07-C: Rules that block unsupported claims | Explicit rules prevent similarity, ingredient matching, or absence of review from being described as suitability. Related information, if present, remains factual comparison only. | Carefully defined claim types, reviewed language, adverse interpretation tests. | Enforces a visible boundary across multiple paths without requiring AI. | Rules can miss misleading wording or user interpretation; a warning alone may not counter persuasive suggestions. | **High** for bounded cases; needs comprehension testing before safety effectiveness is claimed. |

## N08 — Resolve professional questions or preserve unresolved status

**Need:** Know whether a qualified assessment occurred and whether unanswered questions remain. **Priority: Critical when applicable.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N08-A: Explicit referral ownership | A named person accepts responsibility for seeking clarification, documenting the question, recipient, and outcome; an unsuccessful referral stays unresolved. | Agreed roles, professional contact, handoff checklist, minimum context. | Addresses lost responsibility rather than adding automated interpretation. | Depends on cooperation and staffing; person may remain unavailable. | **High** for role-play; actual referral completion is unproven. |
| N08-B: Bounded asynchronous review lifecycle | Track submitted, awaiting review, clarification requested, assessed, and unresolved outcomes. Only an authorized review action establishes assessment; timeouts never approve. | Role definitions, request contract, access controls, synthetic decisions. | Makes missing or incomplete reviews visible and traceable. | More workflow overhead; identity, qualifications, and decision scope need real verification. | **High** for local simulated roles; real identity and professional integration are **Conditional**. |
| N08-C: Existing live consultation route | Use an existing phone or consultation channel when available; record whether clarification actually occurred and what question it addressed. | Available authorized professional, legitimate channel access, context and appropriate consent. | Can resolve an interactive question without building a new review service. | Waiting, cost, connectivity, and access; a call connection does not prove assessment completion. | **Conditional** if a real partner is ready; otherwise only simulated interaction is credible. |

## N09 — Understand whether earlier stock information still applies

**Need:** Distinguish a past observation from a future stock commitment. **Priority: Important.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N09-A: Pre-departure recheck process | Person or staff reconfirms the identified quantity shortly before travel; the response states observation time and whether any commitment exists. | Contact route, staff availability, request details. | Requires little new infrastructure and reduces elapsed time since checking. | More enquiries; product can still be sold after the check. | **High** for simulated timelines; effectiveness needs actual journey evidence. |
| N09-B: Explicit short stock hold | Staff confirm usable stock and accept a time-limited hold, separating accepted, expired, released, and uncertain outcomes. | Store agreement, physical stock control, expiry rules, duplicate/concurrent request handling. | Addresses intervening sales through an operational commitment. | No-shows, fairness, staff enforcement, and overselling if physical operations disagree; not guaranteed by software alone. | **Conditional** for one-store simulation; safe real concurrency and operational enforcement add risk. |
| N09-C: Event-triggered invalidation | When relevant stock changes are recorded, mark earlier answers as needing rechecking and attempt to communicate that change to affected enquiries. | Transaction access, links between answers and products, reliable events, communication channel. | Can reveal changes after an answer without checking every request repeatedly. | Missed events, failed delivery, and unrecorded changes; silence must not imply stock is unchanged. | **Conditional** with synthetic events; real integrations are not established. |

## N10 — Determine whether stock is practically obtainable

**Need:** Consider actual access conditions and recognize barriers beyond availability. **Priority: Important; potentially Critical in specific circumstances.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N10-A: Human access-check conversation | Before travel, clarify price, hours, obtainable amount, prescription requirements, and the person's relevant constraints. Missing answers remain unknown. | Staff time, current store details, willing user, minimal necessary context. | Handles individual circumstances that a generic availability answer overlooks. | Conversation burden and incomplete information; cannot remove financial or physical barriers. | **High** for a scenario; real prices, policies, and outcomes require verification. |
| N10-B: Rule-based feasibility comparison | Compare known store conditions with user-declared budget, timing, travel, and documentation constraints. Distinguish incompatible, potentially feasible, and unknown. | Synthetic conditions, explicit rules, reliable units, minimal user inputs. | Makes hidden practical mismatches visible before travel. | Approximate locations and stale conditions limit conclusions; location alone does not prove accessibility. | **High** for bounded synthetic cases; mapping and live conditions are optional unproven dependencies. |
| N10-C: Existing community assistance coordination | Where legitimate transport, caregiver collection, or assistance arrangements already exist, a coordinator checks whether they can address a specific identified barrier. | Actual partners, eligibility and legal checks, consent, handover responsibilities. | Attempts to remove a barrier instead of only describing it. | Availability, affordability, authority, storage requirements, and safe handover are unknown; inappropriate for some products or cases. | **Low** for real operations in six hours; a disclosed workflow simulation is **Conditional** and proves no real access improvement. |

## N11 — Maintain dependable answers without unsustainable repeated work

**Need:** Reduce avoidable work while retaining necessary fresh checks. **Priority: Important.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N11-A: Exception-focused checking process | Establish a routine for when a fresh physical check is necessary and who performs it; coordinate similar enquiries only when the same evidence legitimately applies. | Workflow agreement, staff training, observed stock behavior, checking log. | Reduces unnecessary interruption without assuming all verification is waste. | Poor rules can skip necessary checks; process discipline may erode. | **High** for sample cases; workload reduction requires real measurement. |
| N11-B: Reuse existing operational events | Use exports or events from current sales/inventory work rather than asking staff to enter every change again; retain import and observation distinctions. | Authorized system access, schemas, stable identifiers, error handling. | Targets duplicate entry rather than creating another manual inventory task. | Legacy incompatibility, incomplete events, synchronization errors; still cannot observe all physical changes. | **Conditional** with a disclosed export/event mock; real pharmacy integration could dominate the event. |
| N11-C: Bounded reuse of previous answers | Reuse a prior claim only for an equivalent request and an explicit limited period; disclose its basis and invalidate it on known changes. | Request equivalence rules, claim metadata, expiry and invalidation rules. | Avoids some repeat enquiries and checks on unchanged information. | Incorrect equivalence or missed changes spread errors; reuse is not fresh verification. | **High** for synthetic timelines; acceptable reuse periods need evidence. |

## N12 — Distinguish enquiry activity from actual unmet demand

**Need:** Interpret requests without counting each one as a distinct shortage or missed sale. **Priority: Secondary for the immediate journey.**

| Intervention concept | How it would work | Required resources | Main advantage | Main weakness | Hackathon feasibility |
|---|---|---|---|---|---|
| N12-A: Small outcome-follow-up study | Sample search episodes and ask whether medicine was obtained, where, and why not; separate nonresponse from failure. | Participant consent, minimal anonymous study records, follow-up capacity. | Directly investigates outcomes absent from enquiry logs. | Recall and selection bias, missing responses, effort; small samples cannot establish broad demand. | **High** for a study protocol and synthetic walkthrough; real representative evidence is **Low** within six hours. |
| N12-B: Deterministic episode and outcome accounting | Keep requests, distinct known episodes, local purchases, and known non-acquisition separate. Merge only with justified episode identifiers; unknown external outcomes remain unknown. | Legitimately collected episode IDs, definitions, outcome records or synthetic equivalents. | Traceable accounting without predictive models. | Supplied searches may lack usable identifiers; deduplication can wrongly merge different people or split one journey. | **High** for explicit synthetic IDs; current dataset linkage is unknown. |
| N12-C: Inventory-constrained demand analysis | Examine request activity alongside stockout periods and sales; report observed signals and confounders rather than asserting a request-to-demand conversion. | Time-aligned stock, sales and enquiries, basic analysis, missingness checks. | Adds operational context: low sales during a stockout need not mean low interest. | Incomplete coverage, ambiguous requests, seasonality and outside purchases limit causal claims. | **Conditional** with synthetic histories; real economic conclusions are unsupported. |
| N12-D: ML-assisted grouping of unresolved request text | Suggest groups of similarly worded requests for human review; retain original text and uncertainty. Count reviewed groups as enquiry categories, not unique patients or confirmed demand. | Labeled or reviewable samples, ready model, reviewer, comparison with simple rules. | May reduce manual categorization when naming varies. | False merges/splits, unvalidated medicine equivalence, little data; cannot recover missing acquisition outcomes. | **Conditional** for an illustrative comparison; robust model validation is unlikely within six hours. |

## Cross-cutting trade-offs to test before later selection

| Architectural or operational assumption | Skeptical check |
|---|---|
| More data makes answers better | Does it preserve contradictory claims and unknowns, or merely spread incorrect records faster? |
| Automation removes manual effort | What new exception handling, corrections, imports, training, and maintenance does it create? |
| Human review makes the answer safe | Is the reviewer authorized, given adequate context, and actually completing the relevant assessment? |
| Sensors establish truth | What exactly is observed? Identity, condition, reservation status, and usable quantity may remain unobserved. |
| A recent answer is a guarantee | Is it a past observation or an operationally enforced commitment? |
| An AI model can resolve unclear names | What happens with several plausible identities, unfamiliar names, confidently wrong outputs, and unavailable model access? |
| Existing infrastructure saves time | Is authorized access actually available, and are its semantics and failure paths understood? |
| Faster information improves acquisition | Are the blocking factors physical shortage, cost, travel, documentation, or professional uncertainty instead? |
| More notifications improve responsiveness | Do they interrupt staff, overload channels, disclose sensitive context, or fail silently? |
| A working mock proves feasibility | It proves behavior under the mock contract, not partner participation, real data quality, sensor performance, or clinical safety. |

## Demonstration and evidence boundaries

For any later-selected concept, a credible demonstration should show a relevant need-to-outcome path plus at least one important uncertainty or failure case. Examples include an unresolved identity, contradictory stock, an unanswered check, concurrent holds, missing quantity units, or an unavailable reviewer. These are validation directions, not a commitment to build every case.

Reported improvements should match the evidence: fewer steps in a simulated journey, correct handling of specified records, or explicit unresolved states are demonstrable claims. Real time savings, user comprehension, adoption, availability accuracy, and health outcomes require additional evidence.

No winner is selected. Process, software, automation, existing infrastructure, rules, human judgment, hardware, data analysis, and optional AI appear only where they change the mechanism of intervention rather than decorate the same idea.
