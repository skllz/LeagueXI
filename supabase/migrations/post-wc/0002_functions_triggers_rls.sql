-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 1 Migration 0002: Functions, triggers & RLS
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
--
-- Covers Phase 1 build-order step 9 — THE HIGHEST-RISK STEP.
-- Run AFTER 0001_schema_renames.sql (this file assumes the table is `fixtures`,
-- the column is `fixture_id`, the enum value is `finished`, and
-- leagues.creator_user_id exists with competition_id dropped).
--
-- What changes and why:
--   • Function BODIES are stored as text and are NOT auto-rewritten by the
--     renames in 0001, so every function referencing matches / match_id /
--     kickoff_at / owner_id / 'completed' / leagues.competition_id is recreated.
--   • RLS policies are bound to the table OID and survive the rename, but per
--     spec we DROP & RECREATE every policy referencing a renamed object so the
--     migration is deterministic and self-documenting.
--
-- BEHAVIOUR IS PRESERVED. These are renames only:
--   - No RPC signature changes EXCEPT where a returned column was itself renamed
--     or dropped (get_league_predictions: match_id→fixture_id in the OUT columns;
--     get_league_for_page: drops competition_id, renames owner_id→creator_user_id).
--   - p_competition_id parameters are KEPT (fixtures.competition_id still exists).
--     Their removal is a Phase 6 (leaderboards) decision, not Phase 1.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. SCORING RPC — recalculate_match_predictions
--    Name & signature UNCHANGED (spec §11). Internal refs updated:
--    matches→fixtures, status 'completed'→'finished', match_id→fixture_id.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.recalculate_match_predictions(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_home_score integer;
  v_away_score integer;
  v_count      integer;
begin
  select home_score, away_score
  into   v_home_score, v_away_score
  from   fixtures
  where  id = p_match_id
    and  status = 'finished';

  if not found then
    raise exception 'Fixture % not found or not yet finished', p_match_id;
  end if;

  update predictions
  set points = case
    when predicted_home_score = v_home_score
     and predicted_away_score = v_away_score
    then 5
    when sign(predicted_home_score - predicted_away_score)
       = sign(v_home_score - v_away_score)
    then 3
    else 0
  end
  where fixture_id = p_match_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.recalculate_match_predictions(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 2. LEADERBOARD RPCs — get_leaderboard / get_league_leaderboard / get_user_rank
--    Signatures UNCHANGED. Internal join matches→fixtures, status
--    'completed'→'finished'. (p_competition_id still filters fixtures.competition_id.)
-- ════════════════════════════════════════════════════════════════════════════
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
    coalesce(sum(fp.points), 0)::integer                   as total_points,
    count(fp.points) filter (where fp.points = 5)::integer as exact_scores,
    count(fp.points) filter (where fp.points = 3)::integer as correct_results,
    p.created_at as member_since
  from public.profiles p
  left join (
    select pr.user_id, pr.points
    from public.predictions pr
    join public.fixtures fx on fx.id = pr.fixture_id
    where fx.status = 'finished'
      and (p_competition_id is null or fx.competition_id = p_competition_id)
  ) fp on fp.user_id = p.id
  where p.is_admin is not true
    and p.username is not null
  group by p.id, p.username, p.avatar_url, p.created_at
  order by total_points desc, exact_scores desc, correct_results desc, p.created_at asc;
$$;

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
    coalesce(sum(fp.points), 0)::integer                   as total_points,
    count(fp.points) filter (where fp.points = 5)::integer as exact_scores,
    count(fp.points) filter (where fp.points = 3)::integer as correct_results,
    lm.joined_at
  from public.league_members lm
  join public.profiles p on p.id = lm.user_id
  left join (
    select pr.user_id, pr.points
    from public.predictions pr
    join public.fixtures fx on fx.id = pr.fixture_id
    where fx.status = 'finished'
      and (p_competition_id is null or fx.competition_id = p_competition_id)
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
      coalesce(sum(fp.points), 0)                   as total_points,
      count(fp.points) filter (where fp.points = 5) as exact_scores,
      count(fp.points) filter (where fp.points = 3) as correct_results,
      p.created_at
    from public.profiles p
    left join (
      select pr.user_id, pr.points
      from public.predictions pr
      join public.fixtures fx on fx.id = pr.fixture_id
      where fx.status = 'finished'
        and (p_competition_id is null or fx.competition_id = p_competition_id)
    ) fp on fp.user_id = p.id
    where p.is_admin is not true
      and p.username is not null
    group by p.id, p.created_at
  ),
  ranked as (
    select
      user_id, total_points, exact_scores, correct_results,
      rank() over (
        order by total_points desc, exact_scores desc, correct_results desc, created_at asc
      ) as rank
    from scored
  )
  select total_points, exact_scores, correct_results, rank
  from ranked
  where user_id = p_user_id;
$$;

grant execute on function public.get_leaderboard(uuid)             to anon, authenticated;
grant execute on function public.get_league_leaderboard(uuid, uuid) to anon, authenticated;
grant execute on function public.get_user_rank(uuid, uuid)          to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 3. LEAGUE PREDICTIONS RPC — get_league_predictions
--    Signature UNCHANGED. Internal: matches→fixtures, p.match_id→p.fixture_id,
--    m.kickoff_at→m.kickoff_datetime_utc.
--    RETURN-SHAPE CHANGE: the OUT column `match_id` is renamed to `fixture_id`
--    to match the column rename (and native LeaguePredictionRow). Drop the old
--    function first so PostgREST sees the new OUT signature.
--
--    NATIVE NOTE: the OUT column is still labelled `kickoff_at` (NOT
--    `kickoff_datetime_utc`) — its value is sourced from the renamed
--    kickoff_datetime_utc column, but the label is intentionally legacy for now.
--    Native must rename match_id → fixture_id but must NOT touch kickoff_at on
--    this RPC's result yet. This label is cleaned up in Phase 6 RPC work.
-- ════════════════════════════════════════════════════════════════════════════
drop function if exists get_league_predictions(uuid, uuid, uuid);

create or replace function get_league_predictions(
  p_league_id      uuid,
  p_caller_id      uuid,
  p_competition_id uuid default null
)
returns table (
  fixture_id        uuid,          -- was match_id
  kickoff_at        timestamptz,   -- value now sourced from kickoff_datetime_utc
  status            text,
  home_score        integer,
  away_score        integer,
  home_team_name    text,
  home_team_short   text,
  home_team_country text,
  away_team_name    text,
  away_team_short   text,
  away_team_country text,
  round             text,
  user_id           uuid,
  username          text,
  avatar_url        text,
  predicted_home    integer,
  predicted_away    integer,
  points            integer
)
language sql
security definer
stable
set search_path = public
as $$
  select
    fx.id,
    fx.kickoff_datetime_utc,
    fx.status::text,
    fx.home_score,
    fx.away_score,
    ht.name::text,
    ht.short_name::text,
    ht.country::text,
    awt.name::text,
    awt.short_name::text,
    awt.country::text,
    fx.round::text,
    p.user_id,
    pr.username::text,
    pr.avatar_url::text,
    p.predicted_home_score,
    p.predicted_away_score,
    p.points
  from predictions p
  join league_members lm ON lm.user_id = p.user_id AND lm.league_id = p_league_id
  join fixtures fx       ON fx.id = p.fixture_id
  join teams ht          ON ht.id = fx.home_team_id
  join teams awt         ON awt.id = fx.away_team_id
  join profiles pr       ON pr.id = p.user_id
  where
    exists (
      select 1 from league_members
      where league_id = p_league_id and user_id = p_caller_id
    )
    and auth.uid() = p_caller_id
    and pr.is_admin is not true
    and (p_competition_id is null or fx.competition_id = p_competition_id)
    and (
      fx.kickoff_datetime_utc <= now()
      or p.user_id = p_caller_id
    )
  order by fx.kickoff_datetime_utc asc, pr.username asc;
$$;

grant execute on function get_league_predictions(uuid, uuid, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 4. LEAGUE PAGE RPC — get_league_for_page
--    RETURN-SHAPE CHANGE: drops competition_id (column dropped in 0001),
--    renames owner_id → creator_user_id in the OUT columns. Drop old first.
-- ════════════════════════════════════════════════════════════════════════════
drop function if exists public.get_league_for_page(text);

create or replace function public.get_league_for_page(p_slug text)
returns table (
  id                uuid,
  name              text,
  slug              text,
  description       text,
  visibility        text,
  prize_description text,
  is_archived       boolean,
  creator_user_id   uuid       -- was owner_id; competition_id removed
)
language sql
security definer
stable
set search_path = public
as $$
  select
    l.id, l.name, l.slug, l.description, l.visibility,
    l.prize_description, l.is_archived, l.creator_user_id
  from public.leagues l
  where l.slug = p_slug
  limit 1;
$$;

grant execute on function public.get_league_for_page(text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 5. TRANSFER OWNERSHIP RPC — transfer_league_ownership
--    Signature UNCHANGED. Internal owner_id → creator_user_id.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.transfer_league_ownership(
  p_league_id    uuid,
  p_caller_id    uuid,
  p_new_owner_id uuid
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from leagues
    where id = p_league_id
      and (
        creator_user_id = p_caller_id
        or exists (
          select 1 from league_members
          where league_id = p_league_id
            and user_id = p_caller_id
            and role = 'owner'
        )
      )
  ) then
    return 'Not authorised';
  end if;

  if not exists (
    select 1 from league_members
    where league_id = p_league_id and user_id = p_new_owner_id
  ) then
    return 'New owner is not a member of this league';
  end if;

  update league_members set role = 'owner'  where league_id = p_league_id and user_id = p_new_owner_id;
  update league_members set role = 'member' where league_id = p_league_id and user_id = p_caller_id;
  update leagues set creator_user_id = p_new_owner_id where id = p_league_id;

  return 'ok';
end;
$$;

grant execute on function public.transfer_league_ownership(uuid, uuid, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════════════════
-- 6. ACCOUNT DELETION RPC — delete_user_account
--    Signature UNCHANGED. Internal owner_id → creator_user_id.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.delete_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_global      uuid := '00000000-0000-0000-0000-000000000001';
  v_league_id   uuid;
  v_new_owner   uuid;
  v_transferred int := 0;
  v_deleted     int := 0;
begin
  if exists (
    select 1 from public.leagues where id = v_global and creator_user_id = p_user_id
  ) then
    raise exception 'Account owns the Global League and cannot be self-deleted';
  end if;

  for v_league_id in
    select id from public.leagues
    where creator_user_id = p_user_id and id <> v_global
  loop
    select lm.user_id
      into v_new_owner
    from public.league_members lm
    where lm.league_id = v_league_id
      and lm.user_id <> p_user_id
    order by lm.joined_at asc, lm.user_id asc
    limit 1;

    if v_new_owner is null then
      delete from public.leagues where id = v_league_id;
      v_deleted := v_deleted + 1;
    else
      update public.leagues
        set creator_user_id = v_new_owner
        where id = v_league_id;
      update public.league_members
        set role = 'owner'
        where league_id = v_league_id and user_id = v_new_owner;
      v_transferred := v_transferred + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'leagues_transferred', v_transferred,
    'leagues_deleted',     v_deleted
  );
end;
$$;

revoke all on function public.delete_user_account(uuid) from public;
revoke all on function public.delete_user_account(uuid) from anon, authenticated;
grant execute on function public.delete_user_account(uuid) to service_role;

-- ════════════════════════════════════════════════════════════════════════════
-- 7. PREDICTION-LOCK TRIGGER — lock_predictions_on_match_status_change
--    Internal: matches→fixtures (trigger now on fixtures), match_id→fixture_id,
--    status 'completed'→'finished'. Recreate the trigger on fixtures explicitly.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.lock_predictions_on_match_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('live', 'finished')
     and (old.status is null or old.status not in ('live', 'finished'))
  then
    update predictions
    set    is_locked = true
    where  fixture_id = new.id
      and  is_locked = false;
  end if;
  return new;
end;
$$;

-- The original trigger (named lock_predictions_on_kickoff) rode along the table
-- rename onto fixtures. Recreate it explicitly so the migration is deterministic.
drop trigger if exists lock_predictions_on_kickoff on public.fixtures;
create trigger lock_predictions_on_kickoff
  after update on public.fixtures
  for each row
  execute function public.lock_predictions_on_match_status_change();

-- ════════════════════════════════════════════════════════════════════════════
-- 8. RLS POLICIES — drop & recreate every policy referencing a renamed object.
--    Spec step 9: "RLS policies on matches — drop and re-create on fixtures."
-- ════════════════════════════════════════════════════════════════════════════

-- ── fixtures (renamed from matches) ─────────────────────────────────────────
drop policy if exists "matches_public_read" on public.fixtures;
drop policy if exists "matches_admin_write" on public.fixtures;
drop policy if exists "matches_admin_update" on public.fixtures;
drop policy if exists "matches_admin_all"   on public.fixtures;

create policy "fixtures_public_read" on public.fixtures
  for select using (true);

create policy "fixtures_admin_all" on public.fixtures
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ── predictions (subqueries referenced matches / match_id / kickoff_at) ──────
drop policy if exists "predictions_own_read"     on public.predictions;
drop policy if exists "predictions_own_insert"   on public.predictions;
drop policy if exists "predictions_own_update"   on public.predictions;
drop policy if exists "predictions_admin_read"   on public.predictions;
drop policy if exists "predictions_admin_update" on public.predictions;

create policy "predictions_own_read" on public.predictions
  for select using (auth.uid() = user_id);

create policy "predictions_own_insert" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.fixtures
      where id = fixture_id
        and kickoff_datetime_utc > now()
        and status = 'scheduled'
    )
  );

create policy "predictions_own_update" on public.predictions
  for update using (
    auth.uid() = user_id
    and is_locked = false
    and exists (
      select 1 from public.fixtures
      where id = fixture_id
        and kickoff_datetime_utc > now()
        and status = 'scheduled'
    )
  );

create policy "predictions_admin_read" on public.predictions
  for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "predictions_admin_update" on public.predictions
  for update to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ── leagues (policies referenced owner_id) ──────────────────────────────────
drop policy if exists "leagues_public_read"   on public.leagues;
drop policy if exists "leagues_read"          on public.leagues;
drop policy if exists "leagues_insert"        on public.leagues;
drop policy if exists "leagues_owner_update"  on public.leagues;
drop policy if exists "leagues_admin_delete"  on public.leagues;

create policy "leagues_read" on public.leagues
  for select using (
    visibility = 'public'
    or creator_user_id = auth.uid()
    or id in (select public.get_user_league_ids(auth.uid()))
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "leagues_insert" on public.leagues
  for insert with check (
    auth.uid() = creator_user_id
    and not exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  );

create policy "leagues_owner_update" on public.leagues
  for update using (
    auth.uid() = creator_user_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "leagues_admin_delete" on public.leagues
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ── league_members (policies referenced leagues.owner_id) ───────────────────
drop policy if exists "league_members_owner_delete" on public.league_members;
drop policy if exists "league_members_owner_update" on public.league_members;

create policy "league_members_owner_delete" on public.league_members
  for delete using (
    user_id = auth.uid()
    or (
      exists (
        select 1 from public.leagues
        where id = league_id and creator_user_id = auth.uid()
      )
      and user_id != auth.uid()
    )
    or (
      exists (
        select 1 from public.profiles
        where id = auth.uid() and is_admin = true
      )
      and role != 'owner'
    )
  );

create policy "league_members_owner_update" on public.league_members
  for update using (
    exists (
      select 1 from public.leagues
      where id = league_id and creator_user_id = auth.uid()
    )
  );

-- NOTE: league_members_read and league_members_insert do NOT reference renamed
-- objects (they use get_user_league_ids / is_league_open_for_joining), so they
-- are intentionally left untouched.

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0002. Next: 0003_verification.sql
-- ════════════════════════════════════════════════════════════════════════════
