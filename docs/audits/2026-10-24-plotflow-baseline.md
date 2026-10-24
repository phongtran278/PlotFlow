# PlotFlow — Technical & Product Audit, baseline v0.1

**Date:** 2026-10-24  
**Scope:** Repository-level preliminary audit; frontend staging branch `feature/plotflow-frontend-state-api-staging`, State API branch `feature/plotflow-state-api-foundation`.  
**Safety rule:** Audit-only change. No production deployment, merge, or production data mutation.

## Executive summary

This is a **preliminary evidence-based baseline**, not a declaration that all six audit areas passed. The existing staging State API demonstrates conditional writes and authentication at the API layer, but several remaining risks need validation before production migration.

### Evidence inspected

- `app/src/project/CloudProjectState.js`
- `app/src/project/CloudSaveStatus.jsx`
- `app/src/main.jsx` (bootstrap integration, previously inspected)
- `app/package.json`
- `app/wrangler.jsonc`
- `app/tools/prepare-cloudflare-staging.mjs`
- `app/tools/check-secrets.mjs`
- `.github/workflows/ui-state-api-staging-ci.yml`
- `services/state-api/src/index.js` (State API foundation branch)

This report distinguishes **code-confirmed facts**, **previously observed staging behavior**, and **not-yet-tested hypotheses**.

## Initial risk register

| ID | Priority | Finding and evidence | Impact | Verification / acceptance |
| --- | --- | --- | --- | --- |
| DATA-01 | **P1** | `CloudProjectState.js` collects selected `localStorage` keys and submits one project-wide snapshot using a single ETag. Azure's `412` blocks stale writes, including non-overlapping edits. | Collaboration friction; potential lost local edits if user reloads without recovery. | Two independent sessions: stale write returns 412; source state unchanged; local edits retained; a safe resolution path exists. |
| DATA-02 | **P1** | `CloudSaveStatus.jsx` renders warnings for conflict/save failure, but does not implement resolution, pending-change export or retry. `CloudProjectState.js` sets `writeBlocked=true`. | User knows save failed but cannot safely resolve it in-app. | UI integration test checks visible alert, preservation of edits, explicit recovery behavior. |
| DATA-03 | **P1** | Sync is triggered by writes to allowlisted `localStorage` keys. App interactions not persisting through those keys cannot trigger cloud PUT. | Some changes may appear successful locally but be unsaved remotely. | Build a save coverage matrix: detail layout, overview, image placement, policy, manual floors, Sheets config, and export settings. Verify actual PUT + reload for each persisted action. |
| ASSET-01 | **P1** | `prepare-cloudflare-staging.mjs` removes noncritical output files >25 MiB from `dist` and writes `staging-omitted-assets.json`. | Certain image/media paths may break in staging and mask real app behavior. | Publish asset omission inventory with source references; optimize/rehost critical assets without modifying originals; smoke-test URLs. |
| SEC-01 | **P1** | Staging builds use `VITE_STATE_API_BASE_URL` and test for Azure URL/SAS strings in built JS. Production exposure and migration not verified in this audit. | Production credential exposure or inconsistent protection remains possible. | Audit production artifact and Cloudflare/Azure access (without logging tokens), define migration and rollback gate; do not migrate during audit. |
| TEST-01 | **P1** | Staging CI runs secret scan, `npm test`, Vite build and a bundle string check; observed workflow does not include browser E2E journeys. | Passing CI does not prove real user flows or cross-browser compatibility. | Add controlled staging E2E smoke for Home, Project, Google Sheets import, Overview, Detail, save/reload, export, stale-write conflict. |
| SEC-02 | **P2** | `check-secrets.mjs` scans specified text roots with two static patterns and skips files >1 MiB; it explicitly says this is not a live credential/security audit. | False sense of comprehensive secret detection. | Document limits, use wider non-secret-leaking scanner in CI, perform access review separately. |
| API-01 | **P2** | State API has a 256 KiB request-size cap and validates a basic project/storage shape. Real snapshot growth not yet measured. | Writes may fail as projects grow. | Measure redacted snapshot byte-size distribution; test near 256 KiB and confirm clear error UX. |
| OPS-01 | **P1 (verification gate)** | Code declares isolated staging Worker. No production deployment, end-to-end rollback or backup restore was executed during this audit. | Unproven disaster recovery. | Record tested restore/RTO/RPO procedure for non-production data and approve rollback checklist before production changes. |

**Priority:** P0 = active production compromise / data loss (none independently confirmed in this code review); P1 = major release blocker / credible risk; P2 = quality or hardening. These are triage priorities, not claims that the bugs have manifested in production.

## Six audit tracks and remaining work

### 1. Preservation
- Confirm branch/ref checkpoints and protected production baseline.
- Inventory backups, retention and Azure Blob versioning; test restore **in staging only**.
- Regression gates: Home, Pricing, Projects, Overview, Detail, export.

### 2. Security & data
- Trace all client data flows including legacy production SAS handling.
- Verify auth, viewer/editor permissions, CORS, token lifetime, environment isolation.
- Test stale ETag, 401/403/412/413 and UI messaging.
- Keep Google Sheets as **business-data source of truth** (unit, area, price, sales policy), PlotFlow as design/layout state. Map any overrides and stale-Sheet handling before proposing code changes.

### 3. Architecture & code quality
- Create dependency/module map (React runtime, project state, localStorage, import/export, rendering).
- Identify duplicate persistence logic, hard-to-test coupled modules and side effects.
- Refactor only behind passing regression tests; no speculative rewrite.

### 4. Performance & assets
- Collect real build inventory, omitted assets list, load time and memory baselines.
- Profile pan/zoom, Overview and Detail with representative data sizes on Windows/macOS.
- Audit optimized image use, lazy loading, PDF/image resources, and Cloudflare 25 MiB limits.

### 5. UX/UI workflows
- Walk through Google Sheets import → apartment selection → visual editing → save/reload → export.
- Distinguish success, saving, offline, conflict and error status in UI.
- Check accessible feedback, undo/recovery and irreversible-action prevention.
- Test user confusion points with a small scripted evaluation.

### 6. Deployment & operations
- Inventory branches, Workers, Azure containers, environment vars/secrets, CI/CD and owners.
- Compare staging vs production behavior; prevent staging resources from mutating production.
- Define reproducible deploy/rollback runbooks and observability for errors.

## Controlled next steps / acceptance checklist

1. **Read-only inventory:** Capture current production and staging commits, workers, asset inventories and CI jobs.
2. **Reproduce high-risk cases in staging:** stale ETag, save failure, import/reload, large assets, cross-session editing.
3. **Measure rather than assume:** browser timings, bundle sizes, snapshot sizes, omitted asset paths and fail rates.
4. **Write findings with reproductions:** severity, user impact, exact module, screenshots/logs without credentials, owner and fix proposal.
5. **Do not ship fixes automatically:** for every P1 finding, propose an isolated branch/PR, tests, preview and rollback plan.
6. **Production migration gate:** no production changes until security checks, regression tests and recoverability pass.

## Current verification status

- **Code review:** partial, modules listed above.
- **CI:** staging pipeline definition inspected; a previous frontend staging CI run passed, but this audit commit has no behavioral changes.
- **Staging end-to-end:** prior manual successful GET/PUT; full journey not performed in this audit.
- **Production:** not modified or audited live by this change.
- **Collaboration merge-by-apartment:** not implemented; explicitly out of scope until baseline audit concludes.

> Avoid interpreting earlier illustrative progress percentages as measured audit completion.
