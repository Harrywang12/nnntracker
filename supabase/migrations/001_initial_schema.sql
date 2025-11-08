-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Detections table
create table if not exists public.detections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  email text,
  date date not null,
  created_at timestamptz not null default now()
);

alter table public.detections enable row level security;

-- Policies
create policy "insert_own_detections"
on public.detections
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "select_all_for_leaderboard"
on public.detections
for select
to authenticated
using (true);

-- Optional index for leaderboard queries
create index if not exists detections_date_idx on public.detections(date);
create index if not exists detections_user_idx on public.detections(user_id);

-- User profiles table for usernames
create table if not exists public.user_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null,
  created_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

-- Unique username (case-insensitive) constraint
create unique index if not exists user_profiles_username_ci on public.user_profiles (lower(username));

-- RLS: users can insert/update their own profile, select all for leaderboard
create policy "profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy "profiles_update_own"
on public.user_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "profiles_select_all"
on public.user_profiles
for select
to authenticated
using (true);

-- Leaderboard view (groups by email stored on insert)
-- Drop existing view if it has SECURITY DEFINER, then recreate without it
drop view if exists public.leaderboard_view;

-- Create view without SECURITY DEFINER (defaults to SECURITY INVOKER)
-- This ensures RLS policies are enforced based on the querying user's permissions
create view public.leaderboard_view as
select
  coalesce(up.username, d.email, 'unknown') as name,
  count(*)::bigint as detections
from public.detections d
left join public.user_profiles up on up.id = d.user_id
group by name
order by detections desc;

grant select on public.leaderboard_view to authenticated;


