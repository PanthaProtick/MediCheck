# Problem Decomposition: The Last-Mile Medicine Gap

Source: [solo_hackathon_6h_problem.md](solo_hackathon_6h_problem.md).

Scope: problem analysis only. This document does not select an intervention, architecture, feature set, or technology.

Evidence boundary: the source explicitly calls itself an organizer-provided brief **for a simulation**. Its statements establish the challenge's premises; they do not independently establish how common these problems are in a real community. Example scenarios and synthetic records are illustrative, not field evidence.

Labels used below:

- **Explicit:** stated in the brief.
- **Interpretation:** a reading of what the statement means, rather than an additional requirement.
- **Possible:** a plausible cause, constraint, or consequence that needs verification.
- **Unknown:** not established by the brief.

## 1. One-sentence plain-English problem

People looking for medicine and pharmacy staff may lack clear, current, trustworthy information about the exact product's availability, making it difficult to decide what to do next without wasted effort or unsafe assumptions.

## 2. Explanation for a first-year university student

Imagine you need a medicine written on a prescription. One pharmacy says it does not have that brand. Another is unsure how much stock remains. A third has an online listing, but it is two days old. A fourth has something with the same active ingredient under another name, but you do not know whether it is appropriate for the prescription.

There are several different questions here:

1. What medicine is actually being requested?
2. What do the available records say about it?
3. How recently was that information checked, and how trustworthy is it?
4. What action is appropriate given what is known and what remains uncertain?

A stock entry is a claim in a record; it is not proof that a usable product is physically available now. Likewise, a familiar name or matching ingredient does not establish that another product is an acceptable substitute.

The pharmacy has difficulties too: staff may be answering repeated calls while serving customers, and sales, reservations, damaged stock, or mistakes can make records disagree with the shelf.

The challenge is to understand a meaningful breakdown in this journey. It does not say that every medicine shortage, pharmacy operation, or medical decision must be addressed.

## 3. Target users

The brief names potential stakeholders but does **not** select one mandatory primary user. The following are candidate direct users, depending on which breakdown participants later choose to address.

| Potential direct user | Need described or implied by the brief | Evidence status |
|---|---|---|
| Person searching for medicine | Understand whether the requested product can be obtained at an accessible pharmacy, at an acceptable time and cost | Explicit |
| Caregiver searching for someone else | Navigate the same information uncertainty on another person's behalf | Named explicitly; specific workflow is an interpretation |
| Pharmacy staff | Handle availability questions alongside customer service and stock-related work | Explicit |
| Pharmacy owner | Understand the store's availability and local demand | Named explicitly; decision responsibilities are an interpretation |
| Healthcare professional | Apply professional judgment where medicine interpretation or alternatives are uncertain | Named explicitly; exact participation is unknown |

The primary user's location, age, language, disability needs, digital literacy, medicine needs, and purchasing circumstances are **unknown**. Participants are explicitly not required to serve every stakeholder.

## 4. Other stakeholders

The distinction between a direct user and another stakeholder depends on the eventual scope; it is not fixed by the brief.

- **Explicit:** pharmacy owners and healthcare professionals can be affected even if they do not directly interact with the prototype.
- **Interpretation:** the person who will take the medicine may be affected even when a caregiver conducts the search.
- **Possible:** pharmacy inventory providers, medicine suppliers or distributors, and relevant regulators may influence information access, stock constraints, or professional responsibilities. The brief does not assign them roles.
- **Explicit evaluation stakeholders:** organizers and judges assess the submitted work; they are not the beneficiaries of the medicine-access journey.

Who owns inventory information, who may share it, and who accepts responsibility for professional verification are **unknown**.

## 5. What exactly goes wrong

