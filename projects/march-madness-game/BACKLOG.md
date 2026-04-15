# Busy March Madness Backlog

## How To Use This File

This backlog translates the roadmap into executable work.

Rules:

- `Now` means active priority for the next few development cycles.
- `Next` means important, but blocked on current foundation work.
- `Later` means intentionally deferred.
- Each ticket should be small enough to complete without mixing unrelated concerns.

Status labels:

- `[todo]`
- `[doing]`
- `[blocked]`
- `[done]`

## Now

These are the highest-value items for getting to a 2027-ready web product.

### Foundation

- [todo] Extract backend service modules from `server/store.js`.
  - Create `server/services/seasons.js`, `server/services/draft.js`, and `server/services/standings.js`.
  - Keep HTTP routing in `server/app.js` thin.

- [todo] Remove static season assumptions from scoring and standings logic.
  - Stop relying on global `owners` from `src/data.js` where season-owned data should drive calculations.
  - Ensure simulations and standings use the selected season state only.

- [todo] Add season test fixtures.
  - Create at least two synthetic season states.
  - Cover standings, draft flow, undo, and reset behavior.

- [todo] Document local development flows.
  - Add a short setup and reset guide for running the app locally.
  - Document how current persistence works until SQLite replaces it.

### Multi-Season Foundation

- [todo] Introduce SQLite and a migration system.
  - Add database bootstrap.
  - Add migration runner.
  - Keep the first version simple and local.

- [todo] Define the initial season schema.
  - `seasons`
  - `season_owners`
  - `season_teams`
  - `season_draft_picks`
  - `season_games`
  - `season_scoring_rules`
  - `audit_events`

- [todo] Add repositories for season reads and writes.
  - Load season summary.
  - Load season detail.
  - Write draft actions by season.
  - Write season config by season.

- [todo] Replace JSON-file writes with season-scoped persistence.
  - Preserve `data/season-state.json` as bootstrap/import data only.

- [todo] Add season selector support to the API.
  - Allow requesting current season explicitly.
  - Prepare the UI to switch season context cleanly.

### Experience Rewrite

- [todo] Redesign the app shell around core product surfaces.
  - `Overview`
  - `Draft Room`
  - `Standings`
  - `Teams`
  - `Scoring Lab`
  - `Commissioner`

- [todo] Build a proper `Overview` surface.
  - Current leader
  - Remaining live games
  - Key path/watch items
  - Recent picks or updates

- [todo] Consolidate the homepage without feature loss.
  - Shorten the initial scroll depth substantially.
  - Move secondary analytics and reference material behind clearer surface boundaries.
  - Keep top actions and top context visible without forcing users to parse the entire dashboard.
  - Preserve access to existing information while reducing homepage cognitive load.

- [todo] Finish the Draft Room layout rewrite.
  - Make draft state the dominant experience.
  - Reduce commissioner control clutter.
  - Improve readability of available vs drafted teams.

- [todo] Add mobile-first navigation.
  - Replace anchor-link navigation with a clearer phone-friendly pattern.
  - Ensure the top-level product surfaces are reachable in one tap.

- [todo] Establish a shared design system direction.
  - Typography scale
  - spacing scale
  - surface and border tokens
  - button hierarchy
  - table/card patterns

## Next

These items should follow once the current foundation and shell work are stable.

### Tournament Operations

- [todo] Add direct game ingestion.
  - Choose the source.
  - Normalize incoming games.
  - Store raw and normalized state by season.

- [todo] Recompute standings from stored game data only.
  - No spreadsheet dependency.
  - No hidden fallback in live paths.

- [todo] Add operational status for live data.
  - Last successful sync
  - ingestion failures
  - stale data warnings

- [todo] Add commissioner correction tools for games.
  - Manual winner correction
  - score correction
  - explicit audit trail

### Access Control

- [todo] Add commissioner authentication.
  - Login/session model
  - protected write routes

- [todo] Define product roles.
  - commissioner
  - admin
  - viewer

- [todo] Add public/read-only mode.
  - safe participant view
  - shareable routes
  - no write affordances

- [todo] Add destructive action safeguards.
  - confirmation flows
  - audit events
  - recovery paths where practical

### Platform Preparation

- [todo] Version the API.
  - Define stable response shapes for mobile use.

- [todo] Add an event model.
  - picks
  - finals
  - lead changes
  - season transitions

- [todo] Document the mobile screen inventory.
  - participant home
  - standings
  - my teams
  - draft board
  - notifications

## Later

These are valuable, but should not distract from getting the core product right first.

### Native Mobile App

- [todo] Choose the native mobile stack after the backend stabilizes.
  - React Native / Expo
  - or native iOS

- [todo] Build participant-first iPhone app.
  - live overview
  - standings
  - my teams
  - draft board
  - notifications

- [todo] Add cached offline-friendly reads for mobile.

- [todo] Add push notifications for:
  - draft picks
  - game finals
  - lead changes

### Commissioner Mobile Expansion

- [todo] Add safe mobile draft controls.
  - make pick
  - undo pick
  - lock/unlock

- [todo] Add lightweight mobile correction tools.

### Nice-To-Have Product Features

- [todo] Draft timer
- [todo] Historical comparisons
- [todo] What-if scoring sandbox
- [todo] Personalized participant landing pages
- [todo] richer visual analytics

## Recommended Order For The Next Three Work Cycles

### Cycle 1

- backend service extraction
- scoring/state cleanup
- local dev documentation

### Cycle 2

- SQLite setup
- season schema
- season-scoped repositories
- API season selector

### Cycle 3

- new app shell
- homepage consolidation
- overview screen
- mobile navigation
- continued Draft Room simplification

## Current Focus Recommendation

The best immediate focus remains:

1. finish the multi-season backend foundation
2. redesign the shell and draft experience

Those two efforts unlock nearly everything that follows, including a real mobile app later.
