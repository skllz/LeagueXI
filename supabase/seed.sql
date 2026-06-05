-- ─────────────────────────────────────────
-- SEED PART 1: Run this now (before any user signs in)
-- ─────────────────────────────────────────

insert into public.competitions (name, slug, season, starts_at, ends_at, is_active)
values (
  'FIFA World Cup 2026',
  'world-cup-2026',
  '2026',
  '2026-06-11T00:00:00Z',
  '2026-07-19T23:59:59Z',
  true
)
on conflict (slug) do nothing;


-- ─────────────────────────────────────────
-- SEED PART 2: Run this AFTER laniquadri@gmail.com has signed in at least once
-- (signing in creates the profile row, which is required for the foreign key)
-- ─────────────────────────────────────────

-- Step 1: Grant admin
-- update public.profiles
-- set is_admin = true
-- where id = (select id from auth.users where email = 'laniquadri@gmail.com');

-- Step 2: Create the global league (owned by the admin)
-- insert into public.leagues (
--   id, competition_id, owner_id, name, slug, invite_code,
--   description, visibility, is_archived
-- )
-- values (
--   '00000000-0000-0000-0000-000000000001',
--   (select id from public.competitions where slug = 'world-cup-2026'),
--   (select id from auth.users where email = 'laniquadri@gmail.com'),
--   'Global League',
--   'global',
--   'GLOBAL',
--   'The official LeagueXI global leaderboard. Every player is automatically entered.',
--   'public',
--   false
-- )
-- on conflict (slug) do nothing;
