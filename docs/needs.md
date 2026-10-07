# User and System Needs: The Last-Mile Medicine Gap

Sources: [problem decomposition](decomposed_problem.md), [organizer brief](solo_hackathon_6h_problem.md), and the current-workflow reconstruction in the accompanying conversation.

Scope: translate the 12 identified workflow failures into needs and desired outcomes. No product features, technologies, or implementation choices are selected here.

## Evidence and ranking boundaries

The organizer brief is a simulation. **Explicit** below means a failure or concern is described in that brief; **inferred** means a plausible workflow failure that still needs field verification. Explicit does not mean independently observed in a real community. Causes listed below are candidate explanations unless established for a particular incident.

Need statements are analytical conclusions from those failures. Their frequency, cost, and real-world severity are unknown. Desired outcomes are conditions to aim for, not promises that stock or professional help will always be available.

Ranking criteria:

- **Critical:** necessary to avoid potentially unsafe interpretation or a materially misleading decision in the relevant journey. A critical need can be conditional on handling that part of the journey.
- **Important:** materially affects completing the journey, wasted effort, or operational sustainability, but the available evidence does not establish a universal immediate safety risk.
- **Secondary:** supports broader operational understanding rather than the immediate individual search; impact and relevance need more evidence.

These ranks express problem importance, not implementation order or a six-hour scope commitment. A narrow prototype need not address every need, but it must respect relevant safety and reliability boundaries. Actual hackathon time remaining is unknown.

## Ranked overview

| Need ID / workflow failure | Need | Rank | Main reason |
|---|---|---|---|
| N01 / F01 | Establish the requested product without hiding ambiguity | Critical | Later decisions depend on knowing what is being requested |
| N04 / F04 | Distinguish recorded stock from checked usable stock | Critical | Incorrect stock claims undermine decisions throughout the journey |
| N05 / F05 | Understand the basis and age of an availability claim | Critical | Old or unverified information must not appear to be current confirmation |
| N06 / F06 | Know whether availability meets the exact product and quantity request | Critical | Broad availability can conceal material product differences |
| N07 / F07 | Distinguish product similarity from professionally assessed suitability | Critical | Similarity must not be interpreted as medical approval |
| N08 / F08 | Resolve questions requiring professional judgment, or know they remain unresolved | Critical, when such questions arise | Unanswered questions must not become implied approval |
| N02 / F02 | Find credible availability information with less repeated searching | Important | Directly affects effort and the ability to progress |
| N03 / F03 | Obtain an answer within a workable time | Important | Waiting obstructs decisions and competes with staff duties |
| N09 / F09 | Understand whether an earlier stock answer still applies | Important | A correct earlier answer can become outdated before arrival |
| N10 / F10 | Determine whether an available product is practically obtainable | Important; potentially critical in specific circumstances | Stock alone does not establish access; urgency and user circumstances are unknown |
| N11 / F11 | Maintain dependable answers without unsustainable repeated work | Important | Operational burden can make reliable information difficult to sustain |
| N12 / F12 | Distinguish enquiry activity from actual unmet demand | Secondary | Supports later operational decisions; enquiry counts alone are weak evidence |

Within each tier, no precise ordering is justified by the evidence currently available.

## Critical needs

### N01 — Understand what medicine is actually requested

**Failure:** An unclear, misspelled, abbreviated, or incomplete request can be interpreted as the wrong product. **Evidence: explicit ambiguity concern.**

→ **Root cause:** Inconsistent naming and missing identifying details; the contribution of handwriting, transcription, or unfamiliarity is unknown.

→ **User affected:** Person searching, caregiver, medicine recipient, pharmacy staff, and any professional interpreting the request.

→ **User need:** Have the requested product understood accurately, and know which details remain unresolved before acting on a match.

→ **Desired outcome:** The request is sufficiently identified for the next decision, or remains explicitly unresolved; uncertainty is not silently converted into a definite product identity.

**Rank: Critical.** Correct availability for the wrong product does not meet the original need and can introduce safety risk. This does not require a particular way of interpreting the request.

**Evidence to establish importance:** Qualified review of anonymized requests, clarification frequency, unresolved cases, and confirmed interpretation errors.

### N04 — Know what the stock claim actually establishes

**Failure:** Recorded quantity disagrees with physically available, usable stock. **Evidence: explicit, including the organizer's synthetic example.**

→ **Root cause:** Possible recent sales, delayed updates, reservations, damaged stock, or entry errors; the cause of any specific discrepancy needs reconciliation.

→ **User affected:** Person searching, caregiver, staff answering enquiries, and owners relying on inventory records.

→ **User need:** Distinguish a recorded stock claim from a checked statement about usable availability, and understand unresolved discrepancies.

→ **Desired outcome:** A decision reflects the evidence actually available; an unverified record is not treated as a guarantee, and a disagreement is not concealed.

**Rank: Critical.** Reliability is an explicit challenge boundary. More availability information is not useful if its evidential status is misrepresented.

**Evidence to establish importance:** Time-matched inventory and physical-stock checks, with sales, reservation, damage, and update histories.

