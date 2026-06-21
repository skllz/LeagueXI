-- ─────────────────────────────────────────────────────────────────────────────
-- Push notifications — device token storage + registration.
-- Run in the Supabase SQL Editor. Idempotent.
--
-- The native app obtains an Expo push token and registers it via
-- register_device_token(). The web/backend send path (src/lib/push.ts) reads
-- these tokens with the service role and POSTs to Expo's push API.
-- Dormant until the native app starts registering tokens.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.device_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token      text not null unique,
  platform   text check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists device_tokens_user_idx on public.device_tokens(user_id);

alter table public.device_tokens enable row level security;

-- Own-row access only. The service role (send path) bypasses RLS.
drop policy if exists device_tokens_select on public.device_tokens;
drop policy if exists device_tokens_insert on public.device_tokens;
drop policy if exists device_tokens_update on public.device_tokens;
drop policy if exists device_tokens_delete on public.device_tokens;
create policy device_tokens_select on public.device_tokens for select using (user_id = auth.uid());
create policy device_tokens_insert on public.device_tokens for insert with check (user_id = auth.uid());
create policy device_tokens_update on public.device_tokens for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy device_tokens_delete on public.device_tokens for delete using (user_id = auth.uid());

drop trigger if exists device_tokens_updated_at on public.device_tokens;
create trigger device_tokens_updated_at
  before update on public.device_tokens
  for each row execute function public.handle_updated_at();

-- Registration: upserts the caller's token. SECURITY DEFINER so it can reclaim a
-- token previously registered to a DIFFERENT user (same physical device, new
-- login) — RLS would otherwise block touching that other user's row.
create or replace function public.register_device_token(
  p_token    text,
  p_platform text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Reclaim the token if it was registered to someone else (device handed over).
  delete from public.device_tokens
    where token = p_token and user_id <> auth.uid();

  insert into public.device_tokens (user_id, token, platform)
  values (auth.uid(), p_token, p_platform)
  on conflict (token) do update
    set user_id    = excluded.user_id,
        platform   = excluded.platform,
        updated_at = now();
end;
$$;

grant execute on function public.register_device_token(text, text) to authenticated;
