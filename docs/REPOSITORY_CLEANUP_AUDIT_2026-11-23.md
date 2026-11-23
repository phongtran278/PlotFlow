# PlotFlow repository cleanup audit — 2026-11-23

## Safety / scope
This document is an initial audit, NOT a completed refactor. Do not delete or relocate code, assets, Git LFS objects, or Azure blobs on the strength of this document alone.
- Keep `main` unchanged until a reviewed PR passes build and smoke tests.
- Preserve full Git history; do not force-push or rewrite history.
- Preserve Azure project state and keep a separately verified backup.
- No production deployment from this audit branch.

## Confirmed structure (GitHub `main`)
- `app/`: runnable Vite + React app; `app/package.json` scripts: `setup`, `sync-assets`, `dev`, `build`, `lint`, `preview`.
- `app/src/`: `App.jsx`, `App.css`, `main.jsx`, `index.css`, `components/`, `data/`, `floorplan/`.
- `app/tools/`: `sync-assets.mjs`, `sync_assets.command`; `app/public/assets/` and `app/public/masterplan/` are ignored as generated runtime copies.
- `PlotFlow_DEMO_READY_PATCH_03/`: historical replacement package. Its `REPLACE_GUIDE.txt` instructs manually replacing files under `app/`; it is **not** evidence that the patch was or wasn't applied.
- `PlotFlow_ROUND1_FINAL_RECOVERY_06/`: historical recovery package. Its `README_FIX.txt` mentions previously missing modules and replacing files; do not run the replacement script without inspection.
- `assets/`, `masterplan/`, `references/`: repository assets; existing `.gitattributes` tracks PNG/JPG/JPEG/PDF through Git LFS.
- `docs/`: existing project specifications and notes.

## Risks to investigate before cleanup
1. Historical patch directories contain alternate code and manual replacement scripts. Determine which historical files are still referenced before archival/removal.
2. Production and development asset loading may differ. Verify `sync-assets`, URL paths and Azure hosting behavior before modifying assets.
3. Git LFS pointers still exist. Azure contains resources, but full parity and runtime URL usage have **not** been verified. Do not remove LFS configuration yet.
4. Existing `.gitignore` contains repeated exclusions; cleanup is low priority and should be isolated from behavior-changing work.
5. Local `localStorage`-backed settings and Azure `state.json` backup/sync semantics must be verified before editing persistence.

## Proposed phased plan
### Phase A: inventory and baseline (read-only)
- Record current `main` commit SHA, repository tree, package scripts and operational deployment path.
- Enumerate duplicate filenames and compare contents of historical packages with `app/`.
- Inspect imports/references to old patch directories and the `sync-assets` script.
- Run `npm ci`, `npm run build`, and `npm run lint` in an isolated checkout; capture baseline failures without changing behavior.
- Define smoke tests: app startup, sheet import, overview card layout, pin/floorplan, badge, prices, image/PDF loading, state export/restore.

### Phase B: small, reversible PRs
- Centralize instructions/document the `app/` entrypoint and separate historical materials.
- Only after provenance check, propose moving historical patch packages to a clear archive location; do not delete them or rewrite history.
- Make one behavior-preserving change per PR. Compare visual outputs and persistence before and after each PR.
- Add CI build/lint checks when current baseline is understood.

### Phase C: Azure/LFS migration (separate project)
- Inventory each LFS pointer and Azure blob path, compare file content/checksums and serving URLs.
- Verify a staging deployment and rollback.
- Stop adding new LFS files only after migration acceptance. Do not rewrite prior commits.

## Guardrails for future edits
- Work on a feature branch; never directly edit `main`.
- Read existing implementation and reuse modules instead of duplicating functionality.
- Limit patch scope; run automated checks and smoke tests.
- Obtain user approval for merge/deploy and for destructive operations.
- Do not commit secrets, connection strings, SAS tokens, private state backups or actual client data.

## Status
Initial repository inventory completed; build/runtime and full file-duplication analysis NOT yet completed. No application files changed.
