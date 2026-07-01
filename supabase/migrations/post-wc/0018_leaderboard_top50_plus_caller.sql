-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Migration 0018: leaderboard Top-N + caller row (P-1)
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Run order: AFTER 0015 (this supersedes the three READ RPCs defined there) and
-- after 0017. Phase 2B is 0019+.
--
-- Resolves contract decision P-1 (docs/decision-log.md 2026-06-30;
-- docs/native-backend-contract.md §2C). Adds Top-N limiting + an always-present
-- caller row to the three native-consumed leaderboard read RPCs:
--   get_round_leaderboard, get_season_leaderboard, get_all_time_leaderboard.
--
-- CONTRACT (all three):
--   • New inputs (existing params preserved, appended after them):
--       p_limit     int  default 50   — clamped via greatest(coalesce(p_limit,50),1)
--       p_caller_id uuid default null
--   • New OUT column (existing columns + types preserved; appended LAST):
--       is_caller boolean
--   • Behaviour:
--       - return up to N (= effective limit) ranked rows;
--       - p_caller_id null            → Top N only (is_caller all false);
--       - caller inside Top N         → caller appears ONCE in natural position,
--                                       is_caller = true (no duplicate);
--       - caller outside Top N        → Top N + exactly ONE appended caller row
--                                       (result size N+1), is_caller = true,
--                                       carrying the caller's TRUE scope rank
--                                       (global rank for global calls, league
--                                       rank for league calls) — never renumbered;
--       - caller absent from board    → no phantom row.
--   • get_all_time_leaderboard keeps bigint for points/correct_scores/
--     correct_outcomes exactly as 0015.
--
-- SQL design:
--   • Round/Season read the STORED leaderboard_entries.rank (full-board rank
--     already materialised by recalculate_leaderboards, 0015) → filter rank<=N,
--     append caller where rank>N, via UNION ALL.
--   • All-Time computes row_number() across the COMPLETE ranked dataset (league
--     filter applied BEFORE row_number so the rank is league-scoped) → then slice
--     Top N + append caller, via UNION ALL.
--   • No DISTINCT. is_caller = (p_caller_id is not null and user_id = p_caller_id).
--
-- FUNCTION REPLACEMENT: the OUT signature changes (is_caller added) and the arg
-- list grows, so CREATE OR REPLACE cannot be used — DROP the exact old signatures
-- first, then CREATE, then REAPPLY the 0015 grants (anon, authenticated).
--
-- INDEXES: NONE added. The existing leaderboard_entries indexes (0011:42-45) are
-- assumed sufficient for launch-scale usage. If later profiling shows a need
-- (e.g. (round_id, league_id, rank)), it will be handled in a future migration.
--
-- NOTE (web, out of scope here): callers that omit p_caller_id (today's web
-- /leaderboards) now receive Top-N only (no caller row) instead of all rows.
-- The web client update is a separate, post-freeze task.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Round leaderboard (stored rank) ──────────────────────────────────────
drop function if exists public.get_round_leaderboard(uuid, uuid);

