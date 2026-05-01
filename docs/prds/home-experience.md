# PRD: Home Experience

Status: Draft  
Date: 2026-05-01  
Owner: Cory

---

## Summary

Redesign the Home screen to serve as the primary re-entry point into the product, reinforcing the value of the user’s attendance record and driving continued logging.

---

## Goal

Make Home:
- immediately understandable
- action-oriented
- tied to the user’s personal record

---

## User Problem

After logging a game, the product does not clearly answer:

- What should I do next?
- Why should I come back before my next game?

As a result:
- sessions may end immediately after logging
- users lack motivation to backfill or explore stats

---

## Principles

1. One dominant module
2. One clear next action
3. Reinforce ownership of the personal record
4. Minimize cognitive load

---

## Proposed Experience

### Hero Module (Top Section)

This becomes the visual and functional anchor of the screen.

It should include:

- Total games logged
- Most recent game attended:
  - teams
  - date
  - venue (if available)

---

### Primary CTA

- “Log a game”
- visually dominant
- always visible above the fold

---

### Secondary CTA (Conditional)

- “Continue backfill”
- shown only if user has ≥1 logged game

---

### Supporting Content (Below Hero)

Optional lightweight modules:

- one rotating stat insight (e.g., most visited stadium)
- simple progress indicator (e.g., number of teams seen)

These should not compete with the hero.

---

## User Flow

1. User opens app
2. Sees:
   - their record (latest + total)
   - clear action to log
3. Can:
   - log a new game immediately
   - optionally continue backfilling

---

## Success Metrics

Primary:
- increase % of users who log a second game
- reduce time to second log

Secondary:
- increase sessions between games
- increase average logs per user

---

## Non-Goals

- No social features
- No live game data
- No external integrations
- No complex stats exploration on Home

---

## Constraints

- Must use existing local data
- Must work offline
- No backend or account system required
- No major navigation changes

---

## Risks

- Overloading Home with too many modules reduces clarity
- Weak stat insights may not add perceived value
- Poor layout on mobile could reduce usability

---

## Open Questions

- Should we show win/loss result in the latest game module?
- Should the hero adapt based on user behavior (e.g., no logs yet)?
- How aggressive should the “backfill” prompt be?

---

## Acceptance Criteria

- Home has a single clear focal point
- User can identify next action within 2–3 seconds
- Latest game is visible without scrolling
- CTA is obvious on both mobile and web

---

## Future Extensions (Not in Scope)

- personalized stat highlights
- streak tracking
- milestone celebrations
- social sharing

---

## Notes

This PRD is intentionally scoped to improve clarity and engagement without introducing new data dependencies.

It should be completed as part of Release 0.3 (Product Quality Pass).
