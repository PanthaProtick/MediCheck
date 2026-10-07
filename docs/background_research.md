# Background Research: Existing Responses to the Last-Mile Medicine Gap

Research date: **7 October 2026**. Context: one participant, six-hour hackathon; actual time remaining is unknown.

Local inputs: [problem decomposition](decomposed_problem.md), [needs](needs.md), and [candidate interventions](interventions.md).

## Scope and evidence rules

This is a bounded desk review, not an exhaustive market survey, clinical assessment, product trial, or verification of pharmacy operations. No single proposed product has been selected; “overlap” below compares existing approaches with the intervention families already documented.

- **VERIFIED FACT:** the cited primary source documents a capability, policy, price, standard, or study finding. For commercial products, this verifies what the provider publicly offers or claims, not independently measured effectiveness, regulatory compliance, stock accuracy, or customer outcomes.
- **REASONABLE INFERENCE:** our analysis of likely strengths, limitations, resource requirements, scaling, or candidate overlap. These conclusions require local validation.
- **UNKNOWN:** information not established in this review. “Not established” does not mean a capability does not exist.

Current product pages were consulted alongside historical studies. Older evidence is explicitly dated; historical success or deployment is not treated as proof of current operation. Source links appear beside factual claims. Prices are snapshots, not quotations for our location.

The challenge does not specify a jurisdiction. Bangladesh examples are included because the brief uses local medicine-name examples; this is a contextual comparison, not a conclusion that Bangladesh is the required market. UK, US-oriented, Indian, African public-sector, and remote-clinic examples have different institutions and data access.

## 1. Existing commercial solutions

### A01 — Medfinder: delegated pharmacy outreach

**Needs / candidate overlap:** N02, N03, N05, N09; enquiry coordinator, request-driven outreach, human confirmation, and automated outreach.