create function public.get_round_leaderboard(
  p_round_id  uuid,
  p_league_id uuid    default null,
  p_limit     integer default 50,
  p_caller_id uuid    default null
)
returns table (
  user_id          uuid,
  username         text,
  avatar_url       text,
  points           integer,
  correct_scores   integer,
  correct_outcomes integer,
  rank             integer,
  is_caller        boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with lim as (select greatest(coalesce(p_limit, 50), 1) as n),
  board as (
    select le.user_id, pr.username, pr.avatar_url,
           le.points, le.correct_scores, le.correct_outcomes, le.rank
    from public.leaderboard_entries le
    join public.profiles pr on pr.id = le.user_id
    where le.round_id = p_round_id
      and le.league_id is not distinct from p_league_id
  )
  select b.user_id, b.username, b.avatar_url,
         b.points, b.correct_scores, b.correct_outcomes, b.rank,
         (p_caller_id is not null and b.user_id = p_caller_id) as is_caller
  from board b, lim
  where b.rank <= lim.n
  union all
  select b.user_id, b.username, b.avatar_url,
         b.points, b.correct_scores, b.correct_outcomes, b.rank,
         true as is_caller
  from board b, lim
  where p_caller_id is not null
    and b.user_id = p_caller_id
    and b.rank > lim.n
  order by rank asc;
$$;

-- ── 2. Season leaderboard (stored rank) ─────────────────────────────────────
drop function if exists public.get_season_leaderboard(uuid, uuid, uuid);

create function public.get_season_leaderboard(
  p_season_id             uuid,
  p_prediction_context_id uuid,
  p_league_id             uuid    default null,
  p_limit                 integer default 50,
  p_caller_id             uuid    default null
)
returns table (
  user_id          uuid,
  username         text,
  avatar_url       text,
  points           integer,
  correct_scores   integer,
  correct_outcomes integer,
  rank             integer,
  is_caller        boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with lim as (select greatest(coalesce(p_limit, 50), 1) as n),
  board as (
    select le.user_id, pr.username, pr.avatar_url,
           le.points, le.correct_scores, le.correct_outcomes, le.rank
    from public.leaderboard_entries le
    join public.profiles pr on pr.id = le.user_id
    where le.round_id is null
      and le.season_id = p_season_id
      and le.prediction_context_id = p_prediction_context_id
      and le.league_id is not distinct from p_league_id
  )
  select b.user_id, b.username, b.avatar_url,
         b.points, b.correct_scores, b.correct_outcomes, b.rank,
         (p_caller_id is not null and b.user_id = p_caller_id) as is_caller
  from board b, lim
  where b.rank <= lim.n
  union all
  select b.user_id, b.username, b.avatar_url,
         b.points, b.correct_scores, b.correct_outcomes, b.rank,
         true as is_caller
  from board b, lim
  where p_caller_id is not null
    and b.user_id = p_caller_id
    and b.rank > lim.n
  order by rank asc;
$$;

-- ── 3. All-Time leaderboard (rank computed at query time; bigint preserved) ──
drop function if exists public.get_all_time_leaderboard(uuid);

create function public.get_all_time_leaderboard(
  p_league_id uuid    default null,
  p_limit     integer default 50,
  p_caller_id uuid    default null
)
returns table (
  user_id          uuid,
  username         text,
  avatar_url       text,
  points           bigint,
  correct_scores   bigint,
  correct_outcomes bigint,
  rank             integer,
  is_caller        boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with lim as (select greatest(coalesce(p_limit, 50), 1) as n),
  ranked as (
    select t.user_id, pr.username, pr.avatar_url,
           t.points, t.correct_scores, t.correct_outcomes,
           row_number() over (
             order by t.points desc, t.correct_scores desc, t.correct_outcomes desc,
                      pr.created_at asc, t.user_id asc
           )::integer as rank
    from (
      select le.user_id,
             sum(le.points)::bigint           as points,
             sum(le.correct_scores)::bigint   as correct_scores,
             sum(le.correct_outcomes)::bigint as correct_outcomes
      from public.leaderboard_entries le
      where le.round_id is null
        and le.league_id is null               -- cross-context global aggregates
      group by le.user_id
    ) t
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
  )
  select r.user_id, r.username, r.avatar_url,
         r.points, r.correct_scores, r.correct_outcomes, r.rank,
         (p_caller_id is not null and r.user_id = p_caller_id) as is_caller
  from ranked r, lim
  where r.rank <= lim.n
  union all
  select r.user_id, r.username, r.avatar_url,
         r.points, r.correct_scores, r.correct_outcomes, r.rank,
         true as is_caller
  from ranked r, lim
  where p_caller_id is not null
    and r.user_id = p_caller_id
    and r.rank > lim.n
  order by rank asc;
$$;

-- ── Grants (reapply 0015's grants on the new signatures) ────────────────────
grant execute on function public.get_round_leaderboard(uuid, uuid, integer, uuid)        to anon, authenticated;
grant execute on function public.get_season_leaderboard(uuid, uuid, uuid, integer, uuid) to anon, authenticated;
grant execute on function public.get_all_time_leaderboard(uuid, integer, uuid)           to anon, authenticated;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0018. Supersedes the three read RPCs from 0015 (writer + scoping logic in
-- 0015 are unchanged). Next free migration number: 0019 (Phase 2B).
-- ════════════════════════════════════════════════════════════════════════════
