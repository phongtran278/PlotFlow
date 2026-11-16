# PlotFlow — Phase 1 current-head preservation status (2026-11-16)

## Scope and safety
This branch adds preservation checks and documents the current state. It is **not deployed** and must remain a draft PR until human acceptance gates pass. Do not merge into the auto-deploy branch merely because CI is green. River Park feature changes present in the source base are **not edited** here.

- Production-deploy *configured* GitHub branch: `agent/fix-preview-pan-tabs-memory` (confirm the actual live Azure artifact separately).
- Current GitHub base commit inspected: `91301c477b8b9e9a6322e383c72200af25bda154` (2026-10-28).
- Immutable-in-practice Git branch checkpoint: `checkpoint/plotflow-pre-preservation-20261116` at that exact commit. Branch refs can be moved/deleted; also retain the SHA and verify independent backups.
- Earlier preservation checkpoint: `checkpoint/plotflow-pre-phase1-20261021` at `df2c6481bd4e3392386a1a6e16f30db096d95df8`.
- Original preservation draft PR: #52, based on the earlier October 21 commit. Its regression/CI files are carried forward into this branch. Do not double-merge #52 and the refreshed PR.
- Existing successful CI run for the **older** preservation branch: [run 39547573491](https://github.com/phongtran278/PlotFlow/actions/runs/39547573491). This is not a pass for the refreshed branch.
- The Azure deployment workflow is triggered by pushes to `agent/fix-preview-pan-tabs-memory` or a manual workflow dispatch. Pushing the new safety branch is not intended to deploy.

## Included changes
The new draft branch ports the tests, source-secret scanner, preview-route checks, CI gates and operating instructions from the original Phase 1 branch onto the 2026-10-28 deployment-branch code, without modifying its feature components or asset files. The checkpoint branch and this draft branch exist separately.

## Verification gates — do not mark complete without actual evidence
- [ ] Fresh GitHub Actions CI success on this refreshed draft, on Ubuntu and macOS: `npm ci`, secrets pattern scan, lint, Node tests, build, built-shell test, route smoke checks.
- [ ] Verify the current deployed Azure website commit against the intended source (GitHub head SHA is not proof of deployed version).
- [ ] Back up the actual Azure state blob to protected, access-restricted, versioned storage outside the public `$web` container and GitHub; test restore using a separate staging copy, with no overwrite of real data.
- [ ] Independently inventory deployed secrets/SAS and all consuming services before any revocation. Existing deployment workflow generates a read-write 365-day SAS in client-facing `VITE_PROJECT_STATE_URL`: **open security blocker**.
- [ ] Run and record the Windows/macOS manual regression checklist (`REGRESSION_CHECKLIST.md`), including Sheets, Preview, Overview, Detail, editing, save/reload and export.
- [ ] Confirm no regression to cross-project storage separation and verify no unintended changes to River Park or other existing product features.
- [ ] Obtain explicit approval of merge, deploy, rollback and storage-security remediation plan.

## Rollback rules
Do not force-reset the deployment branch. For code rollback, make a reviewed revert commit of the preservation merge, and validate the resulting Azure build. Keep the live storage state untouched. Never restore an empty/default blob on top of production data. If backup/restore verification fails, stop rollout.

## Current assessment
Git checkpoint and draft-only preservation code are available. **Production backup, restore, deployed-SHA validation, security and user-flow acceptance have NOT been verified by GitHub alone.** A successful build is not proof of production safety.
