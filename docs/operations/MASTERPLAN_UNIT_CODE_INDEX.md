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

The bundled manifest contains 3,160 numeric-prefix TL identifiers. The supplied VSP source PDF contributes 57 additional `TL-xx` labels. All TL anchors are normalized into the coordinate system used by the bundled page-tile pyramid before the locator or Auto Shape consumes them.

### Coordinate calibration

The supplied PDF and the bundled runtime PDF are different files, even though their page dimensions match. Page dimensions alone are not proof that text coordinates align with the runtime tiles.

A local feature-registration calibration was measured between the supplied PDF page and the exact bundled page-tile crops. It uses a source-PDF-to-runtime-page affine transform and is limited to the calibrated TL region (source page coordinates x=900..1700, y=900..1250 points). It covers all 3,160 existing numeric-prefix TL anchors and all 57 supplemental `TL-xx` anchors.

The calibration is guarded by:
- the SHA-256 of the bundled runtime PDF
- the exact page-tile source manifest, source dimensions, tile size and level widths
- four deterministic page-tile crop fingerprints (`TL-01`, `TL-81`, `TL30-01`, `TL31-02`)
- bounds checks ensuring every TL anchor stays inside the calibrated source region and maps inside the runtime page

If the PDF or tile source changes, the build audit or crop-fingerprint test fails closed. The calibration must be regenerated; it must not be bypassed by loosening the detector threshold.

The transform only applies to `TL*` identifiers. Other project-code families are not changed by this local calibration. Original PDF text coordinates are retained as `sourceBbox` for diagnostics, while `bbox` is stored in runtime page top-left coordinates.

### Location data

Each match retains its code, page number, source text and coordinate provenance. PlotFlow uses the transformed text-box center as a locator anchor. This is not a cadastral polygon: exact lot boundaries still require the Auto Shape/manual polygon workflow.

Repeated matches are retained rather than silently deduplicated; the UI can mark ambiguous codes for review.

## Cache and manifest

The browser index cache schema is versioned separately from raster caches. Updating code recognition forces a fresh text index without invalidating already-rendered raster crops.

Offline manifest generation uses `codePatternVersion: 2` and manifest version `9`.

