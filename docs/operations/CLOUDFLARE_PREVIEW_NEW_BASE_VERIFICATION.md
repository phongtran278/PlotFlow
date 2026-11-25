# Verification of fresh Cloudflare UI Preview (2026-11-25)

Purpose: test Cloudflare's documented behavior that updating Previews Base applies to **newly created** preview branches, not to an existing Preview like PR #62. This commit triggers a fresh branch build after the owner corrected Build command and Root directory in Previews Base.

Expected settings: Root directory `app`, build command `npm ci && npm run build`, Preview command `npx wrangler preview`, Wrangler file `app/wrangler.jsonc` includes `"previews": {}`.

Never use production data or secrets. Do not merge or deploy to staging production based on this experimental check. If a Preview URL is created, validate its environment and data isolation before testing login, save or import.
