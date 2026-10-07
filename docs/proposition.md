# Central Proposition: Request-Specific Medicine Availability Verification

Prepared: **7 October 2026**.

Basis: [problem decomposition](decomposed_problem.md), [needs](needs.md), [background research](background_research.md), and [comparison](comparison.md).

Scope decision: use the recommended combination of evidence-aware availability and request-specific physical verification (Opportunities 1 + 3), with a narrow identity-clarification safeguard from Opportunity 2. This document defines the proposition; it does not claim implementation or field validation.

## Central proposition in the requested format

For **a caregiver deciding whether to visit a participating pharmacy for a specific medicine and quantity**,
who experiences **uncertainty about whether a stock listing matches the request and reflects obtainable stock**,
existing approaches **can provide recorded or indicative availability without establishing that the exact requested quantity was physically checked, while direct enquiries require staff effort**.
We propose **a request-specific availability verification workflow**,
which works by **keeping inventory claims separate from staff-reported physical observations, comparing the identified product and quantity with that observation, and communicating the check's time, basis, discrepancies, and unresolved information without implying future stock guarantees**,
with the goal of improving **the proportion of caregivers who correctly interpret what the evidence establishes about their request, compared with a listing carrying clear caveats and a direct staff-check baseline**.

This is a proposed improvement hypothesis. The research does not establish that existing services universally lack verification or that our workflow will outperform a direct enquiry.

## 1. One-sentence version

For caregivers deciding whether to visit a participating pharmacy, we propose request-specific stock verification that separates recorded availability from staff-reported physical checks and compares exact product and quantity, aiming to reduce unsupported conclusions about availability compared with a clear stock listing and a direct enquiry.

## 2. Judge-friendly version

A caregiver needs six units of an identified medicine. The pharmacy's record says twelve, but a staff check finds only four obtainable units. The workflow preserves both claims and explains that the checked amount does not meet the request, when it was checked, and what remains uncertain. It does not turn another product into an approved substitute or promise stock will remain available at arrival.

Our claim to test is whether this request-specific evidence helps people interpret availability more accurately than an ordinary listing with clear caveats, and whether it adds value over asking pharmacy staff directly. The hackathon demonstration uses disclosed synthetic stock and simulated staff observations; it cannot establish real stock accuracy or fewer wasted trips.

## 3. Technical version

The bounded system treats an inventory entry as a recorded claim and a staff check as a separate, attributed observation. A request identifies the intended catalog product and quantity in a defined unit. Product identity includes the distinctions needed to avoid merging different products; an unresolved identity or quantity unit does not produce an exact match.

The comparison uses the staff-reported obtainable quantity for the identified product, while retaining the original record and any disagreement. Its conclusions distinguish:

- a checked quantity sufficient for the request **at the observation time**;
- a checked quantity insufficient for the request;
- an unresolved request because identity, quantity, observation, or relevant evidence is missing or conflicting.

The answer communicates the observation's source, time, basis, and limitations. An import timestamp is not a physical-check timestamp. A pending or unanswered check is not an unavailable product. A disagreement between recorded and observed quantity is reported rather than silently erased; conflicting checks remain unresolved unless an explicit reconciliation explains which applies.

A staff report is not independent proof that the physical check occurred or was accurate. Attribution makes the claim traceable; it does not certify it. No age cutoff alone establishes correctness, and sufficient observed quantity is not a reservation or proof of clinical suitability. The workflow does not require continuous stock updates or introduce a second complete inventory ledger.

The technical claim is correct handling of specified evidence and uncertainty. The user-value claim is better interpretation at an acceptable checking cost. These require different validation.

## 4. Assumptions required for the proposition to hold

| Assumption | Why it is necessary | Current status / what could invalidate it |
|---|---|---|
| Caregivers face a meaningful decision problem beyond finding a product name | Defines the proposed user's unmet need | Organizer premise; local frequency and importance unknown |
| A participating pharmacy can respond to a bounded request | Supplies the observation needed by the mechanism | No real partner confirmed; simulation cannot establish response capacity |
| The request can be identified without unsupported medical interpretation | Prevents checking the wrong product | Small synthetic catalog is possible; real input coverage unknown |
| Requested and checked quantities use comparable units | Allows a meaningful sufficiency comparison | Unit semantics require definition; unknown conversion must remain unresolved |
| Staff can distinguish obtainable stock from damaged, expired, or already committed stock where relevant | Makes the reported quantity relevant to the request | Actual store process unknown; workflow cannot infer unobserved condition or storage suitability |
| The observation is honestly and competently reported | Determines the quality of the underlying evidence | Attribution is insufficient; physical audit evidence needed |
| Time and source metadata mean what the answer says they mean | Supports interpretation of freshness and basis | Requires checking semantics, not just collecting timestamps |
| Caregivers understand the distinctions and uncertainty | Connects correct data handling to better decisions | Unverified; clear staff wording may perform equally well |
| Extra verification effort is acceptable | Determines operational sustainability | Staff minutes and response times unknown |
| Existing workflows do not already meet this need better | Establishes added value rather than duplication | Research documents similar capabilities; local baseline comparison required |
| Verification fits the user's time window | Makes the answer useful before the decision | No response-time promise established; urgent situations may exceed scope |
| Relevant data can be handled with appropriate permission and limited disclosure | Enables legitimate participation | Synthetic demonstration avoids assuming real prescription or inventory access |

