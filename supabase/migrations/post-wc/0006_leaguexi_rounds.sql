-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0006: leaguexi_rounds + generation fn
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 12. Run AFTER 0004 (seasons) and 0005 (contexts).
--
-- A LeagueXI Round runs Thursday 00:00 UTC → Wednesday 23:59 UTC (spec §6).
-- round_number resets to 1 at the start of each season (spec §28.12).
--
-- ASSUMPTION TO CONFIRM (not specified precisely by the spec): Round 1 of a
-- season is anchored to the FIRST Thursday on or after the season's start_date.
-- For 2026-27 (start 2026-08-01, a Saturday) that is Thursday 2026-08-06. This
-- is a single, easily-changed line in generate_leaguexi_rounds(); flagged for
-- confirmation. Fixtures before that Thursday fall in the summer gap (§9).
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.leaguexi_rounds (
  id                    uuid primary key default gen_random_uuid(),
  round_number          integer not null,
  season_id             uuid not null references public.seasons(id),
  prediction_context_id uuid not null references public.prediction_contexts(id),
  start_datetime        timestamptz not null,   -- Thursday 00:00 UTC
  end_datetime          timestamptz not null,   -- Wednesday 23:59:59 UTC
  status                text not null default 'draft'
                        check (status in (
                          'draft', 'open', 'in_progress',
                          'pending_finalization', 'finalized', 'empty', 'cancelled'
                        )),
  finalized_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  -- round_number is unique within a season+context (resets per season).
  unique (season_id, prediction_context_id, round_number)
);

create index if not exists leaguexi_rounds_context_idx on public.leaguexi_rounds(prediction_context_id);
create index if not exists leaguexi_rounds_season_idx  on public.leaguexi_rounds(season_id);
create index if not exists leaguexi_rounds_status_idx  on public.leaguexi_rounds(status);
create index if not exists leaguexi_rounds_window_idx  on public.leaguexi_rounds(start_datetime, end_datetime);

drop trigger if exists leaguexi_rounds_updated_at on public.leaguexi_rounds;
create trigger leaguexi_rounds_updated_at before update on public.leaguexi_rounds
  for each row execute function public.handle_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Public read is broad here; the app layer hides draft/empty/cancelled rounds
-- from users (spec §8). Admin write covers manual round management (Phase 7).
alter table public.leaguexi_rounds enable row level security;

drop policy if exists "leaguexi_rounds_public_read" on public.leaguexi_rounds;
create policy "leaguexi_rounds_public_read" on public.leaguexi_rounds
  for select using (true);

drop policy if exists "leaguexi_rounds_admin_write" on public.leaguexi_rounds;
create policy "leaguexi_rounds_admin_write" on public.leaguexi_rounds
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ════════════════════════════════════════════════════════════════════════════
-- generate_leaguexi_rounds(p_context_id uuid) → integer (count of rounds created)
--
-- Idempotent: only creates rounds that do not yet exist, extending coverage to
-- ~4 weeks (28 days) ahead of now(). SECURITY DEFINER + service_role-only grant —
-- invoked by the Phase 4 cron and the Phase 7 admin trigger server-side, never
-- by end users. Does nothing if the context has no season_id.
-- ════════════════════════════════════════════════════════════════════════════
create or replace function public.generate_leaguexi_rounds(p_context_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_season_id   uuid;
  v_start_date  date;
  v_end_date    date;
  v_anchor_date date;
  v_num         integer;
  v_max_end     timestamptz;
  v_start       timestamptz;
  v_end         timestamptz;
  v_horizon     timestamptz := now() + interval '28 days';
  v_created     integer := 0;
begin
  -- Resolve the context's season.
  select pc.season_id into v_season_id
  from public.prediction_contexts pc
  where pc.id = p_context_id;

  if v_season_id is null then
    return 0;   -- non-seasonal context (e.g. a tournament) — no auto rounds
  end if;

  select s.start_date, s.end_date into v_start_date, v_end_date
  from public.seasons s where s.id = v_season_id;

  -- Existing progress for this season+context.
  select coalesce(max(round_number), 0), max(end_datetime)
  into v_num, v_max_end
  from public.leaguexi_rounds
  where season_id = v_season_id and prediction_context_id = p_context_id;

  if v_max_end is null then
    -- First Thursday on or after the season start (ISODOW: Thu = 4).
    v_anchor_date := v_start_date + ((4 - extract(isodow from v_start_date)::int + 7) % 7);
    v_start := (v_anchor_date::timestamp) at time zone 'UTC';
  else
    -- Next window starts immediately after the last one (= next Thu 00:00 UTC).
    v_start := v_max_end + interval '1 second';
  end if;

  -- Create successive Thu→Wed windows until we cover the horizon or run past the
  -- season end.
  while v_start <= v_horizon and v_start::date <= v_end_date loop
    v_end := v_start + interval '7 days' - interval '1 second';   -- Wed 23:59:59 UTC
    v_num := v_num + 1;

    insert into public.leaguexi_rounds (
      round_number, season_id, prediction_context_id,
      start_datetime, end_datetime, status
    )
    values (v_num, v_season_id, p_context_id, v_start, v_end, 'draft')
    on conflict (season_id, prediction_context_id, round_number) do nothing;

    v_created := v_created + 1;
    v_start := v_start + interval '7 days';
  end loop;

  return v_created;
end;
$$;

revoke all on function public.generate_leaguexi_rounds(uuid) from public;
revoke all on function public.generate_leaguexi_rounds(uuid) from anon, authenticated;
grant execute on function public.generate_leaguexi_rounds(uuid) to service_role;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0006. Next: 0007_fixtures_fk_constraints.sql
-- ════════════════════════════════════════════════════════════════════════════
