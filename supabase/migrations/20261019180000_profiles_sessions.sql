-- Orderlo: profiles + multi-device sessions (Supabase Auth + Postgres)
-- Identity: HK phone stored as phone_e164; Auth email alias = 852XXXXXXXX@orderlo.local
-- Apply in Supabase SQL Editor or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone_e164 text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'enabled', 'disabled')),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists profiles_status_idx on public.profiles (status);

-- ---------------------------------------------------------------------------
-- Device sessions (app-managed; revoke without wiping Auth user)
-- ---------------------------------------------------------------------------
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_agent text,
  label text,
  revoked_at timestamptz
);

create index if not exists sessions_user_id_idx on public.sessions (user_id);
create index if not exists sessions_active_idx
  on public.sessions (user_id)
  where revoked_at is null;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Auto-create profile from auth.users metadata on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  phone text := coalesce(new.raw_user_meta_data->>'phone_e164', '');
  meta_status text := coalesce(new.raw_user_meta_data->>'status', 'pending');
  admin_phone constant text := '+85266169905';
begin
  if phone = '' then
    -- Derive from email alias 852XXXXXXXX@orderlo.local
    if new.email ~ '^[0-9]{11}@orderlo\.local$' then
      phone := '+' || split_part(new.email, '@', 1);
    end if;
  end if;

  if phone = '' then
    raise exception 'phone_e164 required for Orderlo users';
  end if;

  if meta_status not in ('pending', 'enabled', 'disabled') then
    meta_status := 'pending';
  end if;

  if phone = admin_phone then
    meta_status := 'enabled';
  end if;

  insert into public.profiles (id, phone_e164, status, is_admin)
  values (
    new.id,
    phone,
    meta_status,
    phone = admin_phone
  )
  on conflict (id) do update
    set phone_e164 = excluded.phone_e164,
        is_admin = excluded.is_admin,
        status = case
          when excluded.phone_e164 = admin_phone then 'enabled'
          else public.profiles.status
        end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  to authenticated
  using (id = auth.uid() or public.is_admin());

-- Fallback if the auth trigger did not run (client may insert own row once).
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (
    id = auth.uid()
    and is_admin = (phone_e164 = '+85266169905')
    and (
      phone_e164 = '+85266169905' and status = 'enabled'
      or phone_e164 <> '+85266169905'
    )
  );

drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "sessions_select_own_or_admin" on public.sessions;
create policy "sessions_select_own_or_admin"
  on public.sessions for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own"
  on public.sessions for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "sessions_update_own_heartbeat" on public.sessions;
create policy "sessions_update_own_heartbeat"
  on public.sessions for update
  to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

drop policy if exists "sessions_delete_admin" on public.sessions;
create policy "sessions_delete_admin"
  on public.sessions for delete
  to authenticated
  using (public.is_admin());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.sessions to authenticated;
