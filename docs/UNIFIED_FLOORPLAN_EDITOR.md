# Unified Floorplan Editor

PlotFlow now treats floorplan view, lot highlight, and the 2D pin as one floorplan composition.

## Workflow

1. Open **Edit Floorplan**.
2. Pan/zoom the masterplan crop.
3. Use Auto Detect Shape, Rectangle, or Polygon for the lot highlight.
4. Place and resize the 2D pin.
5. Watch the live poster preview update from the same crop and overlay state.
6. Save & Done.

## Coordinate behavior

Saved polygon and pin coordinates are remapped whenever the crop changes. Zooming or panning therefore no longer invalidates a highlight just because the view changed.

## Locator fallback

The previous glowing oval target marker is no longer part of the unified editor. When no reliable shape exists, a small locator dot marks the unit-code anchor until a shape is detected or drawn.
