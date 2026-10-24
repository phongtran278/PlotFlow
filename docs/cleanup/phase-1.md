# PlotFlow — Cleanup Phase 1 (2026-10-24)

## Scope
Safe repository hygiene, not a product change. Production and active application sources remain unchanged.

## Removed from the active cleanup branch
- `PlotFlow_DEMO_READY_PATCH_03/`
- `PlotFlow_ROUND1_FINAL_RECOVERY_06/`

**Why:** These are historical patch/recovery packages, not canonical app roots. The root `.gitignore` already classifies both naming patterns as backups; the main README names `app/`, `assets/`, `masterplan/`, `docs/`, and `.github/` as the active source roots. No active code entry points are being removed in this batch.

**Recoverability:** Their content remains in Git history and the untouched staging/production branches; deletion is only proposed in this separate cleanup branch. Do not purge Git history.

## Verification gates
- Confirm `npm ci`, `npm test`, `npm run build` in staging CI.
- Inspect the PR diff: the deleted files must be confined to the two historical packages.
- Verify app functionality in staging before any merge.
- Keep `ARCHITECTURE_RULES.md` and `CLEANUP_AUDIT.md` as governing cleanup rules.

## Next batches (not performed yet)
1. Dependency/import graph of `app/src` (including dynamic imports and CSS).
2. CSS ownership map, one subsystem at a time.
3. Detect unused resources with reference checks; never delete based on filename alone.
4. Split high-coupling runtimes only after regression coverage exists.

Note: Cleanup should preserve observable layout, Google Sheets behavior, Overview/Detail interactions, and export output.
