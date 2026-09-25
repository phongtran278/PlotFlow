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

## Consistency

Consistency means the same product concept behaves, reads and responds the same way across Home, Project Home, Overview, Detail and editors. It does not mean every surface must look identical.

### What must stay consistent

- Semantic tokens: color roles, type roles, spacing rhythm, radii, elevation, motion and control heights.
- Interaction meaning: the same action uses the same label, icon meaning, shortcut behavior and state model.
- Object ownership: object-specific actions remain with the selected object; shared actions remain shared.
- Selection, focus, hover, pressed, disabled, destructive and loading states use the same semantics.
- Core control anatomy: buttons, fields, selects, segmented controls, toolbars, panels, popovers and inspector rows.
- Responsive behavior: narrow layouts reflow, disclose or scroll; controls never overlap or become unreachable.
- macOS and Windows use the same interaction model. Platform differences stay in rendering/performance unless a platform convention materially improves usability without changing the product model.

### What may vary

- Home may use larger editorial typography, richer composition and expressive brand treatment.
- Detail and editor surfaces may use denser controls and stronger information hierarchy.
- Overview may optimize spatial editing and canvas visibility.
- Density, layout and visual emphasis may adapt to task context when the semantic role remains unchanged.

### Consistency decision rule

Before introducing a new visual or interaction treatment, ask in this order:

1. Does an existing semantic token solve it?
2. Does an existing production primitive solve it?
3. Does an existing PlotFlow pattern solve it?
4. Can an existing primitive or pattern be extended without breaking current consumers?
5. Only then introduce a new token, primitive or pattern, with a documented product reason.

Do not solve local inconsistency with additional local CSS when the underlying issue belongs to the shared system.

## Adoption

Adoption is progressive. The goal is to increase Design System coverage without destabilizing proven product behavior.

### Default rule

- New product UI uses semantic tokens and Design System primitives by default.
- Existing stable UI is not rewritten solely for visual cleanup.
- Migrate when a surface is already being changed for product, usability, accessibility or maintainability reasons.
- Preserve runtime owners, delegated event wrappers, camera owners, drag owners and geometry owners while migrating presentation.
- Visual migration must not change saved data, object geometry, export output, memory behavior or interaction semantics unless the product change explicitly requires it.

### Adoption order

Prefer migration in this order:

1. Tokens and semantic states.
2. Typography and spacing.
3. Core controls.
4. Toolbars and inspector sections.
5. Panels, popovers and disclosure patterns.
6. Complex editor surfaces and runtime-owned wrappers.

This order lets PlotFlow gain visual consistency before risking structural changes.

### Surface migration checklist

A surface is considered adopted when:

- It consumes shared semantic tokens for common values instead of duplicating raw color, type, radius, spacing or shadow values without a product reason.
- Existing Design System primitives are reused where compatible.
- Actions have one clear owner and do not appear in duplicate locations.
- Default, hover, pressed, focus-visible, selected, disabled and destructive states are covered where relevant.
- Keyboard and pointer behavior remain predictable.
- Narrow layouts do not overlap or hide required controls.
- macOS and Windows preserve the same interaction model.
- Runtime ownership and memory/performance constraints are unchanged unless explicitly part of the task.
- Production behavior has been verified after migration.

### Legacy CSS

Legacy product CSS may remain while a surface is stable. Treat it as migration debt, not as a second Design System.

When touching legacy CSS:

- Prefer replacing repeated raw values with existing semantic tokens.
- Avoid adding another override layer when the owner rule can be fixed directly.
- Do not increase selector specificity or add `!important` unless compatibility with runtime-owned DOM makes it necessary.
- If a new override is necessary, keep it scoped to the owning surface and document why it cannot yet move into a shared primitive.
- Remove obsolete overrides when the owning component or pattern has been migrated safely.

## Governance

The Design System is a product contract shared by design, engineering and AI-assisted development.

### Source-of-truth hierarchy

When guidance conflicts, use this order:

