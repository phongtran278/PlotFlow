# Cloudflare UI preview validation — 2026-11-25

This documentation-only commit is intentionally used to trigger a **fresh Preview build** on PR #62 after the owner updated Cloudflare **Previews Base** to:

- Root directory: `app`
- Build command: `npm ci && npm run build`
- Preview command: `npx wrangler preview`

The UI Worker config in this PR (`app/wrangler.jsonc`) includes `"previews": {}`. This commit does **not** change the deployed application, API bindings, credentials, Azure Blob data, or the production deploy branch.

Acceptance: Cloudflare UI Preview must show successful build + preview deployment for this new commit; verify Preview environment variables are isolated before attempting any save/import action. API staging check is separate and might still fail; do not bypass security or required checks.

Keep PR Draft and do not merge without staging validation.
