-- ============================================================
-- HND App authentication foundation
-- ============================================================

create extension if not exists "pgcrypto";

do $$
begin
  create type public.app_role as enum (
    'system_admin',
    'hod'
  );
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.profiles (
  id uuid primary key
    references auth.users(id)
    on delete cascade,

  full_name text not null,
  email text not null,
  role public.app_role not null default 'hod',

  department_name text not null
    default 'Human Nutrition and Dietetics',

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint profiles_full_name_length_check
    check (char_length(trim(full_name)) >= 2),

  constraint profiles_email_length_check
    check (char_length(trim(email)) >= 3)
);

create unique index if not exists profiles_email_unique_idx
  on public.profiles (lower(email));

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists profiles_is_active_idx
  on public.profiles (is_active);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at
  on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    role
  )
  values (
    new.id,

    coalesce(
      nullif(
        trim(new.raw_user_meta_data ->> 'full_name'),
        ''
      ),
      split_part(coalesce(new.email, ''), '@', 1)
    ),

    coalesce(new.email, ''),

    'hod'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created
  on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_auth_user();

alter table public.profiles
enable row level security;

drop policy if exists
  "Users can read their own profile"
  on public.profiles;

create policy
  "Users can read their own profile"
on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
);

drop policy if exists
  "Users can update safe profile fields"
  on public.profiles;

create policy
  "Users can update safe profile fields"
on public.profiles
for update
to authenticated
using (
  id = (select auth.uid())
)
with check (
  id = (select auth.uid())
);

revoke all
on table public.profiles
from anon;

grant select, update
on table public.profiles
to authenticated;