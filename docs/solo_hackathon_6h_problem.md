# Solo Hackathon Challenge: The Last-Mile Medicine Gap

## Event Format

- **Duration:** 6 hours
- **Team size:** 1
- **AI tools:** Allowed
- **External APIs:** Allowed
- **Open-source software and pretrained models:** Allowed
- **Synthetic/simulated data:** Allowed when clearly disclosed
- **Production deployment:** Not required

---

## Track

**Accessible Healthcare & Community Services**

## Problem Statement

Access to medicine does not end when a doctor writes a prescription or a patient decides to purchase an over-the-counter product. A medicine must also be available at an accessible pharmacy, in the required form or strength, at an acceptable time and cost.

In many communities, people may contact or visit several pharmacies before finding what they need. Availability information can change quickly and may not be visible online. Pharmacy staff may repeatedly answer similar availability questions while also handling customers, prescriptions, inventory, and routine operations.

The problem becomes more difficult when the exact requested product is unavailable. Different manufacturers may sell products containing the same active ingredient, while similar-looking names may represent different medicines. Dosage form, strength, quantity, prescription requirements, storage conditions, and other factors can affect whether an apparent alternative is actually appropriate.

A person searching for medicine may therefore encounter information that is incomplete, outdated, ambiguous, or potentially unsafe to interpret without professional judgment.

Pharmacies face a related information problem. Individual stores may know their own stock, but they may have limited visibility into nearby availability or emerging local demand. Inventory records may also differ from what is physically available because of recent sales, delayed updates, reservations, damaged stock, or data-entry errors.

Participants are challenged to design and prototype a practical digital solution that improves some meaningful part of the journey between:

**medicine needed → availability information discovered → information evaluated → appropriate next action taken**

The objective is **not simply to create an online pharmacy or medicine search box**. Participants should identify where the current process breaks down and demonstrate how their intervention improves it.

The system should not assume that inventory information is always correct or that two medicines can safely be substituted merely because they appear similar.

---

## Example Scenario A

At 8:15 PM, a person needs a medicine listed on a prescription.

They contact Pharmacy A:

> “Sorry, that brand is unavailable.”

Pharmacy B says:

> “We had it earlier today, but I’m not sure whether any are left.”

An online listing for Pharmacy C shows the product as available, but the listing was last updated two days ago.

Pharmacy D has a product with the same active ingredient but a different brand name.

The person does not know whether that product is an acceptable alternative and should not be expected to make a medical substitution decision based only on software.

---

## Example Scenario B

A pharmacy receives many requests during one week for a particular medicine that is frequently unavailable.

Its inventory system contains:

```text
Product: Med-X 10 mg
Recorded stock: 12 units
Last inventory update: 09:10
```

At 11:30, staff discover only 4 units are physically available.

Possible reasons include recent sales, delayed synchronization, reservations, incorrect entries, or damaged stock.

A digital system should therefore distinguish between **recorded information** and **verified current information** where appropriate.

---

## Example Scenario C

A user searches:

> “Napa extra”

Another searches:

> “napa 500”

Another enters:

> “paracetamol”

Another uploads or types information from a prescription containing an unclear medicine name.

These requests may or may not refer to equivalent products.

A useful system must avoid presenting uncertain interpretation as medical fact.

---

## Available Prototype Data

Assume the organizer provides a **synthetic dataset** representing 20 pharmacies and approximately 1,500 inventory records.

Possible fields include:

```text
pharmacy_id
pharmacy_name
approximate_location
medicine_id
brand_name
generic_name
strength
dosage_form
recorded_quantity
last_updated
availability_status
prescription_required
```

You may also assume access to approximately 300 synthetic search/request records containing:

```text
timestamp
search_text
approximate_area
requested_product
search_outcome
```

Some records contain:

- spelling mistakes,
- missing fields,
- stale inventory information,
- inconsistent product naming,
- duplicate products,
- contradictory availability information.

You may modify or extend the synthetic data for prototype purposes, but you must explain what you changed.

No real patient medical records are provided.

---

## Potential Users

Potential stakeholders include:

- people searching for medicines,
- caregivers,
- pharmacy staff,
- pharmacy owners,
- healthcare professionals.

You are **not required to build functionality for every stakeholder**.

---

## Constraints

### Time

You have only **6 hours**. A narrow working prototype is preferred over a broad unfinished platform.

### Reliability

Inventory records may be stale or incorrect.

### Safety

Software must not independently make high-consequence medical decisions or present uncertain substitutions as professionally verified recommendations.

### Privacy

Do not assume access to a person's complete medical history.

### Connectivity

Some users may have slow or intermittent mobile connectivity.

### Data Quality

Medicine names may contain spelling mistakes, abbreviations, brand/generic confusion, or incomplete information.

### Operations

Pharmacy employees may not have time to continuously update another complicated system manually.

### Deployment

Solutions requiring expensive new hardware or major changes to every pharmacy's existing infrastructure should be justified.

---

## Technical Freedom

No particular technology is required.

Participants may use any justified combination of software, data processing, search, machine learning, language models, optimization, mapping, notifications, APIs, human verification, or other techniques.

Technical complexity by itself will not be considered innovation.

---

## Deliverables

By the end of six hours, submit:

### 1. Working Prototype

Demonstrate the central value proposition through at least one complete end-to-end scenario.

### 2. Technical Explanation

Briefly explain:

- the problem you chose to address,
- your central intervention,
- system architecture,
- important technical decisions,
- what is genuinely implemented,
- what is simulated,
- known limitations.

### 3. Validation

Provide some evidence that the prototype behaves as intended. The validation method is up to you.

### 4. Demo/Pitch

Prepare a maximum **4-minute** explanation and demonstration.

---

## Judging Criteria

| Criterion | Weight |
|---|---:|
| Problem understanding | 15% |
| Solution quality & relevance | 15% |
| Working prototype | 25% |
| Technical implementation | 15% |
| Safety & reliability reasoning | 10% |
| Practical feasibility | 10% |
| Validation/evidence | 5% |
| Demo clarity | 5% |

---

## Judge Expectations

Judges may challenge:

- whether the proposed problem is actually important,
- whether a simpler solution would work better,
- how current the availability information really is,
- how incorrect inventory data is handled,
- how ambiguous medicine names are handled,
- whether the system crosses into unsafe medical recommendation,
- what happens when external services fail,
- whether pharmacies would realistically use the system,
- what evidence supports the team's claims.

Teams should distinguish clearly between:

**known information, inferred information, uncertain information, and professionally verified information.**

---

# End of Organizer Brief

Everything above should be treated as organizer-provided information for the simulation.
