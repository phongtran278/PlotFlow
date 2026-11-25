# Dependency security QA — candidate only

Base: PR #68 commit 24ddbe80d4f3a3579ed1d43df68b0373750405ab. Prior audit: four high findings (sharp, vite, source-map-js, xlsx), one runtime finding (xlsx). Prior CI and Cloudflare builds passed; 34 source images, zero missing/oversize/omitted.

Candidate pins sharp 0.35.5, vite 8.2.4, source-map-js override 1.2.2, SheetJS 0.20.3 from its official versioned CDN (https://docs.sheetjs.com/docs/getting-started/installation/frameworks/). These versions are proposed from previous audit ranges; existence, compatibility, integrity and advisory clearance must be confirmed by CI. No automatic npm audit fix or broad update. The runner alone generates a candidate lockfile and reproduces npm ci. Package files in the repository remain unchanged until candidate review. A normal Cloudflare build on this branch therefore still uses #68 dependencies and is not evidence that the candidate works.

New Excel fixtures cover Vietnamese headers/text, leading-zero codes, numeric prices, areas, payment fractions, blank cells and multiple sheets. They test library compatibility only, not the full UI or business logic. Existing tests, media fixtures, strict build, asset audit and full/runtime security gate must pass. Review candidate lockfile diff and actual project import/export on synthetic data before rollout.

No real Azure credentials, no data access, no original assets/PDF changes, no production deploy or merge. Rollback is the preserved #68 branch. If candidate resolution fails or audit still flags a finding, keep Draft and inspect actual logs; do not suppress findings.
