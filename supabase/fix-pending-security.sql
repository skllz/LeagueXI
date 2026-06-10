-- ═══════════════════════════════════════════════════════════════════════════
-- LeagueXI — PENDING SECURITY FIXES
-- Covers: C1, C2(a), C2(b), H2, plus the two RPCs the app requires.
--
-- SAFE TO RE-RUN — every statement is idempotent (CREATE OR REPLACE /
-- DROP IF EXISTS). Run the whole file in the Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- RPCs required by the app (must exist before the app works correctly)
-- ───────────────────────────────────────────────────────────────────────────

-- get_league_for_page
-- SECURITY DEFINER so non-members can load a private league page.
-- The app checks membership separately and renders a join-wall if needed.
-- Returns every field the page needs EXCEPT invite_code.
create or replace function public.get_league_for_page(p_slug text)
returns table (
  id                uuid,
  name              text,
  slug              text,
  description       text,
  visibility        text,
  prize_description text,
  is_archived       boolean,
  owner_id          uuid,
  competition_id    uuid
)
language sql
security definer
stable
set search_path = public
as $$
  select
    l.id, l.name, l.slug, l.description, l.visibility,
    l.prize_description, l.is_archived, l.owner_id, l.competition_id
  from public.leagues l
  where l.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_league_for_page(text) to anon, authenticated;


-- get_league_by_invite_code
-- SECURITY DEFINER so a non-member can resolve a private league from an
-- invite link.  Returns ONLY id, slug, is_archived — never leaks the
-- invite_code itself or any other private data.
drop function if exists public.get_league_by_invite_code(char);

create or replace function public.get_league_by_invite_code(p_invite_code text)
returns table (
  id          uuid,
  slug        text,
  is_archived boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select l.id, l.slug, l.is_archived
  from public.leagues l
  where l.invite_code = upper(p_invite_code)
  limit 1;
$$;

grant execute on function public.get_league_by_invite_code(text) to authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- C1 — Privilege escalation: users can set their own is_admin = true
-- ═══════════════════════════════════════════════════════════════════════════
-- profiles_own_update has no WITH CHECK and no column restriction, so any
-- user can flip is_admin on their own row.
-- Fix: BEFORE UPDATE trigger that pins is_admin to its old value unless the
-- caller is already an admin.  Legitimate self-updates (username, avatar,
-- display_name) are completely unaffected.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.enforce_profile_is_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Nothing changing — let the update through immediately.
  if new.is_admin is not distinct from old.is_admin then
    return new;
  end if;

  -- is_admin is being changed.  Allow it only if the caller is already admin.
  if exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  ) then
    return new;
  end if;

  -- Non-admin tried to change is_admin: silently force it back.
  new.is_admin := old.is_admin;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_is_admin on public.profiles;

create trigger profiles_enforce_is_admin
  before update on public.profiles
  for each row
  execute function public.enforce_profile_is_admin();


-- ═══════════════════════════════════════════════════════════════════════════
-- C2 (a) — Leaderboard must only count COMPLETED matches
-- ═══════════════════════════════════════════════════════════════════════════
-- All three leaderboard RPCs were summing points without filtering on
-- match status, so fake points submitted by a user would appear immediately.
-- Added: WHERE mm.status = 'completed' to every points join.
-- ───────────────────────────────────────────────────────────────────────────

-- Drop the old zero-param signature to avoid PostgREST ambiguity.
drop function if exists public.get_leaderboard();

create or replace function public.get_leaderboard(
  p_competition_id uuid default null
)
returns table (
  user_id         uuid,
  username        text,
  avatar_url      text,
  total_points    bigint,
  exact_scores    bigint,
  correct_results bigint,
  member_since    timestamptz
)
language sql
security definer
stable
as $$
  select
    p.id as user_id,
    p.username,
    p.avatar_url,
    coalesce(sum(fp.points), 0)::integer                              as total_points,
    count(fp.points) filter (where fp.points = 5)::integer            as exact_scores,
    count(fp.points) filter (where fp.points = 3)::integer            as correct_results,
    p.created_at as member_since
  from public.profiles p
  left join (
    select pr.user_id, pr.points
    from public.predictions pr
    join public.matches mm on mm.id = pr.match_id
    where mm.status = 'completed'
      and (p_competition_id is null or mm.competition_id = p_competition_id)
  ) fp on fp.user_id = p.id
  where p.is_admin is not true
    and p.username is not null
  group by p.id, p.username, p.avatar_url, p.created_at
  order by total_points desc, exact_scores desc, correct_results desc, p.created_at asc;
$$;


