-- Fix leaderboard view permissions to ensure authenticated users can query it
-- The view needs to be able to access the underlying tables with RLS

-- Drop and recreate the view to ensure proper permissions
drop view if exists public.leaderboard_view;

-- Create view with SECURITY INVOKER (runs as querying user)
-- This ensures RLS policies on underlying tables are enforced
create view public.leaderboard_view
with (security_invoker = true) as
select
  coalesce(up.username, 'unknown') as name,
  count(*)::bigint as detections
from public.detections d
left join public.user_profiles up on up.id = d.user_id
group by up.username
order by detections desc;

-- Grant select to authenticated users
grant select on public.leaderboard_view to authenticated;

-- Ensure the view owner has proper permissions (though SECURITY INVOKER uses querying user)
-- The view will use the querying user's permissions via RLS policies

-- Verify RLS policies allow authenticated users to select from detections
-- This should already exist from migration 004, but we'll verify
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'detections' 
    and policyname = 'select_all_for_leaderboard'
    and 'authenticated' = ANY(roles)
  ) then
    -- Recreate the policy if missing
    drop policy if exists "select_all_for_leaderboard" on public.detections;
    create policy "select_all_for_leaderboard"
    on public.detections
    for select
    to authenticated
    using (true);
  end if;
end $$;

-- Verify RLS policies allow authenticated users to select from user_profiles
do $$
begin
  if not exists (
    select 1 from pg_policies 
    where schemaname = 'public' 
    and tablename = 'user_profiles' 
    and policyname = 'profiles_select_all'
    and 'authenticated' = ANY(roles)
  ) then
    -- Recreate the policy if missing
    drop policy if exists "profiles_select_all" on public.user_profiles;
    create policy "profiles_select_all"
    on public.user_profiles
    for select
    to authenticated
    using (true);
  end if;
end $$;

