-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 6B Migration 0015: leaderboard writer + read RPCs
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Requires 0011 (leaderboard_entries) and 0014 (scope unique index).
--
-- recalculate_leaderboards(p_round_id): materializes Round + Season leaderboard
-- rows (global + per non-global league) for the round's context/season, via an
-- idempotent ON CONFLICT upsert that reuses 0014's exact COALESCE expressions.
-- Skips finalized rounds (the lock). All-Time is NEVER stored — it is computed at
-- query time by get_all_time_leaderboard.
--
-- Ranks: ROW_NUMBER() over the approved deterministic tie-break chain →
--   points DESC, correct_scores DESC, correct_outcomes DESC,
--   profiles.created_at ASC, user_id ASC  (every user gets a UNIQUE rank).
--
-- Admin accounts and profiles without a username are excluded from all boards
-- (mirrors the WC get_leaderboard behaviour).
-- ════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.recalculate_leaderboards(p_round_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context uuid;
  v_season  uuid;
  v_status  text;
  k_zero    constant uuid := '00000000-0000-0000-0000-000000000000';
  k_global  constant uuid := '00000000-0000-0000-0000-000000000001';
begin
  select prediction_context_id, season_id, status
    into v_context, v_season, v_status
  from public.leaguexi_rounds
  where id = p_round_id;

  if not found then return; end if;
  if v_status = 'finalized' then return; end if;  -- immutability lock (spec §15)

  -- ── 1. GLOBAL ROUND (round_id set, season_id set, league_id NULL) ──────────
  with agg as (
    select p.user_id,
           coalesce(sum(p.points), 0)                  as points,
           count(*) filter (where p.points = 5)        as correct_scores,
           count(*) filter (where p.points = 3)        as correct_outcomes
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where f.round_id = p_round_id
      and f.is_included = true
    group by p.user_id
  )
  insert into public.leaderboard_entries
    (user_id, prediction_context_id, round_id, season_id, league_id,
     points, correct_scores, correct_outcomes, rank, calculated_at)
  select a.user_id, v_context, p_round_id, v_season, null,
         a.points, a.correct_scores, a.correct_outcomes,
         row_number() over (
           order by a.points desc, a.correct_scores desc, a.correct_outcomes desc,
                    pr.created_at asc, a.user_id asc
         ),
         now()
  from agg a
  join public.profiles pr on pr.id = a.user_id
  where pr.is_admin is not true and pr.username is not null
  on conflict (user_id, prediction_context_id,
               coalesce(round_id,  k_zero),
               coalesce(season_id, k_zero),
               coalesce(league_id, k_zero))
  do update set points           = excluded.points,
                correct_scores   = excluded.correct_scores,
                correct_outcomes = excluded.correct_outcomes,
                rank             = excluded.rank,
                calculated_at    = excluded.calculated_at;

  -- ── 2. GLOBAL SEASON (round_id NULL, season_id set, league_id NULL) ────────
  with agg as (
    select p.user_id,
           coalesce(sum(p.points), 0)                  as points,
           count(*) filter (where p.points = 5)        as correct_scores,
           count(*) filter (where p.points = 3)        as correct_outcomes
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    join public.leaguexi_rounds r on r.id = f.round_id
    where r.prediction_context_id = v_context
      and f.season_id = v_season
      and f.is_included = true
    group by p.user_id
  )
  insert into public.leaderboard_entries
    (user_id, prediction_context_id, round_id, season_id, league_id,
     points, correct_scores, correct_outcomes, rank, calculated_at)
  select a.user_id, v_context, null, v_season, null,
         a.points, a.correct_scores, a.correct_outcomes,
         row_number() over (
           order by a.points desc, a.correct_scores desc, a.correct_outcomes desc,
                    pr.created_at asc, a.user_id asc
         ),
         now()
  from agg a
  join public.profiles pr on pr.id = a.user_id
  where pr.is_admin is not true and pr.username is not null
  on conflict (user_id, prediction_context_id,
               coalesce(round_id,  k_zero),
               coalesce(season_id, k_zero),
               coalesce(league_id, k_zero))
  do update set points           = excluded.points,
                correct_scores   = excluded.correct_scores,
                correct_outcomes = excluded.correct_outcomes,
                rank             = excluded.rank,
                calculated_at    = excluded.calculated_at;

  -- ── 3. LEAGUE ROUND (round_id set, season_id set, league_id set) ───────────
  -- Same per-user round totals, restricted to active members of each NON-global
  -- league, ranked within the league. Global League is served from the
  -- league_id IS NULL rows above and is intentionally excluded here.
  with agg as (
    select p.user_id,
           coalesce(sum(p.points), 0)                  as points,
           count(*) filter (where p.points = 5)        as correct_scores,
           count(*) filter (where p.points = 3)        as correct_outcomes
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    where f.round_id = p_round_id
      and f.is_included = true
    group by p.user_id
  )
  insert into public.leaderboard_entries
    (user_id, prediction_context_id, round_id, season_id, league_id,
     points, correct_scores, correct_outcomes, rank, calculated_at)
  select a.user_id, v_context, p_round_id, v_season, m.league_id,
         a.points, a.correct_scores, a.correct_outcomes,
         row_number() over (
           partition by m.league_id
           order by a.points desc, a.correct_scores desc, a.correct_outcomes desc,
                    pr.created_at asc, a.user_id asc
         ),
         now()
  from agg a
  join public.profiles pr on pr.id = a.user_id
  join public.league_members m on m.user_id = a.user_id and m.status = 'active'
  join public.leagues l on l.id = m.league_id and l.is_archived = false
  where pr.is_admin is not true and pr.username is not null
    and m.league_id <> k_global
  on conflict (user_id, prediction_context_id,
               coalesce(round_id,  k_zero),
               coalesce(season_id, k_zero),
               coalesce(league_id, k_zero))
  do update set points           = excluded.points,
                correct_scores   = excluded.correct_scores,
                correct_outcomes = excluded.correct_outcomes,
                rank             = excluded.rank,
                calculated_at    = excluded.calculated_at;

  -- ── 4. LEAGUE SEASON (round_id NULL, season_id set, league_id set) ─────────
  with agg as (
    select p.user_id,
           coalesce(sum(p.points), 0)                  as points,
           count(*) filter (where p.points = 5)        as correct_scores,
           count(*) filter (where p.points = 3)        as correct_outcomes
    from public.predictions p
    join public.fixtures f on f.id = p.fixture_id
    join public.leaguexi_rounds r on r.id = f.round_id
    where r.prediction_context_id = v_context
      and f.season_id = v_season
      and f.is_included = true
    group by p.user_id
  )
  insert into public.leaderboard_entries
    (user_id, prediction_context_id, round_id, season_id, league_id,
     points, correct_scores, correct_outcomes, rank, calculated_at)
  select a.user_id, v_context, null, v_season, m.league_id,
         a.points, a.correct_scores, a.correct_outcomes,
         row_number() over (
           partition by m.league_id
           order by a.points desc, a.correct_scores desc, a.correct_outcomes desc,
                    pr.created_at asc, a.user_id asc
         ),
         now()
  from agg a
  join public.profiles pr on pr.id = a.user_id
  join public.league_members m on m.user_id = a.user_id and m.status = 'active'
  join public.leagues l on l.id = m.league_id and l.is_archived = false
  where pr.is_admin is not true and pr.username is not null
    and m.league_id <> k_global
  on conflict (user_id, prediction_context_id,
               coalesce(round_id,  k_zero),
               coalesce(season_id, k_zero),
               coalesce(league_id, k_zero))
  do update set points           = excluded.points,
                correct_scores   = excluded.correct_scores,
                correct_outcomes = excluded.correct_outcomes,
                rank             = excluded.rank,
                calculated_at    = excluded.calculated_at;
end;
$$;

revoke all on function public.recalculate_leaderboards(uuid) from public;
revoke all on function public.recalculate_leaderboards(uuid) from anon, authenticated;
grant execute on function public.recalculate_leaderboards(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- READ RPCs — Round / Season read stored rows; All-Time computed at query time.
-- league_id IS NULL ⇒ global (also serves the Global League). All exclude admins.
-- ════════════════════════════════════════════════════════════════════════════

-- Round leaderboard (stored).
create or replace function public.get_round_leaderboard(
  p_round_id  uuid,
  p_league_id uuid default null
)
returns table (
  user_id          uuid,
  username         text,
  avatar_url       text,
  points           integer,
  correct_scores   integer,
  correct_outcomes integer,
  rank             integer
)
language sql
security definer
stable
set search_path = public
as $$
  select le.user_id, pr.username, pr.avatar_url,
         le.points, le.correct_scores, le.correct_outcomes, le.rank
  from public.leaderboard_entries le
  join public.profiles pr on pr.id = le.user_id
  where le.round_id = p_round_id
    and le.league_id is not distinct from p_league_id
  order by le.rank asc;
$$;

-- Season leaderboard (stored). round_id IS NULL rows for the season/context.
create or replace function public.get_season_leaderboard(
  p_season_id              uuid,
  p_prediction_context_id  uuid,
  p_league_id              uuid default null
)
returns table (
  user_id          uuid,
  username         text,
  avatar_url       text,
  points           integer,
  correct_scores   integer,
  correct_outcomes integer,
  rank             integer
)
language sql
security definer
stable
set search_path = public
as $$
  select le.user_id, pr.username, pr.avatar_url,
         le.points, le.correct_scores, le.correct_outcomes, le.rank
  from public.leaderboard_entries le
  join public.profiles pr on pr.id = le.user_id
  where le.round_id is null
    and le.season_id = p_season_id
    and le.prediction_context_id = p_prediction_context_id
    and le.league_id is not distinct from p_league_id
  order by le.rank asc;
$$;

-- All-Time leaderboard — COMPUTED at query time, never stored (spec §34).
-- Sums each user's season/tournament aggregate rows (round_id NULL, league_id
-- NULL) across ALL contexts; ranks with the same deterministic tie-break chain.
-- p_league_id given ⇒ restrict to that league's active members.
create or replace function public.get_all_time_leaderboard(
  p_league_id uuid default null
)
returns table (
  user_id          uuid,
  username         text,
  avatar_url       text,
  points           bigint,
  correct_scores   bigint,
  correct_outcomes bigint,
  rank             integer
)
language sql
security definer
stable
set search_path = public
as $$
  with totals as (
    select le.user_id,
           sum(le.points)::bigint           as points,
           sum(le.correct_scores)::bigint   as correct_scores,
           sum(le.correct_outcomes)::bigint as correct_outcomes
    from public.leaderboard_entries le
    where le.round_id is null
      and le.league_id is null               -- cross-context global aggregates
    group by le.user_id
  )
  select t.user_id, pr.username, pr.avatar_url,
         t.points, t.correct_scores, t.correct_outcomes,
         row_number() over (
           order by t.points desc, t.correct_scores desc, t.correct_outcomes desc,
                    pr.created_at asc, t.user_id asc
         )::integer as rank
  from totals t
  join public.profiles pr on pr.id = t.user_id
  where pr.is_admin is not true and pr.username is not null
    and (
      p_league_id is null
      or exists (
        select 1 from public.league_members m
        where m.league_id = p_league_id
          and m.user_id = t.user_id
          and m.status = 'active'
      )
    )
  order by rank asc;
$$;

grant execute on function public.get_round_leaderboard(uuid, uuid)        to anon, authenticated;
grant execute on function public.get_season_leaderboard(uuid, uuid, uuid) to anon, authenticated;
grant execute on function public.get_all_time_leaderboard(uuid)           to anon, authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- STAGING IDEMPOTENCY CHECK (read-only assertions; run manually on staging).
-- Proves running the writer twice produces identical rows (no duplicates).
-- ⚠️ Uncomment and set :round to a real round id on staging.
--
-- select public.recalculate_leaderboards(:round);
-- create temporary table _snap1 as select * from public.leaderboard_entries;
-- select public.recalculate_leaderboards(:round);   -- second run
-- -- Row count identical:
-- select (select count(*) from public.leaderboard_entries)
--      = (select count(*) from _snap1) as count_stable;
-- -- Exactly one row per (user, scope):
-- select count(*) = 0 as no_dupes from (
--   select user_id, prediction_context_id,
--          coalesce(round_id,'00000000-0000-0000-0000-000000000000'::uuid),
--          coalesce(season_id,'00000000-0000-0000-0000-000000000000'::uuid),
--          coalesce(league_id,'00000000-0000-0000-0000-000000000000'::uuid), count(*)
--   from public.leaderboard_entries
--   group by 1,2,3,4,5 having count(*) > 1
-- ) d;
-- ════════════════════════════════════════════════════════════════════════════
