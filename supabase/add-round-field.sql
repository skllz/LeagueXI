-- Add round field to matches
-- Run in Supabase SQL Editor before re-running fetch-fixtures.mjs

alter table public.matches
  add column if not exists round text;

create index if not exists matches_round_idx on public.matches(round);
