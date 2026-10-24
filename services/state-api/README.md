# PlotFlow State API — Step 1, source only

**Status: not deployed.** This folder is an isolated Cloudflare Worker foundation for authenticated, per-project state reads/writes. The production Worker `plotflow-proxy`, Azure Blob data and the existing React app are unchanged.

## Request flow
Cloudflare Access (user login) → JWT signature/issuer/audience verification → project ACL → Azure Blob per-project SAS held only as a Worker secret → ETag conditional write.

Routes:
- `GET /health` (no user data)
- `GET /v1/projects/:projectId/state` (viewer/editor/admin; returns state JSON and ETag)
- `PUT /v1/projects/:projectId/state` (editor/admin; requires `If-Match` with ETag from GET; returns 412 if stale)

## Security decisions
- Fail closed: no Access JWT, missing config, invalid signature, missing project role → reject. Never trust email or role supplied by the browser.
- `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` identify the intended Access issuer and app.
- `PROJECT_ACL_JSON`: `{"vinhomes-saigon-park":{"designer@example.com":"editor","reviewer@example.com":"viewer"}}`. This is a prototype per-email ACL; change to audited identity/membership management before scaling.
- `AZURE_BLOB_URLS_JSON`: secret map of project IDs to **Azure Blob endpoint URLs including narrowly scoped SAS**; NEVER commit or expose to frontend. Staging must use a separate blob and short-lived least-privilege credentials. Do not reuse production's 365-day SAS.
- `ALLOWED_ORIGINS`: comma-separated exact staging site origins. CORS is not authentication.
- No Wrangler config and no deployment workflow intentionally: staging configuration must be reviewed before any live binding.
- Azure blob versioning/backup remains independent of ETag conflict detection.

## Local tests
From `services/state-api`, run `npm test`. No cloud credentials are needed; fake storage is used.

## Important limits before staging
1. Create Cloudflare Access application for the intended API domain, authenticate real team members, and configure JWT verification.
2. Set up a separate **private** staging blob or container (not `$web`) and least-privilege Azure credentials.
3. Determine the API domain/routes so users cannot bypass Access. Enforce authentication in Worker even if Access is configured.
4. Run integration tests against staging storage for GET, conditional PUT, rejected unauthorized access and ETag 412.
5. Integrate a client that fetches, stores ETag, reports 412 and avoids overwrites. Current `CloudProjectState.js` does NOT use this API yet.
6. Audit and revoke the older public write SAS only after deployment migration and verification; rotating Storage account keys without inventory may break other apps.

**No production change is included in this step.**
