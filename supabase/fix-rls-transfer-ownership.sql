-- Fix: league_members has no UPDATE policy, so transferOwnership silently fails.
-- The owner must be able to update the role column for members within their own league.
-- Run this once in the Supabase SQL Editor.

create policy "league_members_owner_update" on public.league_members
  for update using (
    exists (
      select 1 from public.leagues
      where id = league_id and owner_id = auth.uid()
    )
  );