### N05 — Understand freshness and verification before relying on a listing

**Failure:** An old or unverified listing is treated as current confirmation. **Evidence: stale listings explicit; user reliance inferred.**

→ **Root cause:** Stock changes after publication, while the claim's age or checking basis may be unknown or misunderstood.

→ **User affected:** Person or caregiver deciding whether to contact or travel to the pharmacy; staff managing disappointed arrivals.

→ **User need:** Understand when an availability claim was made or checked, what that check established, and what remains uncertain.

→ **Desired outcome:** The person can judge whether the claim is adequate for the intended action; an old entry or recent administrative update does not automatically imply current physical verification.

**Rank: Critical.** This prevents misleading confidence in availability. An old listing is not necessarily false; its age and reliability must not be confused.

**Evidence to establish importance:** Listing-to-stock comparisons and observed user decisions showing whether freshness or verification affected reliance.

### N06 — Know whether the available stock matches the actual requirement

**Failure:** A broad “available” answer hides a different strength, form, product, or insufficient quantity. **Evidence: product distinctions explicit; exact communication failure inferred.**

→ **Root cause:** Incomplete comparisons or answers; potentially inconsistent quantity units or availability meanings.

→ **User affected:** Person searching, medicine recipient, caregiver, and pharmacy staff.

→ **User need:** Understand whether the stated stock meets the identified product and quantity request, with material differences and unknowns preserved.

→ **Desired outcome:** The person does not mistake “some related stock exists” for “the requested product and amount can be obtained.” A product match alone does not establish clinical suitability.

**Rank: Critical.** Material differences can invalidate an apparently successful search and create unsafe interpretation.

**Evidence to establish importance:** Comparisons of original requests, staff answers, actual products, obtainable quantities, and unit definitions.

### N07 — Avoid confusing similarity with medical suitability

**Failure:** Another brand, similar name, or matching ingredient is treated as proof of an acceptable substitute. **Evidence: explicit safety concern.**

→ **Root cause:** Visible similarity is mistaken for a complete assessment; other relevant factors or professional judgment are absent.

→ **User affected:** Primarily the medicine recipient; also caregivers, pharmacy staff, and healthcare professionals.

→ **User need:** Understand that a related product is not automatically appropriate, and distinguish uncertain comparison from an actual professional assessment.

→ **Desired outcome:** No substitution is represented as professionally accepted without the relevant assessment; unresolved suitability remains unresolved.

**Rank: Critical.** This directly reflects the organizer's prohibition on unsafe medical decisions. Actual injuries are not established by the brief.

**Evidence to establish importance:** Qualified review of real comparison enquiries, explanations given, misunderstandings, and documented near misses where available.

### N08 — Reach a clear conclusion when professional judgment is needed

**Failure:** A question is handed off for professional clarification but remains unanswered. **Evidence: professional judgment explicit; failed handoff inferred.**

→ **Root cause:** The responsible professional, necessary context, availability, and clarification process may be unclear. Their actual roles are unknown.

→ **User affected:** Person searching, medicine recipient, caregiver, pharmacy staff, and the professional asked to assess the question.

→ **User need:** Obtain an appropriately qualified assessment for questions that require it, or clearly understand that no such assessment has been obtained.

→ **Desired outcome:** The person knows whether a decision was actually assessed and what remains unresolved; absence of a response does not imply approval.

**Rank: Critical when this boundary is encountered.** This does not require every search to involve a clinician or assume professionals are continuously available.

**Evidence to establish importance:** Observed clarification journeys, response times, completion rates, unresolved outcomes, and who had authority to assess each question.

## Important needs

### N02 — Progress without repeatedly searching from scratch

**Failure:** Each unsuccessful enquiry leads to another call or visit and repetition of the request. **Evidence: explicit.**

→ **Root cause:** Limited visibility of availability across stores and fragmented information; actual search habits are unknown.

→ **User affected:** People searching, caregivers, and staff answering repeated enquiries.

→ **User need:** Find credible information about where the identified medicine may be obtainable without unnecessary repeated effort.

→ **Desired outcome:** The person reaches a relevant next action with fewer avoidable enquiries or journeys, while uncertainty and actual stock limitations remain clear.

**Rank: Important.** This is central to the described burden, but we cannot assume enquiry count is the dominant problem or that less searching guarantees acquisition.

**Evidence to establish importance:** Search diaries measuring contacts, visits, elapsed time, expense, and final acquisition outcomes.

### N03 — Receive an answer within a workable time

**Failure:** Availability enquiries wait behind other work or take time to resolve. **Evidence: competing duties explicit; waiting behavior inferred.**

→ **Root cause:** Staff must balance enquiries with serving customers, prescriptions, stock checks, and other duties.

→ **User affected:** People enquiring, waiting customers, and pharmacy staff.

→ **User need:** Obtain a sufficiently dependable answer within a time suitable for the situation; staff need enquiry work to fit their other responsibilities.

→ **Desired outcome:** People can progress without excessive waiting, while answer speed does not come at the cost of accuracy or safe handling.

