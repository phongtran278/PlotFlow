# PlotFlow System Audit — Scale-out Architecture

Status: architecture audit only; no runtime behavior changed in this pass.

## Executive conclusion

PlotFlow is now strong enough at the interaction/runtime layer to stop treating Overview as an active feature-development surface. Overview should move to regression-only maintenance.

The next product risk is not visual polish. It is project isolation and repeatable onboarding.

Today the product shell can present many projects, but the working Detail/Overview data model is still largely global:

- one active Detail workspace,
- global localStorage keys,
- global sales capture,
- one bundled masterplan/manifest path,
- project-specific unit-code and architecture assumptions in shared source,
- project export/import that does not yet represent the entire project package.

This means the UI can look multi-project while the underlying workspace is not yet safely multi-project.

The scale-out target is:

> Project N = new profile + new data + new assets + optional topology adapter, not new JSX/CSS/runtime code.

A new project should not require editing PlotFlow Core unless it introduces a genuinely new capability.

---

## 1. Audit scope

Reviewed current branch source across:

- product shell and project catalog,
- Detail workspace in `App.jsx`,
- sales ingestion,
- floorplan/masterplan locator stack,
- Overview project/group behavior,
- project settings/export,
- asset and architecture matching,
- memory profile/runtime,
- design-system ownership,
- repository cleanup/legacy structure.

This audit classifies the system into five decisions:

- **KEEP** — stable core behavior; freeze except regressions.
- **EXTRACT TO CONFIG** — project-specific values currently in shared code.
- **REFACTOR BOUNDARY** — behavior is valid but ownership/API needs separation.
- **ADAPTER** — legitimate high-rise / low-rise / hybrid differences.
- **CLEANUP** — legacy/recovery debt that should leave the active product tree after dependency verification.

---

## 2. Current architecture — what is already strong

### KEEP — Overview runtime

Overview has now established clear behavior owners:

- camera / zoom: `OverviewZoomRuntime`,
- card drag + main-canvas connector geometry: `WindowsOverviewViewportRuntime`,
- Auto Arrange: `OverviewArrangeModesRuntime`,
- highlights: `OverviewPenRuntime`,
- Object Audit: `OverviewInteractionRuntime`,
- handover tabs: `OverviewWorkspace.jsx`.

The recent work also established:

- bounded/event-driven updates instead of broad feedback loops,
- stable handover switching,
- memory-bounded raster behavior,
- project-facing visual hierarchy,
- connector clearance as a layout constraint,
- deterministic lot-point recovery semantics.

Recommendation: **freeze these runtime owners**. Do not use the scale-out pass as an excuse to rewrite them.

### KEEP — memory architecture

The low-memory profile is conservative and currently serves the product goal:

- small preview/page/object URL caches,
- no aggressive preloading,
- bounded Overview raster concurrency,
- explicit prepared-raster release,
- runtime memory sampling.

The fact that low-memory detection currently defaults to conservative behavior is acceptable for the packaging pass. Adaptive tuning can be revisited later if real multi-project usage proves it necessary.

### KEEP — Project Landing master architecture

`projectCatalog.js` + `ProjectLanding.jsx` already demonstrate the correct pattern:

- one renderer,
- project records supply content,
- project-specific landing differences do not need copied pages.

That same principle should now be extended to Detail, Overview data sources and project assets.

---

## 3. Highest-priority finding — project selection does not yet isolate workspace state

### Severity: BLOCKER for 10–20 project rollout

`ProductShell.jsx` stores a selected `project`, but the mounted Detail child is still the same global `App` instance.

The selected project is not currently the namespace owner of Detail state.

Examples of global state include:

- sales/sheet history,
- design assignments,
- floorplan overrides,
- lot overlays,
- manual floorplans,
- layout state,
- campaign badges,
- Overview sell units,
- card layouts,
- connector/anchor/highlight state.

Most of these are persisted by global localStorage keys rather than keys scoped to `project.id`.

### Consequence

Opening Project A, then Project B can reuse data from the same browser storage unless each subsystem independently happens to replace it.

This is the central architectural issue to solve before adding many projects.

### Target

Introduce one project-aware persistence contract:

```text
plotflow:<projectId>:<state-domain>:<schema-version>
```

Examples:

```text
plotflow:vinhomes-saigon-park:sales:v1
plotflow:vinhomes-saigon-park:floorplan-overrides:v6
plotflow:vinhomes-saigon-park:overview-card-layout:v2
plotflow:vinhomes-saigon-park:connector-style:v1
```

