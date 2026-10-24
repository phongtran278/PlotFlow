# Cleanup Phase 2 — Generated font aliases

Removed four tracked files from `app/public/assets/font/`:
- `app/public/assets/font/SVN-Gilroy-Regular.otf`
- `app/public/assets/font/SVN-Gilroy-Medium.otf`
- `app/public/assets/font/SVN-Gilroy-SemiBold.otf`
- `app/public/assets/font/SVN-Gilroy-Bold.otf`

These are **generated output aliases**, not canonical font sources. `app/tools/sync-assets.mjs` uses `copyAlias` to recreate all four paths from `assets/font/` every time `npm run setup` or `npm run build` runs. CSS `app/src/index.css` keeps referencing the same URLs; no styling changed. The root `.gitignore` already excludes `app/public/assets/` for future generated files.

Keep originals under `assets/font/`. Do not move/remove source font files. Verifications: npm test, npm run build, CSS font URL smoke-check, staged app visual check.

Do **not** automatically deduplicate map tiles even if hashes match; equal-looking blank tiles can have different coordinate paths and are still needed by the tile manifest.
