# PlotFlow — Full source stability audit, first-pass baseline (2026-11-23)

## Scope and safety
Read-only review of the active GitHub source at commit `91301c477b8b9e9a6322e383c72200af25bda154`, the configured Azure deployment branch `agent/fix-preview-pan-tabs-memory`. All changes in this audit PR are development tooling / documentation only. No product UI, storage content, credentials, or production deployments are changed. River Park is frozen. Existing Phase-1 PR #57 remains separate.

### Initial source inventory
- Recursive Git tree inspected without truncation: ~6,980 tracked paths, dominated by media and assets.
- 185 `app/` JavaScript/JSX/CSS/tool/workflow-candidate files, including 174 under `app/src` (counting JS/JSX/CSS in Git tree). The new script scans `app/src`, `app/tools`, and `services` and produces the authoritative reproducible report.
- `app/src/App.css` ~97 KB and `app/src/App.jsx` ~58 KB; large files make targeted CSS/state changes harder to isolate.
- Three separate `OverviewArrangeLogicRuntime`, `OverviewArrangeLogicRuntimeV2`, `OverviewArrangeLogicRuntimeV3` modules are present. `main.jsx` imports V3; earlier files are **not** certified unused. Trace dynamic/side-effect references before deletion.
- `main.jsx` imports a large group of runtime enhancers directly, including Overview controls, raster, export, pen and interactions. Verify their overlapping event surfaces before consolidating.
- `CloudProjectState.js` directly performs whole-object GET/PUT via client-facing `VITE_PROJECT_STATE_URL`, without conditional ETag writes in this production branch. A save failure returns false; this is a critical data-safety/multiuser release blocker, not a bug to patch casually in a demo PR.
- Lifecycle review candidates from source inspection: `WindowsOverviewViewportRuntime.jsx` schedules animation frames, `OverviewInteractionRuntime.jsx` has multiple listeners/RAF, and PDF locator modules create object URLs. Static counts alone do not prove leaks; only browser profiling and reproduction can establish them.

## Risk-based work plan (not permission to refactor indiscriminately)
1. **P1 Data safety**: preserve backup and rollbacks, then isolated staging restore; merge neither API nor old SAS changes without explicit production migration review. Test save/reload and conflict behavior in isolated environments.
2. **P1 Memory regression**: benchmark sustained PDF import, repeated unit switching, overview pan/zoom and export with browser performance/memory tooling. Record baseline and after-change numbers on realistic project sizes before attempting cache/resource cleanup.
3. **P1 Regression prevention**: add browser-level Playwright smoke for the core demo flow in a separate change; existing route-smoke tests only check app-shell HTML. Never use real Azure state or prices in tests.
4. **P2 CSS drift**: catalog selectors in `App.css` and imported style layers; identify specific cascade conflicts by computed styles in the browser. Prefer narrowly scoped component changes, not another global override.
5. **P2 State and runtime layering**: map module initialization and ownership of events/state; remove duplicate/legacy runtime only after test coverage proves the replacement equivalent.
6. **P2 Maintenance**: consider small, behavior-preserving file extractions after guardrails exist; avoid broad rewrites before presentation.

## How to run
```sh
node app/tools/audit-codebase.mjs
node app/tools/audit-codebase.mjs --json > codebase-audit.json
```
A dedicated GitHub Actions workflow runs this inventory and uploads JSON as an artifact on PRs. The report is a **triage queue**: creation/cleanup counts are imperfect proxies for resource lifecycle. It deliberately never fails CI simply because a file is large or adds listeners.

## Demo and rollout gates
- PR stays Draft and separate from auto-deploy branch; manual GitHub workflow dispatch is not a substitute for deployment approval.
- Do a non-destructive Home → Projects → Overview → Detail smoke check on the presentation device; use isolated sample state for save/export demos.
- Before production changes: validate Azure staging restore, real-user smoke, data ownership/access, SAS remediation, fallback and rollback.
- Confirm the actual live Azure build independently; the GitHub branch is not proof of the deployed artifact.
