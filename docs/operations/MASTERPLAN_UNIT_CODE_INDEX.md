# Masterplan lot-code recognition

PlotFlow reads the PDF text layer first. When the source PDF contains selectable text, this is more accurate than OCR over a raster screenshot and preserves the PDF page coordinates used by the locator.

## Accepted formats

- `TL-01`, `TL-02`, ...: hyphenated TL lot identifiers.
- `TL30-01`, `TL31-02`, and other existing letter + numeric-prefix formats.
- Existing project codes such as `AS10-01` remain supported.

The shared parser lives in `app/src/floorplan/unitCode.js`. Both the browser PDF locator and offline `prepare-masterplan.mjs` import it, so they use the same normalization and matching rules.

## Location data

Each match retains its PDF page number and text-item coordinates (`x`, `y`, `width`, `height`). PlotFlow uses the text position as a locator anchor. This is not a cadastral polygon: exact lot boundaries still require the existing Auto Shape/manual polygon workflow.

Repeated matches are retained rather than silently deduplicated; the UI can mark ambiguous codes for review.

## Cache and manifest

The browser index cache schema is versioned separately from raster caches. Updating code recognition forces a fresh text index without invalidating already-rendered raster crops.

Offline manifest generation uses `codePatternVersion: 2` and manifest version `9`.
