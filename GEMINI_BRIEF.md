# PlotFlow — Gemini Review Brief

## What this repository is
PlotFlow is a React/Vite browser tool for automating real-estate marketing posters from structured data.

## Core workflow
Google Sheet / structured unit data -> unit selection -> house & amenity assets -> masterplan PDF floorplan locator -> manual fine-tune / lot highlight / 2D & 3D pins -> poster preview -> HQ PNG / batch ZIP export.

## Current product status
Round 1 is feature-complete and usable. The current focus is code review, architecture quality, performance, maintainability, cross-platform behavior, and UX refinement.

## Important technical areas
- React 19 + Vite
- PDF.js / pdfjs-dist for masterplan indexing and vector floorplan rendering
- html-to-image + JSZip for export
- localStorage for per-unit overrides and recent state
- Asset picker for house / amenities / logos / badges
- Floorplan fine-tune and normalized geometry for lot highlight / pin placement
- Cross-platform setup for macOS and Windows

## Review goals
Please review the codebase and prioritize findings in this order:
1. Performance bottlenecks and unnecessary React re-renders
2. PDF rendering / canvas memory / deep-zoom efficiency
3. Asset loading and caching strategy
4. Export memory usage and batch-export safety
5. State architecture and duplicated logic
6. Cross-platform/path assumptions
7. Maintainability and component boundaries
8. UX risks or edge cases

Do not assume the heavy image/PDF assets are missing accidentally. This branch intentionally excludes them so the codebase stays small enough for AI review. Asset paths are still visible in the source and should be reviewed as references only.

## Expected output
Start with a concise architecture map, then provide a prioritized list of issues with severity, affected files/functions, reasoning, and concrete recommended changes. Separate quick wins from deeper refactors. Do not rewrite the whole app unless specifically asked.
