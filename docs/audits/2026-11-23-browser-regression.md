# PlotFlow — browser regression and memory baseline (2026-11-23)

This branch adds a real Chromium check against a **local** Vite preview, not a publicly hosted site. It does not read/write Azure, manipulate saved layout, or run Google Sheets import/export. Never enter production credentials in the test environment.

## What the workflow actually checks
- Builds the existing app with `PLOTFLOW_CODE_ONLY_DEPLOY=1` and no cloud state environment variables.
- Navigates Home, Pricing, Projects, one existing project landing, Overview and Detail.
- Checks HTTP 200, nonempty React content and uncaught browser exceptions.
- Repeats Overview/Detail navigation three times, samples Chromium JavaScript heap and DOM/image/canvas/tile counts, and uploads a JSON artifact.
- Fails on route or uncaught page errors. **No invented memory ceiling:** memory numbers are diagnostics, not pass/fail proof of a leak.

## Limitations and required follow-up
- SPA rendering alone does not prove correct visual layout, pan/zoom, drag/drop, actual PDF import/export or Google Sheets connections.
- Chromium on Linux does not substitute for real Windows and macOS browser/device tests.
- Local `VITE_PROJECT_STATE_URL` is empty; multiuser cloud state behavior and Azure restore remain untested.
- CI uses an isolated package install of Playwright for a test-only job, with no app lockfile changes. Pin this dependency formally later if browser testing becomes a standard project requirement.
- Build with code-only assets deliberately excludes the repository's very large media; missing images may not represent production behavior.
- Comparison of memory samples requires the same browser version, data fixture, scenario and device; navigation can legitimately grow caches.
- Do not merge or deploy this branch until independently reviewed, and do not merge preservation PR #57 or audit PR #58 automatically.

## Next tasks
1. Run/check this CI and review failures before adding more constraints.
2. Add **isolated fixtures** and meaningful UI interactions (pan/zoom, route switch, PDF previews, save/reload, export) one feature at a time.
3. Capture stable memory baselines for large representative data sets in browser/devtools, including long-lived sessions; fix only proven leaks with new regression coverage.
4. Reconcile the Phase 1 preservation PR #57 and audit PR #58 before merge into the auto-deploy branch.

## Demo-safe quick check
On the presentation device, open Home → Projects → Overview → Detail and test canvas pan/zoom without saving production data. For editing/export, use an isolated staging project and sample data; keep a video/screenshots as a fallback.
