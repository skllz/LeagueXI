-- ─────────────────────────────────────────
-- LEADERBOARD FUNCTIONS
-- Run in Supabase SQL Editor
-- ─────────────────────────────────────────

-- Global leaderboard
create or replace function public.get_leaderboard()
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
    coalesce(sum(pr.points), 0) as total_points,
    count(pr.points) filter (where pr.points = 5) as exact_scores,
    count(pr.points) filter (where pr.points = 3) as correct_results,
    p.created_at as member_since
  from public.profiles p
  left join public.predictions pr on pr.user_id = p.id
  where p.is_admin is not true
    and p.username is not null
  group by p.id, p.username, p.avatar_url, p.created_at
  order by total_points desc, exact_scores desc, correct_results desc, p.created_at asc;
$$;

-- League leaderboard (used in Phase 4)
create or replace function public.get_league_leaderboard(p_league_id uuid)
returns table (
  user_id uuid,
  username text,
  avatar_url text,
  total_points bigint,
  exact_scores bigint,
  correct_results bigint,
  joined_at timestamptz
)
language sql
security definer
stable
as $$
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    coalesce(sum(pr.points), 0) as total_points,
    count(pr.points) filter (where pr.points = 5) as exact_scores,
    count(pr.points) filter (where pr.points = 3) as correct_results,
    lm.joined_at
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  left join public.predictions pr on pr.user_id = p.id
  where lm.league_id = p_league_id
    and p.is_admin is not true
    and p.username is not null
  group by p.id, p.username, p.avatar_url, lm.joined_at
  order by total_points desc, exact_scores desc, correct_results desc, lm.joined_at asc;
$$;

-- Grant execute to authenticated and anon roles
grant execute on function public.get_leaderboard() to anon, authenticated;
grant execute on function public.get_league_leaderboard(uuid) to anon, authenticated;
