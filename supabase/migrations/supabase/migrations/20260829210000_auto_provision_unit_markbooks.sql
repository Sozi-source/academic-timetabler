-- ============================================================================
-- Auto-Provision Unit Markbooks & Candidate Rosters
-- Zero-friction marks entry for allocated units and registered students
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
  -- 1. Check if an active markbook already exists for this period and unit
  select id into v_event_id
  from public.assessment_events
  where academic_period_id = p_academic_period_id
    and unit_id = p_unit_id
    and assessment_type in ('exam', 'unit_markbook')
  order by created_at desc
  limit 1;

  if v_event_id is not null then
    -- Ensure candidate roster is synchronized with cohort registrations
    insert into public.assessment_population (
      assessment_event_id,
      student_id,
      attendance_status,
      population_status
    )
    select distinct
      v_event_id,
      sur.student_id,
      'expected'::public.assessment_attendance_status,
      'expected'::public.assessment_population_status
    from public.student_unit_registrations sur
    where sur.unit_id = p_unit_id
      and sur.academic_period_id = p_academic_period_id
      and sur.registration_status = 'registered'
    on conflict do nothing;

    -- Also pull students from allocated cohorts if not already registered
    insert into public.assessment_population (
      assessment_event_id,
      student_id,
      attendance_status,
      population_status
    )
    select distinct
      v_event_id,
      s.id,
      'expected'::public.assessment_attendance_status,
      'expected'::public.assessment_population_status
    from public.teaching_allocations ta
    join public.students s on s.current_cohort_id = ta.cohort_id
    where ta.unit_id = p_unit_id
      and ta.academic_period_id = p_academic_period_id
      and s.lifecycle_status in ('admitted', 'active')
    on conflict do nothing;

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

  -- 3. Create the Unit Markbook assessment event
  insert into public.assessment_events (
    department_id,
    academic_period_id,
    unit_id,
    cohort_id,
    assessment_type,
    title,
    max_mark,
    pass_mark,
    status
  ) values (
    v_department_id,
    p_academic_period_id,
    p_unit_id,
    null,
    'exam',
    'Unit Markbook',
    100,
    40,
    'draft'
  )
  returning id into v_event_id;

  -- 4. Ensure assessment rule exists
  insert into public.assessment_rules (
    department_id,
    academic_period_id,
    unit_id,
    assessment_type,
    maximum_mark,
    pass_mark
  ) values (
    v_department_id,
    p_academic_period_id,
    p_unit_id,
    'exam',
    100,
    40
  )
  on conflict do nothing;

  -- 5. Synchronize registered students into the candidate roster
  insert into public.assessment_population (
    assessment_event_id,
    student_id,
    attendance_status,
    population_status
  )
  select distinct
    v_event_id,
    sur.student_id,
    'expected'::public.assessment_attendance_status,
    'expected'::public.assessment_population_status
  from public.student_unit_registrations sur
  where sur.unit_id = p_unit_id
    and sur.academic_period_id = p_academic_period_id
    and sur.registration_status = 'registered'
  on conflict do nothing;

  -- Also pull from cohort students for allocated unit
  insert into public.assessment_population (
    assessment_event_id,
    student_id,
    attendance_status,
    population_status
  )
  select distinct
    v_event_id,
    s.id,
    'expected'::public.assessment_attendance_status,
    'expected'::public.assessment_population_status
  from public.teaching_allocations ta
  join public.students s on s.current_cohort_id = ta.cohort_id
  where ta.unit_id = p_unit_id
    and ta.academic_period_id = p_academic_period_id
    and s.lifecycle_status in ('admitted', 'active')
  on conflict do nothing;

  return v_event_id;
exception when others then
  return null;
end;
$$;

grant execute on function public.ensure_unit_markbook_ready(uuid, uuid) to authenticated;
grant execute on function public.ensure_unit_markbook_ready(uuid, uuid) to service_role;

