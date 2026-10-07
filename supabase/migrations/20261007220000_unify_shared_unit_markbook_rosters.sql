begin;

-- ============================================================================
-- 1. Redefine ensure_unit_markbook_ready to Unify Shared Class Markbook Rosters
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
  v_related_unit_ids uuid[];
  v_related_cohort_ids uuid[];
begin
  -- 1. Discover all related units and cohorts for shared classes / combined offerings
  select array_agg(distinct u_id)
  into v_related_unit_ids
  from (
    select p_unit_id as u_id
    union
    select uo.unit_id
    from public.unit_offerings uo
    where uo.academic_period_id = p_academic_period_id
      and uo.confirmed_shared_offering_id is not null
      and uo.confirmed_shared_offering_id in (
        select confirmed_shared_offering_id
        from public.unit_offerings
        where unit_id = p_unit_id
          and academic_period_id = p_academic_period_id
          and confirmed_shared_offering_id is not null
      )
    union
    select ta.unit_id
    from public.teaching_allocations ta
    where ta.academic_period_id = p_academic_period_id
      and ta.teaching_offering_id is not null
      and ta.teaching_offering_id in (
        select teaching_offering_id
        from public.teaching_allocations
        where unit_id = p_unit_id
          and academic_period_id = p_academic_period_id
          and teaching_offering_id is not null
      )
  ) t;

  if v_related_unit_ids is null or array_length(v_related_unit_ids, 1) = 0 then
    v_related_unit_ids := array[p_unit_id];
  end if;

  select array_agg(distinct c_id)
  into v_related_cohort_ids
  from (
    select ta.cohort_id as c_id
    from public.teaching_allocations ta
    where ta.academic_period_id = p_academic_period_id
      and ta.unit_id = any(v_related_unit_ids)
    union
    select unnest(ta.participant_cohort_ids) as c_id
    from public.teaching_allocations ta
    where ta.academic_period_id = p_academic_period_id
      and ta.unit_id = any(v_related_unit_ids)
      and ta.participant_cohort_ids is not null
    union
    select uo.cohort_id as c_id
    from public.unit_offerings uo
    where uo.academic_period_id = p_academic_period_id
      and uo.unit_id = any(v_related_unit_ids)
      and uo.cohort_id is not null
  ) c
  where c_id is not null;

  -- 2. Check if an active markbook already exists for this unit and period
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
  else
    -- Determine department for the unit
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

    -- Create the Unit Markbook assessment event
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
  end if;

  -- 3. Ensure assessment rule exists with 100 max mark
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

  -- 4. Synchronize registered students across all related units into assessment_roster
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
    sur.unit_id,
    sur.registration_status,
    'expected'
  from public.student_unit_registrations sur
  join public.students s on s.id = sur.student_id
  where sur.unit_id = any(v_related_unit_ids)
    and sur.academic_period_id = p_academic_period_id
    and sur.registration_status = 'registered'
    and s.lifecycle_status in ('admitted', 'active')
  on conflict (assessment_id, student_id) do nothing;

  -- Also synchronize active students in related cohorts if not already in roster
  if v_related_cohort_ids is not null and array_length(v_related_cohort_ids, 1) > 0 then
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
      s.current_cohort_id,
      p_academic_period_id,
      p_unit_id,
      'registered',
      'expected'
    from public.students s
    where s.current_cohort_id = any(v_related_cohort_ids)
      and s.lifecycle_status in ('admitted', 'active')
    on conflict (assessment_id, student_id) do nothing;
  end if;

  -- 5. Synchronize into assessment_population for HOD / analysis views
  insert into public.assessment_population (
    assessment_event_id,
    student_id,
    cohort_id,
    attendance_status,
    population_status
  )
  select distinct
    v_event_id,
    r.student_id,
    r.cohort_id,
    case when r.pre_assessment_status = 'absent' then 'absent'::public.assessment_attendance_status else 'present'::public.assessment_attendance_status end,
    'expected'::public.assessment_population_status
  from public.assessment_roster r
  where r.assessment_id = v_event_id
  on conflict do nothing;

  return v_event_id;
