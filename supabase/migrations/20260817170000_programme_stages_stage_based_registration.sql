-- ============================================================
-- v12.6b — Programme Stages & Stage-Based Unit Registration
-- ============================================================

create table if not exists public.programme_stages (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete cascade,
  programme_id uuid not null references public.programmes(id) on delete cascade,
  stage_number integer not null check (stage_number > 0),
  name text not null,
  is_active boolean not null default true,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint programme_stages_programme_number_unique unique (programme_id, stage_number)
);

create index if not exists programme_stages_department_idx
  on public.programme_stages(department_id);

create index if not exists programme_stages_programme_idx
  on public.programme_stages(programme_id);

create table if not exists public.programme_stage_units (
  stage_id uuid not null references public.programme_stages(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete cascade,
  created_by uuid null references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (stage_id, unit_id)
);

create index if not exists programme_stage_units_unit_idx
  on public.programme_stage_units(unit_id);

alter table public.students
  add column if not exists current_stage_id uuid
  references public.programme_stages(id) on delete set null;

create index if not exists students_current_stage_idx
  on public.students(current_stage_id);

alter table public.programme_stages enable row level security;
alter table public.programme_stage_units enable row level security;

drop policy if exists programme_stages_department_select on public.programme_stages;
create policy programme_stages_department_select
on public.programme_stages
for select
to authenticated
using (public.current_user_can_manage_department(department_id));

drop policy if exists programme_stage_units_department_select on public.programme_stage_units;
create policy programme_stage_units_department_select
on public.programme_stage_units
for select
to authenticated
using (
  exists (
    select 1
    from public.programme_stages ps
    where ps.id = programme_stage_units.stage_id
      and public.current_user_can_manage_department(ps.department_id)
  )
);

grant select on public.programme_stages to authenticated;
grant select on public.programme_stage_units to authenticated;

-- ------------------------------------------------------------
-- Create a stage through a controlled operation.
-- ------------------------------------------------------------
create or replace function public.create_programme_stage(
  target_programme_id uuid,
  supplied_stage_number integer,
  supplied_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_department_id uuid;
  created_stage_id uuid;
  final_name text;
begin
  select p.department_id
  into target_department_id
  from public.programmes p
  where p.id = target_programme_id;

  if target_department_id is null then
    raise exception using errcode = 'P0002', message = 'Programme not found';
  end if;

  if not public.current_user_can_manage_department(target_department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this programme';
  end if;

  if supplied_stage_number is null or supplied_stage_number < 1 then
    raise exception using errcode = '22023', message = 'Stage number must be at least 1';
  end if;

  final_name := nullif(trim(coalesce(supplied_name, '')), '');
  if final_name is null then
    final_name := 'Stage ' || supplied_stage_number::text;
  end if;

  insert into public.programme_stages (
    department_id,
    programme_id,
    stage_number,
    name,
    created_by
  ) values (
    target_department_id,
    target_programme_id,
    supplied_stage_number,
    final_name,
    auth.uid()
  )
  on conflict (programme_id, stage_number)
  do update set
    name = excluded.name,
    is_active = true,
    updated_at = now()
  returning id into created_stage_id;

  return created_stage_id;
end;
$$;

-- ------------------------------------------------------------
-- Replace all unit bindings for a programme stage.
-- ------------------------------------------------------------
create or replace function public.save_programme_stage_units(
  target_stage_id uuid,
  selected_unit_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  stage_row public.programme_stages%rowtype;
  selected_units uuid[];
  selected_unit_id uuid;
begin
  select *
  into stage_row
  from public.programme_stages
  where id = target_stage_id
  for update;

  if stage_row.id is null then
    raise exception using errcode = 'P0002', message = 'Programme stage not found';
  end if;

  if not public.current_user_can_manage_department(stage_row.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this stage';
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into selected_units
  from unnest(coalesce(selected_unit_ids, '{}'::uuid[])) x;

  if exists (
    select 1
    from unnest(selected_units) chosen(unit_id)
    where not exists (
      select 1
      from public.units u
      where u.id = chosen.unit_id
        and u.programme_id = stage_row.programme_id
    )
  ) then
    raise exception using errcode = '23514',
      message = 'Every stage unit must belong to the same programme';
  end if;

  delete from public.programme_stage_units
  where stage_id = target_stage_id;

  foreach selected_unit_id in array selected_units loop
    insert into public.programme_stage_units(stage_id, unit_id, created_by)
    values (target_stage_id, selected_unit_id, auth.uid());
  end loop;

  update public.programme_stages
  set updated_at = now()
  where id = target_stage_id;

  return cardinality(selected_units);
end;
$$;

-- ------------------------------------------------------------
-- Bind a student to their current academic stage.
-- ------------------------------------------------------------
create or replace function public.set_student_programme_stage(
  target_student_id uuid,
  target_stage_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  student_row public.students%rowtype;
  stage_row public.programme_stages%rowtype;
begin
  select *
  into student_row
  from public.students
  where id = target_student_id
  for update;

  if student_row.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  if not public.current_user_can_manage_department(student_row.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this student';
  end if;

  select *
  into stage_row
  from public.programme_stages
  where id = target_stage_id
    and is_active = true;

  if stage_row.id is null then
    raise exception using errcode = 'P0002', message = 'Programme stage not found';
  end if;

  if stage_row.programme_id <> student_row.programme_id then
    raise exception using errcode = '23514',
      message = 'Selected stage does not belong to the student programme';
  end if;

  update public.students
  set current_stage_id = target_stage_id,
      updated_at = now()
  where id = target_student_id;
end;
$$;

-- ------------------------------------------------------------
-- Stage-aware HOD registration.
-- The same verified registration tables remain authoritative.
-- ------------------------------------------------------------
create or replace function public.department_register_student_units(
  target_student_id uuid,
  target_academic_period_id uuid,
  selected_unit_ids uuid[],
  supplied_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  submission_id_value uuid;
  expected_units uuid[];
  selected_units uuid[];
  exception_value boolean;
  selected_unit_id uuid;
  selected_offering_id uuid;
  stage_has_units boolean;
begin
  select *
  into selected_student
  from public.students
  where id = target_student_id
  for update;

  if selected_student.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  if not public.current_user_can_manage_department(selected_student.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to register this student';
  end if;

  if selected_student.lifecycle_status not in ('admitted', 'active')
     or selected_student.current_cohort_id is null then
    raise exception using errcode = 'P0001', message = 'Student is not eligible for unit registration';
  end if;

  if not exists (
    select 1
    from public.academic_periods
    where id = target_academic_period_id
      and status = 'active'
  ) then
    raise exception using errcode = 'P0001', message = 'Academic period is not active';
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into selected_units
  from unnest(coalesce(selected_unit_ids, '{}'::uuid[])) x;

  if cardinality(selected_units) = 0 then
    raise exception using errcode = '22023', message = 'Select at least one unit';
  end if;

  if exists (
    select 1
    from unnest(selected_units) chosen(unit_id)
    where not exists (
      select 1
      from public.unit_offerings uo
      join public.units u on u.id = uo.unit_id
      where uo.academic_period_id = target_academic_period_id
        and uo.unit_id = chosen.unit_id
        and uo.selection_state = 'included'
        and uo.status <> 'cancelled'
        and u.programme_id = selected_student.programme_id
    )
  ) then
    raise exception using errcode = '23514',
      message = 'Selected unit is not available to this programme in the active academic period';
  end if;

  select exists (
    select 1
    from public.programme_stage_units psu
    where psu.stage_id = selected_student.current_stage_id
  )
  into stage_has_units;

  if selected_student.current_stage_id is not null and stage_has_units then
    select coalesce(array_agg(distinct psu.unit_id order by psu.unit_id), '{}'::uuid[])
    into expected_units
    from public.programme_stage_units psu
    where psu.stage_id = selected_student.current_stage_id
      and exists (
        select 1
        from public.unit_offerings uo
        where uo.academic_period_id = target_academic_period_id
          and uo.unit_id = psu.unit_id
          and uo.selection_state = 'included'
          and uo.status <> 'cancelled'
      );
  else
    -- Compatibility fallback until a programme's stages are configured.
    select coalesce(array_agg(distinct uo.unit_id order by uo.unit_id), '{}'::uuid[])
    into expected_units
    from public.unit_offerings uo
    where uo.academic_period_id = target_academic_period_id
      and uo.cohort_id = selected_student.current_cohort_id
      and uo.selection_state = 'included'
      and uo.status <> 'cancelled';
  end if;

  exception_value := selected_units <> expected_units;

  if exception_value and char_length(trim(coalesce(supplied_note, ''))) < 3 then
    raise exception using errcode = '22023',
      message = 'Explain any change from the expected unit list';
  end if;

  select id
  into submission_id_value
  from public.student_unit_registration_submissions
  where student_id = target_student_id
    and academic_period_id = target_academic_period_id
  for update;

  if submission_id_value is null then
    insert into public.student_unit_registration_submissions (
      student_id,
      academic_period_id,
      cohort_id,
      status,
      has_exception,
      exception_reason,
      submitted_at,
      verified_at,
      verified_by,
      verification_note,
      updated_at
    ) values (
      target_student_id,
      target_academic_period_id,
      selected_student.current_cohort_id,
      'verified',
      exception_value,
      case when exception_value then trim(supplied_note) else null end,
      now(),
      now(),
      auth.uid(),
      nullif(trim(coalesce(supplied_note, '')), ''),
      now()
    )
    returning id into submission_id_value;
  else
    update public.student_unit_registration_submissions
    set cohort_id = selected_student.current_cohort_id,
        status = 'verified',
        has_exception = exception_value,
        exception_reason = case when exception_value then trim(supplied_note) else null end,
        submitted_at = coalesce(submitted_at, now()),
        verified_at = now(),
        verified_by = auth.uid(),
        returned_at = null,
        verification_note = nullif(trim(coalesce(supplied_note, '')), ''),
        updated_at = now()
    where id = submission_id_value;
  end if;

  delete from public.student_unit_registrations
  where student_id = target_student_id
    and academic_period_id = target_academic_period_id;

  foreach selected_unit_id in array selected_units loop
    select uo.id
    into selected_offering_id
    from public.unit_offerings uo
    join public.units u on u.id = uo.unit_id
    where uo.academic_period_id = target_academic_period_id
      and uo.unit_id = selected_unit_id
      and uo.selection_state = 'included'
      and uo.status <> 'cancelled'
      and u.programme_id = selected_student.programme_id
    order by (uo.cohort_id = selected_student.current_cohort_id) desc, uo.created_at asc
    limit 1;

    insert into public.student_unit_registrations (
      student_id,
      academic_period_id,
      cohort_id,
      unit_id,
      unit_offering_id,
      submission_id,
      registration_status,
      source,
      notes
    ) values (
      target_student_id,
      target_academic_period_id,
      selected_student.current_cohort_id,
      selected_unit_id,
      selected_offering_id,
      submission_id_value,
      'registered',
      'department_manual',
      nullif(trim(coalesce(supplied_note, '')), '')
    );
  end loop;

  return submission_id_value;
end;
$$;

revoke all on function public.create_programme_stage(uuid, integer, text) from public, anon;
revoke all on function public.save_programme_stage_units(uuid, uuid[]) from public, anon;
revoke all on function public.set_student_programme_stage(uuid, uuid) from public, anon;
revoke all on function public.department_register_student_units(uuid, uuid, uuid[], text) from public, anon;

grant execute on function public.create_programme_stage(uuid, integer, text) to authenticated;
grant execute on function public.save_programme_stage_units(uuid, uuid[]) to authenticated;
grant execute on function public.set_student_programme_stage(uuid, uuid) to authenticated;
grant execute on function public.department_register_student_units(uuid, uuid, uuid[], text) to authenticated;

comment on table public.programme_stages is
  'Programme academic stages used to drive expected student units independently of cohort/intake.';
comment on table public.programme_stage_units is
  'Authoritative unit bindings for each programme academic stage.';
comment on column public.students.current_stage_id is
  'Student current academic stage. Cohort tracks intake; stage tracks actual academic position.';