**Rank: Important.** Delays can block progress, but no response-time threshold or frequency is established. Verified urgency could raise the importance in a specific case.

**Evidence to establish importance:** Response-time observations, abandoned enquiries, interruption counts, and user accounts of acceptable waiting times.

### N09 — Understand the limits of an earlier availability answer

**Failure:** Stock changes after an accurate confirmation but before the person arrives. **Evidence: changing stock explicit; this timeline inferred.**

→ **Root cause:** Intervening sales or reservations; elapsed time between enquiry and arrival.

→ **User affected:** Person travelling, caregiver, and staff whose earlier answer may be blamed.

→ **User need:** Understand whether earlier information still supports the intended action and whether any commitment was actually made.

→ **Desired outcome:** An earlier observation is not mistaken for guaranteed future stock; the person understands residual uncertainty before spending travel time or money.

**Rank: Important.** This is a temporal limitation even when the original answer was accurate. It is distinct from N04's incorrect records and N05's old listings.

**Evidence to establish importance:** Timelines linking enquiries, checks, intervening stock changes, arrival, and unsuccessful acquisition.

### N10 — Know whether stock is practically obtainable

**Failure:** A product is in stock but cannot be obtained because of cost, timing, travel, prescription requirements, or another access barrier. **Evidence: access dimensions explicit; particular failed journeys inferred.**

→ **Root cause:** Physical stock is only one condition of access; individual circumstances and pharmacy conditions may prevent acquisition.

→ **User affected:** People searching and caregivers, especially those facing the relevant access constraint; prevalence is unknown.

→ **User need:** Determine whether obtaining the identified product is feasible under their actual circumstances, and recognize remaining barriers.

→ **Desired outcome:** The next action is practically feasible or the barrier is acknowledged; finding stock is not counted as successfully obtaining medicine.

**Rank: Important, potentially Critical in specific circumstances.** Acquisition is the underlying goal, but this broad need includes different causes that are not measured. Its ranking does not minimize affordability or urgent access.

**Evidence to establish importance:** Follow searches through acquisition or non-acquisition and record the specific barrier, cost, timing, and user circumstances.

### N11 — Sustain reliable enquiry handling without excessive workload

**Failure:** Staff repeatedly answer similar questions and may repeat checks or corrections while other work accumulates. **Evidence: repeated enquiries explicit; exact checking burden inferred.**

→ **Root cause:** Independent enquiries, changing stock, uncertain records, and competing duties; how much repetition is avoidable is unknown.

→ **User affected:** Staff, customers waiting for service, and pharmacy owners.

→ **User need:** Provide and maintain dependable availability information within realistic staff time and operational capacity.

→ **Desired outcome:** Avoidable repeat work decreases without removing necessary fresh checks or transferring unreasonable work to staff or customers.

**Rank: Important.** Operational sustainability affects whether trustworthy information can be maintained. Repetition is not automatically waste: some checks are necessary.

**Evidence to establish importance:** Staff time observations, repeated-enquiry volumes, update effort, correction frequency, and separation of necessary verification from avoidable repetition.

## Secondary need

### N12 — Understand actual unmet demand rather than raw enquiry volume

**Failure:** Repeated requests are interpreted as evidence of unmet demand without knowing their distinctness or outcomes. **Evidence: limited demand visibility explicit; misinterpretation inferred.**

→ **Root cause:** The same person may enquire repeatedly; requests may be ambiguous or fulfilled elsewhere; an individual store sees only part of the journey.

→ **User affected:** Pharmacy staff and owners assessing demand; potentially customers affected by later stock decisions.

→ **User need:** Understand what request activity does and does not establish about distinct needs, fulfilled requests, and unmet demand.

→ **Desired outcome:** Operational decisions distinguish observed enquiries from inferred demand and acknowledge unknown outcomes rather than treating every request as a missed sale or shortage.

**Rank: Secondary for the immediate medicine-search journey.** It supports longer-term decisions and has less direct evidence of immediate user impact. It could become Important if field evidence establishes stock planning as the primary bottleneck.

**Evidence to establish importance:** Request histories compared with distinct search episodes, purchases, stockouts, and known outcomes; inability to observe outcomes elsewhere must remain explicit.

## Boundaries to preserve during later scoping

- N01 concerns identifying the request; N06 concerns comparing that request with obtainable stock; N07 concerns professional suitability. These are different decisions.
- N04 concerns stock evidence; N05 concerns claim age and verification; N09 concerns later changes. One does not resolve the others.
- N03 concerns response delays; N11 concerns sustained operational burden. Faster answers are not necessarily more dependable.
- A missing record does not establish missing physical stock. A found record does not establish successful acquisition.
- Better information cannot by itself supply unavailable medicine, remove affordability barriers, or establish medical suitability.
- Connectivity, privacy, data quality, and staff capacity remain explicit problem constraints where relevant; this needs list does not replace them.
- No ranking here selects a feature, architecture, primary user, or complete MVP. Those choices require separate analysis against evidence and the remaining six-hour budget.
