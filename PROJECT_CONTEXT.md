# PlotFlow — Project Context / Handoff

> Read this file first when continuing PlotFlow in a new ChatGPT conversation or a new coding session.
> This is the project memory: product intent, visual rules, architecture principles, fragile areas, and the current working state.

## 1. What PlotFlow is

PlotFlow is a focused real-estate design operations tool.

Its job is not to become a generic AI design app. It is built to remove repetitive production work from the path between property sales data and finished design output:

`data / spreadsheet → masterplan / floorplan → Overview / Detail → review → export`

The core product principle is:

**Make the repetitive disappear. Keep the design.**

Automation should remove repeatable work. The designer keeps judgment, hierarchy, composition, visual craft, review, override, and final control.

## 2. How to work on this project

The product owner is a designer, not a programmer. Work as a senior design-technologist / creative-technologist partner.

- Discuss product meaning, visual hierarchy, UX, motion, layout, and design fundamentals in plain language.
- Do not dump source code into chat unless explicitly requested.
- After direction is agreed, implement directly in the repository and report the result briefly.
- Explain technical problems in normal language first; technical terms are secondary.
- Do not make the product owner debug like a developer if the repository can be inspected directly.
- Critique both sides: visually attractive but product-meaningless is not good enough; technically logical but visually lifeless is not good enough.
- Prefer structural fixes over one-off visual patches.

## 3. Architecture principle — Figma master / instance mindset

Treat the codebase like a Figma component system.

If a system-level visual change requires editing many instances manually, there is probably a missing master layer.

Target hierarchy:

1. **Design system / tokens**
   - color
   - typography
   - spacing
   - radii
   - shadows / Liquid Glass
   - motion duration / easing

2. **Reusable master components**
   - ProjectCard
   - WorkflowFlow / WorkflowStep
   - FaqAccordion / FAQ item
   - HeroOrbitDiagram
   - buttons / badges / other repeated UI as the system grows

3. **Pages**
   - Home
   - Overview
   - Detail
   - pages compose components and data; they should not locally break component internals.

Hard rules:

- One component = one style owner.
- Do not import another component's stylesheet as a workaround.
- Do not create `Final2.css`, `Polish2.css`, `Fix.css`, or another temporary visual override layer.
- Do not use `!important` as a conflict-resolution strategy.
- Prefer a shared spacing rhythm such as `4 / 8 / 12 / 16 / 24 / 32 / 48`.
- Delete obsolete files after confirming they are unused. Git history is the backup.
- If a visual bug returns, fix the canonical owner instead of resurrecting legacy CSS.

## 4. Current Home architecture

The old stacked Home style layers were removed.

Home should no longer use:

- `HomeLandingFeatured.css`
- `HomeLandingPremium.css`
- `HomeLandingFinal.css`
- `HomeLandingPolish.css`

Current ownership is approximately:

```text
HomeLanding.jsx
  ├─ HomeLanding.css        # page / section composition
  ├─ HeroOrbitDiagram.jsx
  │    └─ HeroOrbitDiagram.css
  ├─ ProjectCard.jsx
  │    └─ ProjectCard.css
  ├─ WorkflowFlow.jsx
  │    └─ WorkflowFlow.css
  └─ FaqAccordion.jsx
       └─ FaqAccordion.css
```

The goal is that a Project Card change happens in `ProjectCard`, a Hero Orbit change happens in `HeroOrbitDiagram`, etc.

## 5. Home visual direction

Overall feel:

- editorial
- premium
- technology-forward but not "AI dashboard"
- calm, refined, spatial
- nuanced dark / off-white tones rather than pure black
- Liquid Glass only as a controlled accent
- strong alignment, spacing, grid, baseline, hierarchy before effects

Reference mindset: Apple-like product clarity and spacing discipline; Artlist-like clean premium editorial energy. Do not copy either literally.

Typography direction:

- IBM Plex Sans for the main system / headlines / body
- IBM Plex Serif Italic only for selective emphasis
- do not turn entire statements into serif italic
- keep Vietnamese diacritics safe by avoiding extremely tight line-height and excessive negative tracking
- important headline line breaks should be intentional, not left entirely to browser wrapping
- Mac and Windows should be visually close; avoid viewport-dependent typography tricks that create platform drift

