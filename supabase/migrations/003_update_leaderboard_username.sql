-- Update leaderboard view to use username instead of email
-- This migration changes the leaderboard to show usernames only

drop view if exists public.leaderboard_view;

create view public.leaderboard_view as
select
  coalesce(up.username, 'unknown') as name,
  count(*)::bigint as detections
from public.detections d
left join public.user_profiles up on up.id = d.user_id
group by up.username
order by detections desc;

grant select on public.leaderboard_view to authenticated;