This proposition deliberately does not address physical shortages, affordability, transport, professional substitution decisions, or guaranteed future stock. Those can still prevent acquisition after a correct availability interpretation.

## 5. Evidence needed to make the proposition credible

### A. Establish that the selected gap exists

- Observe or interview caregivers about actual medicine-search episodes: exact request, information received, interpretation, decision, and final outcome.
- Observe pharmacy enquiries and checks to establish discrepancy causes, staff burden, and response capacity.
- Examine the actual local alternative: existing inventory software, a catalog lookup, clear staff wording, a direct call, or a fulfillment service.
- Identify episodes where insufficient or ambiguous evidence contributed to an unsupported conclusion. A failed purchase alone does not establish an information failure.

These are evidence requirements, not completed research. Participation must use appropriate consent and minimal necessary information.

### B. Demonstrate correct behavior in the hackathon

Use disclosed synthetic cases with expected outcomes established before evaluation. Include a sufficient exact match, insufficient quantity, a recorded/physical discrepancy, stale or missing check time, unanswered checking, unresolved product identity, incompatible quantity units, and conflicting observations. Show one complete caregiver-to-staff-to-answer journey.

For each case, preserve inputs and explain why the expected conclusion follows. Test that the workflow neither hides an unresolved state nor implies substitution approval or a future-stock commitment. These checks establish behavior under specified conditions, not clinical or field effectiveness.

### C. Test the measurable user-value claim

| Measure | Definition | Interpretation boundary |
|---|---|---|
| Primary: correct evidence interpretation rate | Correct answers to predefined availability-evidence questions divided by all evaluated questions; questions cover product, quantity, checking basis/time, and limits | Compare the same underlying situations with a clear-caveat listing and an accurate direct staff answer; counterbalance presentation where practical |
| Unsupported-positive rate | Responses concluding that checked evidence establishes the requested stock when the case does not support that conclusion, divided by cases not supporting it | Report numerator and denominator; do not call this a clinical safety rate |
| Supported-positive recognition | Responses correctly recognizing sufficient exact stock at the observation time, divided by cases establishing it | Prevents “always say unknown” from looking effective |
| Verification burden | Staff checking/entry time and steps per completed enquiry, including unresolved enquiries and follow-up effort | A comprehension gain with excessive workload may be impractical |
| Response delay | Time from request to answered or unresolved closure; report unanswered cases separately | Fast acknowledgment is not a completed check |

The goal is improvement over baselines; no percentage improvement, acceptable workload limit, or response-time target has yet been justified. Report participant count, case composition, raw counts, and evaluation limitations. Developer expectations alone are not evidence of caregiver comprehension. Simulated click counts are not measured staff labour.

### D. Evidence required before claiming real-world benefits

- Time-matched checks comparing reported observations with actual obtainable stock.
- Actual caregiver acquisition outcomes and reasons for non-acquisition.
- Travel, time, and cost comparisons against the user's previous process.
- Sustained pharmacy participation, net staff burden, and handling of changes after checks.

Do not claim reduced wasted trips, improved health, safe substitution, or guaranteed availability from synthetic tests. If a direct enquiry produces equal or better interpretation with less effort, the current proposition needs revision or rejection.

## Six-hour scope boundary

Demonstrate one complete request-specific verification journey with a small controlled catalog, one simple staff flow, synthetic data, and relevant uncertainty cases. Broad pharmacy integration, automated prescription interpretation, reservations, clinical review operations, access planning, and demand forecasting are outside this central proposition.

The proposed differentiation is the handling of evidence at a specific decision boundary, not an app, AI component, dashboard, or claim of global novelty. It remains worthwhile only if the measured interpretation benefit justifies its operational cost.
