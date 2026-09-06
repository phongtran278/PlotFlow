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

## Pass 2 contextual inspector

Pass 2 locks the selection-to-inspector contract:

| Selection | Context inspector |
| --- | --- |
| Canvas / nothing selected | No object inspector |
| One card | Card |
| Two or more cards | Card, with Align / Gap / Distribute exposed immediately |
| Connector | Connector, including endpoint editing |
| Highlight | Highlight appearance |

Only one object inspector is visible at a time.

Unit navigation is a supporting utility below the contextual inspector. It is not owned by Card, Connector or Highlight.

The visible global actions stay outside the object inspector:

- Select / Pan / Highlight tools.
- Auto Arrange.
- Guides.
- Zoom / Fit.
- Export.

Auto Arrange is global because it arranges the visible cards for the current handover group, not one selected card. Its single visible entry point delegates to `OverviewArrangeModesRuntime`.

Highlight drawing remains owned by `OverviewPenRuntime`; only its appearance control is re-homed into the Highlight inspector.

Changing handover group resets contextual inspection to Canvas so stale object controls do not survive into a different group.

## What Pass 2 does not decide

Pass 2 does not finalize visual density, typography polish or final component styling. Those belong to the Design System visual migration after runtime verification.

## Review rule

When an Overview UI change is proposed, first identify:

1. the product action;
2. its semantic owner;
3. its runtime owner;
4. its single visible UI location.

If any of those are ambiguous, resolve the architecture before adding CSS.


## Highlight ownership and linked selection

Highlights are unit-owned objects.

- Selecting a unit in Layers selects that unit through the canonical card-selection owner.
- Card, connector, anchor and highlights belonging to the selected unit share one linked-selection state.
- A newly completed highlight first attaches to the currently selected unit.
- If no unit is selected, ownership may fall back to the active lot anchor and then to the nearest resolved lot anchor.
- Existing owned highlights are not silently reassigned by proximity.

This keeps Layers, canvas selection and Highlight ownership consistent.

## Auto Arrange connector constraint

Connector crossing is a hard validity constraint for Auto Arrange.

The Arrange preview must:

1. solve the requested layout mode;
2. count connector segment intersections;
3. try a crossing-safe side split when needed;
4. add lanes rather than overlap cards;
5. fall back to an all-left or all-right ordered layout if that produces fewer crossings;
6. disable Apply whenever any connector crossing remains.

Manual preview dragging is subject to the same validation. A crossed layout is previewable but cannot be applied.


## Recovery and dismissal contract

- Connector geometry on first Overview entry is hydrated over a short bounded sequence because cards and PDF anchors can become ready on different frames. `WindowsOverviewViewportRuntime` remains the only main-canvas connector geometry writer.
- Undo / Redo controls may be re-homed by the presentation organizer; history handling follows the actions instead of depending on the original toolbar wrapper.
- Focus follows the currently selected unit's current endpoint: unsaved draft while editing, otherwise saved manual endpoint, otherwise auto-detected endpoint.
- Reset position always returns to the original auto-detected PDF endpoint captured before a manual override is applied.
- Selection from Layers, cards and the Unit navigator keeps `OverviewAnchorRuntime` synchronized to the same unit code.
- Contextual disclosures close on outside click or Escape and organizer sync must not immediately reopen them.
