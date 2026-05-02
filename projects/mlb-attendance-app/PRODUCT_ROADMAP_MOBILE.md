# MLB Attendance App Product Roadmap

Last updated: 2026-05-01

## Status Legend

- `Shipped`: live in the app now
- `Foundation Shipped`: the underlying system exists, but polish or expansion is still needed
- `Active`: current primary development arc
- `Next`: should follow the active arc if the product stays on plan
- `Later`: important, but not yet the best use of current effort

## Product Thesis

This product should become the easiest way for a baseball fan to build and keep a durable personal record of every MLB game they attended.

The product wins if:

- logging a game is faster than writing a note
- the record feels trustworthy enough to backfill years of history
- the stats are personal enough to create return visits between games
- local ownership stays strong even before accounts and sync exist

## Current Product Baseline

As of 2026-05-01, the app is no longer just a prototype shell. The core beta loop is real:

- Expo Router app with five tabs: Home, Log Game, History, Stats, Profile
- responsive web-first shell that still supports the mobile app surface
- multi-step onboarding with favorite-team setup and a guided first-run path
- local persistence through `AsyncStorage`
- optional hosted auth and hosted persistence through Supabase
- storage versioning and migration-aware repository state
- create, edit, and delete flows for attendance logs
- duplicate prevention for the same user and game
- import, export, retry-load, and reset controls
- post-log recap flow and dedicated logged-game detail pages
- guided memory prompts and richer history/game-detail editing
- seeded MLB teams, venues, games, line scores, hitters, pitchers, and attendance history
- full 2021-present MLB catalog for logging/search
- hosted social MVP foundation: searchable user profiles, follow requests, privacy-safe friend profiles
- shared `packages/domain` logic for attendance creation and stat derivation
- first test floor in the domain package

## Current Constraints

The product is still constrained in ways that matter for roadmap sequencing:

- canonical MLB reference data is still JSON-backed; there is no hosted canonical games table yet
- game search is still local/static even though the catalog is much larger
- there is no manual fallback path for unresolved or missing games
- no split views yet in Stats beyond aggregate player and team totals
- Stats still lacks narrative summary modules and split-heavy exploration
- History is much richer now, but still not optimized for larger backfill sessions
- repository and UI persistence behavior are still lightly tested outside the domain package
- hosted social is only MVP-level and should stay privacy-first

## Strategy

The next sequence should reflect what already exists:

1. Polish the local ledger so the current product feels trustworthy and intentional.
2. Expand catalog quality and backfill tooling so real multi-season use becomes practical.
3. Turn the logbook into a collectible stats and memories product.
4. Harden hosted accounts, sync, and social only where they strengthen the personal ledger.
5. Keep live context optional until it clearly improves logging or revisitation.

## Product Principles

- Personal record first: every roadmap decision should improve the user’s own ledger.
- Trust before novelty: storage clarity, edit safety, and search correctness beat social surface area.
- Low-friction capture: the save flow should ask for as little as possible at log time.
- Canonical identity matters: teams, venues, players, and games need stable IDs before deeper analytics.
- Seed-aware, not seed-dependent: fixtures can scaffold the product, but roadmap decisions should not optimize only for demo data.
- Offline ownership stays important: a stadium product cannot depend on perfect connectivity.

## Success Metrics

Near-term product health should be measured with simple signals:

- time to first successful log
- percent of users who save a second game after the first
- percent of saves completed without duplicate or validation failure
- edit rate after initial save
- percent of active users with favorite team set
- percent of active users who export or successfully recover their local record
- seven-day retention after first successful log
- average saved games per active user

## Roadmap Overview

## Release 0.1: Local Ledger MVP

Status: `Shipped`

This release established the core single-user attendance loop:

- game logging tied to canonical seeded game IDs
- derived personal stats
- Home, Log Game, History, Stats, and Profile surfaces
- onboarding, favorite-team setup, and local ledger framing

## Release 0.2: Durable Local Record

Status: `Shipped`

This release moved the product from demo-only toward a usable local journal:

- persistent local storage
- migration-aware repository shape
- import/export/reset controls
- edit and delete support
- storage status messaging and recovery hooks

## Release 0.3: Product Quality Pass

Status: `Active`

Target window: April 29, 2026 to June 15, 2026

Goal:

- make the current local-first product feel coherent, trustworthy, and worth repeated use before catalog expansion

Must-have outcomes:

- Home has one dominant hero and one obvious next action
  Status: `Foundation Shipped`