## 6. Hero Orbit — product symbol

The Hero Orbit is not an infographic and not a dashboard widget. It is a visualization of the product philosophy:

**designer at the center, automation around the work**.

Rules:

- center stays visually stable
- outer rings / light arcs carry the motion
- circles must remain true circles
- rings are mostly stroke-only, light, refined
- labels / pills must never overlap the center or each other
- labels should sit on a safe perimeter
- orbit should feel substantial, roughly 30–35% of the hero's visual weight, but must not crop or cover its own labels
- motion should be subtle and meaningful, not game-like
- do not redesign the orbit into a laptop mockup, mosaic, or project-circle gallery

Cross-platform caution:

- Windows has previously rendered the orbit motion / scale better than macOS.
- Avoid sizing based heavily on `vw`; it caused Mac and Windows to diverge.
- Prefer sizing relative to the actual hero visual container with clear min/max bounds.
- Safari/macOS has historically been more sensitive to ring animation and layout differences.

Current visual tuning is **not considered finished**. The latest iterations were trying to find a middle size: large enough to carry hero weight, small enough that all perimeter labels remain visible.

## 7. Project Cards — current design intent

Project cards are a major visual quality checkpoint.

Content hierarchy:

1. index
2. status pill
3. project title
4. developer · location
5. one consistent action

Rules:

- title and meta share the exact same left edge
- title may naturally wrap to two lines
- meta is measured from the last rendered title line, approximately 12px below
- no overlap under any title length
- status, index, artwork content, and action all need generous breathing room from card edges
- do not fix each card instance independently
- all cards should use the same master spacing logic
- a dynamic layout is welcome, but not if one card becomes an awkward tall narrow column
- variation should feel controlled, not random

Current action direction:

- cards use one consistent action: **Open in library**
- the page-level workspace action already exists elsewhere, so cards should not introduce a special `Open workspace` exception

Current layout direction:

- the earlier `5 / 4 / 3` first row was too aggressive because card 03 became visually narrow and inconsistent
- latest direction is a gentler large / medium / smaller rhythm rather than extreme ratios
- visual height should relate sensibly to card width instead of forcing all differently sized cards into the exact same fixed-height geometry

Current visual tuning is **not finished**. Breathing room / consistency still needs final verification from screenshots on both Mac and Windows.

## 8. Workflow

The workflow should communicate a real step-to-step operating system:

`Sales data → Masterplan → PlotFlow engine → Human control → Sales-ready design`

Motion requirements:

- arrows / connectors should visibly communicate movement and arrival
- animation should feel refined and calm
- no static fake connector symbols
- no game-like motion
- every effect should have semantic meaning

Real connector elements were introduced rather than relying on scattered CSS pseudo-elements.

## 9. FAQ

Desktop direction:

- intro / headline / subtitle on the left
- accordion list on the right
- editorial two-column composition

Interaction:

- gentle unfold
- no sudden `max-height` bump
- easing should feel soft and controlled

## 10. Principle statement

The principle quote should mix sans + selective serif emphasis.

Do **not** make the entire quote serif / italic.

Preferred idea:

`A designer should spend more time making decisions that matter — and less time repeating them.`

The main sentence stays sans. Only selected emphasis such as `decisions that matter` may use serif italic / brand accent.

The principle statement can be scaled slightly larger than normal section copy so it feels like a real statement.

## 11. Footer

Footer should use one clear left axis.

The following should visually belong to the same left alignment system:

- Personal note by Phong Trần
- `Đời lắm phong trần.`
- PlotFlow wordmark / giant brand text
- metadata below

Avoid floating / arbitrary alignment.

## 12. Stability — do not casually refactor these areas

There is a history of complete hangs / page-not-responding caused by broad MutationObservers and auto-fit loops.

High-risk files / areas include:

