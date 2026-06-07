-- ─────────────────────────────────────────────────────────────────
-- RLS FIXES — run in Supabase SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- FIX 1 & 2: Leagues SELECT policy
-- The previous policy only allowed SELECT for public leagues, owners,
-- and members. This means non-members could not look up a private
-- league by invite_code (Bug 1) or by slug (Bug 2 — causes 404).
-- Fix: allow any authenticated user to SELECT any league record.
-- Visibility/access is enforced in application code, not RLS.

drop policy if exists "leagues_read"        on public.leagues;
drop policy if exists "leagues_public_read" on public.leagues;
drop policy if exists "leagues_select"      on public.leagues;
drop policy if exists "leagues_select_anon" on public.leagues;

-- Authenticated users can read any league (app code enforces visibility)
create policy "leagues_select" on public.leagues
  for select to authenticated
  using (true);

-- Anon users can read public leagues only
create policy "leagues_select_anon" on public.leagues
  for select to anon
  using (visibility = 'public');


-- FIX 3: Predictions DELETE policy
-- The schema had no DELETE policy on predictions, so .delete() queries
-- were silently blocked by RLS — returning success but deleting nothing.

drop policy if exists "predictions_own_delete" on public.predictions;

create policy "predictions_own_delete" on public.predictions
  for delete to authenticated
  using (auth.uid() = user_id);
