-- ============================================================
-- HND App: profile authorization hardening
-- ============================================================

-- Users must not be able to modify their own role,
-- active status, email, or department assignment directly.

drop policy if exists
  "Users can update safe profile fields"
  on public.profiles;

drop policy if exists
  "Authenticated users can update their profile"
  on public.profiles;

revoke update
on table public.profiles
from authenticated;

-- ------------------------------------------------------------
-- Role-check helper
-- ------------------------------------------------------------

create or replace function public.current_user_has_role(
  allowed_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_active = true
      and role = any(allowed_roles)
  );
$$;

revoke all
on function public.current_user_has_role(public.app_role[])
from public;

grant execute
on function public.current_user_has_role(public.app_role[])
to authenticated;

-- ------------------------------------------------------------
-- Safe profile-name update function
-- ------------------------------------------------------------

create or replace function public.update_my_profile_name(
  new_full_name text
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_profile public.profiles;
  normalized_name text;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  normalized_name := trim(new_full_name);

  if char_length(normalized_name) < 2 then
    raise exception 'Full name must contain at least 2 characters';
  end if;

  update public.profiles
  set full_name = normalized_name
  where id = (select auth.uid())
    and is_active = true
  returning *
  into updated_profile;

  if updated_profile.id is null then
    raise exception 'Active profile not found';
  end if;

  return updated_profile;
end;
$$;

revoke all
on function public.update_my_profile_name(text)
from public;

grant execute
on function public.update_my_profile_name(text)
to authenticated;