# PlotFlow Architecture Rules

This file is the source of truth for code ownership and cleanup decisions. Read it before modifying PlotFlow source.

## Product principle

PlotFlow is a real-estate design operations workflow:

`data / spreadsheet -> masterplan / floorplan -> Overview / Detail -> review -> export`

Automation removes repetitive work. The designer keeps judgment, hierarchy, composition, visual craft, review, override, and final control.

## Architecture layers

1. **Design system / tokens** — color, typography, spacing, radius, shadow, Liquid Glass, motion duration and easing.
2. **Reusable master components** — one canonical component owns each reusable UI behavior.
3. **Pages / runtimes** — compose masters, pass data, and coordinate page-level layout. Pages should not patch component internals.

## Visual source of truth

The approved Home experience is PlotFlow's visual reference implementation.

- Canonical design tokens: `app/src/styles/plotflow-tokens.css`
- Reference page: `app/src/components/HomeLanding.jsx` + `HomeLanding.css`
- Reference masters: Hero Orbit, Project Card, Workflow, FAQ and shared button language on Home.

When styling Overview, Detail, Auth, project settings, future screens, or new reusable components:

1. Start from the global PlotFlow tokens.
2. Match Home's visual language before introducing a new value.
3. Preserve Home's hierarchy: alignment -> grid -> spacing -> hierarchy -> typography -> motion -> effects.
4. Treat Liquid Glass as a controlled material, not a default decoration.
5. Use IBM Plex Sans as the primary family and IBM Plex Serif Italic only for selective emphasis.
6. Prefer the shared spacing rhythm and semantic radius/motion tokens instead of one-off values.
7. If a genuinely new visual primitive is required, add or revise the global token first, then consume it in components.

Home may temporarily retain local variables while legacy styles are consolidated, but the global token file is the forward-looking design-system API. Do not copy Home's raw hex, shadow, easing, radius or spacing values into new stylesheets.

## Canonical Home owners

- Home page composition: `app/src/components/HomeLanding.jsx` + `HomeLanding.css`
- Buttons and button interaction language: `app/src/components/Button.jsx` + `Button.css`
- Hero orbit: `app/src/components/HeroOrbitDiagram.jsx` + `HeroOrbitDiagram.css`
- Project cards: `app/src/components/ProjectCard.jsx` + `ProjectCard.css`
- Workflow: `app/src/components/WorkflowFlow.jsx` + `WorkflowFlow.css`
- FAQ: `app/src/components/FaqAccordion.jsx` + `FaqAccordion.css`

If a Home visual bug belongs to one of these components, fix the canonical owner. Do not patch it from another stylesheet.

## Project scaling contract

Project growth must be **data-driven, not copy-driven**.

Canonical owners:

- Project catalog and project-specific landing content: `app/src/product/projectCatalog.js`
- Project landing renderer: `app/src/product/ProjectLanding.jsx`
- Project landing styles: `app/src/product/ProjectLanding.css`
- Workspace flow/navigation coordination: `app/src/product/ProductShell.jsx`

Rules:

1. A new project should normally require a new or updated record in `projectCatalog.js`, not a new JSX page.
2. Do not copy `ProjectLanding.jsx` or create `ProjectLanding<ProjectName>.jsx` variants for normal project differences.
3. Do not create per-project CSS files for color, imagery, copy length, products, resources, FAQ, or sales content.
4. Project-specific visual tone must be passed through scoped project data/variables on the Project Landing root. Do not introduce global `.tone-*` selectors from Project Landing.
5. If a project needs a genuinely new reusable section, add that capability to the master landing architecture and make it configurable. Do not hide project-specific conditionals throughout the renderer.
6. If adding a project requires editing Project Landing layout code in several places, stop and review the data schema before continuing.
7. Project assets should be referenced by project data/config. Component code must not know project-specific file names unless the behavior itself is unique.
8. The intended flow is `Projects -> Project -> Overview -> Detail`. Project is for story/context/resources; Overview and Detail remain work surfaces.

The scaling test is simple: **project new = data new, not code new**. Exceptions require an explicit product/architecture reason.

## Code ownership rules

- One component = one style owner.
- Do not import another component's CSS to patch its internals.
- Do not create new patch files named `Final`, `Fix`, `Polish`, `Override`, `Last`, or numbered variations of them.
- Do not add a new override layer to defeat an older override layer. Move the rule back to the canonical owner and remove obsolete rules when safe.
- Avoid `!important` as normal conflict resolution. Existing `!important` is debt to understand before changing, not a pattern to copy.
- Do not fix individual instances when the master component can own the fix.
- Prefer shared spacing rhythm: 4 / 8 / 12 / 16 / 24 / 32 / 48.
- If a system-level change requires many manual edits, question the architecture before doing the edits.

## Runtime safety rules

The Overview / workspace runtimes have historically suffered from feedback loops and renderer freezes.

- Do not add body-wide `MutationObserver` logic without explicit architecture review.
- Do not add continuous/unbounded layout, auto-fit, or measurement loops.
- Prefer bounded, event-driven updates.
- Do not casually modify high-risk runtime owners only because they are convenient places to intercept DOM behavior.
- Stable/accepted features must not be changed unless there is explicit new product feedback.

High-risk areas include Overview runtime layers, workspace control/runtime layers, and empty-workspace enhancement logic. Treat them as KEEP until dependency and behavior are understood.

## Dead-code deletion checklist

A file may be deleted only after checking that it has no live:

- static import or re-export,
- dynamic import,
- route or app-shell reference,
- runtime registration / event dependency,
- CSS import,
- asset reference,
- expected selector/DOM contract used by another runtime.

When a compatibility alias is the only remaining indirection, migrate consumers to the canonical master first, then delete the alias.

Git history is the backup. Confirmed dead code should not remain in the active source tree "just in case."

## Legacy CSS policy

A legacy-looking filename is not proof that a file is dead. Some global polish/override styles are still imported from `main.jsx` and therefore remain active.

Do not delete active global CSS in a broad sweep. Consolidate one subsystem at a time by moving valid rules into canonical owners, verifying the UI, and then removing the obsolete import/file.

## Visual verification

Home and product UI changes should be compared on both macOS and Windows when visual parity matters. Check font loading, container sizing, line-height, letter-spacing, responsive rules, browser rendering, and pixel density before introducing OS-specific hacks.

## Branch discipline

The current long-lived cleanup/fix branch is an exception, not the desired future workflow.

After the current branch is stabilized, prefer short-lived branches such as:

- `feature/<name>`
- `fix/<name>`
- `cleanup/<name>`

Keep one coherent problem per branch, verify it, merge it, then start the next problem. This limits regression scope and makes known-good checkpoints easy to recover.

## Definition of done

A change is not "done" merely because code was generated or committed. Report separately:

- what changed,
- canonical owners touched,
- what was runtime-verified,
- macOS/Windows visual verification status when relevant,
- actual CI status.

Never claim pass/fixed/tested unless that verification actually happened.
