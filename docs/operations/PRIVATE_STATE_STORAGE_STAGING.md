# PlotFlow private state storage — staging rollout runbook

**Status: implementation guardrails only. No Azure resources, secrets, state data, or production deployment were changed by this PR.**

## Target architecture

- Public Azure Static Website container `$web` contains only static application assets.
- Project state is stored as a blob under the private container `plotflow-state-private`.
- Cloudflare Worker `plotflow-state-api-staging` is the only application path to state.
- Cloudflare Access authenticates the user; the Worker verifies the Access JWT and applies the explicit project ACL.
- Azure SAS is held only in Worker runtime Secrets. It must be blob-scoped, HTTPS-only, read/write only, and short-lived/rotatable.
- State writes require the strong Azure ETag in `If-Match`; stale writes return 412.

## Required Cloudflare Worker runtime secrets

Configure these in the Worker runtime environment, never in Git, Build Variables, or frontend `VITE_*` variables:

- `PROJECT_ACL_JSON`: explicit project-to-email role map. Grant only named users the minimum role.
- `AZURE_BLOB_URLS_JSON`: project ID to exact private blob URL with a blob-scoped SAS.
- Keep `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `AZURE_STATE_CONTAINER_NAME=plotflow-state-private` as non-secret runtime vars.

The SAS URL must target `https://<account>.blob.core.windows.net/plotflow-state-private/<project>/state.json` and include `sp=rw`, `sr=b`, `spr=https`. Do not use an account SAS, container SAS, public `$web` path, or production credential in Preview. Use a separately provisioned staging blob first.

## Staging acceptance sequence

1. Create the private `plotflow-state-private` container in a non-production/test storage account (or a separately isolated staging account). Verify anonymous container and blob GET return 403/404.
2. Create a staging state blob with a synthetic project snapshot only. Enable blob versioning and soft delete/backup before any real state is migrated.
3. Create a short-lived blob-scoped SAS with only read/write, HTTPS-only. Store the full URL in Worker runtime Secret `AZURE_BLOB_URLS_JSON`; never print it in logs or paste it into chat.
4. Set `PROJECT_ACL_JSON` to the smallest explicit staging allowlist. Confirm Access application protects the Worker hostname and the Worker independently verifies JWT issuer, audience, signature, and expiry.
5. Confirm `/health` and `/diagnostics` do not reveal secrets. Confirm unauthenticated state GET/PUT returns 401, non-members return 403, viewer PUT returns 403, editor GET/PUT works, and stale ETag PUT returns 412.
6. Confirm browser CORS with credentials works from the exact staging UI origin and that `x-plotflow-state-etag` is exposed to JavaScript.
7. Deploy a staging UI with `VITE_STATE_API_BASE_URL` and `VITE_CLOUD_PROJECT_ID`; do not set `VITE_PROJECT_STATE_URL`. Verify the built JS contains no Azure SAS or state URL.
8. Run save/reload, multi-tab conflict, access removal, browser refresh and backup/restore tests against synthetic staging data.
9. Only after all staging gates pass, prepare a separate production migration plan and approved maintenance window.

## Production migration — separate approval required

The existing production workflow currently creates a 365-day read/write SAS for a blob under public `$web` and injects it into `VITE_PROJECT_STATE_URL`. Treat that token as exposed.

Do not simply change the workflow to point at a private blob: the browser cannot access private storage directly. Do not delete or overwrite the old state blob, rotate account keys, revoke SAS, or merge into the auto-deploy branch as part of this staging-only change.

Before production cutover:
- Take a versioned, access-controlled byte-exact backup of the current state and independently verify restore.
- Inventory all consumers of the existing storage account and SAS signing key.
- Copy state to the private blob with source/destination hashes and preserve a rollback copy.
- Deploy the authenticated API and frontend together in a controlled sequence; verify reads and writes on the private blob.
- Remove `VITE_PROJECT_STATE_URL` generation from the production build only when the new API path is live and tested.
- Revoke the exposed SAS safely and verify the old public URL can no longer read/write state.
- Keep the old blob backup until post-cutover acceptance and rollback window expire.

## Current limitations

This PR deliberately does not provision Azure storage, set Cloudflare secrets/Access policies, migrate production data, change the production deploy workflow, or revoke the legacy SAS. A passing source CI is not proof of live Azure privacy. Production closure requires independent anonymous HTTP checks against the actual state URL and private blob plus real authenticated staging tests.
