# PlotFlow Design System

PlotFlow uses one design system across Home, Project Home, Overview, Detail, editors and future product surfaces.

## Source of truth

- Home + Detail define PlotFlow's visual identity.
- Apple Human Interface Guidelines inform interaction discipline, control hierarchy, state clarity, typography roles and toolbar/layout behavior.
- Production tokens and components are the implementation source of truth.
- The Design System preview page renders the same production components; it is not a separate mockup.
- PlotFlow adapts principles rather than cloning macOS visuals.

## Product principles

1. One visual language across every PlotFlow surface.
2. Object-first editing: selecting an object reveals only actions owned by that object.
3. Shared actions stay outside object inspectors.
4. Every action appears in one place only.
5. Prefer progressive disclosure over exposing every control at once.
6. Reuse existing production components before creating new local CSS.
7. Accent color communicates selection or a primary action, never decoration.
8. Preserve functional owner wrappers when runtimes depend on delegated events.
9. macOS and Windows share the same interaction model; platform differences stay in the raster/performance layer.
10. New UI must consume semantic tokens and primitives before introducing local geometry, type sizes, states or shadows.

## Typography

Product UI uses `--pf-font-ui`: the native system UI stack. On Apple platforms this resolves to the system UI typeface; on Windows it resolves to Segoe UI. PlotFlow does not bundle or redistribute Apple system fonts.

Brand/editorial surfaces may continue using `--pf-font-sans` and `--pf-font-serif` when that visual role is intentional.

Semantic roles are defined in `src/styles/plotflow-tokens.css`:

- Display
- Title 1 / Title 2 / Title 3
- Headline
- Body
- Callout
- Label
- Caption
- Micro metadata

Do not introduce a new local font size when an existing semantic role fits.

## Foundations

Use `src/styles/plotflow-tokens.css` for color, spacing, radius, control geometry, layout dimensions, motion, typography and interaction states. Local one-off values require a product reason.

Spacing follows the shared PlotFlow rhythm. Controls use standard compact/default/comfortable heights. Panels, popovers and cards use shared radius/elevation tokens.

## Core controls

Reusable controls live under `src/design-system/PlotFlowControls.jsx` and `PlotFlowControls.css`.

Production primitives include:

- `PFButton`
- `PFSelect`
- `PFTextField`
- `PFCheckbox`
- `PFSwitch`
- `PFSegmentedControl`
- `PFToolbarGroup`
- `PFToolbar`
- `PFInspectorSection`
- `PFControlRow`
- `PFPanel`
- `PFPopover`

When a primitive already exists, product code should use it instead of inventing a visually similar replacement.

## Selection rules

- Use a select/pop-up for one choice among a small mutually exclusive set when conserving space matters.
- Use buttons for immediate actions.
- Use icon-only buttons only for familiar actions and always provide an accessible label/tooltip.
- Use segmented controls only when all choices benefit from being visible simultaneously.
- Use a checkbox for inclusion/selection and a switch for an immediate on/off setting.

## Layout rules

- Every screen has a clear primary content region and optional supporting regions.
- Toolbars use leading / center / trailing zones rather than arbitrary button placement.
- Inspectors use a shared width token and section rhythm.
- Panels keep header/footer stable while the content region owns scrolling when content is long.
- Popovers anchor to the invoking control and use shared width/radius/elevation behavior.
- Prefer alignment to a common grid over local visual nudges.
- Narrow layouts reflow or scroll controls; they must not overlap.
- Reserved canvas/banner safe areas remain respected.

## Toolbar rules

- Keep common and high-frequency commands in the toolbar.
- Keep groups logical and few; avoid crowding the bar.
- Object-specific actions belong in the object inspector, not the shared toolbar.
- Overflow or progressive disclosure is preferred to overlapping/wrapping controls.

## Inspector rules

- Canvas selected: canvas controls.
- Card selected: card controls.
- 2+ cards selected: expose Align / Gap / Distribute immediately.
- Connector selected: connector style and endpoint editing.
- Highlight selected: highlight controls.
- Audit is verification/navigation, not a second inspector.

## Interaction states

Every interactive primitive must account for default, hover, pressed, focus-visible, selected (when applicable), disabled and destructive (when applicable). State meaning must not rely on color alone when the distinction is important.

## Preview

The visual Design System is available in-app using `?design-system=1`. It renders production controls and demonstrates foundations, core controls, toolbar layout, panels, popovers and object-inspector patterns.

## Migration policy

Do not rewrite stable product behavior solely to adopt the Design System. Migrate surface-by-surface while keeping runtime owners intact. New product UI uses the Design System by default. Existing Home, Project Home, Overview and Detail are migrated progressively after visual/runtime verification.
