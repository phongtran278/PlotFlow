# Auto Lot Shape — Round 1

This pass adds conservative automatic lot-shape detection to the Lot Highlight editor.

- Detection runs on the clean rendered floorplan crop around the matched unit-code anchor.
- The detector builds local boundary masks at several thresholds, finds enclosed regions near the anchor, extracts a convex contour, and simplifies it to a 4–8 point polygon.
- A confidence score gates automatic fill. Low-confidence results do not create a fake rectangle.
- Fallback is a small locator dot at the unit-code anchor so the designer can draw Rectangle/Polygon manually.
- The old large glowing ellipse locator is replaced with the same small dot in PDF crop rendering.
- Auto-detected shapes remain editable and are not saved until the user chooses Save Override.

This is intentionally conservative. Threshold/confidence tuning should be validated against the actual masterplan set before broadening acceptance.
