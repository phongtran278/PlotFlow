# Cleanup Phase 3 — Generated house catalog

`app/src/data/generatedHouseCatalog.js` is fully generated from the canonical filenames under `assets/houses/` by `app/tools/sync-assets.mjs`. The same script runs during the package `prebuild` and `predev:hot` stages, and can be called with `npm run setup`.

Removed only the tracked generated snapshot and ignored future regenerations. **Do not delete the source `assets/houses/` files or the generator.** This prevents catalog drift and noisy generated diffs when new house images are added.

Verify `npm ci`, tests, `npm run build` and the house asset picker in staging. Running Vite directly without the documented setup step is not supported for a fresh checkout.