| Point in the stated journey | Breakdown | Evidence status |
|---|---|---|
| Medicine needed | A typed or prescription-derived name can be unclear, incomplete, misspelled, or confused with another product | Explicit |
| Availability information discovered | People may contact or visit several pharmacies; information may not be visible online | Explicit |
| Availability information discovered | Recorded availability can be stale, contradictory, or different from physical stock | Explicit |
| Information evaluated | A person may lack enough detail to distinguish the requested product from a similarly named or apparently related product | Explicit |
| Information evaluated | Matching brand names or ingredients can be mistaken for proof of suitability | Explicit safety concern |
| Appropriate next action taken | Uncertainty makes it difficult to decide where to go or when professional judgment is needed | Interpretation of the stated journey and examples |
| Pharmacy operations | Staff repeatedly answer availability questions while performing other duties | Explicit |
| Pharmacy operations | A store may have limited visibility into nearby availability or emerging local demand | Explicit |

These are related problems, not proof of one universal root cause. Unavailable medicine and inaccurate information about medicine are different failures. Better information alone does not establish that stock, affordability, or access barriers will disappear.

## 6. Why it happens / possible root causes

### Causes explicitly identified in the brief

- Availability changes quickly.
- Recent sales, delayed updates or synchronization, reservations, damaged stock, and data-entry errors can create discrepancies.
- Different manufacturers may sell products containing the same active ingredient.
- Similar-looking names may refer to different medicines.
- Strength, dosage form, quantity, prescription requirements, storage conditions, and other factors matter when evaluating an apparent alternative.
- Input and records may contain misspellings, abbreviations, missing fields, inconsistent names, duplicate products, or contradictory availability.
- Staff handle competing responsibilities and may not have time for continuous manual updates in a complicated additional system.

These are possible explanations supplied by the organizer, not measured findings about a particular pharmacy.

### Additional hypotheses requiring evidence

- **Possible:** information is fragmented across stores, calls, and listings, so people cannot easily compare its freshness or meaning.
- **Possible:** different stores interpret “available” or count “units” differently.
- **Possible:** it is unclear who is responsible for checking and correcting a questionable record.
- **Possible:** users do not have enough product detail to express an exact request.
- **Unknown:** whether stock shortages arise from supplier problems, demand spikes, purchasing decisions, distribution delays, or other causes.
- **Unknown:** which failure happens most often, which causes the most harm, and which stakeholder experiences the largest burden.

## 7. Consequences

| Consequence | Evidence boundary |
|---|---|
| Repeated calls or visits before finding a medicine | Explicitly described |
| Repeated availability enquiries add to pharmacy staff workload | Explicitly described |
| People encounter incomplete, outdated, ambiguous, or potentially unsafe information | Explicitly described |
| A person may travel to a store and find the listed product unavailable | Possible consequence of stale or incorrect information; not measured |
| Obtaining medicine may take longer and involve extra travel or communication costs | Plausible consequence; size and frequency are unknown |
| A person may incorrectly interpret another product as suitable | Explicit concern; actual incidents and harm are not documented |
| Pharmacy decisions may rely on an inaccurate picture of stock or demand | Possible consequence; business impact is unknown |
| Confidence in availability information may decline | Possible consequence; no trust measurements are provided |
| Treatment could be delayed or affected by unsuitable product use | Possible downstream consequence; clinical outcomes are not established |

Do not claim deaths prevented, improved health outcomes, reduced costs, or time saved without evidence appropriate to that claim.

## 8. Explicit constraints stated by organizers

