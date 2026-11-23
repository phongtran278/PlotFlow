# PlotFlow — Minimal demo-readiness and preservation handoff (2026-11-23)

This is a low-friction checklist for the project owner. It **does not certify production security or backup recoverability**.

## Already done on GitHub
- Current working-branch source checkpoint: `checkpoint/plotflow-pre-preservation-20261116` at `91301c477b8b9e9a6322e383c72200af25bda154`.
- Draft preservation PR #57: regression tests, lint/build, route smoke checks, source-secret pattern scan and operational guides. These checks are NOT browser E2E tests.
- Added deploy-safety regression tests: intended Azure deploy trigger remains the working branch/manual dispatch; state seeding remains conditional and non-overwriting.
- River Park is out of scope. No source edits to River Park and no Azure production deployment from this draft.

## Owner: only two short checks before serious UI/feature iteration
1. **Protect the downloaded backup**: keep the downloaded `state.json` private, unchanged and in two restricted locations. Record approximate file size and date without sharing contents or tokens. A downloaded file alone is **not** an independently verified disaster recovery plan.
2. **Five-minute non-destructive browser smoke**: open Home → Projects → an existing Overview → Detail, check project selection and canvas pan/zoom, then return Home. Avoid changing or deleting live project data. Record whether anything visibly fails.

## Before demo (owner + technical review)
- If edits/save/export must be demonstrated, use a specifically isolated test project and test data, not the live shared Azure state.
- Confirm the demo URL actually loads and login/access works from the device/network used for the presentation.
- Confirm Sheets import, editing, save/reload and export using sample data. A green CI does **not** imply those user flows work.
- Prepare screenshots or a recording as a fallback for unstable connections.
- Keep PR #57 Draft and do not trigger the Azure deploy workflow during demo preparation.

## Deferred release blockers — do NOT silently mark done
- Verify Azure backup integrity and do an isolated staging restore test.
- Verify deployed production version versus GitHub commit and confirm service/secret access rights.
- Remove long-lived browser-exposed read/write Azure SAS by adopting the guarded State API and revoking old credentials only after the verified migration plan.
- Resolve or provide safe recovery UX for concurrent edits and failed cloud saves.
- Complete cross-platform browser E2E and sign off the rollback plan.

## Next development flow
Create new UI/feature branches from a verified base, run CI and preview checks, use sample data, and open Draft PRs. Merge/deploy only after an explicit approval and backup/security gates appropriate to the target environment.
