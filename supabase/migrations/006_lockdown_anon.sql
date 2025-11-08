-- Lock down anon role: allow features via authenticated JWT only
-- Ensures users with only the anon key cannot read/modify data

-- Revoke anon from selecting views explicitly
revoke select on public.leaderboard_view from anon;

-- Create explicit DENY policies for anon on tables (RLS is positive, but we add USING false)
-- Detections: deny all operations for anon
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections' and policyname = 'anon_select_detections_deny'
  ) then
    create policy "anon_select_detections_deny"
    on public.detections
    for select
    to anon
    using (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections' and policyname = 'anon_insert_detections_deny'
  ) then
    create policy "anon_insert_detections_deny"
    on public.detections
    for insert
    to anon
    with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections' and policyname = 'anon_update_detections_deny'
  ) then
    create policy "anon_update_detections_deny"
    on public.detections
    for update
    to anon
    using (false)
    with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'detections' and policyname = 'anon_delete_detections_deny'
  ) then
    create policy "anon_delete_detections_deny"
    on public.detections
    for delete
    to anon
    using (false);
  end if;
end $$;

-- user_profiles: deny all operations for anon
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'anon_select_user_profiles_deny'
  ) then
    create policy "anon_select_user_profiles_deny"
    on public.user_profiles
    for select
    to anon
    using (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'anon_insert_user_profiles_deny'
  ) then
    create policy "anon_insert_user_profiles_deny"
    on public.user_profiles
    for insert
    to anon
    with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'anon_update_user_profiles_deny'
  ) then
    create policy "anon_update_user_profiles_deny"
    on public.user_profiles
    for update
    to anon
    using (false)
    with check (false);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'user_profiles' and policyname = 'anon_delete_user_profiles_deny'
  ) then
    create policy "anon_delete_user_profiles_deny"
    on public.user_profiles
    for delete
    to anon
    using (false);
  end if;
end $$;

-- Ensure RLS is enabled (idempotent)
alter table if exists public.detections enable row level security;
alter table if exists public.user_profiles enable row level security;