| Category | Stated constraint or permission |
|---|---|
| Event | Six hours; one participant |
| Scope | A narrow working prototype is preferred over a broad unfinished platform; not every stakeholder needs functionality |
| Reliability | Inventory records may be stale or incorrect; inventory correctness must not be assumed |
| Safety | Software must not independently make high-consequence medical decisions or present uncertain substitutions as professionally verified recommendations |
| Product interpretation | Similar appearance alone must not be treated as evidence of safe substitution; uncertain interpretation must not be presented as medical fact |
| Privacy | Do not assume access to a complete medical history; no real patient medical records are provided |
| Connectivity | Some users may have slow or intermittent mobile connectivity |
| Data quality | Names and records may be incomplete, misspelled, inconsistent, duplicated, stale, or contradictory |
| Operations | Staff may lack time for continuous manual updates in another complicated system |
| Infrastructure | Expensive new hardware or major changes to every pharmacy's infrastructure require justification; this is not an absolute ban |
| Technology | No particular technology is required; technical complexity alone is not innovation |
| Permissions | AI tools, external APIs, open-source software, and pretrained models are allowed, not mandatory |
| Synthetic data | Synthetic or simulated data is allowed with clear disclosure; modifications or extensions must be explained |
| Deployment | Production deployment is not required |
| Prototype | Demonstrate central value through at least one complete end-to-end scenario |
| Explanation | Describe the selected problem, intervention, architecture, important decisions, implemented behavior, simulations, and limitations |
| Validation | Provide some evidence that the prototype behaves as intended; the method is open |
| Pitch | Explanation and demonstration must take no more than four minutes |

## 9. Possible implicit constraints

These are planning implications, **not additional organizer rules**.

- **Time and capacity:** one participant must handle understanding, construction, integration, validation, and the pitch within the same six hours. Actual time remaining is unknown.
- **Demonstrability:** a central claim must be observable in a short demonstration; breadth can make that claim harder to establish.
- **Evidence:** synthetic records can demonstrate behavior under specified conditions, but cannot establish real pharmacy adoption or real-world health impact.
- **Information freshness:** a record's timestamp alone may not establish that someone checked physical stock at that time.
- **Professional involvement:** availability, qualifications, and authority of a professional reviewer cannot be assumed.
- **External dependencies:** permission to use an API does not establish access, affordability, uptime, data quality, or integration feasibility.
- **Adoption:** staff effort and compatibility with current operations could limit practical use. No pharmacy has committed to participation in the brief.
- **Privacy:** searches or prescription text may reveal sensitive information even without a full medical history. Specific legal obligations depend on an unspecified jurisdiction.
- **Accessibility:** language, literacy, device capability, disability needs, and connectivity could affect access. Detailed requirements are unknown.
- **Data interpretation:** approximate locations, missing fields, and unspecified stock units can limit conclusions about accessibility or sufficient quantity.

## 10. What organizers actually expect participants to achieve

**Explicit expectation:** identify a meaningful breakdown in the journey from needing medicine to taking an appropriate next action, then demonstrate an improvement through a practical digital prototype.

The required submission includes a working end-to-end scenario, a technical explanation, validation evidence, and a pitch of at most four minutes. Participants must distinguish known, inferred, uncertain, and professionally verified information.

| Judging criterion | Weight |
|---|---:|
| Problem understanding | 15% |
| Solution quality and relevance | 15% |
| Working prototype | 25% |
| Technical implementation | 15% |
| Safety and reliability reasoning | 10% |
| Practical feasibility | 10% |
| Validation/evidence | 5% |
| Demo clarity | 5% |

**Interpretation:** the combination of the narrow-scope instruction, working-prototype weighting, and judge questions favors a clear, credible improvement supported by honest evidence. This is a reading of the rubric, not a hidden judging rule.

Judges may question importance, simpler alternatives, information freshness, incorrect records, ambiguous names, unsafe recommendations, external-service failure, pharmacy adoption, and evidence. The brief does not set a minimum accuracy, impact, or performance threshold.

## 11. Ambiguous phrases or terminology and simple meanings

