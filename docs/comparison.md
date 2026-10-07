# Comparison of Existing Approaches and Remaining Gaps

Prepared: **7 October 2026**, using [background_research.md](background_research.md), [needs.md](needs.md), [decomposed_problem.md](decomposed_problem.md), and [interventions.md](interventions.md).

## Basis of comparison

This synthesizes the preceding research snapshot; it is not another market survey or a product test. Source links identify the documented capabilities. Commercial descriptions verify a provider's offering or claim, not independently demonstrated effectiveness.

Evidence labels:

- **VERIFIED FACT:** documented in the cited source or directly observed in the local documents.
- **REASONABLE INFERENCE:** comparative judgment, including strengths, operational weaknesses, difficulty, and potential gaps.
- **UNKNOWN:** not established for our intended users or environment.

**VERIFIED FACT — project status:** `proposition.md` and `mvp.md` are empty at this review. The conversation has explored alternatives without selecting a product. The primary user, community, jurisdiction, and actual remaining time are not established. Therefore “our current idea” means candidate intervention families, not an agreed proposition.

**Our context:** a solo six-hour event, documented backend/database/ML/systems strengths, unspecified frontend proficiency, assumed synthetic prototype data, and no confirmed pharmacy, professional, hardware, or inventory-system partner. Bangladesh examples provide comparison context, not proof of the intended market.

Deployment difficulty below is a **REASONABLE INFERENCE about actual operation**, not just how quickly a screen or mock can be built:

- **Low:** limited process or access setup; still requires cooperation.
- **Moderate:** configuration, trustworthy data, or operational agreements.
- **High:** integrations, ongoing professional/logistics capacity, or institutional change.

Using an existing service and recreating it have different difficulties. Difficulty is not a numeric score or a reason to ignore a critical need.

## Approach comparison

The “How it works” column summarizes documented mechanisms, except where a process extension is explicitly marked inferred. Strengths, weaknesses beyond stated product limits, and context judgments are **REASONABLE INFERENCE**. Unknown prices and performance remain unknown.

