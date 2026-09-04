# PhongFlow — Project Architecture

## Product idea

PhongFlow is an internal real-estate visual workspace. Each real-estate project is one package containing two linked views:

1. **Overview / Tổng thể** — the masterplan with multiple lots. Each lot can show a compact callout such as unit code, price and a few important facts, connected to the correct lot by a leader line.
2. **Detail / Chi tiết** — the existing PlotFlow poster workspace for one selected lot/unit.

The important rule is: Overview and Detail are not separate projects. They are two views of the same project data.

## Main information hierarchy

### Home
After authentication, the user lands on a project home page.

Project cards:
- Project A
- Project B
- Project C
- Project D

Each card can later show thumbnail, project name, number of units, last updated time, and sync state.

### Project Workspace
Opening a project enters one shared workspace with two top-level modes:

- **Overview**
- **Detail**

The selected project stays the same while switching modes.

### Overview
Overview contains the project masterplan and a set of lot records.

Each lot record has a stable `unitId` / `unitCode` and can contain:
- masterplan anchor/shape
- callout position
- unit code
- compact price
- compact status
- leader line from callout to lot

Clicking a lot or its callout sets `selectedUnitId` and opens that unit in Detail.

### Detail
Detail uses the current PlotFlow workflow and stores per-unit state such as:
- house/design assignment
- floorplan crop/fine tune
- lot highlight
- text overrides
- badges
- pins
- poster layout overrides

A Back to Overview action returns to the same project and keeps the same selected unit highlighted on the masterplan.

## Core data relationship

```text
Project
├── project profile
├── source data / Google Sheet
├── overview masterplan
│   ├── lot 001 ───────┐
│   ├── lot 002 ────┐  │
│   └── lot 003 ─┐  │  │
└── units         │  │  │
    ├── unit 001 ◄┘  │  │
    ├── unit 002 ◄───┘  │
    └── unit 003 ◄──────┘
```

The link between Overview and Detail must use a stable unit identifier, not visual position or list order.

## Suggested project package

A portable `.plotflow` project can evolve to contain:

```json
{
  "project": {},
  "overview": {
    "masterplan": {},
    "lots": {}
  },
  "units": {},
  "settings": {},
  "schemaVersion": 2
}
```

This allows the existing Export Project / Import Project workflow to carry both Overview and Detail together.

## Recommended user flow

```text
Login
  ↓
Home / Projects
  ↓
Open Project A
  ↓
Overview ─────────────── Detail
  │                       ▲
  └─ click lot 001 ───────┘
         selectedUnitId = 001
```

## Authentication

Do not build a fake local login. Authentication should be connected when cloud storage/backend is selected.

For the internal-tool phase, keep the UI architecture ready for:
- Sign in
- Current user
- Project access
- Viewer / Editor role

But only expose these as real features after the backend exists.

## Build order

### Phase 1 — Current beta
- Finish Detail workspace UI consistency
- Portable Project Export / Import
- Define the shared Project data model

### Phase 2 — Overview
- Create Overview workspace
- Masterplan canvas
- Lot anchors/shapes
- Compact callout cards + leader lines
- Click Overview lot → open linked Detail unit

### Phase 3 — Home
- Project Home page
- Project cards
- Create/Open/Import project
- Recent projects

### Phase 4 — Cloud + Login
- Authentication
- Cloud project storage
- Shared projects
- Viewer / Editor permission
- Version history

## Product principle

One project should be prepared once and then reused everywhere. Overview and Detail must share the same unit data instead of asking users to rebuild the same information twice.
