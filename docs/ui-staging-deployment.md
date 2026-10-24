# Frontend staging deployment: PlotFlow

This branch builds a separate frontend for Cloudflare Workers static assets; it must NOT deploy to production Azure `$web`.

## Automated checks
Workflow: **PlotFlow UI State API Staging CI**. It builds the React app with `VITE_STATE_API_BASE_URL` and with no Azure SAS variable, and uploads a short-lived static artifact.

## First deploy (requires an authorized Cloudflare user)
1. Create a new Cloudflare Worker (Git integration) linked to repository `phongtran278/PlotFlow`, branch `feature/plotflow-frontend-state-api-staging`. Do NOT reuse `plotflow-proxy` or `plotflow-state-api-staging`.
2. Select the distinct Worker name `plotflow-ui-staging` (confirm availability). Set root directory `app`; run build `npm ci && npm run build`; deploy `npx wrangler deploy`. The config at `app/wrangler.jsonc` uploads Vite's `dist` directory.
3. Set build-time **non-secret** environment variables:
   - `VITE_CLOUD_PROJECT_ID=vinhomes-saigon-park`
   - `VITE_STATE_API_BASE_URL=https://plotflow-state-api-staging.phongtran7076.workers.dev`
   - `VITE_PROJECT_STATE_URL` must be **unset**.
   - `PLOTFLOW_CODE_ONLY_DEPLOY=1` may be used to avoid uploading large optional public assets; for functional testing ensure referenced static project images are available in the staging build.
4. Protect the entire UI staging Worker with Cloudflare Zero Trust Access, limited to approved designer emails.
5. On the staging **API** Worker, add the exact UI staging origin to `ALLOWED_ORIGINS`; allow credentialed CORS, expose `x-plotflow-state-etag`, and confirm that Access allows browser preflight or use same-origin routing. Do **not** weaken authentication, omit `If-Match`, or deploy to production.
6. Authenticate to the API staging domain separately. In the browser, confirm login cookies and request headers; disallow any scenario that redirects API fetches to an HTML login page.
7. In an isolated browser profile, verify read, save/reload, and deliberate concurrent edit conflict; verify an API error stops autosave.
8. Test with a **non-empty staging snapshot**. An empty staging snapshot plus local project data intentionally refuses automatic migration.

Until steps 4–7 are verified, treat this as a prepared staging build rather than a usable live UI. The app does not yet display a dedicated status banner for the fail-closed state, so the browser event `plotflow-cloud-state-status` can be used to monitor it.

Keep `agent/fix-preview-pan-tabs-memory` and `$web` unchanged.
