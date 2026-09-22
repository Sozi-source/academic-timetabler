-- ============================================================
-- Department unit registration completion
-- ============================================================
-- HOD/direct registration uses the same submission and registration
-- tables as student self-service. The resulting registration is
-- immediately verified and therefore visible through
-- verified_student_unit_registrations.

create or replace function public.department_register_student_units(
  target_student_id uuid,
  target_academic_period_id uuid,
  selected_unit_ids uuid[],
  supplied_note text default null
)
returns uuid
language plpgsql
security invoker
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
begin
  select * into selected_student
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

  select coalesce(array_agg(distinct uo.unit_id order by uo.unit_id), '{}'::uuid[])
  into expected_units
  from public.unit_offerings uo
  where uo.academic_period_id = target_academic_period_id
    and uo.cohort_id = selected_student.current_cohort_id
    and uo.selection_state = 'included'
    and uo.status <> 'cancelled';

  exception_value := selected_units <> expected_units;

  if exception_value and char_length(trim(coalesce(supplied_note, ''))) < 3 then
    raise exception using errcode = '22023',
      message = 'Explain any change from the expected unit list';
  end if;

  select id into submission_id_value
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
    select uo.id into selected_offering_id
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

revoke all on function public.department_register_student_units(uuid, uuid, uuid[], text) from public, anon;
grant execute on function public.department_register_student_units(uuid, uuid, uuid[], text) to authenticated;

comment on function public.department_register_student_units(uuid, uuid, uuid[], text) is
  'Registers and immediately verifies a student unit roster from the department/HOD workflow while preserving the student self-registration workflow.';
