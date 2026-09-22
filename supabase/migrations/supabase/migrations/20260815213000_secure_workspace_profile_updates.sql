-- Update workspace membership and active-workspace profile fields through
-- narrowly scoped security-definer functions. Direct profile updates remain
-- revoked from authenticated clients.

create or replace function public.assign_workspace_access(
  p_profile_id uuid,
  p_department_id uuid,
  p_membership_role public.department_membership_role,
  p_is_primary boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_name text;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if not public.current_user_has_role(
    array['system_admin']::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only a system administrator can assign workspace access';
  end if;

  select department.name
  into workspace_name
  from public.departments department
  where department.id = p_department_id
    and department.is_active = true;

  if workspace_name is null then
    raise exception using
      errcode = '22023',
      message = 'Select an active school / department workspace';
  end if;

  if not exists (
    select 1
    from public.profiles profile
    where profile.id = p_profile_id
      and profile.is_active = true
  ) then
    raise exception using
      errcode = '22023',
      message = 'Select an active user';
  end if;

  if p_is_primary then
    update public.department_memberships
    set is_primary = false
    where profile_id = p_profile_id
      and is_primary = true;
  end if;

  insert into public.department_memberships (
    profile_id,
    department_id,
    membership_role,
    is_primary,
    is_active,
    created_by
  )
  values (
    p_profile_id,
    p_department_id,
    p_membership_role,
    p_is_primary,
    true,
    auth.uid()
  )
  on conflict (profile_id, department_id)
  do update set
    membership_role = excluded.membership_role,
    is_primary = case
      when excluded.is_primary then true
      else public.department_memberships.is_primary
    end,
    is_active = true;

  if p_is_primary then
    update public.profiles
    set
      active_department_id = p_department_id,
      department_name = workspace_name
    where id = p_profile_id;
  end if;
end;
$$;

revoke all
on function public.assign_workspace_access(
  uuid,
  uuid,
  public.department_membership_role,
  boolean
)
from public;

grant execute
on function public.assign_workspace_access(
  uuid,
  uuid,
  public.department_membership_role,
  boolean
)
to authenticated;

create or replace function public.set_active_workspace(
  p_department_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  workspace_name text;
begin
  if (select auth.uid()) is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  select department.name
  into workspace_name
  from public.departments department
  where department.id = p_department_id
    and department.is_active = true
    and (
      public.current_user_has_role(
        array['system_admin']::public.app_role[]
      )
      or exists (
        select 1
        from public.department_memberships membership
        where membership.profile_id = (select auth.uid())
          and membership.department_id = department.id
          and membership.is_active = true
      )
    );

  if workspace_name is null then
    raise exception using
      errcode = '42501',
      message = 'You do not have access to that workspace';
  end if;

  update public.profiles
  set
    active_department_id = p_department_id,
    department_name = workspace_name
  where id = (select auth.uid())
    and is_active = true;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Active profile not found';
  end if;
end;
$$;

revoke all
on function public.set_active_workspace(uuid)
from public;

grant execute
on function public.set_active_workspace(uuid)
to authenticated;

comment on function public.assign_workspace_access(
  uuid,
  uuid,
  public.department_membership_role,
  boolean
) is
  'Atomically assigns workspace membership and, when requested, updates the user primary workspace.';

comment on function public.set_active_workspace(uuid) is
  'Switches the authenticated user active workspace after validating membership or system-administrator access.';
