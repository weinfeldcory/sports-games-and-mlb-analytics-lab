# MLB Attendance App Beta Ticket Backlog

Last updated: 2026-05-01

This backlog turns the current roadmap into a tactical beta plan for the next two weeks. It is grouped by subproduct so work can ship in coherent slices instead of one-off UI changes.

## How To Use This Backlog

- `P0`: required for a credible private beta
- `P1`: strong beta improvements once the loop is stable
- `P2`: valuable depth, but not required before inviting more testers

For execution, prefer shipping one complete slice at a time:

1. capture and trust
2. first-run and dashboard clarity
3. history and memory depth
4. hosted identity and social basics
5. data quality and player completeness

## Standing Next 3

1. `P0` Make hosted account creation and login resilient to schema drift and setup gaps
2. `P0` Premium product pass across shell, Home, Log Game, recap, and logged-game detail
3. `P0` Stats summary modules and first split views

These three tickets should always stay implementation-ready. If one ships, replace it immediately with the next highest-leverage item rather than letting the queue go stale.

## 1. Capture And Save Loop

### `P0`

- Finish the post-log flow.
  Status: `Foundation Shipped`
  - Scope: save -> recap -> game detail -> back to dashboard/history.
  - Acceptance: a successful save always lands in a satisfying next step.

- Add guided memory prompts during logging and later editing.
  Status: `Shipped`
  - Scope: optional prompts, quick memory chips, skip-for-now path.
  - Acceptance: richer journals without making logging slower.

- Add manual trust states for all log outcomes.
  Status: `Foundation Shipped`
  - Scope: saving, saved, duplicate, failure, player-data pending.
  - Acceptance: users never wonder whether a game actually saved.

### `P1`

- Add faster backfill helpers.
  - Examples: recent seat patterns, common companions, recent search recall.

- Add a manual fallback path for unresolved games.

## 2. First-Run And Identity

### `P0`

- Make hosted auth the safest path in the product.
  Status: `Active`
  - Scope: signup, login, post-auth hydration, and missing-migration fallback paths must degrade cleanly instead of surfacing raw Supabase schema errors.
  - Acceptance: a user can create an account and log in even if optional hosted profile/social columns are not present yet.

- Finish the new onboarding flow and first-run empty states.
  Status: `Foundation Shipped`
  - Scope: concise onboarding, favorite team save, first-game prompt.
  - Acceptance: a new user knows what to do in under 60 seconds.

- Simplify account surfaces around value and next action.
  Status: `Foundation Shipped`
  - Scope: login, account creation, profile identity section.

### `P1`

- Add lightweight profile preferences.
  - Candidates: profile visibility, default reminder for memory prompts.

## 3. Home Dashboard

### `P0`

- Keep the top of Home focused on:
  - ledger hero
  - next best action
  - latest game
  - top personal insights
  Status: `Active`

- Tighten level progress readability.
  Status: `Foundation Shipped`
  - Scope: raw counts first, point logic secondary, simpler copy.

- Make zero-log states feel intentional.
  Status: `Foundation Shipped`

### `P1`

- Add better milestone storytelling.
  - Scope: park progress, rivalry streaks, first-visit moments.

- Add better friend overlap summaries once the hosted social graph is live.

## 4. History And Memory Pages

### `P0`

- Ship logged-game detail pages as personal memory artifacts.
  Status: `Foundation Shipped`
  - Scope: score, line score, seat, memory fields, player status, safe edit/delete.

- Improve history browse ergonomics.
  Status: `Next`
  - Scope: search, filters, grouped views, faster revisit path to detail page.

- Make editing state safer.
  Status: `Next`
  - Scope: clearer save/cancel state and better density in cards.

### `P1`

- Add “missing details” and “missing memories” cleanup flows.

- Add season review slices and print/export prep.

## 5. Stats And Player Insights

### `P0`

- Add summary modules above tables.
  Status: `Next`
  - Scope: top hitters seen, most-seen starters, favorite-team angle, season lens.

- Add player-data completeness caveats.
  Status: `Next`
  - Acceptance: no player insight is shown as fully complete if source data is partial.

### `P1`

- Add first split views.
  - Scope: season, venue, opponent, weekday, home vs away.

- Add friend-safe shared stats later, only after profile privacy rules are firm.

## 6. Hosted Accounts, Sync, And Recovery