**VERIFIED FACT — how it works and target users:** Medfinder describes AI pharmacy calls with human calling agents continuing unsuccessful searches. Its policy says results rely on pharmacist stock confirmation. It serves people seeking prescriptions; its pricing page also offers practice pricing. Posted one-time prices are US$50 for one search, US$120 for three, and US$180 for six, separate from medicine costs. [Pricing](https://www.medfinder.com/pricing), [search and refund policy](https://www.medfinder.com/refund-policy).

**VERIFIED FACT — limitation:** Its policy defines success as notifying the person of a pharmacy reporting confirmed stock. Failure to fill afterwards can lead to a restart subject to conditions. The pricing page's “no subscriptions” wording contrasts with subscription provisions in the policy; the available plan terms need clarification. [Policy](https://www.medfinder.com/refund-policy).

**REASONABLE INFERENCE:**

- **Strength:** removes much of the searcher's calling work without requiring universal inventory integration.
- **Limitations:** confirmation can be wrong or become outdated; outreach still consumes pharmacy attention.
- **Deployment requirements:** contactable pharmacies, medication identification, communications, and exception-handling staff. Reproducing the service also requires authorized operating practices.
- **Scalability:** automation can increase call throughput, but pharmacy response capacity and human escalation remain constraints.
- **Already solves our idea?** Strong direct overlap with “we contact stores and return confirmed availability.” That concept is not novel by itself. This does not establish local coverage or successful acquisition.

**UNKNOWN:** local service eligibility, independent acquisition rates, how often physical stock is checked, operating costs, and access for the intended community. Vendor success claims were not independently validated.

### A02 — Boots prescription stock checker: chain-level availability lookup

**Needs / overlap:** N02, N05, N09; shared availability lookup and explicit limits on stock claims.

**VERIFIED FACT:** Boots offers a prescription stock checker for its pharmacies. The interface says stock is indicative, is not reserved, may change before arrival, and is searched one item at a time. [Service overview](https://www.boots.com/prescription-support/), [stock checker](https://www.boots.com/online/psc/).

**REASONABLE INFERENCE:**

- **How it helps / users:** patients and caregivers can identify potential stores before calling or travelling.
- **Strength:** a chain can expose information from infrastructure it already controls.
- **Limitations:** indicative information is not a hold or professional substitution assessment; the documented service is a Boots lookup, not proof of all-pharmacy coverage.
- **Deployment requirements:** for a comparable system, authorized stock access, compatible product identities, and participating stores.
- **Cost:** no dedicated checker fee was established from the consulted interface; this is not a verified claim about total acquisition cost.
- **Scalability:** easier within a governed chain than across unrelated stores; pharmacy onboarding can dominate software scaling.
- **Already solves our idea?** Direct overlap with a medicine-and-location stock search and stock-disclaimer concept. A new interface needs a demonstrated difference beyond those capabilities.

**UNKNOWN:** update latency, discrepancy rate, exact coverage, reservation integration, and whether a public inventory API is available.

### A03 — Arogga: fulfillment and pharmacist-supported ordering in Bangladesh

**Needs / overlap:** N01, N02, N06, N08, N10; catalog discovery, prescription review, human support, and access through delivery.

**VERIFIED FACT:** Arogga's website offers brand/generic search, prescription upload, pharmacist review, and home delivery. The provider advertises national delivery and faster Dhaka service; these are provider claims, not independently confirmed delivery performance. [Arogga](https://www.arogga.com/).

**REASONABLE INFERENCE:**

- **Target users:** medicine buyers and caregivers willing and able to use the provider's ordering service.
- **Strength:** combines discovery with fulfillment, potentially bypassing the need to search independent nearby shops.
- **Limitations:** an online catalog does not establish immediate shelf stock or suitability for every user; delivery may not meet an urgent local need.
- **Deployment requirements:** users need ordering access and a supported address; a competing operator needs stock, professional review capacity, logistics, and appropriate permissions.
- **Cost:** medicines and delivery are relevant components; a general current fee schedule was not verified.
- **Scalability:** fulfillment, sourcing, delivery, and professional capacity constrain growth as well as software.
- **Already solves our idea?** Significant overlap with generic/brand discovery, prescription review, and obtaining medicine without store hopping. May make a separate finder unnecessary for users it successfully serves.

**UNKNOWN:** independent availability accuracy, acquisition success, actual service times, local affordability, and cross-pharmacy stock access. No endorsement of advertised authenticity or clinical effectiveness is inferred.

### A04 — Pharmarack: distributor connectivity and B2B stock visibility

**Needs / overlap:** N04, N11, N12; existing infrastructure, supply visibility, ordering, and stock/sales data analysis.

**VERIFIED FACT:** Pharmarack describes Indian retailer/distributor trade, stockist ordering, stock visibility, and collection of secondary stock and sales data. The official domain redirects to pharmarack.org. [Pharmarack](https://pharmarack.org/).

**REASONABLE INFERENCE:**

- **How it works / users:** pharmacies obtain distributor information and place supply orders through a participating commercial network.
- **Strength:** addresses procurement and data exchange upstream of the patient's search.
- **Limitations:** distributor availability is not identical to usable retail shelf stock or an immediate patient supply.
- **Deployment requirements:** distributor participation, business onboarding, product mapping, and operational integration.
- **Cost:** no verified general tariff or integration quote was found in the reviewed page.
- **Scalability:** an established network has participation advantages; those relationships cannot be reproduced by importing synthetic records.
- **Already solves our idea?** Strong overlap with supplier discovery and stock/sales aggregation, not demonstrated end-to-end patient availability verification.

**UNKNOWN:** independent data accuracy, local compatibility, retailer-level public inventory access, API terms, and whether our eventual community can participate. Market-size and error-elimination claims were not treated as independently verified results.

### A05 — PioneerRx: transaction-linked pharmacy inventory and counting

**Needs / overlap:** N04, N06, N11; perpetual inventory, barcode capture, physical counts, and operational automation.

**VERIFIED FACT:** PioneerRx advertises perpetual pharmacy inventory. Its mobile-inventory documentation describes counting, item maintenance, barcode scanning, and inventory updates using compatible Apple devices. The mobile article is older product documentation, not a current compatibility guarantee. [Pharmacy software](https://www.pioneerrx.com/pharmacy-software), [mobile inventory article](https://www.pioneerrx.com/blog/featured-feature-mobile-inventory-app).

**REASONABLE INFERENCE:**

- **Target users / strength:** pharmacy operators can maintain inventory within their existing dispensing and sales work rather than duplicate every event elsewhere.
- **Limitations:** unrecorded physical changes and counting errors remain possible; documented internal inventory is not proof of public inter-pharmacy search.
- **Deployment requirements:** licensed system access, configuration, compatible equipment, product identities, and disciplined transaction recording.
- **Cost:** no public price sufficient for a reliable total-cost comparison was established.
- **Scalability:** each store adds migration, training, and integration effort, even if the software handles more transactions.
- **Already solves our idea?** Direct overlap with rebuilding an internal pharmacy stock ledger or barcode counting workflow.

**UNKNOWN:** participating pharmacies' installed systems, current device support, interface permissions, prices, and measured accuracy improvement.

## 2. Existing reference infrastructure and industry approaches

These are documented established mechanisms, not a measured survey of how frequently every pharmacy uses them.

### A06 — MedEx: Bangladesh brand/generic reference catalog

**Needs / overlap:** N01, N06, N07; curated product identity and factual product comparison.

**VERIFIED FACT:** MedEx publishes brand entries with ingredient, strength, and manufacturer information and generic-name indexes. Its terms restrict use to personal non-commercial purposes and prohibit unauthorized extraction and redistribution. [Brand index](https://medex.com.bd/brands), [generic index](https://medex.com.bd/generics), [terms](https://medex.com.bd/terms-of-use).

**REASONABLE INFERENCE:**

- **How it works / users:** people and professionals consult a maintained reference to distinguish names and product details.
- **Strength:** local reference information already exists; a catalog from scratch is not inherently an innovation.
- **Limitations:** a reference entry or “available brands” count must not be interpreted as pharmacy shelf stock or professional approval of substitution.
- **Deployment requirements:** ordinary consultation differs from integrating data; bulk reuse requires permission or a separately licensed source.
- **Cost:** integration licensing and permitted API access are unknown; public browsing is not evidence of free reuse rights.
- **Scalability:** catalog maintenance can serve many readers, but local pharmacy stock requires a different evidence source.
- **Already solves our idea?** Direct overlap with local brand/generic lookup; does not establish acquisition or live stock coverage.

**UNKNOWN:** API availability, licensing fees, independently measured coverage and accuracy, and suitability for the full synthetic dataset.

### A07 — RxNorm/RxNav: standardized identifiers and candidate matching

**Needs / overlap:** N01, N06; normalization, deterministic lookup, approximate matching with review.

**VERIFIED FACT:** NLM's RxNorm normalizes generic and branded drug names using attributes including ingredient, strength, and dose form, principally for medicines available in the US. RxNav provides approximate matching; its documentation explicitly treats approximate results as candidates for manual review and warns that scores lack an absolute meaning. [RxNorm overview](https://www.nlm.nih.gov/research/umls/rxnorm/overview.html), [approximate matching](https://www.lhncbc.nlm.nih.gov/RxNav/news/RxNormApproxMatch.html).

**REASONABLE INFERENCE:**

- **Users / strength:** pharmacy software and data engineers can exchange identities without depending entirely on raw names. No generative AI is needed for this mechanism.
- **Limitations:** US-oriented coverage cannot be assumed for local brands; similarity scores are not identity probabilities or suitability approvals.
- **Deployment requirements:** mappings, permitted data access, catalog upkeep, and review of uncertain matches.
- **Cost:** download/API terms and any incorporated third-party vocabulary rights need checking for the actual integration; total costs are unestablished.
- **Scalability:** standardized identifiers reduce repeated mapping work, but new local catalogs still require curation.
- **Already solves our idea?** Strong overlap with normalized medicine search and candidate generation. Does not establish stock or decide patient-specific substitutions.

**UNKNOWN:** coverage of our intended requests, local-name recall, and comparative performance against a small curated catalog.

### A08 — GS1 identification and barcode-assisted operations

**Needs / overlap:** N01, N04, N06, N11; package identification, scanning, and transaction capture.

**VERIFIED FACT:** GS1 healthcare standards define product identification through GTINs and link identification with lot and expiry data. GS1 DataMatrix can carry these elements and serial information where applicable. [Healthcare identifiers](https://www.gs1.org/1/gtinrules/en/healthcare), [DataMatrix](https://www.gs1.org/industries/healthcare/2d-barcode-healthcare).

**REASONABLE INFERENCE:**

- **How it works / users:** manufacturers encode identifiers; pharmacies or facilities scan supported packages and associate transactions with catalog items.
- **Strength:** reduces some manual name entry and supports package-level traceability.
- **Limitations:** a successful scan does not establish usable quantity, storage history, absence of reservations, or patient suitability.
- **Deployment requirements:** compatible packaging, readers/cameras, identifier mappings, operational capture, and system integration.
- **Cost:** equipment, integration, and any applicable identifier-service fees; no locally applicable totals were verified.
- **Scalability:** shared identifiers support interoperability, but packaging coverage and capture discipline remain bottlenecks.
- **Already solves our idea?** The barcode identification mechanism is established; reinventing package identity is unnecessary where mappings already work.

**UNKNOWN:** local packaging coverage, database permissions, scanner availability, and whether sensors beyond scanning would add value.

## 3. Open-source stock and logistics systems

### A09 — OpenLMIS: facility stock management and supply coordination

**Needs / overlap:** N04, N05, N11, N12; stock cards, physical counts, adjustments, ordering, and reporting.

**VERIFIED FACT:** OpenLMIS documents stock-on-hand views, physical-inventory workflows, issues/receipts, adjustments, lot tracking, and printed stock cards. Its implementation guidance describes free/open-source licensing and stresses long-term planning, stakeholder support, training, monitoring, and maintenance. [Features](https://openlmis.org/product/features/), [implementation guidance](https://openlmis.org/before-you-start/).

**VERIFIED FACT — comparable environment:** Its history records implementations including Tanzania and Zambia. This is project-reported deployment history, not a verified live facility census. [History](https://openlmis.org/about/history/).

**REASONABLE INFERENCE:**

- **Users / strength:** facility staff and supply managers can use established stock-accounting workflows rather than rebuild them.
- **Limitations:** correct recorded transactions do not guarantee physical truth; stock logistics is not automatically a public pharmacy finder or clinical review service.
- **Deployment requirements:** product/facility configuration, infrastructure, staff participation, and governance. Offline support must be checked for the particular workflow, not assumed universal.
- **Cost:** no license fee does not remove hosting, support, training, migration, or integration expenses; local total is unknown.
- **Scalability:** country-level use is relevant evidence of institutional reach, not proof that an unguided install scales smoothly.
- **Already solves our idea?** Substantial overlap with internal stock accountability and facility reporting. Could make a new independent ledger inferior to using existing infrastructure.

**UNKNOWN:** current partner installations, supported exports, local configuration, implementation cost, and end-user enquiry capabilities.

### A10 — OpenBoxes: audited inventory, cycle counts, and lot control

**Needs / overlap:** N04, N06, N11, N12; inventory reconciliation, checking, expiry/condition adjustments, and demand reporting.

**VERIFIED FACT:** OpenBoxes documents stock histories, quantity adjustments, cycle counts, lot/expiry tracking, and reasons for removing stock. Its repository describes healthcare inventory management and an Eclipse Public License 1.0 license. [Features](https://openboxes.com/features/), [repository and license](https://github.com/openboxes/openboxes).

**REASONABLE INFERENCE:**

- **Users / strength:** warehouse and healthcare inventory teams obtain existing audit and counting machinery.
- **Limitations:** a physical count is still necessary to discover some errors; inventory holds are not automatically patient collection commitments or suitability decisions.
- **Deployment requirements:** a maintained installation, configured products/locations, roles, operational training, and migration/integration.
- **Cost:** software license terms are documented; hosting, support, devices, and implementation costs were not quantified.
- **Scalability:** multi-location operations depend on common master data and consistent stock procedures; real benchmark capacity was not verified here.
- **Already solves our idea?** Strong overlap with stock-event history, discrepancy accounting, and cycle-count concepts. Adding another ledger may duplicate work.

**UNKNOWN:** deployment effort for participating pharmacies, current supported integration contracts, total cost, and demand-reporting fitness for N12's specific episode accounting.

### A11 — Open mSupply: offline-first health logistics

**Needs / overlap:** N04, N11, N12; transaction capture, offline operation, central aggregation, and stock management.

**VERIFIED FACT:** Open mSupply records receipts and issues to maintain stock balances and supports offline operations with occasional synchronization. Its documentation distinguishes remote sites from central reporting and describes central-server configuration; a demo installer can operate without a central server. [Introduction](https://docs.msupply.foundation/docs/introduction/introduction/), [FAQ](https://docs.msupply.foundation/docs/introduction/faq/).

**VERIFIED FACT — licensing boundary:** The repository names an mSupply Open Source License derived from AGPL-3.0. Do not transfer the older mSupply Mobile project's MIT license assumptions to this different codebase. [Current repository](https://github.com/msupply-foundation/open-msupply), [historical Mobile announcement](https://www.msupply.org.nz/Blog/msupply-mobile-is-now-free-and-open-source).

**REASONABLE INFERENCE:**

- **Users / strength:** remote facilities can continue local work during connectivity loss instead of depending on continuous cloud access.
- **Limitations:** remote reporting can lag synchronization; offline local operation does not mean fresh cross-site visibility.
- **Deployment requirements:** configured sites, supported equipment, central coordination, master data, and synchronization ownership.
- **Cost:** review exact license and central-server/support requirements; a complete zero-cost deployment was not established.
- **Scalability:** distributed operation reduces continuous connectivity dependence but introduces synchronization and governance work.
- **Already solves our idea?** Strong counterexample to claims that offline health-stock management must be newly invented.

**UNKNOWN:** local deployments, current interoperability with pharmacy systems, implementation cost, and suitability for a public availability journey.

## 4. Low-tech/non-AI and professional process alternatives

### A12 — Stock cards, physical counts, and direct checking

**Needs / overlap:** N02, N04, N05, N06, N09, N11; physical checks, read-back, calls, and manual stock reconciliation.

**VERIFIED FACT:** USAID's Logistics Handbook describes stockkeeping records and physical inventory counts. OpenLMIS and mSupply documentation also preserve counting workflows rather than relying on recorded balances alone. [Handbook](https://pdf.usaid.gov/pdf_docs/pnaeb974.pdf), [OpenLMIS stock workflows](https://openlmis.org/product/features/), [mSupply stocktakes](https://docs.msupply.org.nz/items%3Astocktakes).

**Access limitation:** The handbook's indexed content was available, but direct full-PDF retrieval failed in this review. No detailed handbook cost or outcome claim is drawn from it.

**REASONABLE INFERENCE:**

- **How it works / users:** staff keep movement records and physically check discrepancies; a person calls a store and asks for exact product/quantity confirmation before travel. The call/read-back extension is a candidate process, not evidence of universal industry practice.
- **Strength:** directly addresses a bounded uncertainty without replacing infrastructure or introducing AI.
- **Limitations:** repetitive labour, human errors, limited cross-store visibility, and changing stock after a check.
- **Deployment requirements:** staff time, agreed product/unit meanings, access to stock, and a contact route.
- **Cost:** labour, printing and communications; no representative local prices were verified.
- **Scalability:** checking effort grows with requests and items; targeted checks may be more workable than continuous universal checking.
- **Already solves our idea?** A credible simpler baseline for a small number of stores or occasional enquiries. A proposed digital process should show improvement over this baseline.

**UNKNOWN:** how well these processes currently work locally, workload, frequency, and whether a coordinator or manual hold is already available.

### A13 — Existing professional clarification and shortage protocols

**Needs / overlap:** N07, N08, N10; qualified assessment, referral ownership, and existing service routes.

**VERIFIED FACT:** UK NHS guidance documents emergency-prescription routes, including referral to pharmacies. NHSBSA describes Serious Shortage Protocols under which pharmacists may dispense specified alternatives using professional judgment within an active protocol. This is jurisdiction-specific authority, not a general permission for software or pharmacists everywhere. [Emergency prescriptions](https://www.nhs.uk/nhs-services/prescriptions/emergency-prescriptions/), [SSP guidance](https://www.nhsbsa.nhs.uk/endorsing-serious-shortage-protocols-ssps-0).

**REASONABLE INFERENCE:**

- **How it works / users:** patients, pharmacists, and prescribers use established professional pathways rather than treating catalog similarity as authorization.
- **Strength:** assigns medical decisions to institutions and qualified people with recognized roles.
- **Limitations:** availability, eligibility, context, waiting time, and local authority can restrict access; protocol existence does not eliminate shortages.
- **Deployment requirements:** legitimately available professionals, applicable local rules, sufficient context, and a completed handoff.
- **Cost:** staff/consultation costs and applicable supply charges; no transferable local cost estimate was established.
- **Scalability:** staffing and institutional capacity matter more than queue throughput alone.
- **Already solves our idea?** Existing referral routes may make a newly built review service unnecessary. A workflow tracker does not itself provide qualified review.

**UNKNOWN:** corresponding routes, professional authority, availability, and prices in the eventual target community.

## 5. Relevant research and comparable settings

### A14 — SMS for Life: basic-phone reporting plus management action

**Needs / overlap:** N04, N11, N12; low-bandwidth reporting, human counts, stock visibility, and data-driven redistribution.

**VERIFIED FACT:** A 2010 rural Tanzania pilot used weekly SMS stock reports across 129 facilities for 21 weeks. Facilities missing at least one tracked antimalarial category fell from 78% to 26%; reporting incentives and stock-distribution actions were part of the intervention. This was not a randomized demonstration that SMS alone caused the improvement. [Original pilot study](https://pmc.ncbi.nlm.nih.gov/articles/PMC2978233/).

**VERIFIED FACT — counterevidence:** A 2021 qualitative study reports discontinuation in 2015 after national rollout. It identifies poor adaptation, overlap with other systems, focus on stockouts rather than stock management, and perceived cost. It says a comparative economic evaluation was not conducted. [Scale-up study](https://link.springer.com/article/10.1186/s12913-021-06285-8).

**REASONABLE INFERENCE:**

- **Users / strength:** facility staff and managers can coordinate using basic communications without AI or universal broadband.
- **Limitations:** periodic reporting is not live patient-facing confirmation; visibility cannot replace supply or management action.
- **Deployment requirements:** trained reporters, mobile coverage, incentives/support, and managers able to act.
- **Cost:** recurring communications, reporting labour, and institutional funding matter; no current local tariff or transferable total is established.
- **Scalability:** technical scale can succeed while institutional sustainability fails.
- **Already solves our idea?** Demonstrates that low-tech stock visibility is an established family, and warns against creating another parallel reporting system.

**UNKNOWN:** present successor operations and whether findings transfer to independent retail pharmacies. This discontinued program is historical evidence, not a currently available service.

### A15 — Inventory-inaccuracy research and targeted anomaly detection

**Needs / overlap:** N04, N11; discrepancy analysis and prioritizing checks with rules or statistical models.

**VERIFIED FACT:** DeHoratius and Raman's 2008 study found inaccurate records in a large sample from one retailer and associated auditing practices with lower inaccuracy. This is retail evidence, not a pharmacy prevalence estimate. [Original empirical study](https://pubsonline.informs.org/doi/abs/10.1287/mnsc.1070.0789).

**VERIFIED FACT:** Farias, Li, and Peng propose anomaly detection using cross-store/product data and a low-rank Poisson model, evaluated on synthetic and consumer-retail data. Their reported algorithmic cost reductions are not pharmacy operational savings. [Author paper, revised 2022](https://arxiv.org/abs/2006.13126).

**REASONABLE INFERENCE:**

- **How it works / users:** inventory teams investigate likely discrepancies rather than count every item equally often.
- **Strength:** focuses limited checking capacity and supplies established analytical baselines.
- **Limitations:** a suspected anomaly is not proof of actual stock; statistical assumptions and transfer to local medicines need validation.
- **Deployment requirements:** usable cross-store data, actual discrepancy labels/checks, product alignment, and staff able to investigate.
- **Cost:** analytical development and physical investigation; no pharmacy-specific implementation price or savings were established.
- **Scalability:** more records can support comparisons, but inconsistent identities, sparse data, and audit capacity limit usefulness.
- **Already solves our idea?** Risk-based checking and anomaly detection are established research directions; a small synthetic score is not a new validated stock-certification method.

**UNKNOWN:** whether our 20-store dataset has sufficient structure or ground truth, and whether model prioritization beats simple rules or routine audits.

### A16 — Demand estimation with censored sales

**Needs / overlap:** N12; demand accounting and data-driven stock planning.

**VERIFIED FACT:** Sachs and Minner's 2014 paper studies inventory decisions when observed sales omit demand lost during stockouts. It uses sales timing and explanatory variables to estimate unobserved lost sales. [Original paper](https://www.sciencedirect.com/science/article/pii/S092552731300203X).

**REASONABLE INFERENCE:**

- **How it works / users:** analysts distinguish observed sales from estimated demand, accounting for periods when products could not be purchased.
- **Strength:** challenges naive “sales equal demand” reasoning without requiring generative AI.
- **Limitations:** retail demand models do not automatically identify unique patients or determine whether searches were fulfilled elsewhere; estimates depend on assumptions.
- **Deployment requirements:** time-aligned sales, stockout histories, explanatory data, validation, and clear uncertainty reporting.
- **Cost:** data collection and analytical work; no transferable cost or savings estimate was established.
- **Scalability:** statistical aggregation can scale, but identification of missing demand depends on data quality, not just record volume.
- **Already solves our idea?** Demand inference is an existing operations-research area. It does not establish that the supplied 300 search records are enough for meaningful forecasting.

**UNKNOWN:** stockout timing, sales linkage, episode identifiers, representative sampling, and whether a demand model adds value over basic outcome accounting in our setting.

## 6. Coverage of every documented need

This matrix is a **REASONABLE INFERENCE about mechanism overlap**, not a claim that all listed services completely satisfy each need.

| Need | Existing approaches relevant to it | What is still unproven locally |
|---|---|---|
| N01: Identify request | MedEx, RxNorm, package identifiers, Arogga's advertised review | Catalog coverage, unresolved identity handling, actual interpretation errors |
| N02: Reduce repeated search | Medfinder, Boots, online fulfillment, direct checking | Coverage, acquisition outcomes, benefit over familiar pharmacies |
| N03: Workable response time | Delegated enquiry, existing pharmacy services | Actual waiting times, staff burden, operating hours |
| N04: Stock evidence | PioneerRx, OpenLMIS, OpenBoxes, Open mSupply, physical counts | Physical accuracy, usability/reservation semantics, participation |
| N05: Freshness/basis | Boots caveats, Medfinder confirmation, timestamped stock observations | Whether users understand limits; checking basis and freshness policy |
| N06: Exact requirement | Catalog identities, package scanning, staff comparison | Quantity units, material mismatches, reliable mapping |
| N07: Similarity versus suitability | Professional pathways and jurisdiction-specific protocols | Authorized review and sufficient context locally |
| N08: Complete clarification | Professional services, existing referral routes | Professional availability and completed handoff evidence |
| N09: Earlier answer validity | Rechecking, explicit Boots limits, Medfinder restarts | Real holds, changed-stock communication, arrival outcomes |
| N10: Practical acquisition | Online fulfillment, store enquiry, established assistance routes where available | Affordability, travel, service eligibility, final acquisition |
| N11: Sustainable operations | Existing pharmacy inventory, counts, offline LMIS, integration | Net staff effort, duplicate systems, support ownership |
| N12: Actual unmet demand | Logistics reporting, follow-up, censored-demand research | Distinct episodes, external purchases, representative outcome data |

## 7. Evidence that could make our direction unnecessary or inferior

These are tests of candidate families, not a product selection.

| Candidate direction | Evidence against an unqualified novelty/value claim | What would justify reconsidering or stopping that direction |
|---|---|---|
| Another medicine stock finder | Boots already offers indicative stock lookup; Medfinder offers delegated confirmation. [Boots](https://www.boots.com/online/psc/), [Medfinder](https://www.medfinder.com/refund-policy) | Intended users are already well served, or our data is less dependable than a direct enquiry |
| AI for every unclear medicine name | Established curated vocabularies and candidate matching exist. [NLM](https://www.lhncbc.nlm.nih.gov/RxNav/news/RxNormApproxMatch.html) | A small curated catalog handles the actual requests more accurately, cheaply, and transparently |
| A new local brand/generic directory | MedEx already publishes that reference information. [MedEx](https://medex.com.bd/brands) | No demonstrated missing reference capability; permitted reuse or ordinary consultation is sufficient |
| A separate manual pharmacy stock ledger | Commercial and open-source systems already provide stock accounting. [PioneerRx](https://www.pioneerrx.com/pharmacy-software), [OpenBoxes](https://openboxes.com/features/) | It duplicates existing entry work, lacks a reliable data source, or cannot secure staff participation |
| Visibility automatically fixes shortages | Historical SMS reporting required action and later faced sustainability failure. [Pilot](https://pmc.ncbi.nlm.nih.gov/articles/PMC2978233/), [scale-up study](https://link.springer.com/article/10.1186/s12913-021-06285-8) | Main bottleneck is supply, financing, distribution, or institutional coordination rather than information |
| Build a new professional review service | Existing institutional review routes can already hold decision authority. [NHSBSA](https://www.nhsbsa.nhs.uk/endorsing-serious-shortage-protocols-ssps-0) | No qualified partner; a referral tracker adds steps without increasing completed assessments |
| Purchase sensors to establish stock truth | Existing scanning and counting offer established evidence channels. [GS1](https://www.gs1.org/industries/healthcare/2d-barcode-healthcare), [stocktakes](https://docs.msupply.org.nz/items%3Astocktakes) | No measured advantage over current counting; device cannot observe the actual source of discrepancy |
| Predict unmet demand from search counts | Demand estimation must address unobserved outcomes and stock constraints. [Censored-demand research](https://www.sciencedirect.com/science/article/pii/S092552731300203X) | No episode/outcome linkage or stock history; basic descriptive accounting is more honest |

Each stopping condition is a **REASONABLE INFERENCE** to investigate. None is asserted to be satisfied already.

## 8. What we can and cannot conclude

**VERIFIED FACT:** public offerings and documentation show that pharmacy stock lookup, delegated enquiry, medicine catalogs, barcode identification, physical counting, electronic stock management, professional review pathways, and stock-visibility reporting already exist. The linked profiles establish the specific capabilities, not universal adoption or a complete solution for our community.

**REASONABLE INFERENCE:** the defensible question is whether a particular user remains underserved despite these approaches, and why. A different interface, AI label, timestamp, or dashboard alone does not establish improvement. Data access, accurate product identities, staff effort, completed review, and actual acquisition are likely decisive comparisons.

**UNKNOWN:** which need is most costly locally; existing installed systems; willingness to share inventory; available professional roles; permitted catalog integration; current search/acquisition success; cost and connectivity barriers; and whether a simple direct check already works well enough.

The review did **not** establish a universal reliable public cross-pharmacy inventory source, automatic substitution authority, universal reservation mechanism, or fully solved local acquisition journey. It also did **not** prove that these capabilities are absent. No software was installed, no pharmacy contacted, no paid service purchased, and no clinical decision tested.

## 9. Hackathon implications without choosing a winner

- Existing approaches are baselines to compare against, not evidence that any one should be copied.
- A synthetic prototype can demonstrate explicit uncertainty and failure handling. It cannot prove pharmacy participation, professional effectiveness, physical accuracy, economic benefit, or acquisition improvement.
- Real inventory integration, staffing, hardware validation, or institutional deployment is not established as achievable in the six-hour event. A mock must remain labeled as such.
- A narrower intervention may still have value, but that value must be tied to an unmet need and an observable improvement over a simpler or existing approach.
- Neither “nobody has built this” nor “existing tools completely solve it” is supported by this bounded review.