| Phrase | Plain meaning in this brief | What remains unclear |
|---|---|---|
| Last-mile medicine gap | The remaining difficulties between needing medicine and being able to obtain an appropriate product | Which difficulty matters most locally |
| Accessible pharmacy | A pharmacy the person can realistically use | Distance, opening hours, transport, disability access, and other criteria |
| Required form or strength | The product's presentation and amount of active ingredient matter | Exact matching rules and permitted variations |
| Acceptable time and cost | Obtaining medicine within a workable time and budget | Whose limits apply and how they are determined |
| Active ingredient / generic name | Ingredient-related information used to describe a medicine | Whether names are standardized and sufficiently detailed |
| Dosage form | Physical presentation, such as a tablet or liquid | Which distinctions the dataset represents |
| Apparent alternative | A product that looks related to the request | Whether a professional considers it appropriate |
| Recorded information | What a stored entry says | Whether it reflects a physical check |
| Verified current information | Information checked as current | Who checked it, how, when, and for how long it remains dependable |
| Availability status | A label describing whether a product can be obtained | Meaning of each label and treatment of reservations or damaged stock |
| Emerging local demand | Requests that may indicate changing needs in an area | Representativeness, time window, and whether requests become purchases |
| Meaningful improvement | A change that materially helps a chosen part of the journey | Required size of improvement and acceptable evidence |
| Appropriate next action | An action justified by available information and professional boundaries | Who decides appropriateness in each case |
| Central value proposition | The main benefit the prototype claims to deliver | Which benefit participants choose |
| End-to-end scenario | A complete example showing the central benefit from initial need or input to outcome | Whether judges require a specific scenario |
| High-consequence medical decision | A decision whose error could seriously affect health | Exact boundaries organizers expect participants to apply |
| Professionally verified | Checked by an appropriately qualified professional | Required credentials and evidence of review |
| Practical feasibility | Whether the approach could realistically fit user and pharmacy circumstances | Adoption, cost, and operational evaluation thresholds |

These explanations are contextual interpretations, not clinical definitions or substitution guidance.

## 12. Facts explicitly stated

These are **facts about the provided challenge**, not independently verified facts about a real medicine market.

- The track is Accessible Healthcare & Community Services.
- The event lasts six hours and has a team size of one.
- The journey includes discovering information, evaluating it, and taking an appropriate next action.
- Availability may change quickly, and people may contact or visit multiple pharmacies.
- Product identity and suitability involve more than a similar name or matching ingredient.
- Inventory records may disagree with physical availability.
- Example A describes an 8:15 PM search with an unavailable brand, uncertain stock, a two-day-old listing, and another brand with the same active ingredient.
- Example B describes recorded stock of 12 units, last updated at 09:10, versus 4 physically available units found at 11:30. The cause is not established.
- Example C presents differently worded searches and unclear prescription information; it does not declare those requests equivalent.
- Participants may assume a synthetic dataset representing 20 pharmacies and approximately 1,500 inventory records, plus approximately 300 synthetic search/request records.
- Listed dataset fields are described as **possible fields**; their exact schema, meanings, and completeness are not guaranteed.
- Some records contain spelling mistakes, missing values, stale information, inconsistent names, duplicates, and contradictory availability.
- Synthetic data may be modified or extended with an explanation.
- No real patient medical records are provided.
- The constraints, permissions, deliverables, judging weights, and information-status distinctions in sections 8 and 10 are stated explicitly.

The brief does not establish that the assumed datasets have already been delivered or inspected.

## 13. Assumptions we might accidentally make

| Accidental assumption | Why it is unsupported or risky |
|---|---|
| The inventory record is the truth | The brief explicitly supplies discrepancies |
| A recent timestamp means physically verified stock | Update and verification processes are unspecified |
| Positive recorded quantity means the user can buy enough now | Reservations, damaged stock, units, and recent sales may matter |
| Same ingredient means safe substitution | Suitability can depend on other factors and professional judgment |
| Similar names identify the same product | The brief explicitly warns otherwise |
| A search uniquely identifies a medicine | Names and prescription information may be ambiguous |
| A request represents confirmed unmet demand | It may be repeated, incomplete, or followed by purchase elsewhere |
| Every listed field exists and uses consistent units | Fields are only described as possible; semantics are unspecified |
| Approximate location establishes travel time or accessibility | Transport, opening hours, and individual constraints are unknown |
| Online visibility is the main bottleneck | Importance and frequency of different failures are not measured |
| Better information solves a physical shortage | Information accuracy and medicine supply are distinct problems |
| Pharmacies will continuously maintain another system | Staff workload is an explicit constraint |
| A healthcare professional is always available | Participation and response time are unknown |
| External API permission means a usable integration exists | Access and reliability are not provided |
| Synthetic validation proves real-world effectiveness | It establishes behavior only within disclosed test conditions |
| All stakeholders need functionality | The brief explicitly says otherwise |
| Complexity earns innovation points | The brief explicitly rejects complexity alone as innovation |
| Pantha's backend and ML strengths imply frontend proficiency | The skills document does not establish that proficiency |
| All six hours are still available | Actual elapsed time is unknown |
| This challenge is governed by a particular country's medicine rules | Jurisdiction is not specified |

