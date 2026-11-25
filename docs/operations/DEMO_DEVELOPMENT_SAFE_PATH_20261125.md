# PlotFlow — Safe demo development track (2026-11-25)

## Current situation (verified with GitHub API)
- Azure-deploy branch: `agent/fix-preview-pan-tabs-memory` at `91301c477b8b9e9a6322e383c72200af25bda154`.
- This demo-development branch was cut from that exact baseline; **no product code or Azure state has been changed**.
- Preservation PR #57, read-only audit PR #58, and browser-baseline PR #59 are open Draft PRs; each has passed its own GitHub Actions checks. Browser smoke is local-only, not production E2E.
- Cloudflare Workers staging checks (`plotflow-ui-staging` and `plotflow-state-api-staging`) report failure even on the unchanged Azure-deploy baseline commit. These are NOT yet diagnosed and must not be bypassed by disabling required checks.

## Owner-friendly development rule
1. Use `work/plotflow-demo-ui-safe-20261125` for upcoming visual and feature changes, or create narrowly scoped child branches. Make small PRs for one behavior at a time.
2. Before each change: name the affected screen and expected behavior, identify its actual owner in source, and capture a before screenshot where useful.
3. After each change: run lint/build and targeted tests; test Home → Projects → Overview → Detail, the modified interaction, and PDF/Preview/export when relevant.
4. Never use production Azure state as a test fixture; editing, save/reload or Sheets import demos must use an isolated setup and synthetic/project-safe data.
5. Keep a simple rollback path: checkpoint commit, revert individual PR, verify cloud data separately. Source revert cannot restore Azure Blob data.

## Merge and production approval gates
- Confirm current remote deployment and staging configuration; do not assume GitHub commit equals deployed app.
- Investigate **Cloudflare Workers Builds** failures via Cloudflare build logs and distinguish independent integration failures from actual release requirements. Never remove checks merely to turn CI green.
- Verify downloaded `state.json` integrity and staging restore without touching the live `$web/plotflow-projects/vinhomes-saigon-park/state.json`.
- Confirm browser functional smoke on real target OS and device, including save/reload and PDF/Preview; compare memory under sustained representative workloads.
- Review/remove browser-exposed long-lived Azure write SAS via tested State API migration and credential rotation, with rollback.
- Explicit owner approval is mandatory before any merge targeting auto-deploy branch or manual production deployment.

## Recommended integration order (once gates pass)
Preservation PR #57 → architecture inventory PR #58 → browser regression PR #59, rebasing/re-testing after every merge. Merge order is a proposal, not authorization.

## Presentation preparation
- Verify the exact demo URL on the presentation laptop and network.
- Prepare safe sample project and screenshots/video fallback.
- Avoid changes to production and avoid live save/export operations in shared projects.