- onboarding and first-run experience feel intentional
  Status: `Foundation Shipped`
- Log Game communicates save state clearly and rewards a successful save
  Status: `Foundation Shipped`
- History feels safe and revisitable through real game detail pages
  Status: `Foundation Shipped`
- Profile clearly separates identity, follows, sync trust, and data controls
  Status: `Active`
- hosted/local mode is legible enough for beta debugging
  Status: `Shipped`

Core workstreams:

- information hierarchy
- trust and feedback states
- responsive web polish
- larger-history usability
- repository and UI confidence

Current highest-leverage tickets:

- Make hosted account creation and login resilient to schema drift so auth never fails on optional profile/social columns.
- Redesign the global shell, Home, Log Game, recap, and logged-game detail surfaces into a cohesive premium product pass.
- Add split views to `Stats` for season, stadium, opponent, weekday, and home-vs-away questions.
- Add narrative summary modules above the Stats tables so the page is not just two grids.
- Strengthen History browse ergonomics for larger backfill sessions.
- Finish the hosted social MVP with request management, shared profile reliability, and cleaner privacy-safe comparison surfaces.
- Add tests around repository migrations, persistence failure handling, and UI-adjacent domain assumptions.

Exit criteria:

- the app feels intentional as a local ledger on both web and mobile
- the user understands whether their record is safe, saved, and editable
- the product is strong enough to justify real historical backfill

## Release 0.4: Catalog Quality And Backfill

Status: `Next`
Target window: June 16, 2026 to August 31, 2026

Goal:

- remove the biggest manual friction from logging and backfilling real attendance history

Must-have outcomes:

- users can find normal MLB games across seasons without wrestling the search flow
- unresolved games can still be logged through a clear fallback path
- historical backfill is practical for users with dozens or hundreds of games

Core workstreams:

- catalog expansion
- canonical identity normalization
- search quality
- manual fallback and import tools

Ticket candidates:

- Expand the catalog beyond the current seeded local dataset.
- Add season, opponent, and richer venue filters to game search.
- Introduce a visible manual fallback record path for games not yet resolved canonically.
- Add CSV import or guided batch backfill.
- Add handling for doubleheaders, postponed games, resumed games, and partial-score edge cases.
- Strengthen canonical IDs for leagues, teams, venues, players, and games.

Exit criteria:

- most real MLB attendance can be logged without workarounds
- users can distinguish canonical catalog games from manual fallback entries
- the data model is stable enough for deeper stats and future sync

## Release 0.5: Personal Stats, Collections, And Memories

Status: `Next`
Target window: September 1, 2026 to November 30, 2026

Goal:

- make the product something fans reopen because the record itself is rewarding

Must-have outcomes:

- stats feel deeper and more personal than a simple tracker
- collection progress creates repeat engagement
- memories become more than a note field

Core workstreams:

- split-heavy stats
- collections and milestones
- richer witnessed events
- memory objects and recap surfaces

Ticket candidates:

- Add season and lifetime recap modules.
- Track park progress, rivalry attendance, opening day history, and giveaway collections.
- Expand witnessed moments into a richer editable schema.
- Add photo or attachment support after save.
- Build collectible summary cards and recap states that feel shareable even before social features ship.

Exit criteria:

- users return for progress and stats, not only for data entry
- the product has a distinctive identity as a baseball ledger

## Release 1.0: Account, Sync, And Backup

Status: `Later`
Target window: after strong local usage signals

Goal:

- preserve local-first trust while making the record durable across devices

Must-have outcomes:

- sign-in is simple
- sync handles offline-created and locally-edited records safely
- backup and export remain user-legible and user-controlled

Core workstreams:

- authentication
- backend data model
- sync engine
- conflict handling
- privacy and export

Ticket candidates:

- Add low-friction auth and recovery.
- Define backend models for users, logs, events, collections, and derived summaries.
- Implement sync semantics for offline-created and locally-edited records.
- Add backup and recovery UX that does not hide local ownership.
- Add privacy and account-level controls.

Exit criteria:

- users trust the product across devices
- sync semantics are understandable, not magical

## Release 1.1+: Optional Social And Live Context

Status: `Later`

Only start this work after Release 1.0 is stable.

Potential bets:

- shareable season recap cards
- friend comparisons grounded in actual overlapping attendance
- upcoming-game reminders
- collaborative memories for shared games
- live game context for already-selected attended games
