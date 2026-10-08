# Medicine Check â€” local SQLite demo

The UI demonstrates one caregiver request â†’ a simulated pharmacy check â†’ a qualified availability response. Choose **Caregiver** or **Pharmacy** from the home page. Each workspace has separate page state and controls.

Local mode uses `/api/v1`, SQLite, the seeded `PHARM-A` pharmacy, and a backend-configured staff access key. Caregiver reads are public synthetic demo data. This is not private account isolation or a publicly hosted multi-user service.

## Run locally

Build from `frontend/`:

```powershell
npm run build
```

From `backend/`, configure the demo environment before starting the server:

```powershell
$env:APP_MODE = 'local'
$env:ENV = 'demo'
$env:DEMO_DATABASE_PATH = 'E:/Hackathon Demo/backend/data/demo.sqlite3'
$env:DEMO_STAFF_TOKEN = '<choose-a-private-demo-token>'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Open [the home page](http://127.0.0.1:8000/). Use separate browser tabs for [the caregiver workspace](http://127.0.0.1:8000/?role=caregiver) and [the pharmacy workspace](http://127.0.0.1:8000/?role=staff). Enter the configured key only in the pharmacy screen. Reloading or leaving that page clears the in-memory credential.

For frontend development, `npm run dev` proxies API calls to the backend on port 8000. Installed project dependencies are required; runtime use needs no external service.

## Verification

- Backend: from `backend/`, `.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_*.py'`.
- Frontend: from `frontend/`, `node --test tests/transport.test.js`, `npm run build`, and `npm run lint`.
- Browser: from the repository root, `.\backend\.venv\Scripts\python.exe backend/scripts/check_browser.py`. Uses Chrome with a temporary profile and temporary SQLite database.

See [the local repair validation](docs/local_repair_validation.md), [the demonstration runbook](docs/demo_runbook.md), and [the local API contracts](docs/api_contracts.md).

## Hosted multi-user setup

Hosted mode uses real Clerk registration/login, PostgreSQL (Neon), private caregiver requests, and operator-assigned pharmacy memberships. The backend selects the matching frontend mode through `/api/config`. Hosted mode does not expose anonymous local endpoints or accept demo tokens.

Follow [the deployment setup guide](docs/deployment_setup.md). Supply your domain/DNS, Clerk production instance, Neon database, Git repository, and hosting account; migrate before starting the hosted server. The root `Dockerfile` and `render.yaml` deploy one combined frontend/API service. Runtime values are documented in `backend/.env.production.example`.

See [hosted deployment contracts](docs/hosted_deployment_contracts.md) and [current hosted validation](docs/hosted_validation.md). Browser verification for hosted workspaces: from the repository root, `.\backend\.venv\Scripts\python.exe backend/scripts/check_browser.py --hosted`. This is an injected test harness, not a live Clerk/Neon acceptance test.

The old `frontend/src/AccountApp.jsx` and `components/AuthWrapper.jsx` are preserved inactive drafts and are not mounted or bundled by the production entry. Do not use their development-auth path for hosted deployment.

Staff reports are immutable observations, not independent verification, a reservation, or clinical approval.
