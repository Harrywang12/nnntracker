-- Add username support to existing schema
-- Run this if you already have the base schema and need to add username functionality

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
create policy if not exists "profiles_insert_own"
on public.user_profiles
for insert
to authenticated
with check (auth.uid() = id);

create policy if not exists "profiles_update_own"
on public.user_profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy if not exists "profiles_select_all"
on public.user_profiles
for select
to authenticated
using (true);

-- Update leaderboard view to use username instead of email
drop view if exists public.leaderboard_view;

create view public.leaderboard_view as
select
  coalesce(up.username, d.email, 'unknown') as name,
  count(*)::bigint as detections
from public.detections d
left join public.user_profiles up on up.id = d.user_id
group by name
order by detections desc;

grant select on public.leaderboard_view to authenticated;

