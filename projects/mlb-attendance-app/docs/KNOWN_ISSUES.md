# MLB Attendance App Known Issues

Last updated: 2026-05-02

This file tracks live beta issues, operational risks, and reliability gaps separately from the product roadmap.

## Open Issues

### Hosted schema drift can still break account creation or login

- Impact: if the deployed Supabase project has not run the latest profile/social migration, hosted sign-up or sign-in can surface raw schema-cache errors instead of opening the ledger.
- User impact: the primary auth path can fail before a user ever reaches the product.
- Mitigation: keep the client tolerant of missing optional profile columns and run `supabase/migrations/20260501_social_graph_mvp.sql` against the production Supabase project.
- Owner: Cory
- Priority: `P0`

### Hosted schema drift can still degrade social features after auth

- Impact: even when auth succeeds, social surfaces may degrade or return empty states until the latest profile/social migration is applied.
- User impact: following, profile discovery, or username-based views may appear incomplete.
- Mitigation: run `supabase/migrations/20260501_social_graph_mvp.sql` against the production Supabase project.
- Owner: Cory
- Priority: `P0`

### Domain test failure in player stats package

- Impact: `packages/domain` still has a pre-existing failing test in `calculatePersonalStats.test.ts`.
- User impact: no confirmed production bug from this yet, but it weakens trust in player-stat regression coverage.
- Mitigation: audit the expectation mismatch and either fix the code or correct the stale test.
- Owner: Cory
- Priority: `P1`

### Premium shell/design pass is in progress

- Impact: the app still has mixed old/new visual language across authenticated screens.
- User impact: product feel is not yet consistent.
- Mitigation: finish the shared shell and high-traffic surface redesign before widening beta.
- Owner: Cory
- Priority: `P1`

## Tracking Rules

- Keep this file focused on live issues and operational risks.
- Remove items when resolved; do not let this become an archive.
- If a problem is strategic rather than operational, put it in the roadmap or backlog instead.
