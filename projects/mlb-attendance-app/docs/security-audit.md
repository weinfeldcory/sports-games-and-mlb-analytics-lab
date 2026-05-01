# Security Audit

Date: 2026-05-01  
Scope: `projects/mlb-attendance-app`

## What I Checked

- Searched the repo for hardcoded secrets, Supabase `service_role` credentials, publishable keys beyond expected public client config, tokens, passwords, and personal recovery logic.
- Reviewed client-side Supabase config in `apps/mobile/src/lib/persistence/supabaseClient.ts`.
- Reviewed hosted persistence and local persistence flows:
  - `apps/mobile/src/lib/persistence/hostedAppDataStore.ts`
  - `apps/mobile/src/lib/persistence/localAppDataStore.ts`
  - `apps/mobile/src/providers/AppDataProvider.tsx`
  - `apps/mobile/src/lib/storage/appRepository.ts`
- Reviewed Supabase schema and RLS in:
  - `supabase/schema.sql`
  - `supabase/migrations/20260501_security_hardening.sql`
- Reviewed secret-handling and local file coverage in:
  - `.gitignore`
  - `apps/mobile/.env.example`

## Findings

### Safe public client env usage confirmed

The Expo/mobile client expects only public client-side variables:

- `EXPO_PUBLIC_APP_DATA_BACKEND`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- optional `EXPO_PUBLIC_APP_COMMIT_SHA`

These are acceptable in client code. The Supabase URL and anon key are intended for client use when RLS is configured correctly.

### No service-role key in client code

No `service_role`, `sb_secret_`, or similar privileged Supabase credential is referenced in the Expo/mobile client.

### Personal recovery behavior removed from runtime

The previous hosted recovery branch that treated one email differently was removed from production runtime code. Recovery is now manual and documented in `docs/data-recovery.md`.

### Repo ignore coverage strengthened

The project `.gitignore` now covers:

- `.env`
- `.env.local`
- `.env.production`
- `.env.*.local`
- Expo build artifacts
- logs
- Supabase local temp files

## Risks Found

### Local-only accounts still use device-side passwords

Local accounts are still a convenience mode backed by local storage. That means they are not secure account credentials in the production sense. This is acceptable for a local-only fallback but should not be marketed as secure hosted auth.

### Mobile app does not yet have dedicated automated storage/security tests

Typecheck and domain tests pass, but there is not yet a dedicated app-level test harness covering hosted/local auth flows. Manual QA remains important for shared-browser and multi-account verification.

### Legal/policy pages are placeholders

The beta Terms, Privacy Policy, and Beta Disclaimer are practical placeholders and should be reviewed by counsel before broader beta expansion or monetization.

## Files Changed

- `.gitignore`
- `apps/mobile/src/lib/persistence/hostedAppDataStore.ts`
- `apps/mobile/src/providers/AppDataProvider.tsx`
- `apps/mobile/src/features/profile/ProfileScreen.tsx`
- `apps/mobile/app/auth.tsx`
- `apps/mobile/app/debug.tsx`
- `apps/mobile/app/legal/terms.tsx`
- `apps/mobile/app/legal/privacy.tsx`
- `apps/mobile/app/legal/beta-disclaimer.tsx`
- `apps/mobile/src/components/common/PolicyScreen.tsx`
- `apps/mobile/src/lib/runtimeInfo.ts`
- `supabase/schema.sql`
- `supabase/migrations/20260501_security_hardening.sql`
- `docs/data-recovery.md`
- `docs/account-isolation-qa.md`
- `docs/supabase-rls.md`
- `docs/ip-and-ownership.md`
- `CONTRIBUTING.md`

## Manual Steps Still Needed

### GitHub

- Keep the repo private if you do not want broad code visibility during beta.
- Confirm GitHub Actions secrets contain only the public Supabase anon key and never a service-role key.
- If any secret was ever pasted into the repo or Actions logs in the past, rotate it even if it has since been removed.

### Supabase

- Keep RLS enabled on `profiles` and `attendance_logs`.
- Never use the service-role key in Expo/client code.
- Review Auth settings for password reset redirect behavior and email templates.
- Periodically verify rows in `attendance_logs` are separated by `user_id`.
- Document any future third-party tables before exposing them to the client.

### Product operations

- Define a real deletion request process before scaling beyond a small beta.
- Add app-level auth/storage regression tests when a test harness is introduced.