## 14. Questions to clarify with organizers

Priority indicates which unknowns most affect interpretation and evaluation; these questions do not prescribe a solution.

| Priority | Question | Why it matters |
|---|---|---|
| High | Is any target community or jurisdiction intended? | Establishes context and applicable professional boundaries |
| High | Which datasets will actually be supplied, and when? | Separates assumed data from available evidence |
| High | What are the exact schema, units, status values, timestamps, time zones, and missing-value conventions? | Prevents incorrect interpretation of records |
| High | Do any records represent physical verification? What qualifies as verification and freshness? | Clarifies the distinction central to the brief |
| High | What counts as acceptable professional verification, and what medical interpretation is outside scope? | Clarifies the safety boundary |
| High | Must the demonstration cover a specified scenario, or may participants choose any meaningful part of the journey? | Establishes required coverage |
| High | What validation evidence is acceptable, and are there minimum thresholds? | Clarifies what claims can be supported |
| Medium | Is there evidence about the most frequent or costly breakdowns and the affected users? | Supports importance claims rather than invented priorities |
| Medium | How should contradictory stock records, reservations, damaged stock, and quantity units be interpreted? | Establishes what “available” means |
| Medium | Are user or pharmacy interviews, observations, or existing workflow descriptions available? | Supports practical-feasibility reasoning |
| Medium | Are any services or professional participants provided, and what access limits apply? | Avoids assumed dependencies |
| Medium | What connectivity and device conditions should be demonstrated? | Clarifies how the connectivity constraint is judged |
| Medium | What privacy expectations apply to synthetic prescription text or any participant-collected data? | Clarifies permitted handling without assuming medical-history access |
| Medium | Must all supplied pharmacies and records be covered, or is a disclosed subset acceptable? | Clarifies dataset coverage expectations |
| Medium | Does the four-minute limit include setup, and are questions separate? | Clarifies presentation timing |
| Medium | Are there rules about pre-existing code, assets, or work completed before the six-hour event? | These permissions are not specified |

## 15. Things the problem statement does NOT require

- Serving every stakeholder or fixing the entire medicine-access journey.
- Eliminating medicine shortages or guaranteeing stock, affordability, or immediate access.
- Building a full online pharmacy, purchasing flow, payment system, delivery service, or marketplace.
- Independently selecting treatment, prescribing, or approving substitutions. The brief instead establishes safety limits on medical decisions.
- Claiming equivalence among the example search phrases or presenting uncertain identity as fact.
- Access to real patient records or complete medical histories.
- AI, machine learning, language models, IoT, blockchain, a mobile app, or any other particular technology.
- Using external APIs, maps, notifications, pretrained models, or every optional technique mentioned.
- Live connections to real pharmacies or production deployment.
- Expensive hardware or changes to every pharmacy's infrastructure.
- Continuous manual stock updates by employees.
- A particular validation method, fixed accuracy target, response-time target, or quantified business or health impact.
- A particular primary user, country, language, or accessibility standard; these remain unspecified rather than irrelevant.

These exclusions do not remove the explicit obligations: a practical digital prototype, at least one complete end-to-end scenario, validation evidence, honest disclosure, safety and reliability reasoning, and a pitch within four minutes.
