create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  display_name text not null,
  favorite_team_id text null,
  following_ids text[] not null default '{}',
  has_completed_onboarding boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attendance_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null,
  venue_id text not null,
  attended_on date not null,
  seat_section text not null,
  seat_row text null,
  seat_number text null,
  witnessed_events jsonb not null default '[]'::jsonb,
  memorable_moment text null,
  companion text null,
  giveaway text null,
  weather text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, game_id)
);

create index if not exists attendance_logs_user_id_idx
on public.attendance_logs (user_id);

create index if not exists attendance_logs_user_id_attended_on_idx
on public.attendance_logs (user_id, attended_on desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

drop trigger if exists attendance_logs_set_updated_at on public.attendance_logs;
create trigger attendance_logs_set_updated_at
before update on public.attendance_logs
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.attendance_logs enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "attendance_logs_select_own" on public.attendance_logs;
create policy "attendance_logs_select_own"
on public.attendance_logs
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "attendance_logs_insert_own" on public.attendance_logs;
create policy "attendance_logs_insert_own"
on public.attendance_logs
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "attendance_logs_update_own" on public.attendance_logs;
create policy "attendance_logs_update_own"
on public.attendance_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "attendance_logs_delete_own" on public.attendance_logs;
create policy "attendance_logs_delete_own"
on public.attendance_logs
for delete
to authenticated
using (auth.uid() = user_id);
