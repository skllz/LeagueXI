-- ─────────────────────────────────────────────────────────────────────────────
-- Self-serve account deletion — transactional league PRE-WORK.
-- Run in the Supabase SQL Editor. Idempotent (CREATE OR REPLACE).
--
-- Why this exists: leagues.owner_id, predictions.user_id, league_members.user_id
-- and profiles.id are all ON DELETE CASCADE. So deleting the auth.users row would
-- cascade-delete every league the user OWNS — including ones with other members.
-- This function reassigns/cleans up owned leagues FIRST, so the cascade can't
-- wipe other people's leagues.
--
-- The actual auth.users deletion is done by the /api/account/delete route via the
-- Auth admin API (service role) AFTER this runs. This function only does the
-- public-schema pre-work and is granted to service_role ONLY (never to users).
--
-- Auto-handle rules:
--   • Owned league with other members  → transfer to the oldest remaining member
--     (joined_at ASC, then user_id ASC as a deterministic tie-break).
--   • Owned league where user is sole member → delete the empty league.
--   • Global League (00000000-…-0001) → never transfer/delete; if the caller
--     OWNS it (the admin), refuse — its cascade would wipe everyone's standings.
--   • predictions / league_members / profile are cleaned up by ON DELETE CASCADE
--     when the route deletes the auth.users row.
-- ─────────────────────────────────────────────────────────────────────────────

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
  -- Never allow self-deletion of the account that owns the Global League.
  if exists (
    select 1 from public.leagues where id = v_global and owner_id = p_user_id
  ) then
    raise exception 'Account owns the Global League and cannot be self-deleted';
  end if;

  for v_league_id in
    select id from public.leagues
    where owner_id = p_user_id and id <> v_global
  loop
    select lm.user_id
      into v_new_owner
    from public.league_members lm
    where lm.league_id = v_league_id
      and lm.user_id <> p_user_id
    order by lm.joined_at asc, lm.user_id asc
    limit 1;

    if v_new_owner is null then
      -- Sole member: drop the empty league (its membership rows cascade).
      delete from public.leagues where id = v_league_id;
      v_deleted := v_deleted + 1;
    else
      -- Transfer ownership to the oldest remaining member.
      update public.leagues
        set owner_id = v_new_owner
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

-- Lock it down: only the service-role API route may call this.
revoke all on function public.delete_user_account(uuid) from public;
revoke all on function public.delete_user_account(uuid) from anon, authenticated;
grant execute on function public.delete_user_account(uuid) to service_role;
