-- ============================================================
-- Migration: 20260907091000_fix_dndt_stages_and_registration_flexibility.sql
-- Description: 
--   1. Fix DNDT programme stage unit bindings (12xx -> Y1S2, 13xx -> Y1S3).
--   2. Ensure unit offerings exist for all 7 DNDT Y1S2 units for DNDT JAN 26.
--   3. Enhance department_register_student_units to auto-provision offerings
--      and provide fallback notes for custom unit selections.
-- ============================================================

do $$
declare
  dndt_prog_id uuid;
  y1s2_stage_id uuid;
  y1s3_stage_id uuid;
  active_period_id uuid;
  dndt_jan26_cohort_id uuid;
  dept_id uuid;
  offering_row record;
begin
  -- 1. Locate DNDT programme
  select id, department_id into dndt_prog_id, dept_id
  from public.programmes
  where code = 'DNDT'
  limit 1;

  if dndt_prog_id is null then
    return;
  end if;

  -- 2. Locate Y1S2 and Y1S3 stages for DNDT
  select id into y1s2_stage_id
  from public.programme_stages
  where programme_id = dndt_prog_id and code = 'Y1S2'
  limit 1;

  select id into y1s3_stage_id
  from public.programme_stages
  where programme_id = dndt_prog_id and code = 'Y1S3'
  limit 1;

  -- 3. Realign DNDT stage units
  -- Remove existing bindings for Y1S2 and Y1S3 to rebuild cleanly
  delete from public.programme_stage_units
  where stage_id in (y1s2_stage_id, y1s3_stage_id);

  -- Insert all 12xx units into Y1S2
  insert into public.programme_stage_units (stage_id, unit_id)
  select y1s2_stage_id, un.id
  from public.units un
  where un.programme_id = dndt_prog_id
    and un.code like 'DNDT 12%';

  -- Insert all 13xx units into Y1S3
  insert into public.programme_stage_units (stage_id, unit_id)
  select y1s3_stage_id, un.id
  from public.units un
  where un.programme_id = dndt_prog_id
    and un.code like 'DNDT 13%';

  -- Update academic_period_number in units table to match curriculum
  update public.units
  set academic_period_number = 2
  where programme_id = dndt_prog_id and code like 'DNDT 12%';

  update public.units
  set academic_period_number = 3
  where programme_id = dndt_prog_id and code like 'DNDT 13%';

  -- 4. Locate active academic period and DNDT JAN 26 cohort
  select id into active_period_id
  from public.academic_periods
  where status = 'active'
  limit 1;

  select id into dndt_jan26_cohort_id
  from public.cohorts
  where programme_id = dndt_prog_id
    and upper(trim(name)) = 'DNDT JAN 26'
  limit 1;

  -- 5. Ensure all 7 DNDT 12xx units have included unit offerings for DNDT JAN 26
  if active_period_id is not null and dndt_jan26_cohort_id is not null then
    for offering_row in (
      select id, code, name
      from public.units
      where programme_id = dndt_prog_id
        and code like 'DNDT 12%'
    ) loop
      insert into public.unit_offerings (
        academic_period_id,
        cohort_id,
        unit_id,
        selection_state,
        status,
        offering_type,
        origin,
        exception_reason,
        is_timetable_enabled,
        weekly_sessions,
        session_duration_minutes
      )
      values (
        active_period_id,
        dndt_jan26_cohort_id,
        offering_row.id,
        'included',
        'active',
        'classroom',
        'special',
        'Department unit offering',
        true,
        2,
        120
      )
      on conflict do nothing;
    end loop;
  end if;
end $$;

