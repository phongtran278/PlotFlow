# Azure media cutover — stage 1: metadata inventory
Base: PR #78 7287b6ceb89c2396e8db5a01c28e972d4958558b; GitHub CI passed, Cloudflare checkout failed repeatedly. LFS quota is suspected, not verified. No remote Azure operation has been performed.

This isolated push-only QA branch inventories LFS pointer SHA-256 and original byte size from Git objects, with LFS smudge disabled. It includes images/PDF and font paths, classifies source/public/legacy references, and deduplicates LFS content. Non-LFS files are separately identified; their Git object hashes are not SHA-256 of content. Planned archive keys are NOT proof of uploaded blobs. No Azure credentials, no downloads of LFS objects, no build or deployment, no production writes, no file removals, no pointer changes.

Cutover gates:
1. Compare inventory with private local originals and existing Azure assets read-only. Verify exact bytes and SHA-256, do not trust filename or size alone; report missing/mismatched content. Do not expose credentials or actual state.json.
2. Approve isolated Azure container/prefix and least-privilege identity. Copy missing originals only to immutable content-addressed paths with overwrite disabled; read back and hash every copy. Runtime optimized variants, fonts, PDF and 6596 tiles require separate verified mapping, content types, access/CORS/cache rules. Review 42 missing legacy lot references.
3. Build a code-only preview using an approved asset resolver/serving layer; keep old path compatibility, test all rendering and exports against verified staging assets. No direct SAS in front-end. State API remains separate. Existing production deploy workflow embeds legacy state SAS; do not use it for migration or change production in this branch.
4. Verify staging recovery and rollback; only after approval remove LFS pointer dependencies from a new release branch and switch build workflows to code-only. Retain all source/history/backups; no history rewriting, LFS deletion, or production deployment without explicit approval. Removing current pointers alone does not remove historic dependency or billed storage.

No PR opened yet to avoid triggering more Cloudflare checkout attempts. Open Draft PR only when the inventory and approved next step are ready. PR #78 is unchanged.
