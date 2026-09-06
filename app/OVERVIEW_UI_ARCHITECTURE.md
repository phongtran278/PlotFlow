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


## Connector utility contract

Connector editing no longer requires clicking the thin connector line.

- Connector controls are a persistent Overview utility.
- Edit endpoint acts on the currently selected / active unit and reveals that unit's endpoint handle.
- Width, color and opacity are global connector style for the current Overview product, not per-line styling.
- Style edits remain a draft until the user chooses **Apply to all**.
- Clicking a connector line may visually select the line, but it must not open or relocate a floating inspector.
- Reset position is idempotent and reads only the immutable auto-detected coordinates published by `OverviewDetailLocatorBridge`; repeated Reset actions must resolve to the exact same point.


## Connector style preview and audit actions

- Connector width, color and opacity preview live on the canvas while the controls are edited.
- **Apply to all** persists the previewed connector style as the shared connector style.
- The connector color control must show a readable rectangular swatch and the current hex value; it must not rely on an ambiguous native dot.
- **Show all objects** in Object Audit reveals all hidden card/connector/anchor objects and expands every unit so the action has immediate visible feedback.

## Arrange production-geometry validation

Auto Arrange validates connector crossings against the same clamped card-center geometry that production Apply uses.

A candidate is not considered crossing-safe merely because its ideal, unclamped preview coordinates do not cross. Card bounds, reserved top area and final PDF-edge clamping are applied first, then connector crossings are counted. Manual preview dragging uses the same normalization.


## Connector clearance and live preview

- Connector style controls preview immediately and the preview remains active even while Overview runtimes mutate or redraw the connector DOM.
- Width supports values through 10 so thick-line behavior can be evaluated before saving.
- **Apply to all** persists the currently visible preview; it does not trigger the preview.
- The color field uses an explicit rectangular swatch plus hex value instead of relying on the browser's native color-dot presentation.
- Object Audit uses **Restore hidden** only when something is actually hidden. It restores visibility without expanding every unit.

## Auto Arrange minimum connector clearance

A connector layout is invalid not only when two segments geometrically cross, but also when separate connector segments run closer than the minimum visual clearance.

For groups up to 10 units, Auto Arrange deterministically searches side assignments and prefers the first zero-conflict layout. This models the same kind of manual correction a user can make by moving cards to the opposite side, while keeping one canonical Arrange runtime.


## Overview simplification after runtime testing

- Sales-file membership is the source of truth for which units appear. Object Audit hide/restore UI is removed instead of maintaining a second visibility model.
- Endpoint editing has one clear entry point in Unit: **Edit lot point**. It focuses the current lot endpoint and keeps Save / Reset / Cancel with the anchor runtime.
- Connector style remains a compact global row; endpoint actions are not duplicated inside Connector.
- Auto Arrange keeps the meaning of Smart, Balanced, Compact, All left and All right while still ranking zero-conflict layouts first. Different layout buttons must remain visibly different when more than one zero-conflict solution exists.


## Object Audit correction

Object Audit remains part of Overview. It is used to inspect units and their linked card / connector / highlight structure, navigate to objects and surface exceptions.

Only the global **Restore hidden** footer action is removed. The Audit itself is not removed.

## Connector layout correction

Connector Style uses a compact two-row layout rather than forcing every control into one crowded row:

- Row 1: Width + Color.
- Row 2: Opacity + Apply to all.

The goal is balanced density, not minimum height at the expense of readability.


## Handover tab continuity

Handover switching prioritizes visual continuity:

- The historical double-`requestAnimationFrame` delay is preserved only for the first Overview entry, where runtimes need time to mount.
- Subsequent handover tab changes dispatch after one frame.
- `WindowsOverviewViewportRuntime` resets selection on group change but does not hydrate geometry against the outgoing layer; geometry waits for `pf-overview-live-units-ready` from the incoming layer.
- Connector Style no longer observes every DOM mutation in `document.body`. It installs with a bounded startup retry and re-applies only when live units are ready.
- Connector Style is global and auto-saved. Input events preview immediately; change events persist automatically. There is no **Apply to all** action.


## Pass 3 preflight: stable left rail

Before visual polish, the left rail must be event-driven and visually stable.

- `OverviewControlRailRuntime` does not observe all mutations in `document.body`; runtime DOM churn must not repeatedly reorganize the sidebar.
- Control organization uses a bounded startup retry, then updates from explicit product/runtime events.
- Handover `group-changed` resets contextual selection but does not rebuild the rail against the outgoing group.
- Object Audit waits for `pf-overview-live-units-ready` before rebuilding for the incoming group.
- `installPanel()` owns the Audit render; refresh must not render the full panel a second time.
- Card selection changes linked-selection state without rebuilding the entire Audit tree.
