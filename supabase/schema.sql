-- LeagueXI Database Schema
-- Run this in the Supabase SQL Editor

-- ─────────────────────────────────────────
-- EXTENSIONS
-- ─────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Constraint: username format
alter table public.profiles
  add constraint username_format
  check (username ~ '^[a-z0-9_]{3,20}$');

-- ─────────────────────────────────────────
-- COMPETITIONS
-- ─────────────────────────────────────────
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  season text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default false
);

-- ─────────────────────────────────────────
-- TEAMS
-- ─────────────────────────────────────────
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text not null,
  country text not null,
  logo_url text
);

-- ─────────────────────────────────────────
-- MATCHES
-- ─────────────────────────────────────────
do $$ begin
  create type match_status as enum (
    'scheduled', 'live', 'completed', 'postponed', 'cancelled'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  kickoff_at timestamptz not null,
  status match_status not null default 'scheduled',
  home_score integer,
  away_score integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- PREDICTIONS
-- ─────────────────────────────────────────
create table if not exists public.predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  predicted_home_score integer not null check (predicted_home_score >= 0),
  predicted_away_score integer not null check (predicted_away_score >= 0),
  points integer,
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, match_id)
);

-- ─────────────────────────────────────────
-- LEAGUES
-- ─────────────────────────────────────────
create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references public.competitions(id),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  slug text unique not null,
  invite_code char(6) unique not null,
  description text,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  logo_url text,
  prize_description text check (char_length(prize_description) <= 500),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- LEAGUE MEMBERS
-- ─────────────────────────────────────────
create table if not exists public.league_members (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

-- ─────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────
create index if not exists predictions_user_id_idx on public.predictions(user_id);
create index if not exists predictions_match_id_idx on public.predictions(match_id);
create index if not exists league_members_user_id_idx on public.league_members(user_id);
create index if not exists league_members_league_id_idx on public.league_members(league_id);
create index if not exists matches_kickoff_at_idx on public.matches(kickoff_at);
create index if not exists matches_status_idx on public.matches(status);

-- ─────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ─────────────────────────────────────────
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();

create trigger matches_updated_at before update on public.matches
  for each row execute function public.handle_updated_at();

create trigger predictions_updated_at before update on public.predictions
  for each row execute function public.handle_updated_at();

create trigger leagues_updated_at before update on public.leagues
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────
-- AUTO-JOIN GLOBAL LEAGUE ON PROFILE CREATION
-- Runs after username is set (profile upsert)
-- ─────────────────────────────────────────
create or replace function public.handle_profile_username_set()
returns trigger as $$
declare
  global_league_id uuid;
begin
  -- Only trigger when username transitions from null to a value
  if old.username is null and new.username is not null then
    -- Get the global league (slug = 'global')
    select id into global_league_id
    from public.leagues
    where slug = 'global'
    limit 1;

    if global_league_id is not null then
      insert into public.league_members (league_id, user_id, role)
      values (global_league_id, new.id, 'member')
      on conflict (league_id, user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_profile_username_set
  after update on public.profiles
  for each row execute function public.handle_profile_username_set();

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.competitions enable row level security;
alter table public.teams enable row level security;
alter table public.matches enable row level security;
alter table public.predictions enable row level security;
alter table public.leagues enable row level security;
alter table public.league_members enable row level security;

-- profiles: public read (username/display_name/avatar only), own write
create policy "profiles_public_read" on public.profiles
  for select using (true);

create policy "profiles_own_update" on public.profiles
  for update using (auth.uid() = id);

create policy "profiles_own_insert" on public.profiles
  for insert with check (auth.uid() = id);

-- competitions: public read, admin write
create policy "competitions_public_read" on public.competitions
  for select using (true);

create policy "competitions_admin_write" on public.competitions
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- teams: public read, admin write
create policy "teams_public_read" on public.teams
  for select using (true);

create policy "teams_admin_write" on public.teams
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- matches: public read, admin write
create policy "matches_public_read" on public.matches
  for select using (true);

create policy "matches_admin_write" on public.matches
  for all using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- predictions: own read/write, lock enforced
create policy "predictions_own_read" on public.predictions
  for select using (auth.uid() = user_id);

create policy "predictions_own_insert" on public.predictions
  for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.matches
      where id = match_id
      and kickoff_at > now()
      and status = 'scheduled'
    )
  );

create policy "predictions_own_update" on public.predictions
  for update using (
    auth.uid() = user_id
    and is_locked = false
    and exists (
      select 1 from public.matches
      where id = match_id
      and kickoff_at > now()
      and status = 'scheduled'
    )
  );

-- Admin can read all predictions (for scoring)
create policy "predictions_admin_read" on public.predictions
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Admin can update predictions (for scoring/recalculation)
create policy "predictions_admin_update" on public.predictions
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- leagues: public leagues readable by all; private only by members/admin
create policy "leagues_public_read" on public.leagues
  for select using (
    visibility = 'public'
    or owner_id = auth.uid()
    or exists (
      select 1 from public.league_members
      where league_id = id and user_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles
      where id = auth.uid() and is_admin = true
    )
  );

create policy "leagues_insert" on public.leagues
  for insert with check (
    auth.uid() = owner_id
    and not exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  );

create policy "leagues_owner_update" on public.leagues
  for update using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  );

create policy "leagues_admin_delete" on public.leagues
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- league_members: visible to members of the league, public leagues visible to all
create policy "league_members_read" on public.league_members
  for select using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id
      and (
        l.visibility = 'public'
        or l.owner_id = auth.uid()
        or exists (
          select 1 from public.league_members lm2
          where lm2.league_id = l.id and lm2.user_id = auth.uid()
        )
        or exists (
          select 1 from public.profiles where id = auth.uid() and is_admin = true
        )
      )
    )
  );

create policy "league_members_insert" on public.league_members
  for insert with check (
    auth.uid() = user_id
    and not exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  );

create policy "league_members_owner_delete" on public.league_members
  for delete using (
    user_id = auth.uid()
    or exists (
      select 1 from public.leagues
      where id = league_id and owner_id = auth.uid()
    )
    or exists (
      select 1 from public.profiles where id = auth.uid() and is_admin = true
    )
  );