1. Proven production interaction and runtime architecture.
2. `DESIGN_SYSTEM.md` product and interaction principles.
3. Semantic tokens in `src/styles/plotflow-tokens.css`.
4. Production primitives in `src/design-system/`.
5. Shared product patterns.
6. Local surface CSS.

A lower layer must not silently override a higher-level principle. If an exception is required, document the reason near the implementation.

### Change classes

Use three change classes:

- **Patch** — fixes a bug or inconsistency without changing semantic meaning.
- **Extension** — adds a token, state, primitive or supported variant while preserving existing behavior.
- **Breaking change** — changes semantic meaning, interaction ownership, component API or a token in a way that can alter existing surfaces.

Breaking changes require explicit review of all known consumers before migration.

### Adding a token

Add a new token only when:

- the value represents a reusable semantic role, not one screen-specific measurement;
- at least two current or clearly planned usages share the same meaning; or
- the value is foundational enough that central control materially reduces drift.

Prefer semantic names over visual names. For example, prefer a role such as `text-secondary` over a color-specific name when the role is what matters.

### Adding or extending a component

Before creating a new primitive:

- confirm that composition of existing primitives cannot solve the need cleanly;
- define its semantic purpose and ownership;
- cover relevant states and keyboard behavior;
- define narrow-layout behavior;
- keep styling token-driven;
- add the component or variant to the Design System preview;
- avoid embedding product-specific business logic inside a shared primitive.

### Accessibility governance

Interactive components must be reviewed for:

- keyboard reachability and expected keyboard behavior;
- visible focus;
- accessible name and role;
- disabled and destructive semantics;
- state meaning that is not color-only;
- readable contrast for essential text and controls;
- reduced-motion and reduced-transparency behavior where motion or glass is used.

Small tertiary metadata may use softer contrast, but information required to understand or operate the product must remain clearly readable.

### Review gate before merge

For any UI change, verify:

- Is the action in the correct owner?
- Does the same action already exist elsewhere?
- Are existing tokens and primitives reused first?
- Are raw visual values justified?
- Are all relevant interaction states covered?
- Does keyboard behavior still work?
- Does the layout remain usable at narrow widths?
- Does the change preserve macOS/Windows interaction parity?
- Does it preserve runtime ownership, memory bounds and export behavior?
- Has the Design System preview been updated when a shared primitive or pattern changed?
- Has stable production behavior been runtime-tested after the change?

### AI-assisted implementation rules

When AI edits PlotFlow UI:

- inspect the current production owner before writing;
- reuse tokens, primitives and proven patterns before inventing new ones;
- do not duplicate actions or runtime owners;
- do not perform broad visual refactors as a side effect of a narrow bug fix;
- distinguish visual ownership from runtime ownership;
- preserve stable behavior unless the request explicitly changes it;
- prefer the smallest coherent change that improves system adoption;
- call out any new token, primitive, pattern or exception introduced.

### Deprecation

When replacing a primitive or pattern:

1. mark the old implementation as superseded in code or documentation;
2. stop using it for new UI;
3. migrate existing consumers gradually;
4. remove it only after all known consumers are verified on the replacement.

Do not keep two active entry points for the same action or two competing primitives with the same semantic role.

### Design System health

Periodically audit:

- duplicate semantic tokens;
- repeated raw colors, type sizes, radii, spacing and shadows;
- duplicated actions or controls;
- high-specificity override chains and unnecessary `!important`;
- primitives that exist in the catalog but are not adopted in production;
- product controls that should become shared primitives;
- accessibility gaps;
- platform-specific interaction drift.

The goal is not zero local CSS. The goal is one coherent product language with clear ownership, predictable behavior and a low cost of change.

## Migration policy

Do not rewrite stable product behavior solely to adopt the Design System. Migrate surface-by-surface while keeping runtime owners intact. New product UI uses the Design System by default. Existing Home, Project Home, Overview and Detail are migrated progressively after visual/runtime verification.
