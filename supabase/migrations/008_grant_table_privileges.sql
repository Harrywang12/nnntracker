-- Ensure the 'authenticated' role has the base privileges required
-- to query through SECURITY INVOKER views with RLS enforced.
-- RLS policies still gate row access; these GRANTs only satisfy
-- the underlying Postgres privilege checks.

grant usage on schema public to authenticated;

-- Minimal privileges for leaderboard read path
grant select on table public.detections to authenticated;
grant select on table public.user_profiles to authenticated;

-- Minimal privileges for expected writes (enforced by RLS + triggers)
grant insert on table public.detections to authenticated;
grant insert, update on table public.user_profiles to authenticated;


