-- ─────────────────────────────────────────
-- LEADERBOARD FUNCTIONS
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────

-- Global leaderboard — optional competition filter.
-- NULL (default) = all competitions, keeping existing callers unchanged.
-- Drop old 0-param signature to avoid PostgREST ambiguity after adding the param.
drop function if exists public.get_leaderboard();

create or replace function public.get_leaderboard(
  p_competition_id uuid default null
)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  total_points bigint,
  exact_scores bigint,
  correct_results bigint,
  member_since timestamptz
)
language sql
security definer
stable
as $$
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    coalesce(sum(filtered_pr.points), 0)::integer as total_points,
    count(filtered_pr.points) filter (where filtered_pr.points = 5)::integer as exact_scores,
    count(filtered_pr.points) filter (where filtered_pr.points = 3)::integer as correct_results,
    p.created_at as member_since
  from public.profiles p
  left join (
    select pr.user_id, pr.points
    from public.predictions pr
    join public.matches mm on mm.id = pr.match_id
    where p_competition_id is null
       or mm.competition_id = p_competition_id
  ) filtered_pr on filtered_pr.user_id = p.id
  where p.is_admin is not true
    and p.username is not null
  group by p.id, p.username, p.avatar_url, p.created_at
  order by total_points desc, exact_scores desc, correct_results desc, p.created_at asc;
$$;

-- League leaderboard — optional competition filter so scores match the Predictions tab.
-- If p_competition_id is NULL, all predictions across all competitions are counted
-- (backwards-compatible with existing callers).
-- Drop old 1-param signature first to avoid PostgREST ambiguity.
drop function if exists public.get_league_leaderboard(uuid);

create or replace function public.get_league_leaderboard(
  p_league_id      uuid,
  p_competition_id uuid default null
)
returns table (
  user_id         uuid,
  username        text,
  avatar_url      text,
  total_points    bigint,
  exact_scores    bigint,
  correct_results bigint,
  joined_at       timestamptz
)
language sql
security definer
stable
as $$
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    coalesce(sum(filtered_pr.points), 0)::integer as total_points,
    count(filtered_pr.points) filter (where filtered_pr.points = 5)::integer as exact_scores,
    count(filtered_pr.points) filter (where filtered_pr.points = 3)::integer as correct_results,
    lm.joined_at
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  left join (
    select pr.user_id, pr.points
    from public.predictions pr
    join public.matches mm on mm.id = pr.match_id
    where p_competition_id is null
       or mm.competition_id = p_competition_id
  ) filtered_pr on filtered_pr.user_id = p.id
  where lm.league_id = p_league_id
    and p.is_admin is not true
    and p.username is not null
  group by p.id, p.username, p.avatar_url, lm.joined_at
  order by total_points desc, exact_scores desc, correct_results desc, lm.joined_at asc;
$$;

-- Grant execute to authenticated and anon roles
grant execute on function public.get_leaderboard(uuid) to anon, authenticated;
grant execute on function public.get_league_leaderboard(uuid, uuid) to anon, authenticated;