Do not migrate every runtime independently. Create a shared project storage API and migrate domain by domain.

---

## 4. Project Profile — missing canonical contract

### Severity: BLOCKER

`projectCatalog.js` currently owns useful identity/landing metadata:

- id,
- code,
- name,
- developer,
- location,
- status,
- tone,
- landing content.

But the workspace needs a richer `ProjectProfile`.

Recommended minimum shape:

```js
{
  id,
  code,
  name,
  developer,
  location,
  status,

  topology: {
    kind: "low-rise" | "high-rise" | "hybrid",
    hierarchy: ["zone", "subzone", "lot"]
    // or ["tower", "floor", "unit"]
  },

  sales: {
    schema: "project-sales-v1",
    fieldMap: {},
    handoverField: "handover",
    unitCodeField: "unitCode"
  },

  overview: {
    groups: [],
    masterplanSource: {},
    preparedManifest: {},
    defaults: {}
  },

  detail: {
    template: "sales-poster-v1",
    fields: [],
    assetSlots: [],
    exportPreset: {}
  },

  locator: {
    codeRules: {},
    overrideSource: null
  },

  assets: {
    catalog: {},
    branding: {}
  }
}
```

The exact final schema can evolve, but a project must have one canonical object that all work surfaces receive.

---

## 5. Sales ingestion — duplicated and low-rise-biased

### Severity: HIGH

There are currently at least two normalization paths:

1. `App.jsx -> normalizeRow()`
2. `OverviewSellDataRuntime.jsx -> normalizeRow()`

They understand overlapping but different aliases.

`OverviewSellDataRuntime` also wraps `window.fetch` to detect Google Sheet CSV traffic as a side effect.

### Problems

- Detail and Overview can normalize the same source differently.
- Field aliases are embedded in runtime code.
- New projects with different column names require source edits.
- Global fetch interception is hard to reason about and unnecessary once data ownership is explicit.

### Target

Create one ingestion pipeline:

```text
Source adapter
  -> raw rows
  -> project field map
  -> canonical UnitRecord[]
  -> project store
  -> Detail + Overview selectors
```

Recommended canonical unit core:

```js
{
  id,
  unitCode,
  topology: {
    zone,
    subzone,
    block,
    tower,
    floor,
    lot
  },
  product: {
    type,
    bedrooms,
    floors,
    landArea,
    constructionArea,
    usableArea,
    frontage,
    roadWidth
  },
  commercial: {
    price,
    priceAllIn,
    paymentOptions: {}
  },
  handover: {
    code,
    label
  },
  architecture: {},
  source: {
    rowId,
    raw
  }
}
```

High-rise and low-rise should share this canonical record; unused fields can be empty.

---

## 6. High-rise vs low-rise — use topology adapters, not separate apps

### Severity: HIGH design decision

The product owner expects 70–90% common behavior. The current source supports that conclusion.

Common Core:

- project identity,
- sales ingestion,
- unit selection,
- commercial fields,
- asset assignment,
- Detail composition,
- Overview selection/cards,
- export,
- review,
- Design System,
- persistence,
- memory behavior.

Legitimate differences belong in an adapter.

### Low-rise adapter

Typical hierarchy:

```text
Zone -> Subzone / Collection -> Lot
```

Likely capabilities:

- masterplan lot anchor,
- house architecture model,
- land/construction area,
- frontage/road metadata,
- lot highlight.

### High-rise adapter

Typical hierarchy:

```text
Tower -> Floor -> Unit
```

Likely capabilities:

- tower/floor navigation,
- typical-floor plan,
- unit floorplan anchor,
- bedroom/usable-area/view-direction metadata,
- stack/unit-line logic.

### Hybrid adapter

Combines both without changing the canonical UnitRecord.

Rule:

> Topology changes navigation and locator strategy, not the entire Detail/Overview product architecture.

---

## 7. Detail — functional core is strong, ownership is too monolithic

### Severity: HIGH, but migrate incrementally

`App.jsx` currently owns too many domains at once:

- Google Sheets connection,
- Excel import,
- data normalization,
- unit state,
- locator connection/indexing,
- floorplan render caches,
- manual override state,
- lot editor state,
- design assignments,
- asset selection,
- export,
- Detail UI composition.

The behavior works, so this should **not** be rewritten wholesale.

### Target decomposition

Keep `App` as composition during migration, but extract stable boundaries:

