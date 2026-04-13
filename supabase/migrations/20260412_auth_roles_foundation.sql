-- 20260412_auth_roles_foundation.sql

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_user_id uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.businesses enable row level security;

alter table public.profiles
  add column if not exists role text not null default 'owner' check (role in ('owner', 'employee')),
  add column if not exists business_id uuid references public.businesses(id) on delete cascade,
  add column if not exists is_active boolean not null default true,
  add column if not exists business_name text;

create unique index if not exists profiles_user_id_key on public.profiles(user_id);
create unique index if not exists profiles_phone_key on public.profiles(phone);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "businesses_select_member" on public.businesses;
create policy "businesses_select_member"
on public.businesses
for select
to authenticated
using (
  owner_user_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.business_id = businesses.id
  )
);

drop policy if exists "businesses_insert_owner" on public.businesses;
create policy "businesses_insert_owner"
on public.businesses
for insert
to authenticated
with check (owner_user_id = auth.uid());

drop policy if exists "businesses_update_owner" on public.businesses;
create policy "businesses_update_owner"
on public.businesses
for update
to authenticated
using (owner_user_id = auth.uid())
with check (owner_user_id = auth.uid());