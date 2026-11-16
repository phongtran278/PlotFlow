# PlotFlow — Phase 1 preservation baseline

Baseline recorded: **2026-10-21**. This document is operational; it does not certify the current live website build.

## What is protected

- Repository: `phongtran278/PlotFlow`
- Working/production-deploy branch: `agent/fix-preview-pan-tabs-memory`
- Exact pre-change commit: `df2c6481bd4e3392386a1a6e16f30db096d95df8`
- Preserved branch: `checkpoint/plotflow-pre-phase1-20261021`
- Implementation branch: `safety/phase1-preservation-20261021`
- Default `main` was substantially older at baseline; do not start this migration from `main`.
- Last known CI result for pre-change commit: **success**, run [37466486553](https://github.com/phongtran278/PlotFlow/actions/runs/37466486553) (2026-10-06). That CI only included lint/build.
- Production deployment uses `.github/workflows/deploy-azure-storage.yml` on pushes to the working branch. **Do not merge the preservation PR until checks pass and the rollback path is understood.**

## What Phase 1 changes

Only adds Node regression tests, a built-shell check, a source secret guard, and operational documentation; extends CI for pull requests targeting the working branch. Does not restructure Overview/Detail, migrate project state, update production Azure data, or change deployment logic.

## Before any deployment

1. Confirm the current GitHub branch and commit and whether it matches the live build. The presence of the git commit in the repository is not proof that production is running it.
2. Back up the current Azure blob `$web/plotflow-projects/vinhomes-saigon-park/state.json` **outside the public website/container and GitHub**, using a protected, versioned destination. Verify the backup can be read and restored. Do not paste SAS tokens into tickets or logs.
3. Check `app/package-lock.json` matches `package.json`; `npm ci` must pass.
4. Run CI, then follow the manual regression matrix in `REGRESSION_CHECKLIST.md` with non-sensitive sample data. Record actual results.
5. Verify production storage security independently; see `AZURE_STATE_SECURITY.md`. A successful lint/build does NOT imply it is secure.

## Safe rollback concept

For this Phase 1 change, no runtime functionality is intentionally altered. If any regression occurs after merging, **revert the Phase 1 merge commits** on the deployment branch and allow the existing Azure deploy workflow to rebuild, rather than force-pushing or resetting shared history. Verify the resulting commit against the checkpoint and check Azure state before/after.

For rollback of an earlier production version, deploy a **reviewed restore commit** based on the checkpoint. Because the Azure workflow is code-only and retains existing assets, also verify compatibility with assets that remain in the container. Do not replace the Azure `state.json` with an empty seed; it contains working project data.

## Known risks deliberately not disguised as fixed

- Writable Azure Blob SAS is injected into client-side build with up to 365 days' expiry; anyone holding the URL may write. **Security blocker for multi-user release.**
- Azure state sync is a whole-object GET/PUT with no concurrency control, so simultaneous editing can overwrite work.
- Some state keys remain global/local across projects, so cross-project mixing is a scale-out blocker.
- The GitHub LFS bandwidth was previously exhausted. The existing production deploy is code-only; do not silently restore LFS-heavy deployments.

Phase 1 is **in progress until** the PR CI succeeds and the human regression/security checkpoints are recorded.
