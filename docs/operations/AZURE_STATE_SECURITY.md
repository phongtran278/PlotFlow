# PlotFlow — Azure state security gate (Phase 1)

**Status: OPEN SECURITY BLOCKER — not remediated by the Phase 1 preservation PR.**

## Confirmed source-level design

- `.github/workflows/deploy-azure-storage.yml` generates a **read/write Azure Blob SAS**, expiry +365 days, and exports it as `VITE_PROJECT_STATE_URL` during frontend compilation.
- `app/src/project/CloudProjectState.js` performs direct `GET`/`PUT` on that URL from the browser.
- Because `VITE_*` variables are compiled into public JS, this SAS is **not a secret** to anyone who can access the build.
- CORS rules and a Cloudflare domain do **not** authorize the writer; restricting the website domain does not neutralize a leaked direct Blob SAS.
- No ETag/`If-Match` is used for updates, so last writer wins.

## Immediate operating rules

1. Treat the existing SAS as exposed; do not copy/paste it into chat, issues, screenshots, or test reports.
2. Limit access to the site and sensitive data while migrating; this reduces exposure but **does not secure direct Azure Blob writes**.
3. Make an access-controlled backup of `$web/plotflow-projects/vinhomes-saigon-park/state.json`; verify it can be restored before touching credentials.
4. Review Azure Storage diagnostic/activity logs and key usage through the Azure portal, without sharing credentials.
5. **Do not rotate account keys blindly.** Existing service SAS tokens signed by the rotated key will stop working, and other apps may depend on it.

## Required hardening before sharing editing access

1. Put an authenticated API (Cloudflare Worker with Access verification or equivalent server-side service) between browser and Azure Blob.
2. Keep storage credential in server-side secrets only; remove `VITE_PROJECT_STATE_URL` with write rights from compiled frontend.
3. Enforce per-user/project write permission on the API and reject unauthenticated requests. Test attempts that bypass the app UI.
4. Use ETag/`If-Match` or versioning with conflict handling rather than blind whole-state overwrites.
5. Enable state backups/versioning and audit logging; test recovery from malformed updates.
6. After secure gateway is deployed, revoke the prior SAS safely (including key rotation only with a dependency inventory), verify the old URL fails, and confirm the new API still works.
7. Block broader multi-user release until this gate is closed and manual tests PF-10/PF-11/PF-14 pass.

The Phase 1 `check:secrets` CI guard only catches likely **literal credentials accidentally committed to source**. It **does not** catch dynamically generated SAS embedded into a public build. Do not report the security issue resolved just because the guard passes.
