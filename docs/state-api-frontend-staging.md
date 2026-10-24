# PlotFlow frontend → State API: staging-only integration

The UI state sync implementation is in `app/src/project/CloudProjectState.js`. No production settings are changed by this branch.

## Transport selection
- Legacy mode (default): `VITE_PROJECT_STATE_URL` still drives existing Azure behavior.
- Staging opt-in: `VITE_STATE_API_BASE_URL` selects `/v1/projects/:projectId/state` with authenticated GET and conditional PUT.
- Set `VITE_CLOUD_PROJECT_ID=vinhomes-saigon-park` for this test only. Do not set `VITE_PROJECT_STATE_URL` or put any SAS credentials in the staging frontend.
- Example staging build variable: `VITE_STATE_API_BASE_URL=https://plotflow-state-api-staging.phongtran7076.workers.dev`.

## Safety behavior
- GET retrieves a dedicated `x-plotflow-state-etag` version header and restores only allowed project keys into local cache.
- PUT includes the strong ETag with `If-Match`. HTTP 412 permanently blocks further automatic saves for that page session and emits `plotflow-cloud-state-status` (`version_conflict`).
- If GET or PUT fails, or the version header is missing, automatic writing remains blocked.
- An empty remote staging project paired with non-empty local project data **does not migrate automatically**. `manual_migration_required` prevents writing.
- Unrelated remote storage keys are preserved; missing tracked keys can be deleted.
- Page must be refreshed only after considering unsaved edits. No silent overwrite is permitted.

## Deployment requirements (not completed by this commit)
1. Deploy a **separate staging frontend** and gate it behind Cloudflare Access before enabling the new build variable.
2. Prefer same-origin routing: host the API under the staging frontend origin via a secured reverse proxy; otherwise explicitly configure API `ALLOWED_ORIGINS` for the staging frontend and allow cross-origin `x-plotflow-state-etag` via `Access-Control-Expose-Headers`. Also ensure credentialed requests and Cloudflare Access auth work on both origins.
3. Confirm the staging backend's `AZURE_BLOB_URLS_JSON` still references `plotflow-staging`, never production `$web`.
4. Test opening a project with a non-empty staging snapshot, editing a card, successful save/reload, and a genuine simultaneous-edit 412.
5. Build and exercise cross-origin authentication, browser storage isolation, and the no-implicit-migration path before production rollout.
6. Do not merge into `agent/fix-preview-pan-tabs-memory` until tests and a separate rollout review pass.

The previous /test Worker UI PASS verified backend I/O only; it did not verify browser integration.
