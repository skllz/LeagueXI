-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 8 Migration 0016: prediction-locking reminder dedup
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 8 — the fixture owns its reminder-delivery state. The locking-reminders
-- cron sends `prediction_locking_soon` exactly once per fixture:
--   • kickoff within the 2h pre-kickoff window
--   • locking_reminder_sent_at IS NULL
--   → send, then set locking_reminder_sent_at = now()  (idempotency mechanism)
-- ════════════════════════════════════════════════════════════════════════════

begin;

alter table public.fixtures
  add column if not exists locking_reminder_sent_at timestamptz;

-- Partial index over fixtures still awaiting a reminder (cheap cron lookup).
create index if not exists fixtures_locking_reminder_pending_idx
  on public.fixtures (kickoff_datetime_utc)
  where locking_reminder_sent_at is null;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0016.
-- ════════════════════════════════════════════════════════════════════════════
