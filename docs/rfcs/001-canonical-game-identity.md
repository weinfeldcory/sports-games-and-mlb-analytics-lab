# RFC 001: Canonical Game Identity

Status: Proposed  
Date: 2026-05-01  
Owner: Cory

---

## Summary

Define a stable, deterministic identity for MLB games that works across:
- seeded local data
- future catalog expansion
- manual fallback entries
- eventual external data sources and sync

This RFC establishes the contract for how a "game" is uniquely identified in the system.

---

## Problem

The product currently relies on seeded data and implicit identity. As we expand catalog coverage and introduce manual fallback logging, we risk:

- duplicate records for the same real-world game
- inability to reconcile manual entries with canonical data
- broken or inconsistent derived stats
- ambiguity around edge cases (doubleheaders, postponed games, resumed games)

Without a canonical identity, the ledger cannot be trusted at scale.

---

## Requirements

A valid game identity must:

1. Uniquely identify every MLB game
2. Support doubleheaders (multiple games same teams, same day)
3. Support postponed and resumed games
4. Be stable across data sources
5. Be deterministic (same inputs → same ID)
6. Allow later reconciliation of manual entries
7. Work offline (no dependency on external APIs)

---

## Non-Goals

- Perfect mapping to every historical MLB edge case at launch
- Real-time data syncing
- External API integration (this will come later)

---

## Proposed Solution

### Canonical Game Identity Fields

A game is uniquely defined by the following fields:

- `league` (e.g., MLB)
- `season` (year)
- `date` (local game date, YYYY-MM-DD)
- `game_number` (integer, default = 1)
  - used to distinguish doubleheaders
- `home_team_id`
- `away_team_id`
- `venue_id`

---

### Canonical ID Construction

A deterministic ID string should be constructed as:


{league}{season}{date}{game_number}{home_team_id}{away_team_id}{venue_id}


Example:


MLB_2018_06-12_1_NYY_BOS_YANKEE_STADIUM


---

### Game Number Rules

- Default: `1`
- Doubleheaders:
  - First game: `1`
  - Second game: `2`
- If unknown:
  - assume `1`
  - allow later reconciliation

---

### Date Rules

- Use the official game date (not resume date for suspended games)
- If unknown:
  - allow user-entered date
  - mark as low-confidence

---

## Manual Fallback Handling

When a game cannot be resolved to canonical data:

- Create a **manual game record**
- Assign a temporary ID:

```
manual_{timestamp}_{hash}
```

- Store all known fields (teams, date, venue if known)

---

### Reconciliation Strategy (Future)

Manual entries should be:
- flagged as `unverified`
- eligible for later matching against canonical games

Matching logic may include:
- date proximity
- team pairing
- venue match

Once matched:
- manual ID is replaced with canonical ID
- user data is preserved

---

## Edge Cases

### Doubleheaders
Handled via `game_number`

---

### Postponed Games
- Use originally scheduled date if known
- If not, use played date
- Must remain consistent once set

---

### Resumed/Suspended Games
- treated as a single game
- tied to original game date

---

### Neutral Site Games
- must still have a `venue_id`
- venue normalization required

---

## Data Model Implications

- All attendance logs must reference a `game_id`
- Derived stats must group strictly by canonical ID
- Duplicate prevention must operate on canonical identity

---

## Risks

- Incorrect assumptions about game_number may cause collisions
- Manual entries may be difficult to reconcile without strong heuristics
- Venue normalization must be consistent

---

## Open Questions

- How should we handle games with unknown venue?
- Should spring training be included under same identity model?
- Do we need a separate `game_type` field (regular season, postseason, etc.)?

---

## Decision

Pending.

This RFC should be finalized before Release 0.4 (Catalog Expansion).

---

## Next Steps

- Implement ID generation utility in `packages/domain`
- Update attendance creation to require canonical identity
- Add `manual` vs `canonical` distinction to game records
- Add test coverage for ID construction and duplicate prevention
