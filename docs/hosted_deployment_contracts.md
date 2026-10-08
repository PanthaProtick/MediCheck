# Hosted deployment contract addendum

This addendum is authoritative for deployment mode; existing v1/v2 evidence schemas remain unchanged except the health storage enum and canonical /me response noted below.

- APP_MODE=local: v1 SQLite routes enabled; configured local staff token required. No fabricated account fallback or v2 routes are exposed.
- APP_MODE=hosted: only authenticated v2 business routes enabled; PostgreSQL required; no SQLite or test-token fallback. ENV=production requires HTTPS origin/issuer. Explicit dependency injection in ENV=test is solely for isolated tests.
- GET /api/config (unauthenticated, no-store): {"mode":"local","clerk_publishable_key":null,"simulated":true} or {"mode":"hosted","clerk_publishable_key":"pk_live_example","simulated":true}. Only public configuration. Runtime configuration selects the frontend mode; keys are not baked into a separate frontend build.
- GET /api/v2/health: {"status":"ready","storage":"postgresql"} after database/schema readiness. Test-injected SQLite returns storage:"sqlite"; it must never be reported as PostgreSQL.
- GET /api/v2/me (Bearer session): canonical MeResponse {"user_id":"00000000-0000-4000-8000-000000000001","auth_subject":"user_example","active":true,"memberships":[{"pharmacy_id":"PHARM-A","role":"staff","active":true,"created_at":"2026-10-07T00:00:00Z"}]}. No invented name/email.
- All business calls require a current Clerk Bearer token. No anonymous or empty-token v1 fallback in hosted client.
- Owner/reporter fields: owner_user_id and observation.reported_by_user_id; both canonical lowercase UUIDs.
- Pagination is limit (1..100) and offset (0..1000), not cursor. Response {"items":[],"limit":20,"offset":0,"has_more":false}. Next offset = offset + limit; above 1000 is unsupported.
- Quantity/unit/null/timestamp/report coherence use existing schemas. No reservation or clinical approval; hosted data remains a synthetic demo.
- Auth: RS256 only; matching HTTPS issuer; required exp, iat, nbf, sub; azp must equal PUBLIC_APP_ORIGIN. Backend secret API keys are not session-signing secrets. Invalid/expired/untrusted token ->401; unavailable JWKS ->503; memberships exclusively server-derived.
- Unknown PUT result freezes ID/body per local user UUID + workspace. Reload retains intent, not token. Inspect via authenticated GET; compare owner/reporter and all attempted fields. Explicit retry uses exact ID/body; rejected retry cannot erase earlier uncertain outcome.
- Signout/account switch unmounts role state, invalidates pending reads and removes the prior user's recovery data. Pharmacy changes clear queue, selection/report inputs and invalidate pending reads. During uncertain writes, pharmacy change is disabled.
- Errors use {"error":{"code":"unauthorized","message":"Invalid session token signature or claims.","fields":[]}}; mutation response headers/body deadline 5000ms; reads 3000ms; no automatic write retries. Body limit applies to streamed bodies, not solely Content-Length.
- Universal frontend build includes deployment.json {"schema_version":1,"runtime_config":true}; hosted startup rejects missing/incompatible assets.

- Public request limits use the client IP provided by Uvicorn, never an unverified token string. Defaults: 120 requests and 30 mutations per rolling 60 seconds; shared networks share the allowance. At most 5000 active IP keys; new identities are rejected while capacity is full. Hosted 429 code is rate_limited with Retry-After rounded up. Limits are per process: deployment uses one worker and one instance. Trusted proxy configuration is an operator responsibility.
