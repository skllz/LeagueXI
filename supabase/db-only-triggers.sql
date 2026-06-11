-- ============================================================================
-- DB-ONLY TRIGGERS — REFERENCE COPY. ALREADY LIVE IN THE DATABASE. DO NOT RUN.
-- ============================================================================
-- These two trigger functions were created directly in the Supabase dashboard
-- and were never committed to a SQL file, which made them invisible to
-- file-based audits (the 2026-06-10 handover audit wrongly listed global-league
-- auto-join as a missing feature because of this).
--
-- Dumped from the live database on 2026-06-10 via pg_get_functiondef /
-- pg_get_triggerdef. This file exists purely so the repo reflects reality.
--
-- What they do:
--   1. on_auth_user_created (auth.users AFTER INSERT)
--      -> handle_new_user(): creates the profiles row for every new signup.
--   2. on_profile_username_set (public.profiles AFTER UPDATE)
--      -> handle_profile_username_set(): when username transitions from null
--         to a value (onboarding complete), auto-joins the user to the global
--         league (slug = 'global') as a member.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
begin
  insert into public.profiles (id, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_profile_username_set()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  global_league_id uuid;
begin
  -- Only trigger when username transitions from null to a value
  if old.username is null and new.username is not null then
    -- Get the global league (slug = 'global')
    select id into global_league_id
    from public.leagues
    where slug = 'global'
    limit 1;

    if global_league_id is not null then
      insert into public.league_members (league_id, user_id, role)
      values (global_league_id, new.id, 'member')
      on conflict (league_id, user_id) do nothing;
    end if;
  end if;
  return new;
end;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE TRIGGER on_profile_username_set AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION handle_profile_username_set();
