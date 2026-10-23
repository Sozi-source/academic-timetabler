begin;

-- Build a shared markbook roster from registrations for units explicitly
-- confirmed in the same shared offering. Do not infer unit participation from
-- cohort membership: students in a cohort are not automatically enrolled in
-- every unit taught to that cohort.
create or replace function public.ensure_unit_markbook_ready(
  p_academic_period_id uuid,
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_department_id uuid;
  v_related_unit_ids uuid[];
begin
  select coalesce(unit.department_id, programme.department_id)
  into v_department_id
  from public.units unit
  left join public.programmes programme on programme.id = unit.programme_id
  where unit.id = p_unit_id;

  if v_department_id is null then
    raise exception 'Cannot prepare a markbook for a unit without a department.'
      using errcode = '23514';
  end if;

  -- A sibling unit joins this roster only through an explicit, confirmed
  -- shared offering in the same period and department.
  select array_agg(distinct related_offering.unit_id)
  into v_related_unit_ids
  from public.unit_offerings base_offering
  join public.teaching_offerings shared_offering
    on shared_offering.id = base_offering.confirmed_shared_offering_id
   and shared_offering.department_id = v_department_id
  join public.unit_offerings related_offering
    on related_offering.confirmed_shared_offering_id = shared_offering.id
   and related_offering.academic_period_id = p_academic_period_id
  join public.units related_unit
    on related_unit.id = related_offering.unit_id
  left join public.programmes related_programme
    on related_programme.id = related_unit.programme_id
  where base_offering.unit_id = p_unit_id
    and base_offering.academic_period_id = p_academic_period_id
    and coalesce(related_unit.department_id, related_programme.department_id) = v_department_id;

  v_related_unit_ids := array_append(coalesce(v_related_unit_ids, array[]::uuid[]), p_unit_id);

  select id into v_event_id
  from public.assessment_events
  where academic_period_id = p_academic_period_id
    and unit_id = p_unit_id
    and assessment_type = 'exam'
  order by created_at desc
  limit 1;

  if v_event_id is not null then
    -- Preserve the frozen roster while trainers are entering marks.
    if exists (
      select 1 from public.assessment_events
      where id = v_event_id and trainer_entry_open
    ) then
      return v_event_id;
    end if;

    update public.assessment_events
    set operational_assessment_type = 'exam',
        operational_workflow_status = coalesce(operational_workflow_status, 'open'),
        population_locked_at = coalesce(population_locked_at, now()),
        max_mark = 100,
        pass_mark = 40
    where id = v_event_id;
  else
    insert into public.assessment_events (
      department_id,
      academic_period_id,
      unit_id,
      cohort_id,
      assessment_type,
      operational_assessment_type,
      operational_workflow_status,
      title,
      max_mark,
      pass_mark,
      status,
      population_locked_at
    ) values (
      v_department_id,
      p_academic_period_id,
      p_unit_id,
      null,
      'exam',
      'exam',
      'open',
      'Unit Markbook',
      100,
      40,
      'open',
      now()
    ) returning id into v_event_id;
  end if;

  insert into public.assessment_rules (
    academic_period_id, unit_id, assessment_type, maximum_mark, pass_mark
  ) values (
    p_academic_period_id, p_unit_id, 'exam', 100, 40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set maximum_mark = 100, pass_mark = 40;

  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    snapshot_registration_status,
    pre_assessment_status
  )
  select distinct on (registration.student_id)
    v_event_id,
    registration.student_id,
    coalesce(registration.cohort_id, student.current_cohort_id),
    p_academic_period_id,
    registration.unit_id,
    registration.registration_status,
    'expected'
  from public.student_unit_registrations registration
  join public.students student on student.id = registration.student_id
  join public.units registered_unit on registered_unit.id = registration.unit_id
  left join public.programmes registered_programme on registered_programme.id = registered_unit.programme_id
  where registration.unit_id = any(v_related_unit_ids)
    and registration.academic_period_id = p_academic_period_id
    and registration.registration_status = 'registered'
    and student.department_id = v_department_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(registered_unit.department_id, registered_programme.department_id) = v_department_id
  order by registration.student_id, registration.registered_at desc
  on conflict (assessment_id, student_id) do nothing;

  -- Only mirror currently valid registered candidates into the legacy
  -- attendance population table. This avoids reintroducing old cohort-only
  -- rows through the reporting snapshot.
  insert into public.assessment_population (
    assessment_event_id,
    student_id,
    cohort_id,
    attendance_status,
    population_status
  )
  select distinct on (registration.student_id)
    v_event_id,
    registration.student_id,
    coalesce(registration.cohort_id, student.current_cohort_id),
    'present'::public.assessment_attendance_status,
    'expected'::public.assessment_population_status
  from public.student_unit_registrations registration
  join public.students student on student.id = registration.student_id
  join public.units registered_unit on registered_unit.id = registration.unit_id
  left join public.programmes registered_programme on registered_programme.id = registered_unit.programme_id
  where registration.unit_id = any(v_related_unit_ids)
    and registration.academic_period_id = p_academic_period_id
    and registration.registration_status = 'registered'
    and student.department_id = v_department_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(registered_unit.department_id, registered_programme.department_id) = v_department_id
  order by registration.student_id, registration.registered_at desc
  on conflict do nothing;

  return v_event_id;
end;
$$;

revoke all on function public.ensure_unit_markbook_ready(uuid, uuid) from public, anon;
grant execute on function public.ensure_unit_markbook_ready(uuid, uuid) to authenticated, service_role;

comment on function public.ensure_unit_markbook_ready(uuid, uuid) is
  'Prepares unit markbooks from active students registered for the unit or its explicitly confirmed same-department shared offering. Cohort membership alone never enrolls students in a unit.';

commit;