### `P0`

- Keep hosted identity stable and obvious.
  Status: `Foundation Shipped`
  - Scope: sync status, debug page, recovery docs, no user-specific runtime branches.

- Finish isolation QA.
  Status: `Next`
  - Scope: sign-out clears in-memory state, hosted data rehydrates correctly, local fallback stays isolated.

### `P1`

- Add profile visibility controls that tie into social pages.

- Add safer import/recovery handoff between local and hosted ledgers.

## 7. Social Graph MVP

### `P0`

- Replace mocked friends with real hosted user profiles.
  Status: `Foundation Shipped`
  - Scope: searchable profiles, one profile per auth user, safe public fields only.

- Add follow-request relationships.
  Status: `Foundation Shipped`
  - Scope: request, accept, reject, unfollow, pending requests.

- Add a privacy-safe friend profile page.
  Status: `Foundation Shipped`
  - Scope: display name, favorite team, shared games count, shared stadium count.
  - Do not show: seat, companions, memory notes, exact private history.

### `P1`

- Add shared profile stats beyond counts.
  - Candidates: teams seen count, favorite-team record, witnessed home runs.
  - Only if those can be served without exposing private log rows.

## 8. Catalog And Data Quality

### `P0`

- Keep the full MLB catalog usable for backfill.
  Status: `Foundation Shipped`
  - Scope: search quality, canonical identity, data quality metadata.

- Document and repair incomplete player-data batches.
  Status: `Next`

### `P1`

- Expand enriched player data across all catalog games.

- Build repeatable repair/backfill scripts for missing player lines.

## 9. Beta Operations And Trust

### `P0`

- Maintain security and exposure hygiene.
  Status: `Foundation Shipped`
  - Scope: no secrets in repo, legal placeholders linked, debug info sanitized.

- Keep docs current for:
  Status: `Active`
  - security audit
  - account isolation QA
  - social graph MVP
  - data recovery

### `P1`

- Add basic beta event tracking later.
  - Candidates: sign up, first log, second log, follow request, onboarding complete.

## 10. Responsive Web And Mobile Browser Fit

### `P0`

- Add a responsive shell audit and breakpoint system pass.
  Status: `Next`
  - Scope: define core width bands, spacing shifts, typography scaling, and when nav/layout collapses.
  - Acceptance: the app has predictable responsive rules instead of per-screen improvisation.

- Fix small-window overflow and compression issues in the authenticated shell.
  Status: `Next`
  - Scope: top nav, action rows, card grids, hero sections, sticky controls.
  - Acceptance: shrinking the browser window does not create clipped, overlapping, or unreadably dense UI.

- Make mobile browser rendering first-class for the core loop.
  Status: `Next`
  - Scope: auth, onboarding, Home, Log Game, recap, logged-game detail, History, Profile.
  - Acceptance: core product surfaces remain readable, tappable, and visually proportional on phone-sized web screens.

### `P1`

- Add responsive table/card strategy for dense data surfaces.
  - Scope: Stats and History should swap from wide-table assumptions to stacked summary cards, horizontal scrollers, or segmented views where needed.
  - Acceptance: dense baseball data stays understandable on narrow screens without shrinking to illegibility.

- Add safe-area and mobile browser chrome handling.
  - Scope: bottom nav, sticky save bars, notch spacing, mobile Safari/Chrome viewport quirks.
  - Acceptance: important actions are never hidden behind browser UI or unsafe edges.

### `P2`

- Add screenshot/device QA baselines for major breakpoints.
  - Scope: a repeatable set of viewport checks for future releases.
  - Acceptance: regressions are easier to catch before beta testers do.

## Recommended Build Order From Here

1. Complete the premium product pass across shell, Home, Log Game, recap, and logged-game detail.
2. Run the responsive shell and mobile-browser fit pass across the core loop.
3. Add stats summary modules and player-data completeness warnings.
4. Add first split views in Stats.
5. Improve History browse/filter ergonomics and safer edit-state feedback.
6. Finish isolation QA and migration-adjacent tests.

## Active Build Queue

### Active

- Premium product pass across shell, Home, Log Game, recap, and logged-game detail

### Next

- Responsive shell and mobile-browser fit pass
- Stats summary modules and player-data completeness warnings
- Stats split views
- History browse/filter improvements
