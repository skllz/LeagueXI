-- ════════════════════════════════════════════════════════════════════════════
-- LeagueXI Post-WC — Phase 2 Migration 0004: seasons
-- ════════════════════════════════════════════════════════════════════════════
-- STATUS: WRITTEN — NOT EXECUTED. Do not run against the live database.
-- Phase 2 build-order step 11.
--
-- Seasons run August 1 → July 31 (spec §13). First season: 2026-27.
-- Seeded status is 'active' because these migrations execute on cutover day
-- (early August 2026, per §27A) — by which point 2026-27 is the live season.
-- ════════════════════════════════════════════════════════════════════════════

begin;

create table if not exists public.seasons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,                 -- e.g. 2026-27
  start_date  date not null,                 -- August 1
  end_date    date not null,                 -- July 31
  status      text not null default 'upcoming'
              check (status in ('upcoming', 'active', 'completed', 'archived')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (name)
);

create index if not exists seasons_status_idx on public.seasons(status);

drop trigger if exists seasons_updated_at on public.seasons;
create trigger seasons_updated_at before update on public.seasons
  for each row execute function public.handle_updated_at();

-- ── RLS: public read, admin write ───────────────────────────────────────────
alter table public.seasons enable row level security;

drop policy if exists "seasons_public_read" on public.seasons;
create policy "seasons_public_read" on public.seasons
  for select using (true);

drop policy if exists "seasons_admin_write" on public.seasons;
create policy "seasons_admin_write" on public.seasons
  for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- ── Seed: 2026-27 ────────────────────────────────────────────────────────────
insert into public.seasons (name, start_date, end_date, status)
values ('2026-27', '2026-08-01', '2027-07-31', 'active')
on conflict (name) do nothing;

commit;

-- ════════════════════════════════════════════════════════════════════════════
-- END 0004. Next: 0005_prediction_contexts.sql
-- ════════════════════════════════════════════════════════════════════════════
