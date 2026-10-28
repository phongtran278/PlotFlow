# PlotFlow Cleanup Audit

This document records cleanup decisions so later edits do not reintroduce retired code or delete active legacy behavior by mistake.

## Cleanup batch: architecture baseline

### Removed: confirmed dead code

- `app/src/components/SalesPolicyBar.jsx`
- `app/src/components/SalesPolicyBar.css`
  - No live consumer was found during dependency search.
  - The component and its styling were isolated from the current app flow.

- `app/src/components/SharedProjectStatus.jsx`
- `app/src/components/SharedProjectStatus.css`
  - No live consumer was found during dependency search.
  - This was an old floating project-status UI with its own interaction/style language and is not part of the current product flow.

### Consolidated: compatibility alias removed

- Removed `app/src/components/UnifiedFloorplanEditor.jsx` compatibility re-export.
- `FloorplanFineTune.jsx` now imports `UnifiedFloorplanEditorV2.jsx` directly.
- Canonical floorplan editor ownership remains with the V2 implementation and its existing styles.

## Active legacy debt — KEEP for now

Several filenames look like historical patch layers but are still imported directly by the application. They are therefore active code, not dead code.

Examples observed in `app/src/main.jsx` include global polish/override styles such as:

- `PremiumAuthPolish.css`
- `PremiumProductPolish.css`
- `OverviewCallouts.css`

Do not delete these files based on naming alone. Their valid rules must first be traced and migrated into canonical owners one subsystem at a time.

## High-risk runtime areas — KEEP / do not broad-clean

Do not perform opportunistic cleanup in runtime layers that can affect global DOM behavior, auto-fit, preview interactions, or Overview/workspace rendering. Existing body-wide observers or similar mechanisms are architecture debt to isolate carefully, not to rewrite during a visual cleanup batch.

Stable accepted areas should remain untouched unless new feedback explicitly targets them.

## Why this cleanup is intentionally conservative

The goal is not to maximize the number of deleted files. The goal is to reduce duplicate ownership and regression risk.

A safe cleanup order is:

1. Trace live imports, re-exports, routes, events, selectors, and runtime contracts.
2. Identify the canonical owner.
3. Move any still-valid behavior into the canonical owner.
4. Verify the affected workflow.
5. Delete the obsolete file/import.
6. Check CI and compare macOS/Windows for visual changes.

Deleting active patch layers before moving their valid behavior can resurrect old bugs. Adding new patches instead of consolidating ownership creates the same problem in the opposite direction.

## Next cleanup phases

### Phase 2 — Global CSS ownership map

Audit styles imported globally from `main.jsx`. For each file:

- list selectors and screens affected,
- identify the canonical component/page owner,
- classify each rule as KEEP / MOVE / DELETE,
- migrate one subsystem per commit/batch,
- remove the global import only after verification.

### Phase 3 — Component dependency audit

Continue through `app/src/components` and `app/src/product` looking for:

- compatibility aliases,
- abandoned prototypes,
- duplicate versions,
- components with no live consumer,
- CSS files with no live owner.

Do not infer dead code from filenames alone.

### Phase 4 — Branch reset after stabilization

The current PR has accumulated hundreds of commits and a large changed-file surface. After it is stabilized and merged, return to short-lived `feature/*`, `fix/*`, and `cleanup/*` branches so each regression has a small, understandable diff and a recoverable known-good checkpoint.

## Source of truth

Read `ARCHITECTURE_RULES.md` before future source changes. It defines canonical Home owners, deletion rules, runtime safety constraints, and the no-patch-stacking policy.
