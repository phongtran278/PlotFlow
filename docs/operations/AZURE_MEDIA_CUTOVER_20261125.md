# Azure media cutover — stages 1–3

Inventory commit: 61d02b4af4d554fcd4846ba1853bf55bcc416b49. The initial live read-only pass verified 6,673 path/size-matched entries by content hash. It left 14 unmapped paths and one size difference. These results are from the operator's persistent Cloud Shell reports, not from a direct assistant connection.

Refined mapping:
- Three app/public/overview-masterplan/*.pdf files are explicitly listed under the Azure overview-masterplan/ prefix, then size/content-checked. Their README says this folder is for Overview-only PDFs, separate from Detail's masterplan source.
- The checked-in app/public/assets/font/SVN-Gilroy-Bold.otf pointer is a generated alias. sync-assets.mjs overwrites it from the canonical source assets/font/SVNGilroy Bold.otf. The comparison maps the runtime alias to that source object, not the stale checked-in pointer.
- Ten files below PlotFlow_ROUND1_FINAL_RECOVERY_06/COPY_INTO_APP/... are recovery-archive copies, not active public paths. references/ref.png is a design reference. Keep them in Git history; do not upload them as runtime assets unless a separate archival requirement is approved.

The verifier supports incremental reuse of the previous verified report for matching Git LFS SHA-256 entries. Non-LFS entries are re-read unless the old report includes their Git blob SHA-1. New/changed candidates (including Overview PDFs) are read and hashed. This avoids repeating the full ~600 MiB transfer. All reads use the fixed Azure Blob endpoint, Entra token, no redirects, no account key/SAS, max eight concurrent requests, and no local media copies. Metadata comparison only lists assets/, masterplan/, overview-masterplan/. No state.json reads or writes. Output remains local to Cloud Shell.

No Azure uploads, deletes, overwrites, ACL changes, public URL changes, LFS pointer/history rewrites, or production deploy. Publication remains disabled. Next gates: verify the newly mapped PDFs and alias, inspect any remaining missing paths, approve a staging asset resolver and access/cache policy, stage copies only after hash validation, test rendering/export, and rollback. Keep all existing originals and versions.