-- ------------------------------------------------------------
-- Update department_register_student_units to auto-provision
-- offerings if missing and allow flexible unit selection.
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
  resolved_note text;
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

  -- Verify all chosen units belong to the student's department/programme
  if exists (
    select 1
    from unnest(selected_units) chosen(unit_id)
    where not exists (
      select 1
      from public.units u
      where u.id = chosen.unit_id
        and u.programme_id = selected_student.programme_id
    )
  ) then
    raise exception using errcode = '23514',
      message = 'Selected unit does not belong to the student programme';
  end if;

  -- Auto-provision unit offerings for any selected units missing in this period for the cohort
  foreach selected_unit_id in array selected_units loop
    if not exists (
      select 1
      from public.unit_offerings uo
      where uo.academic_period_id = target_academic_period_id
        and uo.unit_id = selected_unit_id
        and uo.selection_state = 'included'
        and uo.status <> 'cancelled'
    ) then
      insert into public.unit_offerings (
        academic_period_id,
        cohort_id,
        unit_id,
        selection_state,
        status,
        offering_type,
        origin,
        exception_reason,
        is_timetable_enabled,
        weekly_sessions,
        session_duration_minutes
      )
      values (
        target_academic_period_id,
        selected_student.current_cohort_id,
        selected_unit_id,
        'included',
        'active',
        'classroom',
        'special',
        'Department unit offering',
        true,
        2,
        120
      )
      on conflict do nothing;
    end if;
  end loop;

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
    where psu.stage_id = selected_student.current_stage_id;
  else
    select coalesce(array_agg(distinct uo.unit_id order by uo.unit_id), '{}'::uuid[])
    into expected_units
    from public.unit_offerings uo
    where uo.academic_period_id = target_academic_period_id
      and uo.cohort_id = selected_student.current_cohort_id
      and uo.selection_state = 'included'
      and uo.status <> 'cancelled';
  end if;

  exception_value := selected_units <> expected_units;

  resolved_note := coalesce(
    nullif(trim(supplied_note), ''),
    case when exception_value then 'Department authorized registration' else null end
  );

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
      verified_by
    )
    values (
      target_student_id,
      target_academic_period_id,
      selected_student.current_cohort_id,
      'verified',
      exception_value,
      resolved_note,
      now(),
      now(),
      auth.uid()
    )
    returning id into submission_id_value;
  else
    update public.student_unit_registration_submissions
    set status = 'verified',
        has_exception = exception_value,
        exception_reason = resolved_note,
        cohort_id = selected_student.current_cohort_id,
        submitted_at = coalesce(submitted_at, now()),
        verified_at = now(),
        verified_by = auth.uid(),
        updated_at = now()
    where id = submission_id_value;
  end if;

  delete from public.student_unit_registrations
  where student_id = target_student_id
    and academic_period_id = target_academic_period_id
    and unit_id <> all(selected_units);

  foreach selected_unit_id in array selected_units loop
    select uo.id
    into selected_offering_id
    from public.unit_offerings uo
    where uo.academic_period_id = target_academic_period_id
      and uo.unit_id = selected_unit_id
      and uo.selection_state = 'included'
      and uo.status <> 'cancelled'
      and (uo.cohort_id = selected_student.current_cohort_id or uo.cohort_id is null)
    order by (uo.cohort_id = selected_student.current_cohort_id) desc
    limit 1;

    if selected_offering_id is null then
      select uo.id
      into selected_offering_id
      from public.unit_offerings uo
      where uo.academic_period_id = target_academic_period_id
        and uo.unit_id = selected_unit_id
        and uo.selection_state = 'included'
        and uo.status <> 'cancelled'
      limit 1;
    end if;

    insert into public.student_unit_registrations (
      student_id,
      unit_id,
      academic_period_id,
      unit_offering_id,
      registration_status,
      registered_at
    )
    values (
      target_student_id,
      selected_unit_id,
      target_academic_period_id,
      selected_offering_id,
      'registered',
      now()
    )
    on conflict (student_id, academic_period_id, unit_id)
    do update set
      unit_offering_id = excluded.unit_offering_id,
      registration_status = 'registered',
      registered_at = now();
  end loop;

  return submission_id_value;
end;
$$;