```text
project/
  ProjectContext
  ProjectStorage
  ProjectProfile

data/
  SalesSourceAdapter
  SalesNormalizer
  UnitRepository

locator/
  LocatorService
  LocatorProfile
  PreparedManifestProvider

detail/
  DetailWorkspace
  DetailTemplate
  DetailExportService
  DesignAssignmentStore
```

Migration rule:

> Move one responsibility at a time, preserve runtime behavior, verify production after each boundary extraction.

---

## 8. Detail template — separate reusable structure from one campaign format

### Severity: HIGH for scale

Current Detail output is strongly tied to one 1080 x 1920 sales-poster composition.

Examples in current source:

- fixed 1080 x 1920 export canvas,
- floorplan slot geometry around 506 x 390,
- project-colored export background,
- fixed asset roles: house / amenity 01 / amenity 02 / logo / campaign badges,
- low-rise-oriented architecture assignment.

These are valid for the current template. They should not be treated as universal project logic.

### Target

Introduce a Detail template profile:

```js
{
  id: "sales-poster-v1",
  artboard: { width: 1080, height: 1920 },
  slots: ["hero", "house", "floorplan", "unitInfo", "amenity1", "amenity2"],
  supportedFields: [],
  exportPresets: [1, 2, 3, 4, 5]
}
```

A high-rise project could use the same template, or choose another template later, without changing data ingestion or locator Core.

---

## 9. Masterplan / floorplan locator — project source paths are hardcoded

### Severity: BLOCKER

Current shared locator code contains project-specific source assumptions:

- bundled masterplan path `/masterplan/masterplan.pdf`,
- prepared manifest path `/masterplan/generated/manifest.json`,
- Overview raster source `prepared-masterplan-page-1`.

These must move into ProjectProfile / ProjectPackage.

### Target

```js
project.overview.masterplan = {
  source: "/projects/<id>/masterplan/masterplan.pdf",
  manifest: "/projects/<id>/masterplan/generated/manifest.json",
  renderMode: "prepared-raster"
}
```

The locator facade should receive a source descriptor. It should not infer the active project from a hardcoded path.

---

## 10. Unit-code compatibility — shared file contains project-specific recovery logic

### Severity: HIGH

`unitCodeCompat.js` includes compatibility behavior such as:

- DLCV / LCV / CV prefix aliases,
- global `locatorOverrides.json`.

Those are durable and useful for the current project, but they are not generic PlotFlow Core rules.

### Target

Move project-specific aliases into:

```text
ProjectProfile.locator.codeRules
```

Move overrides into the project package or project-scoped persistent data.

Core should only own generic normalization:

- Unicode normalization,
- dash normalization,
- case normalization,
- safe character normalization.

---

## 11. Architecture auto-match — current implementation is a project dataset

### Severity: HIGH

`architectureAutoMatch.js` contains explicit unit codes and low-rise architecture mappings such as CH-series house styles.

This is not a defect; it is simply in the wrong layer for scale.

### Decision

**EXTRACT TO PROJECT DATA.**

Core may keep generic matching functions, scoring and asset compatibility.

The list:

```text
unitCode -> architectureCode -> architectureLabel
```

belongs to the active project package.

---

## 12. Assets — catalogs need project scoping

### Severity: MEDIUM/HIGH

`assetLibrary.js` contains explicit example assets such as:

- TAN_CO_DIEN,
- AS76_08,
- AMENITY_1,
- AMENITY_2.

Other catalog files are more structured, but the active assignment model is still global.

### Target

Separate:

```text
Core asset roles
  house
  floorplan
  amenity
  logo
  badge
  pin

from

Project asset instances
  /projects/<id>/assets/...
```

A project profile decides which roles are enabled.

High-rise may not need `house`; low-rise may not need `towerStackDiagram`.

Do not create per-project React components just to hide unused asset slots.

---

## 13. Overview groups — current defaults are project-specific

### Severity: HIGH

`ProductShell.jsx` currently includes:

```text
Hoàn thiện
Giãn xây
Xây thô
```

and canonicalization rules for those Vietnamese low-rise handover labels.

This is appropriate for the current project but should not be PlotFlow-wide behavior.

### Target

Move group definitions and aliases into ProjectProfile:

```js
overview.groups = [
  {
    id: "finished",
    label: "Hoàn thiện",
    aliases: ["hoan thien", "..."]
  }
]
```

A high-rise project could instead group by:

- tower,
- release phase,
- sales status,
- handover package,

without modifying `ProductShell`.

---

## 14. Project Settings / .plotflow export is incomplete as a project package

### Severity: HIGH

