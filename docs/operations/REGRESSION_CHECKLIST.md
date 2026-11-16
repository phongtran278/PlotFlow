# PlotFlow — Manual regression checklist

Use sample data on a safe workspace. Do **not** use live prices or allow two people to edit the same project during these checks. This is a test plan, not a report claiming tests passed.

Date: ______  Commit: ______  Tested by: ______
Windows/browser: ______  macOS/browser: ______
Live or staging URL: ______  Data backup reference: ______

| ID | Scenario | Expected outcome | Result |
| --- | --- | --- | --- |
| PF-01 | Open Home and project catalog | Hero/cards render, project route navigates | NOT RUN |
| PF-02 | Open `/projects/vinhomes-saigon-park` directly | Project landing loads after hard refresh | NOT RUN |
| PF-03 | Open Overview and change handover tabs | Correct group, no card mix or page freeze | NOT RUN |
| PF-04 | Pan/zoom Overview repeatedly | View remains responsive; no runaway memory loop | NOT RUN |
| PF-05 | Draw multiple polygons using Pen Tool; close first anchor | Existing thin strokes and close behavior preserved | NOT RUN |
| PF-06 | Arrange cards, drag anchor/pin, reload | Saved layout restores; no unwanted movement | NOT RUN |
| PF-07 | Import sample Google Sheet/CSV/XLSX | Unit mapping and prices resolve correctly | NOT RUN |
| PF-08 | Enter Detail, switch units, zoom/fit | Artwork and preview stable; no blank/corrupt canvas | NOT RUN |
| PF-09 | Export Overview/Detail | Export file contains correct visual output | NOT RUN |
| PF-10 | Reload from a second browser profile (test data) | Shared cloud state loads or an explicit error is reported | NOT RUN |
| PF-11 | Verify non-shared browser data | No unintended shared state or user session leakage | NOT RUN |
| PF-12 | Switch Project A → Project B → Project A | Record any cross-project contamination (known blocker) | NOT RUN |
| PF-13 | Measure memory on Windows and macOS after heavy Overview actions | No hung tab; preserve current memory guards | NOT RUN |
| PF-14 | Verify untrusted browser cannot write Azure state without auth | Expected **FAIL** until credential model is fixed; do not test by mutating live data | NOT RUN |
| PF-15 | GitHub Actions code-only deployment/reload | Routes resolve and historical large assets remain available | NOT RUN |

Record failures with exact repro steps, browser, commit and screenshots. Do not mark a scenario PASS based only on `npm test` or a successful build. Do not use a production project to simulate concurrent write conflicts.
