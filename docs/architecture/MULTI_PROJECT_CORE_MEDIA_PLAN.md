# PlotFlow multi-project core & media safety — implementation plan

Status: design contract + read-only asset audit. No production rollout.

## Agreed architectural boundary
- One reusable **business/data core** with typed fields, validators, pricing logic, project-scoped state, search and filtering; all price values stored as decimal quantities, formatting is display-only.
- Project-specific **presentation** (layout, typography, graphics, color, interaction, custom component arrangements). No mandate to copy visual designs between projects.
- Each project has its own stable `projectId`, project config, media namespace, product catalog, and versioned masterplan. Data from two projects must not mix.
- Each project exposes **Overview** and **Detail**, but the interface can be entirely different.

## Media workflow (next increment after the audit)
1. Keep originals in private, versioned Azure Blob folders by project ID; keep deployable optimized variants in a separate prefix.
2. Add a durable, project-scoped manifest mapping canonical house/amenity IDs to runtime URLs, original object versions, dimensions, transparency, checksum and transformation profile.
3. On upload: reject invalid media, retain original, optimize only changed inputs (Sharp), preserve transparency and filenames/IDs, and verify browser-loadable media before publication.
4. For large drawings, retain the existing PDF preparation / raster tile pyramid; do not apply photo-style compression to annotated floorplan tiles. Validate manifests, labels, zoom/detail and memory behavior.
5. Upload via scoped short-lived workload identity (GitHub Actions OIDC) or authenticated backend; do not embed Azure account keys, SAS write tokens or raw connection strings in client bundles. Do not change the current deployment authentication automatically.
6. Stage, smoke-test and approve data publication separately from application code deployment. Ensure rollback restores prior manifest/asset references.

## First guard (implemented on this branch)
- `cd app && npm run build && npm run audit:assets`: produces `app/asset-audit-report.json` from source houses and amenities against `dist`, listing missing and over-25-MiB images.
- `npm run audit:assets:strict`: fails if any expected source image was silently omitted or is still oversized. **Do not turn on strict gating in Cloudflare until optimization and URL mapping are in place**, because existing staging omit policy intentionally removes large media.
- This audit checks file presence **only**; it does not verify whether the UI references the correct URLs, nor whether Azure has the file. These require subsequent catalog/URL and deployment checks.

## Release gates
- Source original preserved, optimized delivery URLs accessible, catalog has no missing refs, UI photos maintain alpha/detail, PDF tiles still zoom cleanly.
- Azure `state.json` backup verified and staging restore performed before any production merge.
- State API Build failure and reported npm high-severity advisories are separate tracked risks; never bypass release checks.
