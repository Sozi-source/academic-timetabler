-- ============================================================
-- Migration: Fix department_register_student_units cohort missing
-- Description:
--   Adds missing cohort_id, submission_id, source, and notes to the
--   student_unit_registrations insert in department_register_student_units
--   to satisfy table constraints and triggers.
-- ============================================================

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
      academic_period_id,
      cohort_id,
      unit_id,
      unit_offering_id,
      submission_id,
      registration_status,
      source,
      notes,
      registered_at
    )
    values (
      target_student_id,
      target_academic_period_id,
      selected_student.current_cohort_id,
      selected_unit_id,
      selected_offering_id,
      submission_id_value,
      'registered',
      'department_manual',
      resolved_note,
      now()
    )
    on conflict (student_id, academic_period_id, unit_id)
    do update set
      unit_offering_id = excluded.unit_offering_id,
      cohort_id = excluded.cohort_id,
      submission_id = excluded.submission_id,
      registration_status = 'registered',
      source = 'department_manual',
      notes = excluded.notes,
      registered_at = now();
  end loop;

  return submission_id_value;
end;
$$;
