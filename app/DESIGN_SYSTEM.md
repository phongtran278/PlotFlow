# PlotFlow Design System

PlotFlow uses one design system across Home, Project Home, Overview, Detail, editors and future product surfaces.

## Source of truth

- Home + Detail define PlotFlow's visual tone.
- Apple Human Interface Guidelines inform interaction discipline, control hierarchy, state clarity and toolbar behavior.
- Production tokens and components are the implementation source of truth.
- The Design System preview page renders the same production components; it is not a separate mockup.

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

## Foundations

Use `src/styles/plotflow-tokens.css` for color, spacing, radius, control geometry, motion, typography and interaction states. Local one-off values require a product reason.

## Core controls

Reusable controls live under `src/design-system/PlotFlowControls.jsx` and `PlotFlowControls.css`.

Initial production primitives:

- `PFButton`
- `PFSelect`
- `PFToolbarGroup`
- `PFInspectorSection`
- `PFControlRow`

When a primitive already exists, product code should use it instead of inventing a visually similar replacement.

## Selection rules

- Use a select/pop-up for one choice among a small mutually exclusive set when conserving space matters.
- Use buttons for immediate actions.
- Use icon-only buttons only for familiar actions and always provide an accessible label/tooltip.
- Use segmented controls only when all choices benefit from being visible simultaneously.

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

## Preview

The visual Design System is available in-app using `?design-system=1`. It should stay lightweight and render production controls directly.

## Migration policy

Do not rewrite stable product behavior solely to adopt the Design System. Migrate surface-by-surface while keeping runtime owners intact. New product UI should use the Design System by default.
