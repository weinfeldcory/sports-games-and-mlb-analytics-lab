# Account Isolation QA

Date: 2026-05-01

## Purpose

Use this checklist to verify that one user cannot see another user’s profile, logs, or derived stats.

## Hosted QA Checklist

1. Account A signs in and creates attendance logs.
2. Account A signs out.
3. Account B signs in on the same browser and confirms:
   - no Account A profile copy
   - no Account A attendance logs
   - derived stats reflect only Account B data
4. Account B creates attendance logs.
5. Account A signs back in on the same browser and sees only Account A data.
6. Account A signs in on a second device or browser and confirms hosted logs rehydrate.
7. Refresh both sessions and confirm each account still sees only its own data.
8. Clear local browser storage, sign back into Account A, and confirm hosted data rehydrates from Supabase.
9. In Supabase, confirm `attendance_logs` rows for Account A and Account B remain separated by `user_id`.

## Local-Only QA Checklist

1. Create Local Account A and log games.
2. Sign out.
3. Create Local Account B on the same browser/device.
4. Confirm Local Account B does not inherit Local Account A logs.
5. Sign back into Local Account A and confirm only Local Account A logs appear.

## Debug Fields To Check

Use the in-app `Beta Debug` page to confirm:

- `storageMode`
- `currentUserId`
- `profileId`
- `loadedAttendanceLogs`
- `lastHydration`
- `lastSave`
- `lastError`

