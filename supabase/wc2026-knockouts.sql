-- Adds TBD placeholder matches for all knockout rounds.
-- Run after fetch-fixtures.mjs has seeded the group stage.

INSERT INTO public.teams (id, name, short_name, country) VALUES
  ('00000000-0000-0000-0000-000000000000', 'TBD', 'TBD', 'TBD')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.matches (competition_id, home_team_id, away_team_id, kickoff_at, round)
SELECT
  (SELECT id FROM public.competitions WHERE slug = 'world-cup-2026'),
  '00000000-0000-0000-0000-000000000000'::uuid,
  '00000000-0000-0000-0000-000000000000'::uuid,
  ko::timestamptz,
  rnd
FROM (VALUES
  -- Round of 32 (16 matches, Jun 29 – Jul 3)
  ('2026-06-29T17:00:00Z', 'Round of 32'),
  ('2026-06-29T21:00:00Z', 'Round of 32'),
  ('2026-06-30T17:00:00Z', 'Round of 32'),
  ('2026-06-30T21:00:00Z', 'Round of 32'),
  ('2026-07-01T17:00:00Z', 'Round of 32'),
  ('2026-07-01T21:00:00Z', 'Round of 32'),
  ('2026-07-02T17:00:00Z', 'Round of 32'),
  ('2026-07-02T21:00:00Z', 'Round of 32'),
  ('2026-07-03T17:00:00Z', 'Round of 32'),
  ('2026-07-03T21:00:00Z', 'Round of 32'),
  ('2026-07-04T01:00:00Z', 'Round of 32'),
  ('2026-07-04T05:00:00Z', 'Round of 32'),
  ('2026-07-05T01:00:00Z', 'Round of 32'),
  ('2026-07-05T05:00:00Z', 'Round of 32'),
  ('2026-07-05T17:00:00Z', 'Round of 32'),
  ('2026-07-05T21:00:00Z', 'Round of 32'),
  -- Round of 16 (8 matches, Jul 6–9)
  ('2026-07-06T17:00:00Z', 'Round of 16'),
  ('2026-07-06T21:00:00Z', 'Round of 16'),
  ('2026-07-07T17:00:00Z', 'Round of 16'),
  ('2026-07-07T21:00:00Z', 'Round of 16'),
  ('2026-07-08T17:00:00Z', 'Round of 16'),
  ('2026-07-08T21:00:00Z', 'Round of 16'),
  ('2026-07-09T17:00:00Z', 'Round of 16'),
  ('2026-07-09T21:00:00Z', 'Round of 16'),
  -- Quarter-finals (4 matches, Jul 10–11)
  ('2026-07-10T17:00:00Z', 'Quarter-finals'),
  ('2026-07-10T21:00:00Z', 'Quarter-finals'),
  ('2026-07-11T17:00:00Z', 'Quarter-finals'),
  ('2026-07-11T21:00:00Z', 'Quarter-finals'),
  -- Semi-finals (2 matches, Jul 14–15)
  ('2026-07-14T21:00:00Z', 'Semi-finals'),
  ('2026-07-15T21:00:00Z', 'Semi-finals'),
  -- Final (Jul 19)
  ('2026-07-19T20:00:00Z', 'Final')
) AS t(ko, rnd);
