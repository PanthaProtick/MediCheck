# Hosted multi-user deployment setup

Updated 2026-10-07. This is a public **synthetic demo**, with real accounts and operator-assigned pharmacy memberships. It is not connected to actual pharmacy stock. The repository is prepared for deployment; no cloud service or domain has been provisioned from this workspace.

## What you must supply

1. A Git repository containing this project, accessible to your hosting provider.
2. A domain you control and permission to edit its DNS records. Choose one final HTTPS address, for example `https://app.example.com`.
3. A Clerk account/application with a **production instance** configured for that domain.
4. A Neon PostgreSQL project/database for demo data, plus a separate disposable test database/branch if you want live integration tests.
5. A Render account (or another Docker-capable host), and your chosen hosting plan. Provider pricing and billing approval are your responsibility; no price is assumed here.

Clerk production uses production keys and domain/DNS configuration. Follow the dashboard production checklist; copy its actual Frontend API/issuer origin rather than guessing it. [Clerk production documentation](https://clerk.com/docs/guides/development/deployment/production)

## 1. Configure Clerk

- Enable your intended registration and login method in the production instance; email/password is sufficient for this demo.
- Complete the production domain and DNS setup shown by Clerk. A development instance and its users are separate from production.
- Copy the production **publishable key** (`pk_live_...`). This key is intentionally public.
- Copy the exact HTTPS issuer origin for this instance, without a trailing slash or path. Tokens must have that issuer and an `azp` matching your app origin.
- Use the final app origin consistently. Authentication from a different origin is rejected by this backend.

This implementation verifies signed session tokens through Clerk's JWKS. It does **not** need `CLERK_SECRET_KEY`. Do not paste session tokens or private credentials into chat or source files.

## 2. Prepare Neon and migrate before starting the hosted server

Create an empty demo database. Keep both its direct and pooled connection strings private. Use the direct string for schema management and the pooled string for the application. Preserve the TLS parameters supplied by Neon. [Neon's official connection guide](https://github.com/neondatabase/website/blob/main/content/docs/get-started/connect-neon.md)

From `E:\Hackathon Demo\backend`, use a private terminal session:

```powershell
uv sync --frozen --no-install-project
$privateConnection = Read-Host 'Paste the Neon DIRECT connection string' -AsSecureString
$env:DATABASE_URL = [System.Net.NetworkCredential]::new('', $privateConnection).Password
.\.venv\Scripts\python.exe scripts/migrate_v2.py --seed
.\.venv\Scripts\python.exe scripts/migrate_v2.py --check-only
Remove-Item Env:DATABASE_URL
```

This applies migrations `001_multi_user` and `002_observation_coherence`, then seeds synthetic products, claims, and pharmacies `PHARM-A` / `PHARM-B`. It does not create Clerk accounts or grant staff membership. Re-running migrations skips applied versions. Seeding is deliberate catalog setup; do not use it as a routine production startup command.

Existing SQLite requests are **not** migrated. Hosted data starts separately. Automatic conversion would falsely assign anonymous local requests to real account owners.

## 3. Deploy one combined application

Push the project to your Git repository after checking that private environment files are excluded. Use Render's Blueprint with the checked-in `render.yaml`, or create one Docker web service using the root `Dockerfile`. The container serves the built frontend and API together. Do not deploy a separate static frontend for this setup. [Render Docker deployment](https://render.com/docs/docker), [Blueprint reference](https://render.com/docs/blueprint-spec)

Set these values in the host's environment/secrets panel. Replace examples with your exact values:

| Variable | Value |
|---|---|
| `APP_MODE` | `hosted` |
| `ENV` | `production` |
| `DATABASE_URL` | Neon pooled PostgreSQL URL, including its TLS options |
| `CLERK_PUBLISHABLE_KEY` | Actual production `pk_live_...` value |
| `CLERK_ISSUER` | Actual Clerk issuer origin, e.g. `https://clerk.example.com` |
| `PUBLIC_APP_ORIGIN` | Final browser origin, e.g. `https://app.example.com` |
| `CORS_ORIGINS` | JSON array containing that origin: `["https://app.example.com"]` |

The example is `backend/.env.production.example`. Frontend auth configuration comes from `/api/config` at runtime; there is no `VITE_CLERK_PUBLISHABLE_KEY` build step. No demo access key is used in hosted mode. [Render environment variable configuration](https://render.com/docs/configure-environment-variables)

- Leave Docker command unset so the Dockerfile command runs.
- Keep one service instance and one Uvicorn worker. The request limiter is process-local.
- Use `/api/v2/health` as the health-check path. Startup rejects missing migrations, missing frontend assets, or invalid hosted configuration. [Render health checks](https://render.com/docs/health-checks)
- Connect the custom domain and complete the host's DNS/TLS instructions. Do not use the temporary hosting hostname for account workflows unless it is the configured app origin.
- Review forwarded-client-IP handling on the chosen host. The limiter uses the client address Uvicorn provides; configure trusted proxy addresses only for your deployment network. Do not blindly trust arbitrary forwarded headers. Without correct proxy handling, users may share the proxy's request allowance.

If the host deploys before database/domain setup is complete, the service can fail readiness. Complete the steps, then redeploy. No automatic migration or SQLite fallback masks the failure.

## 4. Assign pharmacies after real users register

Have the intended pharmacy staff sign up and open the app successfully. Expand **Account reference for pharmacy assignment**, then copy the displayed local user UUID. Verify the person's identity out of band before granting permissions; email spelling alone is not an authorization check.

In a private operator terminal, from `backend/`, set `DATABASE_URL` using the secure prompt above and run:

```powershell
$env:PYTHONPATH = (Get-Location).Path
.\.venv\Scripts\python.exe scripts/manage_memberships.py grant-staff '<local-user-uuid>' PHARM-A
.\.venv\Scripts\python.exe scripts/manage_memberships.py grant-staff '<other-local-user-uuid>' PHARM-B
.\.venv\Scripts\python.exe scripts/manage_memberships.py list-memberships
Remove-Item Env:DATABASE_URL
Remove-Item Env:PYTHONPATH
```

Replace quoted UUID placeholders with the displayed UUIDs. The CLI accepts **UUIDs, not email addresses**. The same staff UUID may be granted access to both pharmacies. Ask the user to click **Refresh account access**, then open Pharmacy workspace.

Other operator commands:

```powershell
.\.venv\Scripts\python.exe scripts/manage_memberships.py create-pharmacy PHARM-C 'Synthetic Demo Pharmacy C'
.\.venv\Scripts\python.exe scripts/manage_memberships.py revoke-staff '<local-user-uuid>' PHARM-A
.\.venv\Scripts\python.exe scripts/manage_memberships.py deactivate-pharmacy PHARM-C
```

These require the same private database environment and `PYTHONPATH`. Creating a pharmacy adds a simulated pharmacy, not real inventory claims or a stock-system integration. Staff privileges cannot be self-selected at signup.

## 5. Run the live acceptance check

Use separate browser profiles/accounts, not only two tabs sharing one Clerk session.

1. Check `/api/config`: `mode` is `hosted`; no database URL, secret, or access key appears.
2. Check `/api/v2/health`: `status` is `ready`, `storage` is `postgresql`. `/api/v1/bootstrap` must return 404.
3. Register two caregivers and two staff users. Grant one staff user only PHARM-A and the other only PHARM-B.
4. Caregiver A requests six MED-A tablets at PHARM-A. Caregiver B must not see that request in their history or by copying its URL.
5. PHARM-A staff sees the pending request; PHARM-B staff cannot read or report it. PHARM-A staff reports four obtainable tablets with a known check time.
6. Caregiver A refreshes and sees the same immutable report, with owner/reporter attribution and the synthetic-data limitations.
7. Repeat at PHARM-B. Sign out/in with another account and confirm previous account data is cleared from the displayed workspace.
8. Revoke a staff membership. Refresh access; that pharmacy's queue must become inaccessible. The backend rechecks membership on each request.
9. Restart/redeploy the service; requests must persist in Neon. Confirm a failed refresh is labelled and an uncertain save requires inspection instead of automatic retry.

Do not call the public deployment validated until these pass using real Clerk, Neon and HTTPS.

## Optional live PostgreSQL integration suite

Use a separate disposable database whose connection URL contains `test` (the suite enforces this guard). Set `TEST_DATABASE_URL` privately, then from `backend/` run:

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -p 'test_database_pg.py'
```

The suite applies migrations and seeds catalog data, then checks concurrent identity creation, concurrent identical requests, account isolation, report creation/replay/conflict, and truthful health reporting. It cleans up its generated users and requests but leaves schema/catalog setup. Never use the deployed demo database for this suite. Without `TEST_DATABASE_URL`, this integration test is explicitly skipped.

## Known deployment limits

- Live cloud verification and Docker image execution have not run in this workspace. Docker Desktop's daemon is unavailable here; the host must successfully build and run the image.
- Local backend/browser tests validate contracts and workflow; the hosted browser harness uses explicitly injected test identities and SQLite. It cannot establish live Clerk or PostgreSQL correctness.
- This is a bounded demo: synthetic catalog, immutable staff observations, no reservations, no clinical approval, no real inventory sync, no automatic SQLite account-data import, and no public admin console.
- Default request limits are 120 requests / 30 mutations per minute per client IP; shared networks share limits. Distributed abuse prevention and load testing remain outside this demo.
- Multi-user support does not imply high-load capacity. Begin with the configured five-connection pool and one worker; measure actual hosted behavior before changing it.