-- Drop old 1-param signature to avoid PostgREST ambiguity.
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
    coalesce(sum(fp.points), 0)::integer                              as total_points,
    count(fp.points) filter (where fp.points = 5)::integer            as exact_scores,
    count(fp.points) filter (where fp.points = 3)::integer            as correct_results,
    lm.joined_at
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  left join (
    select pr.user_id, pr.points
    from public.predictions pr
    join public.matches mm on mm.id = pr.match_id
    where mm.status = 'completed'
      and (p_competition_id is null or mm.competition_id = p_competition_id)
  ) fp on fp.user_id = p.id
  where lm.league_id = p_league_id
    and p.is_admin is not true
    and p.username is not null
  group by p.id, p.username, p.avatar_url, lm.joined_at
  order by total_points desc, exact_scores desc, correct_results desc, lm.joined_at asc;
$$;


create or replace function public.get_user_rank(
  p_user_id        uuid,
  p_competition_id uuid default null
)
returns table (
  total_points    bigint,
  exact_scores    bigint,
  correct_results bigint,
  rank            bigint
)
language sql
security definer
stable
as $$
  with scored as (
    select
      p.id as user_id,
      coalesce(sum(fp.points), 0)                               as total_points,
      count(fp.points) filter (where fp.points = 5)             as exact_scores,
      count(fp.points) filter (where fp.points = 3)             as correct_results,
      p.created_at
    from public.profiles p
    left join (
      select pr.user_id, pr.points
      from public.predictions pr
      join public.matches mm on mm.id = pr.match_id
      where mm.status = 'completed'
        and (p_competition_id is null or mm.competition_id = p_competition_id)
    ) fp on fp.user_id = p.id
    where p.is_admin is not true
      and p.username is not null
    group by p.id, p.created_at
  ),
  ranked as (
    select
      user_id,
      total_points,
      exact_scores,
      correct_results,
      rank() over (
        order by total_points desc, exact_scores desc, correct_results desc, created_at asc
      ) as rank
    from scored
  )
  select total_points, exact_scores, correct_results, rank
  from ranked
  where user_id = p_user_id;
$$;

grant execute on function public.get_leaderboard(uuid)              to anon, authenticated;
grant execute on function public.get_league_leaderboard(uuid, uuid)  to anon, authenticated;
grant execute on function public.get_user_rank(uuid, uuid)           to anon, authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- C2 (b) — Predictions: stop users writing arbitrary `points`
-- ═══════════════════════════════════════════════════════════════════════════
-- INSERT/UPDATE RLS policies don't restrict columns, so a user could submit
-- a prediction with points = 999.
--
-- Fix: BEFORE INSERT OR UPDATE trigger that forces points = null for any
-- normal end-user insert, and preserves OLD.points (set by scoring) on
-- update so editing a prediction never erases an already-awarded score.
--
-- The scoring path (recalculate_match_predictions) runs as a SECURITY
-- DEFINER function whose owner is NOT the 'authenticated'/'anon' role, so
-- current_user is the function owner, not the request role.  The trigger
-- detects this and allows the points write through unchanged.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.enforce_prediction_points()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_is_request_role boolean := current_user in ('authenticated', 'anon');
  v_is_admin        boolean := exists (
    select 1 from public.profiles
    where id = auth.uid() and is_admin = true
  );
begin
  -- Trusted callers: the SECURITY DEFINER scoring path (current_user is the
  -- function owner, not a request role), and genuine admins.
  if (not v_is_request_role) or v_is_admin then
    return new;
  end if;

  -- Untrusted caller: prevent any points manipulation.
  if tg_op = 'INSERT' then
    new.points := null;
  else
    new.points := old.points;   -- preserve score already set by scoring
  end if;

  return new;
end;
$$;

drop trigger if exists predictions_enforce_points on public.predictions;

create trigger predictions_enforce_points
  before insert or update on public.predictions
  for each row
  execute function public.enforce_prediction_points();


-- ═══════════════════════════════════════════════════════════════════════════
-- H2 — Archived league join: enforce at DB level
-- ═══════════════════════════════════════════════════════════════════════════
-- league_members_insert had no is_archived check, so a user could join an
-- archived league by calling joinLeagueByCode directly.
--
-- The helper function must be SECURITY DEFINER because when a non-member is
-- inserting their first league_members row (i.e. joining), they cannot yet
-- see a private league under leagues_read — a plain subquery against
-- leagues inside the policy would return no rows and falsely block the join
-- even with a valid invite code.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.is_league_open_for_joining(p_league_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(not is_archived, false)
  from public.leagues
  where id = p_league_id;
$$;

grant execute on function public.is_league_open_for_joining(uuid) to authenticated;

drop policy if exists "league_members_insert" on public.league_members;

create policy "league_members_insert" on public.league_members
  for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
    and public.is_league_open_for_joining(league_id)
  );