| Approach | How it works | Problem solved | Strengths | Weaknesses | Deployment difficulty | Cost considerations | Our-context limitations |
|---|---|---|---|---|---|---|---|
| A01: Medfinder | Automated and human pharmacy outreach; pharmacist-confirmed stock communicated to the searcher. [Policy](https://www.medfinder.com/refund-policy) | Delegates repeated searches and obtains a reported stock answer: N02/N03/N05/N09. | Does not depend on universal inventory integration; human escalation. | Policy success is notification of confirmed stock, not necessarily acquisition; stock can change; calls still occupy pharmacy staff. | Existing service: low setup if eligible. Recreating operations: high. | Posted one-time US$50/search, US$120/3, US$180/6; medicine separate. [Pricing](https://www.medfinder.com/pricing) | Local eligibility and affordability unknown; simulated calls cannot prove real response or acquisition rates. |
| A02: Boots stock checker | Looks up indicative prescription availability at Boots; explicitly does not reserve or guarantee stock at arrival. [Checker](https://www.boots.com/online/psc/) | Reduces blind search within one chain: N02/N05/N09. | Uses an existing store network; expresses availability limits. | Chain coverage; unknown freshness/accuracy; no guaranteed future stock. | Consumer use: low. Recreating a cross-store feed: high. | Dedicated checker fee not established; travel and medicines remain costs. | UK chain service is a mechanism comparator, not a verified local resource; our synthetic index lacks its operational data access. |
| A03: Arogga | Advertises search, prescription upload, pharmacist review, and delivery in Bangladesh. [Provider](https://www.arogga.com/) | Combines discovery and fulfillment: N01/N02/N06/N08/N10. | Can bypass visiting several stores and serve the acquisition goal. | Catalog presence does not establish immediate fulfillment; speed and clinical review effectiveness were not independently tested. | Existing ordering: low if usable. Recreating fulfillment/review: high. | Medicine and delivery costs; general verified tariff unknown. | Intended location/eligibility unknown; urgent need may not fit delivery; no verified performance comparison. |
| A04: Pharmarack | B2B retailer/distributor ordering, stock visibility, and secondary stock/sales data collection. [Provider](https://pharmarack.org/) | Procurement and supply-network visibility: N04/N11/N12. | Addresses upstream operations and existing trade relationships. | Distributor stock is not retail saleable stock; patient-facing confirmation unestablished. | Moderate/high with business onboarding and integration. | Pricing, integration charges, and total cost unknown. | Indian network participation cannot be assumed; no distributor or retail inventory access confirmed. |
| A05: PioneerRx | Pharmacy perpetual inventory, counting, and barcode-assisted operations. [Software](https://www.pioneerrx.com/pharmacy-software), [mobile documentation](https://www.pioneerrx.com/blog/featured-feature-mobile-inventory-app) | Internal stock accounting: N04/N06/N11. | Reuses operational transactions; avoids a separate duplicate ledger when integrated. | Unrecorded physical changes persist; public cross-store lookup unestablished; mobile documentation is older. | Moderate/high for installation, migration, training, integration. | Current license, device, support, and integration totals unknown. | No participating pharmacy's installed system or access rights established. |
| A06: MedEx | Maintained Bangladesh brand/generic reference with strength/manufacturer information. [Brands](https://medex.com.bd/brands) | Product reference and name distinctions: N01/N06. | Existing local reference reduces need to create another directory. | A reference entry is not shelf availability or suitability; data extraction/reuse is restricted. [Terms](https://medex.com.bd/terms-of-use) | Consultation: low. Authorized integration: moderate/unknown. | Bulk licensing/API costs unknown; public viewing does not grant reuse rights. | Cannot assume permission to populate our catalog; coverage and accuracy for our requests unmeasured. |
| A07: RxNorm/RxNav | Normalized medicine identities and approximate candidates requiring manual review. [Overview](https://www.nlm.nih.gov/research/umls/rxnorm/overview.html), [matching](https://www.lhncbc.nlm.nih.gov/RxNav/news/RxNormApproxMatch.html) | Terminology alignment and candidate lookup: N01/N06. | Existing non-generative baseline; standardized identities aid interoperability. | US-oriented coverage; similarity is not identity, clinical suitability, or calibrated confidence. | Moderate for local mappings and permitted integration. | Relevant data terms, maintenance, and integration total unknown. | Local brands may be missing; a small curated catalog may fit synthetic cases better. |
| A08: GS1 identification/scanning | Encodes product identifiers and relevant lot/expiry information for scanning and traceability. [Standard](https://www.gs1.org/industries/healthcare/2d-barcode-healthcare) | Package identity and event capture: N01/N04/N06/N11. | Reduces some name transcription; established interoperability mechanism. | Scan does not prove quantity, condition, reservations, or suitability. | Moderate/high depending on packaging, mapping, equipment, and workflow. | Scanners, integration, maintenance, and applicable identifier services; local totals unknown. | Packaging coverage and mappings unknown; a synthetic scan does not validate physical stock. |
| A09: OpenLMIS | Stock cards, physical inventory, adjustments, receipts/issues, and supply workflows. [Features](https://openlmis.org/product/features/) | Facility stock accounting and coordination: N04/N05/N11/N12. | Established logistics capabilities and implementation guidance. | Requires staff discipline and physical reconciliation; not automatically a public finder. | High operationally; project stresses long-term planning and support. [Guidance](https://openlmis.org/before-you-start/) | No licensing fee documented; hosting, configuration, training, migration, and support still matter. | Six hours cannot establish institutional rollout; offline coverage depends on workflow; local integrations unknown. |
| A10: OpenBoxes | Inventory history, cycle counts, lot/expiry control, and adjustments. [Features](https://openboxes.com/features/) | Stock accountability and targeted counting: N04/N06/N11/N12. | Existing audit and reconciliation machinery. | Still depends on physical/transaction evidence; internal holds do not automatically guarantee patient collection. | Moderate/high for configuration, hosting, and operational adoption. | EPL-1.0 license documented; implementation/support totals unknown. [Repository](https://github.com/openboxes/openboxes) | Another custom ledger risks duplication; local product mappings and adoption unestablished. |
| A11: Open mSupply | Offline local stock operations, receipts/issues, and occasional synchronization with central coordination. [Introduction](https://docs.msupply.foundation/docs/introduction/introduction/), [FAQ](https://docs.msupply.foundation/docs/introduction/faq/) | Stock work under intermittent connectivity: N04/N11/N12. | Does not require continuous internet for local operations. | Offline work does not provide continuously fresh cross-site visibility. | Moderate/high for site setup, central configuration, and training. | Exact license and central/support costs need review; full zero-cost deployment unestablished. [Repository](https://github.com/msupply-foundation/open-msupply) | Central dependencies and local compatibility unknown; offline logistics is already an existing capability. |
| A12: Stock cards, physical counts, direct checks | Records movements and counts stock; call/read-back before travel is an inferred process extension. [Stocktake documentation](https://docs.msupply.org.nz/items%3Astocktakes) | Bounded stock uncertainty and exact-request clarification: N02/N04/N05/N06/N09/N11. | Little new infrastructure; checks the actual item; credible baseline. | Labour, repetition, human error, and changing stock after checking. | Low for a bounded process; harder across many busy stores. | Staff time, communications, printing, travel; local amounts unknown. | May beat new software for occasional enquiries; cooperation and workload still need evidence. |
| A13: Professional clarification/shortage protocols | Authorized professionals assess specific cases within applicable service/protocol rules. [UK example](https://www.nhsbsa.nhs.uk/endorsing-serious-shortage-protocols-ssps-0) | Suitability and professional decision authority: N07/N08/N10. | Places consequential judgment with qualified people. | Availability, context, eligibility, and authority vary; software queue is not an assessment. | Existing route: low/moderate if accessible. New staffed service: high. | Professional time and applicable supply/consultation charges; local costs unknown. | UK protocol authority cannot be imported; no professional partner or local pathway established. |
| A14: SMS for Life — historical | Weekly basic-phone stock reports plus management action; pilot and later scale-up studied in Tanzania. [2010 pilot](https://pmc.ncbi.nlm.nih.gov/articles/PMC2978233/) | Facility stock visibility and supply coordination: N04/N11/N12. | Demonstrates a low-bandwidth, non-AI mechanism. | Periodic reports are not live patient confirmation; discontinued in 2015 with adaptation, overlap, and perceived-cost issues. [2021 study](https://link.springer.com/article/10.1186/s12913-021-06285-8) | High for institutional operations; simple messaging demo is much easier. | Labour, incentives, communications, funding; current local total unknown; comparative economic evaluation absent. | Historical evidence, not an available service; public-sector findings do not automatically transfer to retail pharmacies. |
| A15: Audit prioritization/anomaly research | Uses inventory comparisons or statistical anomalies to select records for investigation. [Empirical research](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.1070.0789), [model research](https://arxiv.org/abs/2006.13126) | Allocates stock-checking effort: N04/N11. | Established alternatives to checking every record equally; possible efficient investigation. | Suspicion is not stock verification; consumer-retail findings may not transfer. | Moderate/high for usable data, ground truth, validation, and physical follow-up. | Analysis and checking labour; pharmacy savings unproven. | Synthetic anomalies cannot establish model validity; simple rules may outperform an unsupported model. |
| A16: Censored-demand estimation | Estimates demand not observed in sales during stockouts using sales timing and explanatory data. [2014 paper](https://www.sciencedirect.com/science/article/pii/S092552731300203X) | Demand planning when sales understate demand: N12. | Recognizes missing demand rather than equating sales with need. | Depends on assumptions; cannot identify unique patients or outside acquisition from search counts alone. | High for defensible operational validation; illustrative analysis easier. | Data collection and analytical work; applicable monetary benefit unknown. | Roughly 300 assumed searches do not establish suitable sales/stockout histories or representative demand. |

## 1. What parts of the problem are already well solved?

**REASONABLE INFERENCE:** several technical and operational mechanisms are established enough that rebuilding them requires justification. “Well solved” here means established capability, not universal local access or verified end-to-end success.

| Established capability | Evidence | Important boundary |
|---|---|---|
| Brand/generic reference and normalized product identities | MedEx and NLM in A06/A07 | Coverage, licensing, and uncertain inputs still matter |
| Package identification | GS1 in A08 | Identity does not establish usability or suitability |
| Recorded inventory, adjustments, audit history, physical counts | A05/A09/A10/A11 | Correct records still require operational evidence |
| Indicative stock discovery and delegated enquiry | A01/A02 | Reported availability is not guaranteed acquisition |
| Online ordering with delivery and advertised review | A03 | Delivery/access performance must fit the actual user |
| Offline health-stock operations | A11 | Remote information may lag synchronization |
| Professional decision pathways in defined jurisdictions | A13 | Authority and availability are locally specific |
| Demand-estimation and audit-prioritization methods | A15/A16 | Research availability is not local validation |

**UNKNOWN:** whether these approaches are actually available, affordable, integrated, and effective for the eventual primary users. We cannot call the whole medicine-acquisition journey well solved from capability lists alone.

## 2. What remains inconvenient, expensive, unreliable, inaccessible, slow, or difficult?

These are unresolved limitations or hypotheses, not a claim that every existing product has every weakness.

| Remaining issue | Why it can persist | Evidence status / missing evidence |
|---|---|---|
| Physical stock versus recorded claims | Unrecorded changes, damage, reservations, and counting errors are operational problems | Explicit in brief; local discrepancy frequency unknown |
| Confirmation-to-arrival changes | Later sales can invalidate a correct earlier answer | Boots explicitly excludes arrival guarantees; local incidence unknown |
| Cross-store participation and data access | Independent stores do not automatically share identities or inventory | Reasonable inference; local access agreements unknown |
| Cost of delegated searching | Work is transferred to an operator, not eliminated | Medfinder publishes a separate search charge; local willingness/ability to pay unknown |
| Repeated verification burden | Dependable answers can require staff checks | Reasonable inference from workflow; net staff minutes unmeasured |
| Slow or incomplete professional handoff | A digital request cannot create available qualified staff | Reasonable inference; existing local response times unknown |
| Connectivity versus shared freshness | Offline stores can work locally while remote views remain behind | Documented synchronization mechanism; actual local delay unknown |
| Affordability, travel, opening hours, eligibility | Information cannot itself remove these barriers | Brief identifies access dimensions; affected population unknown |
| Ambiguous identity and local coverage | Reference vocabularies may not cover the wording or brand | NLM's scope/review boundary documented; local failure rate unknown |
| Legal access to reference data | Public consultation is different from authorized integration | MedEx terms documented; permission/cost unknown |
| Long-term adoption and funding | Another system can duplicate work or compete with existing programs | SMS for Life study provides historical counterevidence; local adoption unknown |
| Unknown search outcomes | Requests can repeat or be fulfilled elsewhere | Reasonable inference; outcome linkage unavailable in the assumed schema |

No verified local ranking tells us which issue is most frequent, costly, or worth tackling first.

## 3. Which limitations matter specifically for our target users?

**UNKNOWN:** we have potential users, not a selected primary-user segment. The following is conditional relevance, not a completed target-user decision.

| Potential user / circumstance | Limitations that matter most | Why / what to verify |
|---|---|---|
| Person or caregiver needing an exact product | Identity ambiguity, insufficient quantity, inaccurate availability, residual uncertainty | Can make an apparently successful search fail; verify actual requests and acquisition outcomes |
| Person with a time-sensitive need | Staff response, confirmation-to-arrival gap, delivery time, professional access | Delays may outweigh convenience; urgency distribution and clinical impact are unknown |
| Person with limited travel ability or budget | Wasted trips, service charges, opening hours, delivery eligibility | Small failures may consume substantial resources; verify travel/cost burden rather than assuming it |
| Person with intermittent connectivity | Dependence on live channels and unclear age of information | May prevent completing the journey or judging freshness; verify devices and connection patterns |
| Busy pharmacy staff | Duplicate entry, enquiry interruption, reconciliation work, unclear ownership | An intervention can worsen workload while helping searchers; measure net staff effort |
| Pharmacy owner | Integration costs, data-sharing control, inaccurate demand conclusions, maintenance | Benefits must justify continuing operations; installed systems and business priorities unknown |
| Healthcare professional | Adequate context, authorized role, misleading automated interpretation, incomplete handoffs | Traceability does not substitute for a valid assessment; verify scope and participation |

For a patient-facing scope, N01/N04/N05/N06/N07 are decision boundaries, not optional polish. N08 applies when professional questions arise. For a staff-focused scope, N11 may be central. N12 remains secondary unless evidence makes stock planning the primary bottleneck.

The team member's ML skill does not establish that users need ML. Our ability to build something and their need for it are different facts.

## 4. Are we solving a real gap or rebuilding something existing?

**Current assessment: a real local gap has not yet been validated; several candidates have high duplication risk.**

**VERIFIED FACT:** existing sources document the mechanisms listed in the comparison. **REASONABLE INFERENCE:** an unqualified novelty claim for a stock finder, catalog, stock ledger, offline inventory app, automated outreach, or demand dashboard would be weak.

| Candidate family | Duplication risk | A defensible gap would require |
|---|---|---|
| Medicine catalog or fuzzy lookup | High | Specific requests inadequately served by permitted existing references; superior ambiguity handling on relevant evidence |
| Public availability lookup | High at mechanism level | Defined underserved coverage and a reliable information source better than current enquiries |
| Delegated pharmacy outreach | High | A local access/cost/response gap and evidence the operational burden is acceptable |
| New pharmacy inventory ledger | High | An existing workflow failure not better handled by the installed system or an established stock tool |
| Professional review queue | Medium/high | Lost handoffs are observed, a qualified reviewer exists, and completed assessments improve |
| Physical-stock sensors | Unproven value | Specific measurable discrepancy causes the device can observe better than a simple check |
| Uncertainty-aware decision support | Plausible but unvalidated | Users currently misunderstand claim limits and the intervention improves decisions over a clear direct answer |
| Unmet-demand inference | High research overlap | Suitable outcome/stock histories, a useful decision, and improvement over descriptive accounting |

A timestamp, warning, human-review label, or AI component is not sufficient differentiation. Local novelty may still be meaningful, but needs evidence of local unmet need rather than a claim of global originality.

The synthetic brief validates a challenge premise for the simulation. It does not validate market demand, willingness to participate, or real impact.

## 5. Would a simpler existing approach beat our current idea?

**Possibly yes. We cannot choose a winner because the idea and primary user remain unselected.** These are conditional comparisons, not claims of demonstrated superiority.

| If the candidate direction is… | Simpler or existing baseline | When that baseline could beat it | What must be compared |
|---|---|---|---|
| AI interpretation of product names | Curated catalog plus explicit clarification | Small known product set; frequent exact/alias matches; AI adds wrong confident interpretations | Correct identity, unresolved ambiguity, staff effort, cost |
| Aggregated synthetic stock search | A direct staff check of the exact request | Listing cannot be physically trusted, few stores involved, or data access absent | Time to dependable answer, unsuccessful trips, checking burden |
| New stock-management application | Current store system plus reconciliation; suitable existing stock software | New entry duplicates sales/inventory work | Total staff effort, discrepancies found, migration/support cost |
| New professional review service | Existing legitimate pharmacist/prescriber route | The route is accessible and already resolves the question | Completed assessments, elapsed time, context, authorized responsibility |
| Independent medicine finder | Existing ordering/delivery provider | It serves the location, product, budget, and timing need | Successful acquisition, total cost, elapsed time, unresolved cases |
| Predictive demand dashboard | Distinct-episode/outcome counts and physical stock review | Data is sparse or outcomes missing; no forecast-dependent decision exists | Decision usefulness and errors, not visual polish |
| Hardware stock sensing | Targeted physical count and package identification | Checks are occasional or the sensor cannot observe reservations/condition | Actual discrepancy detection, labour, device/setup cost |

A process-only baseline may not itself meet the digital-prototype deliverable. That does not make it an inferior real-world alternative: the prototype still needs to explain its added value against it.

No reduction in calls, travel, cost, or harm should be asserted without a corresponding comparison. A shorter simulated path can demonstrate fewer modeled steps; it cannot establish measured field savings.

## 6. What opportunities remain worth exploring?

The following are **REASONABLE INFERENCE hypotheses**, not selected features or claims of unexplored novelty. Their relevance depends on evidence, access, and remaining hackathon time.

| Opportunity hypothesis | Related needs | Why it may remain useful | Disconfirming evidence / reason to stop | Evidence that would support further exploration |
|---|---|---|---|---|
| People misunderstand what availability evidence establishes | N04/N05/N09 | Indicative, recorded, checked, and committed stock support different decisions | Users already understand the distinctions; clear staff wording performs equally well | Observed decisions and comprehension on realistic contradictory/stale cases |
| Ambiguous local requests are mishandled by existing paths | N01/N06 | Local naming or incomplete inputs may leave unresolved requests | Permitted references plus clarification already perform well | Qualified assessment of representative requests and errors |
| A narrowly defined enquiry loop is repeatedly lost or duplicated | N02/N03/N11 | Responsibility and reply status may matter more than richer search | Existing communication resolves it with less effort; new workflow adds interruptions | Observed unanswered/repeated enquiries and net burden across both sides |
| Existing stock evidence is usable but poorly communicated across boundaries | N04/N05/N11 | A trustworthy source may exist without reaching the person making the next decision | No reliable source or permission; another integration creates duplicate work | Confirmed source semantics, access agreement, and actual user misunderstanding |
| Professional clarification fails at handoff rather than medical reasoning | N07/N08 | A process gap might be distinct from the assessment itself | No reviewer capacity; current route already completes reviews | An available qualified participant and documented incomplete handoffs |
| Stock matches conceal practical access barriers | N06/N10 | The user may need conditions beyond a location and positive quantity | Existing ordering/calls answer these adequately; information cannot address the binding barrier | Failed-acquisition reasons and current access-condition information |
| Requests are incorrectly counted as distinct unmet demand | N12 | More honest measurement could improve interpretation before prediction | No operational decision depends on it; necessary outcome linkage is unavailable | Episode definitions, legitimate outcome data, and a stakeholder decision affected by miscounting |

These opportunities can overlap with existing products. Their case must be “this particular gap is not adequately served here,” not “we invented uncertainty, verification, or coordination.”

## What must remain open before later proposition selection

1. Which primary user and exact decision are we addressing?
2. What existing approach do they actually use, and where does it fail?
3. Is the binding obstacle information, physical supply, affordability, professional access, or another constraint?
4. What reliable source and participating actor would make the intervention work beyond a mock?
5. What improvement can be observed against the simpler baseline, including extra staff effort and incorrect decisions?
6. Can one complete journey plus its relevant failure behavior be demonstrated within the actual remaining time?

No winner or MVP is selected here. The current evidence supports established baselines and plausible remaining gaps, with substantial local uncertainty and high duplication risk for broad platform concepts.
