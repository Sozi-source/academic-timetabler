-- Present schools and departments as one user-facing timetable workspace.
-- The existing two-table relationship is retained for compatibility.

do $$
declare
  workspace_record record;
begin
  -- Where a legacy school contains exactly one department, use the
  -- department's code and name for the hidden parent school as well.
  -- Conflicting school names/codes are left untouched instead of risking
  -- a uniqueness failure or changing unrelated data.
  for workspace_record in
    select
      school.id as school_id,
      department.code,
      department.name
    from public.schools school
    join public.departments department
      on department.school_id = school.id
    where (
      select count(*)
      from public.departments sibling
      where sibling.school_id = school.id
    ) = 1
  loop
    if not exists (
      select 1
      from public.schools other_school
      where other_school.id <> workspace_record.school_id
        and (
          lower(trim(other_school.code)) =
            lower(trim(workspace_record.code))
          or lower(trim(other_school.name)) =
            lower(trim(workspace_record.name))
        )
    ) then
      update public.schools
      set
        code = workspace_record.code,
        name = workspace_record.name,
        is_active = true
      where id = workspace_record.school_id;
    end if;
  end loop;
end
$$;

create or replace function public.sync_workspace_parent_school()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Synchronize only one-department parents. A legacy multi-department
  -- parent is preserved and simply hidden by the streamlined interface.
  if (
    select count(*)
    from public.departments department
    where department.school_id = new.school_id
  ) = 1
  and not exists (
    select 1
    from public.schools other_school
    where other_school.id <> new.school_id
      and (
        lower(trim(other_school.code)) = lower(trim(new.code))
        or lower(trim(other_school.name)) = lower(trim(new.name))
      )
  ) then
    update public.schools
    set
      code = new.code,
      name = new.name,
      is_active = new.is_active
    where id = new.school_id;
  end if;

  return new;
end;
$$;

drop trigger if exists departments_sync_workspace_parent
on public.departments;

create trigger departments_sync_workspace_parent
after insert or update of code, name, is_active
on public.departments
for each row
execute function public.sync_workspace_parent_school();

create or replace function public.create_academic_workspace(
  workspace_code text,
  workspace_name text
)
returns table (
  created_school_id uuid,
  created_department_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_code text := upper(trim(workspace_code));
  normalized_name text := trim(workspace_name);
  paired_school_id uuid;
  paired_department_id uuid;
begin
  if not public.current_user_has_role(
    array['system_admin']::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only a system administrator can create an academic workspace';
  end if;

  if normalized_code !~ '^[A-Z0-9_-]{2,30}$' then
    raise exception using
      errcode = '22023',
      message = 'Enter a valid workspace code';
  end if;

  if char_length(normalized_name) not between 2 and 160 then
    raise exception using
      errcode = '22023',
      message = 'Enter a valid workspace name';
  end if;

  insert into public.schools (
    code,
    name,
    is_active,
    created_by
  )
  values (
    normalized_code,
    normalized_name,
    true,
    auth.uid()
  )
  on conflict ((lower(trim(code))))
  do update set
    name = excluded.name,
    is_active = true,
    updated_at = now()
  returning id into paired_school_id;

  insert into public.departments (
    school_id,
    code,
    name,
    is_active,
    created_by
  )
  values (
    paired_school_id,
    normalized_code,
    normalized_name,
    true,
    auth.uid()
  )
  on conflict (school_id, (lower(trim(code))))
  do update set
    name = excluded.name,
    is_active = true,
    updated_at = now()
  returning id into paired_department_id;

  return query
  select paired_school_id, paired_department_id;
end;
$$;

revoke all
on function public.create_academic_workspace(text, text)
from public;

grant execute
on function public.create_academic_workspace(text, text)
to authenticated;

comment on function public.create_academic_workspace(text, text) is
  'Creates one visible school/department timetable workspace while retaining the compatible school and department records internally.';

comment on function public.sync_workspace_parent_school() is
  'Keeps the hidden parent school synchronized when it represents exactly one department workspace.';
