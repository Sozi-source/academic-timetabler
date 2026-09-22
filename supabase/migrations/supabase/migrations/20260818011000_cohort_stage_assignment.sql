-- ============================================================
-- v12.14.0 - Cohort stage assignment + student stage inheritance
-- ============================================================

alter table public.cohorts
  add column if not exists current_stage_id uuid
    references public.programme_stages(id)
    on delete set null;

create index if not exists cohorts_current_stage_id_idx
  on public.cohorts(current_stage_id);

create or replace function public.validate_cohort_current_stage()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  stage_programme_id uuid;
begin
  if new.current_stage_id is null then
    return new;
  end if;

  select ps.programme_id
  into stage_programme_id
  from public.programme_stages ps
  where ps.id = new.current_stage_id
    and ps.is_active;

  if stage_programme_id is null then
    raise exception 'The selected programme stage is not active or does not exist';
  end if;

  if stage_programme_id <> new.programme_id then
    raise exception 'The selected stage does not belong to this cohort programme';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_cohort_current_stage_trigger
  on public.cohorts;

create trigger validate_cohort_current_stage_trigger
before insert or update of programme_id, current_stage_id
on public.cohorts
for each row
execute function public.validate_cohort_current_stage();

create or replace function public.inherit_cohort_stage_on_student()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cohort_stage_id uuid;
begin
  if new.current_cohort_id is null then
    return new;
  end if;

  if new.current_stage_id is not null then
    return new;
  end if;

  if tg_op = 'INSERT'
     or new.current_cohort_id is distinct from old.current_cohort_id then
    select c.current_stage_id
    into cohort_stage_id
    from public.cohorts c
    where c.id = new.current_cohort_id;

    if cohort_stage_id is not null then
      new.current_stage_id := cohort_stage_id;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists inherit_cohort_stage_on_student_trigger
  on public.students;

create trigger inherit_cohort_stage_on_student_trigger
before insert or update of current_cohort_id, current_stage_id
on public.students
for each row
execute function public.inherit_cohort_stage_on_student();

create or replace function public.set_cohort_programme_stage(
  target_cohort_id uuid,
  target_stage_id uuid,
  apply_to_students_without_stage boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid :=
    public.current_user_primary_department_id();
  cohort_record record;
  stage_record record;
  updated_students integer := 0;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication is required';
  end if;

  if active_department is null
     or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department first';
  end if;

  if not public.current_user_has_role(
    array['hod','system_admin']::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an HOD or system administrator can set a cohort stage';
  end if;

  select
    c.id,
    c.programme_id,
    p.department_id
  into cohort_record
  from public.cohorts c
  join public.programmes p
    on p.id = c.programme_id
  where c.id = target_cohort_id
    and p.department_id = active_department
  for update of c;

  if cohort_record.id is null then
    raise exception 'The selected cohort was not found in the working department';
  end if;

  select
    ps.id,
    ps.programme_id,
    ps.code,
    ps.sequence_number
  into stage_record
  from public.programme_stages ps
  where ps.id = target_stage_id
    and ps.programme_id = cohort_record.programme_id
    and ps.is_active;

  if stage_record.id is null then
    raise exception 'The selected stage does not belong to this cohort programme';
  end if;

  update public.cohorts
  set current_stage_id = stage_record.id,
      updated_at = now()
  where id = cohort_record.id;

  if apply_to_students_without_stage then
    update public.students
    set current_stage_id = stage_record.id,
        updated_at = now()
    where current_cohort_id = cohort_record.id
      and current_stage_id is null
      and lifecycle_status in ('admitted','active');

    get diagnostics updated_students = row_count;
  end if;

  return jsonb_build_object(
    'cohort_id', cohort_record.id,
    'stage_id', stage_record.id,
    'stage_code', stage_record.code,
    'students_updated', updated_students
  );
end;
$$;

revoke all
on function public.set_cohort_programme_stage(uuid, uuid, boolean)
from public, anon;

grant execute
on function public.set_cohort_programme_stage(uuid, uuid, boolean)
to authenticated;

comment on column public.cohorts.current_stage_id is
  'Current expected academic stage for this cohort. Individual students may differ where an exception is required.';

comment on function public.set_cohort_programme_stage(uuid, uuid, boolean) is
  'Sets a cohort current stage and optionally assigns that stage only to active/admitted students who do not yet have an individual stage.';
