-- Fix: infinite recursion between leagues and league_members RLS policies
-- The issue: leagues policy checks league_members, league_members policy checks leagues
-- Fix: use a security definer function that bypasses RLS to break the cycle

-- Helper function (security definer = bypasses RLS when called from a policy)
create or replace function public.get_user_league_ids(p_user_id uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select league_id from public.league_members where user_id = p_user_id;
$$;

grant execute on function public.get_user_league_ids(uuid) to authenticated, anon;

-- Drop old policies
drop policy if exists "leagues_public_read" on public.leagues;
drop policy if exists "league_members_read" on public.league_members;

-- Leagues: visible if public, owner, member, or admin
create policy "leagues_read" on public.leagues
  for select using (
    visibility = 'public'
    or owner_id = auth.uid()
    or id in (select public.get_user_league_ids(auth.uid()))
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- League members: visible if you share the league, admin, or the league is public
-- (public leagues need member visibility so non-members can see the Members tab)
create policy "league_members_read" on public.league_members
  for select using (
    league_id in (select public.get_user_league_ids(auth.uid()))
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
    or exists (select 1 from public.leagues where id = league_id and visibility = 'public')
  );