`ProjectSettings.jsx` exports a set of localStorage domains, but it is not yet a complete project snapshot.

The package does not currently define one canonical contract for:

- ProjectProfile,
- active sales source/data,
- masterplan/floorplan source descriptors,
- prepared manifests,
- project-specific locator aliases/overrides,
- Overview runtime state,
- project assets,
- schema migration.

### Target: Project Package v1

Recommended conceptual package:

```text
<Project>.plotflow/
  manifest.json
  project.json
  sales/
    mapping.json
    snapshot.json
  masterplan/
    source.json
    generated/manifest.json
  locator/
    code-rules.json
    overrides.json
  assets/
    catalog.json
  state/
    detail.json
    overview.json
```

The physical distribution can initially remain JSON + referenced files. The key requirement is the schema boundary.

---

## 15. Repository structure — recovery folders should not remain active product architecture

### Severity: MEDIUM

The repository root still contains historical recovery/patch trees such as:

- `PlotFlow_DEMO_READY_PATCH_03`
- `PlotFlow_ROUND1_FINAL_RECOVERY_06`

They are useful historical artifacts, but they increase search ambiguity and can produce stale code-search results.

### Decision

**CLEANUP after dependency verification.**

Preferred outcome:

- archive outside active source tree,
- or move to a clearly marked `archive/` excluded from architecture/search workflows,
- never import from them.

Do not delete them until the existing cleanup checklist confirms no active references.

---

## 16. Design System — healthy direction, remaining debt is not a scale blocker

### Severity: MEDIUM

The Design System has a forward API:

- semantic tokens,
- shared controls,
- system UI typography for editor surfaces,
- Home/brand typography distinction.

Remaining legacy font/style code exists in older Detail layers.

### Decision

Do not pause scale-out to perfect all visual debt.

Rule for the next pass:

- new project-aware UI must consume semantic tokens,
- do not create new per-project CSS,
- migrate legacy Detail visual owners only when touched by the architecture work.

---

## 17. Global DOM/event runtime architecture — preserve, then reduce opportunistically

### Severity: MEDIUM

PlotFlow still uses several DOM-bridge runtimes and event contracts because the product evolved around a working Detail app.

This is acceptable while behavior is stable.

Do not attempt a React rewrite during scale-out.

Instead:

1. introduce ProjectContext and project-scoped APIs,
2. make existing runtimes consume those APIs,
3. remove DOM discovery only when a direct data contract becomes available,
4. keep bounded/event-driven update rules.

The system has already proven that broad observers and auto-layout loops can cause freezes; avoid architecture “cleanup” that reintroduces that risk.

---

## 18. Recommended target architecture

```text
PlotFlow Core
|
+-- ProductShell
|   +-- ProjectContext
|   +-- ProjectProfile
|   +-- ProjectStorage
|
+-- Unit Data Core
|   +-- SalesSourceAdapter
|   +-- FieldMapper
|   +-- UnitNormalizer
|   +-- UnitRepository
|
+-- Topology Adapter
|   +-- LowRiseAdapter
|   +-- HighRiseAdapter
|   +-- HybridAdapter
|
+-- Locator Core
|   +-- PreparedManifestProvider
|   +-- RuntimePdfProvider
|   +-- ProjectCodeRules
|   +-- ProjectOverrides
|
+-- Detail Core
|   +-- DetailWorkspace
|   +-- DetailTemplateProfile
|   +-- DesignAssignmentStore
|   +-- ExportService
|
+-- Overview Core
|   +-- current stable runtimes
|   +-- project-scoped data selectors
|   +-- project-scoped state
|
+-- Project Package
    +-- profile
    +-- field mapping
    +-- sources
    +-- assets
    +-- locator data
    +-- saved state
```

---

## 19. Migration roadmap

### Phase 0 — Freeze accepted baseline

Do now:

- Overview -> regression-only.
- Memory runtime -> KEEP.
- Do not redesign Detail.
- Record exact production baseline.

Exit condition:

- current project remains behaviorally unchanged.

### Phase 1 — ProjectContext + storage namespace

Build first.

Deliver:

- `ProjectContext` provides active `project.id` and `ProjectProfile`,
- one `ProjectStorage` API,
- project-scoped keys,
- migration layer reads old global keys only for the current legacy project.

Do not migrate every domain in one commit.

Exit condition:

- Project A and Project B can hold different saved state without collision.

### Phase 2 — Unified sales data contract

Deliver:

