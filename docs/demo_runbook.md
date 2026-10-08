# Medicine Check — local demonstration runbook

## Launch

Follow [README.md](../README.md) to build the frontend and run the loopback backend with an absolute SQLite path and a private DEMO_STAFF_TOKEN. Open the home page at http://127.0.0.1:8000/. No external runtime service is required.

Use two tabs: **Caregiver workspace** (`/?role=caregiver`) and **Pharmacy workspace** (`/?role=staff`). The local model has one seeded pharmacy; role selection is not user registration.

## Four-minute target journey

1. Show the synthetic-data banner and explain that staff reports do not reserve stock or provide clinical approval.
2. In the caregiver tab, select **Demo Medicine A · 10 mg · tablet**, enter **6**, and click **Request a pharmacy check**. Show **Waiting for a pharmacy check**, recorded inventory **12 tablets**, and no saved staff count.
3. In the pharmacy tab, enter the backend-configured demo access key and click **Open / refresh queue**. Select the enquiry created in step 2. Review its exact product, quantity and enquiry ID.
4. Choose **I checked the stock**, enter **4**, and click **Set simulated check time to now**. Alternatively use the device-local date/time picker. Click **Save this check** and show **Report Accepted**.
5. In the caregiver tab, click **Refresh response**. Show **Not enough for this request**, requested 6 / recorded 12 / staff-reported 4, and discrepancy **-8 tablets**. Expand evidence details only if the judge asks about attribution, ID or timestamps.
6. Explain alternate outcomes: count 8 can meet the request; count 0 means none obtainable; **Time unknown** and **I could not complete the check** remain unresolved. Each new request is a separate enquiry; saved reports cannot be edited.

The automated browser journey passed. Human presentation timing and user understanding have not been measured.

## Errors and uncertain saves

If a write times out or its response is lost, use **Inspect saved outcome**. The original ID and inputs remain frozen. Matching evidence confirms the save; missing/pending evidence does not prove rollback. **Retry identical save** becomes available only after inspection and requires an explicit action. A pharmacy retry after reload requires re-entering the access key. A rejected retry does not erase the earlier uncertain attempt.

A failed refresh retains previously loaded evidence and labels it. Invalid credentials show an error and hide the queue/report controls. Unloaded, failed and empty queues are separate states.

Reload or **Change workspace** clears the page's in-memory key. Unfinished intents survive reload when browser session storage is available. Tokens are not stored there by the local client.

## Validation and reset

See [local_repair_validation.md](local_repair_validation.md) for actual checks and limitations. The isolated browser runner uses a temporary SQLite database and Chrome profile.

To intentionally reset demo data, stop the backend first and run `scripts/reset_demo.py` from backend using the project interpreter, then restart. Reset deletes existing local demo enquiries/reports; it was not run during this repair.
