# Private State API frontend staging

This branch is based on PR #79, targets the isolated UI Worker `plotflow-ui-staging`, and does not merge into Azure production. The existing API Worker must remain on the reviewed private-state branch. Only synthetic staging state may be used.

## Cloudflare UI Worker: stable deployment only
- Protect all URLs via Cloudflare Access, with the same explicitly authorized test user.
- Production branch: `fix/frontend-private-state-staging-20261126`.
- Root directory: `app`.
- Build command: `node tools/build-private-state-staging.mjs` (after dependency installation).
- Deploy command: `npx wrangler deploy`.
- Remove `VITE_PROJECT_STATE_URL` from UI Build variables. Do not put Azure SAS or runtime ACL into UI variables.
- Previews Base: retain the existing ordinary build command, no state credentials or API env. The browser transport in this branch rejects cloud state on non-stable workers.dev origins. The API Preview gate is independent.
- Stable UI origin: https://plotflow-ui-staging.phongtran7076.workers.dev.
- Stable API origin: https://plotflow-state-api-staging.phongtran7076.workers.dev.

The build script pins the public endpoint and project ID, rejects conflicting build env, and scans built text assets for likely Azure credentials. This is defense-in-depth, not a proof of absence of all secrets.

## Runtime acceptance
1. Record exact build commit and confirm the UI worker has Access enabled. Authenticate to the API origin first (same browser), then UI. Verify `GET /v1/projects/vinhomes-saigon-park/state` returns 200 with the exposed `x-plotflow-state-etag` in a cross-origin browser request. If Access blocks OPTIONS, configure Access CORS/preflight handling for this exact UI origin, not anonymous GET/PUT. Never disable Access to make a test pass.
2. Use synthetic data only. Existing differing local cache is preserved and cloud writes blocked; back up edits before explicitly resetting staging-origin project keys. Never clear production storage. Use a fresh test browser profile if necessary.
3. Edit one sample card, check PUT 200 and new ETag; reload and verify persistence. Test two independent browser profiles with the same project baseline, then save from both; second stale PUT must return 412 and stop automatic saving. Same-origin tabs share localStorage, so two tabs alone do not prove isolation.
4. Test unauthorized access, wrong role, expired session, network failure, preview isolation, and asset/PDF/tiles/Excel regressions. Some Cloudflare oversized media may be omitted by existing preview tooling; review omissions before acceptance.
5. Check no browser request goes directly to Azure state URL; static asset traffic to Azure is allowed. Review build scanner output and actual bundle/network. Keep PR Draft until live gates pass.
6. Do not migrate production. Staging SAS expires 2026-12-02 15:13 UTC per operator output; arrange renewal before expiry, never commit secrets.

No live frontend deploy, actual browser verification, or production migration is performed by this branch alone.
