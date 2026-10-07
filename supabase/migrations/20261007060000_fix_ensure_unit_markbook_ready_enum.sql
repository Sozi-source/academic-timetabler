begin;

-- ============================================================================
-- Fix ensure_unit_markbook_ready enum cast and auto-provision all allocated units
-- ============================================================================

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
begin
  -- 1. Check if an active markbook already exists for this unit and period
  select id into v_event_id
  from public.assessment_events
  where academic_period_id = p_academic_period_id
    and unit_id = p_unit_id
    and assessment_type = 'exam'
  order by created_at desc
  limit 1;

  if v_event_id is not null then
    -- Ensure event operational fields are active
    update public.assessment_events
    set
      operational_assessment_type = 'exam',
      operational_workflow_status = coalesce(operational_workflow_status, 'open'),
      population_locked_at = coalesce(population_locked_at, now()),
      max_mark = 100,
      pass_mark = 40
    where id = v_event_id;

    -- Ensure candidate roster is synchronized with cohort registrations
    insert into public.assessment_roster (
      assessment_id,
      student_id,
      cohort_id,
      academic_period_id,
      unit_id,
      snapshot_registration_status,
      pre_assessment_status
    )
    select distinct
      v_event_id,
      sur.student_id,
      coalesce(sur.cohort_id, s.current_cohort_id),
      p_academic_period_id,
      p_unit_id,
      sur.registration_status,
      'expected'
    from public.student_unit_registrations sur
    join public.students s on s.id = sur.student_id
    where sur.unit_id = p_unit_id
      and sur.academic_period_id = p_academic_period_id
      and sur.registration_status = 'registered'
    on conflict (assessment_id, student_id) do nothing;

    insert into public.assessment_roster (
      assessment_id,
      student_id,
      cohort_id,
      academic_period_id,
      unit_id,
      snapshot_registration_status,
      pre_assessment_status
    )
    select distinct
      v_event_id,
      s.id,
      ta.cohort_id,
      p_academic_period_id,
      p_unit_id,
      'registered',
      'expected'
    from public.teaching_allocations ta
    join public.students s on s.current_cohort_id = ta.cohort_id
    where ta.unit_id = p_unit_id
      and ta.academic_period_id = p_academic_period_id
      and s.lifecycle_status in ('admitted', 'active')
    on conflict (assessment_id, student_id) do nothing;

    return v_event_id;
  end if;

  -- 2. Determine department for the unit
  select p.department_id into v_department_id
  from public.units u
  left join public.programmes p on p.id = u.programme_id
  where u.id = p_unit_id;

  if v_department_id is null then
    select department_id into v_department_id
    from public.teaching_allocations
    where unit_id = p_unit_id
      and academic_period_id = p_academic_period_id
    limit 1;
  end if;

  if v_department_id is null then
    select id into v_department_id from public.departments limit 1;
  end if;

  -- 3. Create the Unit Markbook assessment event with full operational defaults
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
  )
  returning id into v_event_id;

  -- 4. Ensure assessment rule exists
  insert into public.assessment_rules (
    academic_period_id,
    unit_id,
    assessment_type,
    maximum_mark,
    pass_mark
  ) values (
    p_academic_period_id,
    p_unit_id,
    'exam',
    100,
    40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set
    maximum_mark = 100,
    pass_mark = 40;

  -- 5. Synchronize registered students into the candidate roster
  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    snapshot_registration_status,
    pre_assessment_status
  )
  select distinct
    v_event_id,
    sur.student_id,
    coalesce(sur.cohort_id, s.current_cohort_id),
    p_academic_period_id,
    p_unit_id,
    sur.registration_status,
    'expected'
  from public.student_unit_registrations sur
  join public.students s on s.id = sur.student_id
  where sur.unit_id = p_unit_id
    and sur.academic_period_id = p_academic_period_id
    and sur.registration_status = 'registered'
  on conflict (assessment_id, student_id) do nothing;

  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    snapshot_registration_status,
    pre_assessment_status
  )
  select distinct
    v_event_id,
    s.id,
    ta.cohort_id,
    p_academic_period_id,
    p_unit_id,
    'registered',
    'expected'
  from public.teaching_allocations ta
  join public.students s on s.current_cohort_id = ta.cohort_id
  where ta.unit_id = p_unit_id
    and ta.academic_period_id = p_academic_period_id
    and s.lifecycle_status in ('admitted', 'active')
  on conflict (assessment_id, student_id) do nothing;

  return v_event_id;
end;
$$;

-- Auto-provision assessment events for ALL active teaching allocations
do $$
declare
  rec record;
begin
  for rec in (
    select distinct academic_period_id, unit_id
    from public.teaching_allocations
    where academic_period_id is not null and unit_id is not null
  ) loop
    perform public.ensure_unit_markbook_ready(rec.academic_period_id, rec.unit_id);
  end loop;
end $$;

commit;
