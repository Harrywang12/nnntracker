-- Ensure all tables have RLS enabled and appropriate policies
-- This migration ensures RLS is enabled on all tables and creates policies if missing

-- Enable RLS on all existing tables (idempotent - safe to run multiple times)
do $$
declare
  tbl record;
begin
  for tbl in 
    select tablename 
    from pg_tables 
    where schemaname = 'public' 
    and tablename not in ('leaderboard_view') -- skip views
  loop
    execute format('alter table if exists public.%I enable row level security', tbl.tablename);
  end loop;
end $$;

-- Ensure detections table has RLS policies
-- Insert policy: users can only insert their own detections
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'detections' 
    and policyname = 'insert_own_detections'
  ) then
    create policy "insert_own_detections"
    on public.detections
    for insert
    to authenticated
    with check (auth.uid() = user_id);
  end if;
end $$;

-- Select policy: authenticated users can select all for leaderboard
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'detections' 
    and policyname = 'select_all_for_leaderboard'
  ) then
    create policy "select_all_for_leaderboard"
    on public.detections
    for select
    to authenticated
    using (true);
  end if;
end $$;

-- Update policy: users can only update their own detections (if needed)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'detections' 
    and policyname = 'update_own_detections'
  ) then
    create policy "update_own_detections"
    on public.detections
    for update
    to authenticated
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  end if;
end $$;

-- Delete policy: users can only delete their own detections (if needed)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'detections' 
    and policyname = 'delete_own_detections'
  ) then
    create policy "delete_own_detections"
    on public.detections
    for delete
    to authenticated
    using (auth.uid() = user_id);
  end if;
end $$;

-- Ensure user_profiles table has RLS policies
-- Insert policy: users can only insert their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_profiles' 
    and policyname = 'profiles_insert_own'
  ) then
    create policy "profiles_insert_own"
    on public.user_profiles
    for insert
    to authenticated
    with check (auth.uid() = id);
  end if;
end $$;

-- Update policy: users can only update their own profile
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_profiles' 
    and policyname = 'profiles_update_own'
  ) then
    create policy "profiles_update_own"
    on public.user_profiles
    for update
    to authenticated
    using (auth.uid() = id)
    with check (auth.uid() = id);
  end if;
end $$;

-- Select policy: authenticated users can select all for leaderboard
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_profiles' 
    and policyname = 'profiles_select_all'
  ) then
    create policy "profiles_select_all"
    on public.user_profiles
    for select
    to authenticated
    using (true);
  end if;
end $$;

-- Delete policy: users can only delete their own profile (if needed)
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_profiles' 
    and policyname = 'profiles_delete_own'
  ) then
    create policy "profiles_delete_own"
    on public.user_profiles
    for delete
    to authenticated
    using (auth.uid() = id);
  end if;
end $$;

-- Verify RLS is enabled on all tables
do $$
declare
  tbl record;
  rls_enabled boolean;
begin
  for tbl in 
    select tablename 
    from pg_tables 
    where schemaname = 'public'
    and tablename not in ('leaderboard_view')
  loop
    select relrowsecurity into rls_enabled
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
    and c.relname = tbl.tablename;
    
    if not rls_enabled then
      raise notice 'Warning: RLS not enabled on table: %', tbl.tablename;
    end if;
  end loop;
end $$;

