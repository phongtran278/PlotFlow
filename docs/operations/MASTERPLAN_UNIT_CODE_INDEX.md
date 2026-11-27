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

## Bundled Masterplan runtime

The existing bundled manifest already contains the 3,160 numeric-prefix TL identifiers. The 57 additional `TL-xx` labels are supplied by `app/public/masterplan/generated/tl-hyphen-index.json` and merged into the manifest at load time. The supplement records its source PDF SHA-256 and uses page-top-left bounding boxes.

The current bundled page and the supplied source PDF share the same page dimensions (3370.5100 × 2384.1399 points). The existing 3,160 numeric-prefix TL code set also matches the supplied source index exactly. The runtime uses the text-box center for the 57 supplemental labels, avoiding the horizontal-baseline assumption used for ordinary PDF.js text items.

The index provides label anchors only. It does not claim cadastral lot polygons; Auto Shape/manual polygon remains the boundary workflow.

The bundled supplement also records a fingerprint of the 3,160 numeric-prefix TL identifiers already present in the runtime manifest. The build audit recomputes that fingerprint and requires an exact match before accepting the 57 additional `TL-xx` anchors. This guards against merging coordinates from an unrelated Masterplan revision.
