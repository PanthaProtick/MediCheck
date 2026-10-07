# RxVerify - synthetic availability verification MVP

A local React/FastAPI demo connects one caregiver request to one immutable simulated staff observation. It preserves the recorded stock claim and returns a sufficient, insufficient, or unresolved answer qualified by observation time. Synthetic data and attributed staff reports do not establish real stock accuracy, clinical suitability, reservations, or availability on arrival.

## Start the built demo

Build from `frontend/`:

```powershell
npm run build
```

From `backend/`, configure backend-only settings and launch:

```powershell
$env:ENV = 'demo'
$env:DEMO_DATABASE_PATH = 'E:/Hackathon Demo/backend/data/demo.sqlite3'
$env:DEMO_STAFF_TOKEN = '<choose-a-private-demo-token>'
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Replace the token placeholder with your own private demo credential. Enter the same value manually in the staff password field. There is no built-in or prefilled credential. Existing `.env` values can also supply these settings; do not commit real credentials. Startup rejects an empty token or relative database path. Demo mode also requires `frontend/dist/index.html`.

Open `http://127.0.0.1:8000/`. Development mode can run without a build; `npm run dev` uses the existing `/api` loopback proxy. The application requires no remote model, pharmacy integration, database, or font service.

## Verification

From `backend/`:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p "test_*.py"
```

From `frontend/`:

```powershell
node --test tests/transport.test.js
npm run build
npm run lint
```

Optional real-browser smoke test from `backend/` (requires local Chrome and Node):

```powershell
.\.venv\Scripts\python.exe scripts/check_browser.py
```

The browser script uses random loopback ports, a temporary SQLite database, test-only credential, and isolated browser profiles. The backend and transport suites also avoid the demo database. Current review: 56 backend tests and 14 frontend tests passed; the built two-context browser journey and response-loss/read-failure recovery passed. Lint exits successfully with five existing unused-import warnings in inactive template components. See [validation](docs/validation.md) for coverage and limits.

## Demo and maintenance

See [the runbook](docs/demo_runbook.md). An uncertain save preserves its ID and payload; use **Inspect saved outcome**. A pending/404 inspection still leaves the outcome unknown while a write may be in flight. Only explicit retries reuse the frozen ID/body. Saved reports cannot be replaced.

To reset, stop the server first. From `backend/`:

```powershell
.\.venv\Scripts\python.exe scripts/reset_demo.py
```

Reset is destructive local maintenance, restricted to `backend/data/demo.sqlite3`; no API reset endpoint exists. An exclusive-lock probe cannot establish that an idle server is stopped.

Requirements and integration rules are in [the MVP](docs/mvp.md), [the contracts](docs/api_contracts.md), and [the implementation plan](tasks/implementation_plan.md).