- one source adapter for Google Sheet / Excel,
- one field-map schema,
- one canonical UnitRecord,
- Detail and Overview consume the same normalized records,
- remove Overview fetch interception after direct flow is proven.

Exit condition:

- one imported sheet drives both Detail and Overview identically.

### Phase 3 — Project source/package contract

Deliver:

- project-specific masterplan source,
- prepared manifest source,
- locator rules,
- asset catalog,
- Detail template profile.

Exit condition:

- no shared runtime contains the current project's masterplan path.

### Phase 4 — Detail boundary extraction

Incrementally extract:

- source/data controller,
- locator controller,
- design assignment store,
- export service.

Keep UI behavior identical.

Exit condition:

- `App.jsx` becomes composition instead of the owner of every data/service concern.

### Phase 5 — Overview project scoping

Do not rewrite Overview runtimes.

Only migrate:

- sales selector,
- group config,
- card/connector/anchor/highlight storage,
- masterplan source.

Exit condition:

- two projects can switch Overview with no state bleed.

### Phase 6 — Project Package v1 + validator

Deliver:

- project schema version,
- required/optional capabilities,
- field-map validator,
- source/asset validation,
- onboarding diagnostics.

Exit condition:

- a new project can be prepared without editing Core.

### Phase 7 — Second-project stress test

Choose a project with different topology.

Best validation:

- current low-rise project,
- one high-rise project.

Measure:

- source files edited in Core,
- config/data added,
- onboarding time,
- schema exceptions,
- runtime RAM,
- Detail/Overview regressions.

Success criterion:

> A normal second project requires zero Core layout/runtime forks.

---

## 20. Priority matrix

| Area | Decision | Priority |
| --- | --- | --- |
| Overview interaction/runtime | KEEP / freeze | P0 |
| Memory-bounded runtime | KEEP | P0 |
| ProjectContext | BUILD | P0 |
| Project-scoped storage | BUILD | P0 |
| ProjectProfile | BUILD | P0 |
| Unified UnitRecord | BUILD | P0 |
| Sales field mapper | EXTRACT | P0 |
| Masterplan/manifest paths | EXTRACT TO CONFIG | P0 |
| Overview handover groups | EXTRACT TO CONFIG | P1 |
| Unit-code aliases | EXTRACT TO PROJECT | P1 |
| Locator overrides | EXTRACT TO PROJECT | P1 |
| Architecture auto-match data | EXTRACT TO PROJECT | P1 |
| Detail template geometry | TEMPLATE CONFIG | P1 |
| Project asset catalogs | PROJECT SCOPE | P1 |
| .plotflow project package | EXPAND | P1 |
| App.jsx decomposition | INCREMENTAL REFACTOR | P1 |
| DOM bridge reduction | OPPORTUNISTIC | P2 |
| Remaining Detail visual polish | LATER | P2 |
| Recovery folder cleanup | VERIFY + ARCHIVE | P2 |

---

## 21. What should NOT happen next

Do not:

- redesign Detail before project/data ownership is fixed,
- fork Detail for high-rise and low-rise,
- create `ProjectA.css`, `ProjectB.jsx`, etc.,
- duplicate sales normalizers,
- add more project-specific aliases to global Core,
- hardcode a second masterplan path into locator runtime,
- rewrite stable Overview runtimes,
- do a large React/runtime rewrite just for architectural neatness.

---

## 22. Recommended immediate next implementation

Start with **Phase 1 only**:

1. introduce `ProjectProfile` extension in `projectCatalog.js`,
2. introduce `ProjectContext`,
3. introduce `ProjectStorage`,
4. pass active project into the Detail workspace without changing Detail UI,
5. migrate one low-risk state domain first,
6. verify current project behavior,
7. then migrate sales + locator domains.

This is the safest first move because it creates the namespace that every later migration needs.

---

## 23. Definition of “PlotFlow is packaged”

PlotFlow is ready for 10–20 projects when all statements below are true:

- selecting a project isolates all workspace state,
- Detail and Overview consume one canonical unit dataset,
- masterplan/floorplan sources come from ProjectProfile,
- high-rise/low-rise differences use adapters/config,
- project assets are project-scoped,
- project save/export represents the complete project state contract,
- onboarding validates missing fields/assets before runtime,
- a new normal project requires no Core fork,
- memory remains bounded when switching projects repeatedly,
- Overview remains regression-stable,
- visual differences are template/profile choices, not CSS patches.

At that point PlotFlow is no longer “an app configured for one project”.

It is a reusable real-estate design operations platform.