- `OverviewSimplifiedRuntime.jsx`
- `OverviewV2Runtime.jsx`
- `OverviewAnchorRuntime.jsx`
- `WorkspaceController.jsx`
- `EmptyWorkspaceEnhancer.jsx`

Do not add another whole-document observer or continuous layout loop without strong justification.

Event-driven / bounded updates are preferred.

## 13. Spotify area

A previous Spotify-related feature was explicitly confirmed working by the product owner.

**Do not touch it unless the product owner gives new feedback.**

## 14. Overview Pen Tool

Current accepted direction:

- thin highlight
- explicit close anchor
- stroke ~0.25
- minimum ~0.15
- draft ~0.35
- fill ~0.12
- no proximity auto-close
- unlimited polygons
- close via first anchor / double-click / Enter

Path:

`app/src/product/OverviewPenRuntime.jsx`

Do not change unless new feedback arrives.

## 15. Detail Workspace

Known important behavior:

- zoom range approximately 20–250
- artwork 1080×1920
- initial zoom around 38
- `fitArtwork()` sets scrollTop to 0
- one-shot auto-fit after Sheet connect is preferred
- avoid adding body-wide observation loops

## 16. CI / dependency issue

The repository has had an `app/package-lock.json` mismatch with `app/package.json`, especially around Supabase dependencies.

Known symptom:

`npm ci` fails because package.json and package-lock.json are not in sync.

Do not "fix" CI by weakening it. Correct approach:

- regenerate / sync `app/package-lock.json`
- commit the correct lockfile
- then rerun CI

Do not claim CI passes unless an actual current run passes.

## 17. Mac / Windows local differences

The product is actively tested on both macOS and Windows.

Typical update flow:

Mac:

```bash
cd ~/Documents/PlotFlow
git pull

cd app
pkill -f vite
rm -rf node_modules/.vite
npm run dev -- --open
```

Windows:

```bat
cd %USERPROFILE%\Documents\PlotFlow
git pull

cd app
rmdir /s /q node_modules\.vite
npm run dev -- --open
```

Always confirm the current branch / commit when UI looks stale:

```bash
git branch --show-current
git rev-parse --short HEAD
git status
```

macOS previously had local modifications to:

- `app/package-lock.json`
- `app/public/assets/font/SVN-Gilroy-Bold.otf`

Do not delete / restore a local file automatically unless its purpose is understood.

## 18. Working branch / checkpoint

Repository:

`https://github.com/phongtran278/PlotFlow`

Current working branch at the time this handoff was created:

`agent/fix-preview-pan-tabs-memory`

Draft PR:

`#51`

Checkpoint immediately before this context file was added:

`2b02d1091d9848f8c55cc84054deb7d2dd9096b7`

The context-file commit will naturally move HEAD forward. Always read the current branch HEAD rather than assuming the checkpoint is still latest.

## 19. Current unfinished visual work

At handoff time, the main open visual tuning is Home:

- Project Card spacing still needs final visual verification. The product owner wants much more breathing room and stronger consistency.
- Dynamic card proportions should feel intentional but not produce an awkward narrow card.
- Hero Orbit needs a stable cross-platform size: Windows has looked good at sizes that were too large on Mac; later Mac-safe sizing became too small.
- Cross-platform behavior must be solved structurally, not by arbitrary Mac-only / Win-only visual hacks unless unavoidable.

Everything above should be checked against the latest screenshots and current code before editing.

## 20. How a new ChatGPT conversation should start

Suggested prompt:

> Continue PlotFlow from the GitHub repo. Read `PROJECT_CONTEXT.md` first, then inspect the current branch and current code before changing anything. Work as my senior design-technologist partner: explain simply, do not paste code unless I ask, and implement changes directly in GitHub. Preserve the master/component architecture and do not reintroduce legacy Home CSS layers.

Then provide the current visual feedback / screenshot.

## 21. Keep this file alive

Update `PROJECT_CONTEXT.md` whenever there is a major durable decision such as:

- architecture change
- new canonical component
- design-system rule
- accepted interaction behavior
- known fragile area
- important cross-platform rule
- major feature considered "do not touch"

Do not fill this file with every temporary experiment. It should preserve decisions, not noise.
