# Hosted implementation and validation

Date: 2026-10-07. Current source replaces the historical multi-user validation claims. Deployment instructions are in [deployment_setup.md](deployment_setup.md).

## Changes implemented

- Explicit local/hosted runtime modes. Local mode serves SQLite v1; hosted mode serves authenticated PostgreSQL v2. Production startup rejects local mode, missing/malformed database configuration, development publishable keys, invalid origin/CORS, missing frontend assets and missing schema versions.
- Real Clerk registration/login UI and RS256 session verification through JWKS. Issuer, expiration, issued-at, not-before, subject and authorized origin are checked. Fabricated demo tokens and shared-secret signing fallback are rejected. Test verifier/SQLite injection is permitted only for explicitly injected test applications.
- Canonical frontend/backend contracts: user_id/auth_subject/memberships, owner_user_id/reported_by_user_id, offset pagination, truthful database health and runtime public configuration. Hosted transport rejects empty credentials before dispatch and cannot fall back to anonymous local APIs.
- Separate caregiver/staff workspaces. Caregiver history is account-scoped; staff queues are membership-scoped. Account/role changes unmount workspace state, pharmacy changes reset selection/report state, and prior asynchronous reads cannot replace newer context.
- Recovery freezes exact ID/body with local user/workspace attribution. Reload inspection verifies canonical owner/reporter and submitted fields; unknown saves are not automatically retried. Recovery storage excludes credentials.
- Concurrent first login converges on one user by database conflict handling. Concurrent identical enquiry creation converges on one immutable request. PostgreSQL report handling no longer executes SQLite PRAGMA in a transaction.
- Migration 002 closes the PostgreSQL NULL-check loophole for unable-to-check observations. Migration execution uses a transaction and advisory lock, with schema readiness checks before serving traffic.
- Actual streamed request bodies are bounded. Invalid-token rotation cannot bypass IP limits; limiter key storage is bounded, retry times round up and hosted errors use the contracted rate_limited code.
- Combined frontend/API container, non-root runtime, frozen dependency installation, health check, Render Blueprint and production environment template. Private environment file variants are ignored and excluded from container context. Operator commands support direct script invocation and require PostgreSQL.

## Executed checks

| Check | Result and scope |
|---|---|
| Backend unittest discovery | 99 tests: 98 passed, 1 explicitly skipped (live PostgreSQL integration has no TEST_DATABASE_URL) |
| Frontend transport/recovery tests | 28 passed; strict schemas, empty auth rejection, immutable recovery, ownership and offset pagination |
| Production frontend build | Passed; emits runtime deployment manifest and lazy local/hosted bundles |
| Frontend lint | Exit 0; remaining warnings are inactive draft components and test harness fast-refresh structure. No warnings in the active hosted workspace after moving token-provider updates into effects |
| Frozen backend production dependencies | uv dry-run passed: 43 packages checked, no installation changes needed in the existing Windows environment |
| Local browser workflow | Passed: golden mismatch, zero/unknown/unable cases, offline evidence, credential rejection, creation/report lost-response inspection, reload and 390px layout |
| Hosted browser workflow | Passed: account-owned requests, pharmacy isolation, lost-report recovery without duplicate PUT, multi-membership switching, second pharmacy workflow, account switch, no v1 fallback, mobile layout and no uncaught errors |
| Visual review | Reviewed hosted staff mobile screenshot; readable role/navigation/queue/report/evidence layout with no horizontal overflow |
| Operator CLI | Help invocation passed from repository root |
| Diff whitespace | git diff --check passed; Git emitted normal LF/CRLF notices |
| Local services | Confirmed workspace frontend/backend processes stopped; no listeners on ports 5173 or 8000 at completion |

Browser tests use isolated temporary databases and browser profiles. The hosted harness uses production workspace components with explicitly supplied test identities and SQLite; it does not execute the live Clerk sign-in flow or establish PostgreSQL locking semantics. Test harness files are not part of the production Vite entry or container build context.

## Not yet verified

- Docker image build/execution: Docker Desktop's daemon was unavailable. The dry-run and frontend build do not substitute for a Linux container build.
- Live Neon/PostgreSQL migration and workflow test: no TEST_DATABASE_URL was supplied. The optional suite includes real PostgreSQL concurrent identity creation, concurrent identical requests, owner isolation, report/replay/conflict, and health checks with generated test data cleanup.
- Real Clerk registration, session delivery/refresh/signout, production issuer/JWKS reachability and domain configuration.
- Hosting DNS/TLS, correct forwarded client addresses, database connectivity, persistence across actual redeploys, cold-start behavior and hosted multi-account acceptance.
- Load/scaling, distributed rate limiting, operational monitoring/backups and real pharmacy integrations. These remain outside the current bounded synthetic demo.

No external resources were provisioned and no credentials were supplied. Follow the guide's live acceptance checklist before presenting the hosted deployment as validated.