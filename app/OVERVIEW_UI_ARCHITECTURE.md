# PlotFlow Overview UI Architecture

This document records the Overview presentation boundary after Pass 1. It exists to prevent future UI passes from recreating duplicate controls or competing layout owners.

## Pass 1 decision

`OverviewControlRailRuntime.jsx` is the single presentation organizer for Overview controls.

It may re-home existing runtime-owned controls into the header, inspector rail or supporting regions. It does not take over their behavior.

CSS may style the resulting structure, but CSS must not create a second interaction architecture, resurrect superseded entry points or depend on a hidden legacy control becoming visible.

## Stable behavior owners

Keep these owners intact unless a dedicated product/runtime pass explicitly changes them:

- Camera / zoom: `OverviewZoomRuntime`.
- Card drag and canonical main-canvas connector geometry: `WindowsOverviewViewportRuntime`.
- Highlight drawing and highlight style behavior: `OverviewPenRuntime`.
- Auto Arrange preview and apply behavior: `OverviewArrangeModesRuntime`.
- Layers / object audit interaction: `OverviewInteractionRuntime`.
- Handover tabs, current group and group counts: `OverviewWorkspace.jsx`.

Presentation code must delegate to these owners rather than duplicate their behavior.

## Pass 1 cleanup rules

- `OverviewWorkspace.jsx` owns the visible handover tabs and counts. Do not generate a second Overview group band.
- Keep one visible Auto Arrange entry point. The legacy Arrange button embedded inside `.pf-connector-control` stays hidden.
- `OverviewControlRailTwoRows.css` is base rail layout only.
- `OverviewFinalPolish.css` is visual polish only. It must not move controls or restore superseded UI.
- Runtime-owned wrappers stay intact when delegated listeners depend on them.
- Do not add a second connector geometry writer, drag owner, camera owner or Arrange runtime.

## What Pass 1 does not decide

Pass 1 does not finalize the contextual inspector state machine or final visual hierarchy.

Those belong to the next passes:

1. Contextual selection model: Canvas / Card / multi-card / Connector / Highlight.
2. Global action placement: Arrange, Guides, View and Export.
3. Design System visual migration after the interaction architecture is stable.

## Review rule

When an Overview UI change is proposed, first identify:

1. the product action;
2. its semantic owner;
3. its runtime owner;
4. its single visible UI location.

If any of those are ambiguous, resolve the architecture before adding CSS.