end;
$$;

-- ============================================================================
-- 2. Redefine submit_assessment_online_marks to Commit Results for All Cohorts
-- ============================================================================

create or replace function public.submit_assessment_online_marks(
  target_assessment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status text;
  target_type text;
  target_locked_at timestamptz;
  target_period_id uuid;
  target_unit_id uuid;
  configured_maximum numeric;
  expected_count integer := 0;
  absent_count integer := 0;
  result_count integer := 0;
  submission_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.assessment_actor_can_manage_assessment(
    target_assessment_id
  ) then
    raise exception
      'This assessment is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  select
    coalesce(workspace.workflow_status, 'open'),
    coalesce(workspace.assessment_type, 'exam'),
    workspace.population_locked_at,
    workspace.academic_period_id,
    workspace.unit_id
  into
    target_status,
    target_type,
    target_locked_at,
    target_period_id,
    target_unit_id
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id
  for update;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment has already left editable marks entry.'
      using errcode = '23514';
  end if;

  -- Seamless auto-lock if not locked yet
  if target_locked_at is null then
    update public.assessment_events
    set population_locked_at = now()
    where id = target_assessment_id;
  end if;

  -- Ensure rule exists
  insert into public.assessment_rules (
    academic_period_id,
    unit_id,
    assessment_type,
    maximum_mark,
    pass_mark
  ) values (
    target_period_id,
    target_unit_id,
    'exam',
    100,
    40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set maximum_mark = 100, pass_mark = 40;

  select
    count(*) filter (where roster.pre_assessment_status = 'expected')::integer,
    count(*) filter (where roster.pre_assessment_status = 'absent')::integer
  into
    expected_count,
    absent_count
  from public.assessment_roster as roster
  where roster.assessment_id = target_assessment_id;

  if (expected_count + absent_count) = 0 then
    raise exception
      'The assessment roster is empty. No students found for this unit.'
      using errcode = 'P0002';
  end if;

  -- Verify all students have draft marks
  if exists (
    select 1
    from public.assessment_roster as roster
    left join public.assessment_online_mark_drafts as draft
      on draft.assessment_id = roster.assessment_id
     and draft.student_id = roster.student_id
    where roster.assessment_id = target_assessment_id
      and (
        draft.student_id is null
        or draft.assignment_mark is null
        or draft.presentation_mark is null
        or draft.rat_mark is null
        or draft.cat_mark is null
        or (roster.pre_assessment_status = 'expected' and draft.exam_mark is null)
        or (roster.pre_assessment_status = 'absent'   and draft.exam_mark is not null)
      )
  ) then
    raise exception
      'Missing marks remain. Assignment, Presentation, RAT and CAT are required for every student; Exam is required for students expected to sit.'
      using errcode = '23514';
  end if;

  -- Remove any previous results for this assessment before committing fresh online submission
  delete from public.assessment_results
  where assessment_event_id = target_assessment_id;

  -- Insert official results for target_assessment_id
  insert into public.assessment_results (
    assessment_event_id,
    student_id,
    cohort_id,
    component_marks,
    total_mark,
    grade,
    comment,
    operational_mark,
    operational_result_status,
    import_source,
    imported_at
  )
  select
    roster.assessment_id,
    roster.student_id,
    roster.cohort_id,
    jsonb_build_object(
      'assignment', draft.assignment_mark,
      'presentation', draft.presentation_mark,
      'rat', draft.rat_mark,
      'cat1', draft.cat_mark,
      'ratCatAverage', (draft.rat_mark + draft.cat_mark) / 2.0,
      'coursework', draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0),
      'exam', case when roster.pre_assessment_status = 'absent' then null else draft.exam_mark end,
      'total', case
        when roster.pre_assessment_status = 'absent' then null
        else draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark
      end
    ),
    case
      when roster.pre_assessment_status = 'absent' then null
      else round((draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark)::numeric, 2)
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'ABSENT'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 75 then 'DISTINCTION'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 65 then 'CREDIT'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 40 then 'PASS'
      else 'REFER'
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'Exam Absent'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 40 then 'Pass'
      else 'Refer'
    end,
    case
      when roster.pre_assessment_status = 'absent' then null
      else round((draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark)::numeric, 2)
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'absent'
      else 'sat'
    end,
    'online',
    now()
  from public.assessment_roster as roster
  join public.assessment_online_mark_drafts as draft
    on draft.assessment_id = roster.assessment_id
   and draft.student_id = roster.student_id
  where roster.assessment_id = target_assessment_id;

  get diagnostics result_count = row_count;

  -- Synchronize results into each student's registered unit assessment event if different
  insert into public.assessment_results (
    assessment_event_id,
    student_id,
    cohort_id,
    component_marks,
    total_mark,
    grade,
    comment,
    operational_mark,
    operational_result_status,
    import_source,
    imported_at
  )
  select
    sibling_ae.id,
    res.student_id,
    res.cohort_id,
    res.component_marks,
    res.total_mark,
    res.grade,
    res.comment,
    res.operational_mark,
    res.operational_result_status,
    'online',
    now()
  from public.assessment_results res
  join public.student_unit_registrations sur
    on sur.student_id = res.student_id
   and sur.academic_period_id = target_period_id
   and sur.registration_status = 'registered'
  join public.assessment_events sibling_ae
    on sibling_ae.academic_period_id = target_period_id
   and sibling_ae.unit_id = sur.unit_id
   and (sibling_ae.operational_assessment_type in ('exam', 'unit_markbook') or sibling_ae.assessment_type in ('exam', 'unit_markbook'))
  where res.assessment_event_id = target_assessment_id
    and sibling_ae.id <> target_assessment_id
  on conflict (assessment_event_id, student_id)
  do update set
    component_marks = excluded.component_marks,
    total_mark = excluded.total_mark,
    grade = excluded.grade,
    comment = excluded.comment,
    operational_mark = excluded.operational_mark,
    operational_result_status = excluded.operational_result_status,
    updated_at = now();

  -- Record submission record
  insert into public.assessment_online_mark_submissions (
    assessment_id,
    submitted_by,
    submitted_at,
    result_count,
    absent_count
  ) values (
    target_assessment_id,
    auth.uid(),
    now(),
    result_count,
    absent_count
  )
  on conflict (assessment_id)
  do update set
    submitted_by = auth.uid(),
    submitted_at = now(),
    result_count = excluded.result_count,
    absent_count = excluded.absent_count
  returning id into submission_id;

  -- Update event state to submitted for target and any related sibling events in the shared class
  update public.assessment_events
  set
    operational_workflow_status = 'submitted',
    marks_submitted_at = now()
  where id = target_assessment_id;

  update public.assessment_events
  set
    operational_workflow_status = 'submitted',
    marks_submitted_at = now()
  where id in (
    select distinct sibling_ae.id
    from public.assessment_results res
    join public.student_unit_registrations sur
      on sur.student_id = res.student_id
     and sur.academic_period_id = target_period_id
    join public.assessment_events sibling_ae
      on sibling_ae.academic_period_id = target_period_id
     and sibling_ae.unit_id = sur.unit_id
    where res.assessment_event_id = target_assessment_id
  );

  return jsonb_build_object(
    'submissionId', submission_id,
    'assessmentId', target_assessment_id,
    'status', 'submitted',
    'resultCount', result_count,
    'absentCount', absent_count
  );
end;
$$;

-- ============================================================================
-- 3. Synchronize All Active Markbooks Across the System
-- ============================================================================

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
