# Supabase RLS Model

Date: 2026-05-01

## Plain-English Model

Every hosted account signs in through Supabase Auth and gets a unique authenticated user ID.

Two user-owned tables matter here:

- `public.profiles`
- `public.attendance_logs`

Row Level Security is enabled on both tables. That means the database itself rejects reads and writes that do not belong to the authenticated user.

## Profiles

`profiles.id` is the same UUID as `auth.users.id`.

Policies allow an authenticated user to:

- select their own profile row
- insert their own profile row
- update their own profile row

Policies do not allow a user to read or write another user’s profile row.

## Attendance Logs

`attendance_logs.user_id` is a foreign key to `auth.users.id`.

Policies allow an authenticated user to:

- select their own attendance rows
- insert their own attendance rows
- update their own attendance rows
- delete their own attendance rows

Policies do not allow a user to read or mutate another user’s attendance rows.

## Client Assumptions

The client uses the Supabase anon key. That key is public by design. Security depends on:

- valid user authentication
- RLS policies
- never using a service-role key in the client

## Current Constraints And Indexes

- `profiles.id` primary key references `auth.users.id`
- `attendance_logs.user_id` references `auth.users.id`
- `attendance_logs` has a unique constraint on `(user_id, game_id)`
- index on `attendance_logs(user_id)`
- index on `attendance_logs(user_id, attended_on desc)`

These support user isolation and the common “load my logs” query path.

## Operational Reminder

If you add new hosted tables later, they should be treated as unsafe by default until:

1. a clear ownership model exists
2. RLS is enabled
3. policies are added and reviewed

