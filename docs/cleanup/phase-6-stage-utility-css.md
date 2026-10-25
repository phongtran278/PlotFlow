# Cleanup Phase 6 — Stage utility CSS consolidation

Moved the unmodified rules from `FocusDeckPosition.css` to the end of `StageUtility.css`, preserving their prior CSS order (`StageUtility.css` was imported by `useStageUtilityTarget.js`; `FocusDeckPosition.css` by `FocusDeck.jsx`). `FocusDeck.jsx` now imports the shared hook and no separate stylesheet. The helper hook still owns `StageUtility.css` and the focus deck remains under the same DOM mount point.

No runtime behavior was altered. Validation: `npm test`, `npm run build`; manual compare Focus Deck toolbar/popover, responsive layouts and stacking in staging before merging.
