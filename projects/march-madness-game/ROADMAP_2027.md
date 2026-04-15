# Busy March Madness 2027 Roadmap

## Purpose

Define the product standard for the 2027 tournament and the sequence required to get there.

This file is the year-specific bridge between:

- `PRODUCT_SPEC.md` for product requirements
- `PRODUCT_ROADMAP_MOBILE.md` for long-range platform sequencing
- `BACKLOG.md` for execution-level ticketing

## 2027 Product Standard

The 2027 version should be:

- reliable enough to run draft night without fallback tabs or spreadsheet rescue steps
- clear enough that participants prefer it over the spreadsheet during the tournament
- consolidated enough that the homepage is fast to scan and does not require long-scroll interpretation
- structured enough that a new season can be launched without code edits
- safe enough that commissioner actions are authenticated, explicit, and recoverable
- durable enough that the 2027 work becomes the foundation for later mobile products

## 2027 Exit Criteria

The 2027 product bar is met when all of the following are true:

- the season can be configured inside the app
- the live draft can be run entirely inside the app on desktop and phone
- standings and scoring are computed from app-owned backend data
- the product supports season-scoped persistence instead of one mutable JSON document
- commissioner workflows require authentication
- participants have a clean read-only view for following the pool
- the homepage surfaces the most important information and actions without hiding existing functionality
- season rollover does not require destructive resets or code changes

## Strategy

The 2027 work should happen in this order:

1. Stabilize the codebase so changes stop increasing prototype debt.
2. Build the multi-season backend foundation before adding more product surface area.
3. Redesign the web experience around draft-night and participant clarity.
4. Remove spreadsheet dependency from tournament operations.
5. Add access control and public product modes once the data model is stable.

This sequence matters. Native mobile, richer analytics, and visual polish should not outrun the backend and workflow foundations.

## Workstreams

### Workstream 1: Foundation Cleanup

Outcome:

- the codebase is easier to change without regressions

Required outcomes:

- split large frontend files into smaller UI modules
- extract backend service boundaries from storage and HTTP concerns
- remove static season assumptions from scoring and standings logic
- add stronger tests and fixtures for season behavior
- document local development and reset flows

Evidence of completion:

- `src/main.js` is no longer the center of unrelated UI logic
- `server/app.js` is thin and service-oriented
- tests cover at least two synthetic seasons

### Workstream 2: Multi-Season Persistence

Outcome:

- the product can support 2027 without remaining trapped in a single mutable JSON file

Required outcomes:

- introduce SQLite and a migration path
- define season-scoped tables for owners, teams, picks, games, rules, and audit events
- add repository/service layers for season reads and writes
- make season selection explicit in the API
- support season creation and historical browsing without wiping prior seasons

Evidence of completion:

- multiple seasons can coexist
- current season is selected rather than implied
- `data/season-state.json` is bootstrap data, not the long-term runtime store

### Workstream 3: Web Experience Rewrite

Outcome:

- the app feels like a product instead of a prototype dashboard

Required outcomes:

- redesign the shell around `Overview`, `Draft Room`, `Standings`, `Teams`, `Scoring Lab`, and `Commissioner`
- consolidate the homepage so users can understand state, next actions, and live context without traversing a long dashboard
- make the Draft Room the highest-focus workflow in the product
- improve phone navigation and reduce long-scroll dashboard behavior
- establish a calmer design language with clearer hierarchy and less clutter
- add presentation mode for draft-night display

Evidence of completion:

- the homepage is materially shorter, clearer, and faster to scan with no meaningful feature loss
- a participant can follow the draft and standings comfortably from a phone
- the commissioner workflow is obvious without exposing every control at once
- the visual system feels calm, precise, and high-trust

### Workstream 4: Tournament Operations

Outcome:

- the spreadsheet is no longer part of live tournament operations

Required outcomes:

- add direct game ingestion from an app-controlled source
- normalize and store game updates by season
- recompute standings from stored game data only
- support manual corrections with explicit audit history
- expose operational status for stale or failed ingestion

Evidence of completion:

- live standings depend only on app-owned data
- corrections are visible and recoverable
- operators can see whether the live feed is healthy

### Workstream 5: Access Control And Public Modes

Outcome:

- commissioner actions and participant consumption are cleanly separated

Required outcomes:

- add commissioner authentication
- define roles for commissioner, admin, and viewer
- hide destructive actions behind authenticated routes
- add public read-only views and shareable routes
- support season-scoped session and authorization checks

Evidence of completion:

- destructive actions require auth
- public viewers can safely use the product
- the product supports distinct commissioner and participant journeys

## Recommended Delivery Sequence

### Cycle 1

Focus:

- frontend modularization
- backend service extraction
- scoring/state cleanup
- local development documentation

Success gate:

- the prototype is easier to change without changing behavior

### Cycle 2

Focus:

- SQLite setup
- migration runner
- initial season schema
- season repositories and API season selection

Success gate:

- the app can hold more than one season safely

### Cycle 3

Focus:

- new app shell
- homepage consolidation
- overview surface
- mobile navigation
- Draft Room simplification

Success gate:

- the participant-facing experience is clearly stronger than the current dashboard

### Cycle 4

Focus:

- direct game ingestion
- standings recomputation from backend data
- audit log and correction tools

Success gate:

- the spreadsheet is no longer required for live scoring

### Cycle 5

Focus:

- commissioner auth
- public/read-only mode
- destructive action safeguards
- season rollover workflow

Success gate:

- the product can run the 2027 tournament with role separation and safer operations

## Design Standard

The visual direction should continue to follow these principles:

- strong hierarchy
- quiet surfaces
- restrained color
- spacious layout
- obvious primary actions
- progressive disclosure for advanced controls
- smooth but subtle motion

This is not a request to mimic Apple styling. It is a request for clarity, restraint, and precision under live-use pressure.

## Non-Goals For Early 2027 Work

Do not spend early cycles on:

- decorative animation work
- overbuilt charting
- exotic probability widgets
- speculative multiplayer features
- native mobile clients before the web product and backend are stable

## Immediate Priority

The highest-value immediate focus remains:

1. finish the multi-season backend foundation
2. redesign the shell and draft experience

Those two efforts unlock nearly everything else on the 2027 path.
