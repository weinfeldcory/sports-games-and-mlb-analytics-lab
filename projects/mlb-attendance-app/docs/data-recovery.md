# Data Recovery

Date: 2026-05-01

## Purpose

This app no longer contains runtime code that auto-recovers one specific person’s hosted account or injects personal seeded data into production accounts.

That behavior was removed on purpose because the app is now multi-user and should not treat any individual email or account differently.

## Safe Recovery Options

### Local import/export recovery

Use this when a user has an exported JSON payload from the app:

1. Sign into the correct account.
2. Open `Profile`.
3. Paste the exported payload into the import box.
4. Run the import action.

This is the safest user-facing recovery path because it is explicit and account-scoped.

### Hosted data verification

Use this when a hosted user says data is missing:

1. Check `auth.users` for the account email.
2. Check `public.profiles` for the matching `id`.
3. Check `public.attendance_logs` filtered by that `user_id`.
4. Confirm whether data is actually missing in Supabase or only failing to hydrate in the client.

### Admin restore from known source

If you have a known-good backup of attendance rows, restore them manually through Supabase SQL or table import using the correct `user_id`.

Important rules:

- Restore only into the intended user’s `user_id`.
- Do not run broad inserts without filtering by the correct user.
- Do not use client runtime code to special-case one account.

## What Not To Do

- Do not add hardcoded emails to production runtime.
- Do not auto-seed hosted accounts with another user’s history.
- Do not store privileged recovery credentials in the repo.
- Do not restore data through the Expo/mobile client using service-role access.

