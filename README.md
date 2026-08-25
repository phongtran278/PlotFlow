# PlotFlow

PlotFlow is the project workspace for turning real-estate sales data and masterplans into consistent Overview and Detail design outputs.

## Source of truth

The repository is intentionally organized around a small set of canonical roots:

- `app/` — application source and build tooling
- `assets/` — source assets used by the app
- `masterplan/` — source masterplan PDF
- `docs/` — product, architecture, workflow, and asset documentation
- `.github/` — CI configuration

Generated runtime copies such as `app/public/assets/` and `app/public/masterplan/` are recreated by `npm run setup` / `npm run build` and should not be treated as source files.

## Local development

From `app/`:

```bash
npm install
npm run dev
```

`npm run dev` runs the setup/build pipeline first, then opens the Vite preview on port 4173.

## Repository hygiene

Historical patch/recovery packages are not canonical application code. Git history is the archive. New recovery folders, generated asset copies, local exports, videos, and backup workspaces should remain outside source control.

Before deleting local-only files, first confirm they are either committed to GitHub or intentionally ignored. Prefer a dry-run comparison before mirroring GitHub back to a workstation.

## Architecture

Read `ARCHITECTURE_RULES.md` before structural source changes and `CLEANUP_AUDIT.md` before deleting legacy-looking files. PlotFlow favors one canonical owner per behavior instead of stacking patch layers.
