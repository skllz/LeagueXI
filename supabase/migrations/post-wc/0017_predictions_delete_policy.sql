-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Migration 0017: predictions own-delete RLS policy
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Staging-QA fix (FAIL-1 — "× Remove" doesn't persist). `predictions` has
-- SELECT/INSERT/UPDATE RLS policies (0002) but NO DELETE policy. With RLS
-- enabled, a DELETE matching zero *permitted* rows succeeds with 0 rows affected
-- and NO error, so removing a prediction silently no-ops: the server action
-- returns success, the UI clears optimistically, and the row reappears on reload.
--
-- This adds `predictions_own_delete`, gated to MIRROR `predictions_own_update`
-- (0002:513) EXACTLY — a user may delete their own prediction only while the
-- fixture is unlocked and still pre-kickoff/scheduled, i.e. the same window in
-- which edits are allowed. Admin and service_role (seed/scoring) bypass RLS and
-- are unaffected.
-- ════════════════════════════════════════════════════════════════════════════

begin;

drop policy if exists "predictions_own_delete" on public.predictions;

create policy "predictions_own_delete" on public.predictions
  for delete using (
    auth.uid() = user_id
    and is_locked = false
    and exists (
      select 1 from public.fixtures
      where id = fixture_id
        and kickoff_datetime_utc > now()
        and status = 'scheduled'
    )
  );

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0017.
-- ════════════════════════════════════════════════════════════════════════════
