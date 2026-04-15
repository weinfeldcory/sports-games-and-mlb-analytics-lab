# MLB Attendance App Product Roadmap

## Objective

Take the current local Expo prototype from a seeded MLB logging demo to a product that can support:

- a dependable personal attendance journal for one fan
- durable game logging and stats across devices
- a catalog and import layer that reduces manual entry friction
- a flexible platform for later social, collection, and live-experience features

This roadmap is intentionally sequenced to prove the personal attendance loop before adding community or live data complexity.

## Product Strategy

The development path should be:

1. Make personal game logging fast, trustworthy, and pleasant.
2. Add persistence so a fan's history survives app restarts and device changes.
3. Improve input quality with better catalog search, imports, and profile preferences.
4. Expand the stats and collection model once the core log is reliable.
5. Add selective social and live features only after the single-user product is stable.

## Success Criteria By Stage

### Stage 1: Personal Attendance MVP

Success means:

- a user can log attended games without confusion
- history is accurate and easy to browse
- core personal stats feel rewarding enough to bring the user back
- the app works without seeded-only assumptions in the main user flow

### Stage 2: Durable Personal Product

Success means:

- logs persist reliably across app sessions
- the game catalog is broad enough for normal logging behavior
- profile preferences shape the experience meaningfully
- core stats and summaries can be trusted as a personal record

### Stage 3: Expansion Platform

Success means:

- the product model supports collections, achievements, and richer metadata
- account and sync foundations can support multiple devices or users
- optional social features can be added without reworking the core domain

## Phase Plan

## Phase 0: Stabilize The Prototype

Purpose:

- reduce prototype debt
- make the current Expo app easier to extend safely

Epics:

- shared domain alignment
- state management cleanup
- component consistency
- test baseline

Ticket candidates:

- Remove duplicated stats logic between `apps/mobile` and `packages/domain` so one domain path is canonical.
- Introduce fixture-driven test coverage for attendance creation, duplicate prevention, and personal stats calculation.
- Clean up provider responsibilities so catalog search, attendance mutation, and derived stats boundaries are explicit.
- Standardize empty states, validation messaging, and success states across `Home`, `Log Game`, `History`, and `Stats`.
- Add a contributor-facing note for booting the app and understanding the seeded data model.

Definition of done:

- the current flows still behave the same
- product logic is easier to trust and change
- the app has a basic quality floor for future iterations

## Phase 1: Personal Logging MVP

Purpose:

- make the core loop strong enough for real repeated use
- improve confidence that every saved game belongs in the user's record

Epics:

- faster log flow
- better history usability
- profile basics
- first retention hooks

Ticket candidates:

- Add stronger search and filter behavior in `Log Game`, including clearer no-result and selected-state handling.
- Support editing and deleting an attendance log from `History`.
- Add notes such as who the user went with, weather, giveaway, or freeform memory.
- Let the user set and edit a favorite team inside `Profile`.
- Improve `Home` so it focuses on the next useful action, recent log, and progress milestones.
- Add first-run onboarding that explains what gets tracked and why.

Definition of done:

- the user can create, review, and correct their own logbook
- the app no longer feels like a demo with fixed seeded assumptions
- the personal value proposition is clear in one session

## Phase 2: Local Persistence And Offline Reliability

Purpose:

- preserve user history between sessions
- make the app trustworthy even before cloud sync exists

Epics:

- on-device storage
- offline-safe mutations
- local migrations
- recovery and integrity

Ticket candidates:

- Replace in-memory attendance state with persistent local storage.
- Add a migration path for seeded demo data versus real user-created data.
- Persist profile settings, favorite team, and lightweight onboarding state.
- Add duplicate-detection rules that survive app reloads.
- Add safe error handling and retry messaging around save failures and corrupt local state.
- Define an app-owned repository layer instead of reading directly from static mock files in runtime flows.

Definition of done:

- logs survive app restarts
- a user can rely on the app as a personal record
- local storage changes can evolve without data loss

## Phase 3: Catalog And Import Quality

Purpose:

- reduce the amount of manual entry required
- make it practical to backfill a real fan's past attendance

Epics:

- better game catalog
- import tooling
- data validation
- venue and team metadata quality

Ticket candidates:

- Expand the catalog service beyond a tiny seeded MLB slate.
- Add season-aware game browsing by team, venue, and date.
- Introduce bulk import paths for past attendance from CSV or manual batch entry.
- Add fuzzy venue and opponent matching to help with imperfect recall.
- Store canonical identifiers for teams, venues, and games so historical logs remain stable.
- Add guardrails for postponed games, doubleheaders, and incomplete score data.

Definition of done:

- most normal MLB attendance scenarios can be logged without workarounds
- backfilling prior seasons is practical
- game identity is consistent enough for long-term stats

## Phase 4: Rich Personal Stats And Collection Layer

Purpose:

- turn the record into something fans want to revisit
- deepen the sense of progress and identity

Epics:

- advanced stats
- collections and badges
- memorable moments
- visual progress tracking

Ticket candidates:

- Add streaks, attendance by season, day-of-week, opponent, and venue splits.
- Track collection goals such as all 30 parks, rivalry series, opening days, or giveaway categories.
- Expand witnessed moments into a richer schema instead of a small seeded list.
- Add milestones, badges, or progress states tied to real attendance behavior.
- Build visual summaries for recent seasons and lifetime progress.
- Let users attach photos or artifacts to a logged game later in the flow.

Definition of done:

- the app offers more than storage
- stats feel personalized and collectible
- repeat engagement comes from progress, not only data entry

## Phase 5: Account, Sync, And Multi-Device Support

Purpose:

- move from device-local utility to durable product account
- prepare for optional social and collaboration features

Epics:

- authentication
- cloud sync
- conflict handling
- account settings

Ticket candidates:

- Add sign-in and account creation with a minimal, low-friction auth flow.
- Define backend models for users, attendance logs, profile settings, and derived stats jobs.
- Add sync semantics for offline-created logs and duplicate conflict resolution.
- Introduce export and backup options so users can keep control of their record.
- Add account-level settings for privacy, favorite team, notification preferences, and data export.
- Establish API contracts that mirror the app's domain model cleanly.

Definition of done:

- a user can trust their record across devices
- the backend model is stable enough for future expansion
- account infrastructure does not distort the single-user product flow

## Phase 6: Social And Live Fan Features

Purpose:

- add network effects only after the personal product is strong
- make game-day use better without overwhelming the core journal

Epics:

- friends and sharing
- live context
- collaborative attendance
- notifications

Ticket candidates:

- Add shareable summaries for recent games, season stats, and stadium progress.
- Support friend connections or lightweight follow mode for comparing attendance histories.
- Add optional live game context for upcoming or in-progress attended games.
- Support shared memories for groups attending the same game.
- Add reminders for upcoming tickets or notable attendance milestones.
- Introduce privacy controls so every social feature is opt-in.

Definition of done:

- social features add value without weakening the personal record
- live features complement logging instead of replacing it
- privacy and sharing behavior are explicit and understandable

## What Not To Build Yet

Avoid these until the earlier phases are complete:

- marketplace or ticket resale features
- fantasy-style gamification unrelated to real attendance history
- league-wide social feeds
- generalized support for every sport before MLB logging is solid
- highly custom visual polish work before persistence and catalog quality are stable

## Near-Term Recommendation

If work starts now, prioritize:

1. Phase 0 cleanup around shared domain logic and tests.
2. Phase 1 features for edit/delete, favorite team settings, and better onboarding.
3. Phase 2 local persistence so the app can be used as a real personal record.

That sequence is the shortest path from prototype to a product with real user value.
