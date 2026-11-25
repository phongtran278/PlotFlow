# Media preview QA (isolated, 2026-11-25)

This stacked Draft is based on the integrated UI/API preview (#66). It does not modify UI source, Azure, original assets, PDFs, tile pyramids or deployment workflows.

The existing postbuild guard is unchanged by default. Only the isolated QA job opts into PLOTFLOW_MEDIA_OPTIMIZE=1: optimize built house and amenity paths (including known aliases/optimized variants), then reject any oversized asset and require source-image coverage. No output is silently deleted in strict mode. The current legacy guard still reports omissions in default builds; those builds are not media acceptance.

The runner generates a candidate exact Sharp 0.34.5 lockfile with npm, then reproduces installation with npm ci. No workflow writes to GitHub or Azure. Candidate package and lock files plus reports are artifacts; commit the verified lockfile separately before enabling optimization in Cloudflare. The generated lockfile is public dependency metadata, not credentials.

Acceptance: clean npm ci, fixture tests, UI regression tests, strict asset audit with zero missing and oversized tracked images, build shell, actual Preview visual review (including transparent PNG and all unique house keys), and no data access. 100 MP limit, sequential processing and disabled Sharp cache limit memory; still measure actual peak RAM. Rollback: abandon this stacked branch; #66 remains unchanged. No production merge or deployment.
