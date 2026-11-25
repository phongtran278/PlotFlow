# PlotFlow photo delivery — staged implementation

## Scope and promises
- First increment optimizes **house** and **amenity** photos after Vite builds into `app/dist`, **in place**, keeping each runtime pathname and extension unchanged.
- Originals under repository `assets/` (and any originals in Azure) are not written to, deleted or renamed.
- PNG remains PNG (retains transparency); JPEG remains JPEG; WebP remains WebP. This trades some compression efficiency for zero broken legacy URLs.
- `masterplan/`, PDF source, high-resolution raster tile pyramid, overlays, and UI layout are never modified by this command.
- The optimizer targets 2.5 MiB where feasible (configurable), checks the Workers **25 MiB hard asset limit**, and exits nonzero if an image is unreadable or still exceeds 25 MiB. No silent deletion.
- Processing is sequential to reduce peak image decoder memory. This is **not** yet an Azure upload system.

## Run locally / in isolated CI
```bash
cd app
npm ci
npm run build
npm run media:optimize:dry-run
# Sharp is optional and is not yet locked in package-lock.json.
# Install it in a disposable isolated environment before the actual optimize step:
npm install --no-save --package-lock=false sharp@0.35.3
npm run media:optimize:dist
npm run audit:assets:strict
```

Don't run actual optimizer after an existing Cloudflare postbuild **if oversized files were already omitted**; the audit will then correctly flag missing files. Wire it **before** the Cloudflare 25 MiB guard when enabling this feature as a standard build action.

## Delivery hardening still needed before automatic use
1. Lock `sharp` to an audited compatible version in `package.json` **and** `package-lock.json`; verify `npm ci` on Linux and Windows.
2. Make optimization run before Cloudflare's existing oversize-file omit step; replace silent omission with an explicit failure when critical image is absent.
3. Validate expected catalog IDs and URLs, including six canonicalized duplicate names; check all image references used outside the house picker.
4. Verify visual image quality and alpha preservation; target sizes are best-effort.
5. Once Azure media endpoint authentication and staging restore tests exist, promote originals/optimized variants into project-scoped Blob Storage with versioned manifests and rollback.
6. Complete State API preview build and security checks separately. Never use live `state.json` or production credentials in Preview.

The read-only `audit:assets` added in PR #64 checks source file coverage; it does not yet verify network accessibility, state API links or rendered images in a browser.
