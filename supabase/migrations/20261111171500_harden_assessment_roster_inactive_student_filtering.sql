-- ============================================================================
-- Migration: Harden Assessment Roster Against Inactive Student Lifecycle Changes
--
-- 1. Cleans up lingering inactive students (dropped_out, deferred, suspended,
--    withdrawn, completed, graduated) or non-in_class students from open,
--    unsubmitted assessment_roster records.
-- 2. Adds an automated trigger on public.students to remove students from open,
--    unsubmitted assessment rosters whenever their lifecycle_status or
--    academic_phase transitions to an inactive state.
-- 3. Hardens public.ensure_unit_markbook_ready to only populate active candidates
--    (lifecycle_status in ('admitted', 'active') and academic_phase = 'in_class').
-- 4. Hardens public.save_assessment_online_component_marks so that cohort
--    completeness checks only require active candidates, preventing dropped-out
--    or deferred students from blocking legitimate trainer mark submissions.
-- 5. Hardens public.submit_assessment_online_marks so that final markbook
--    validation and results insertion strictly target active candidates.
-- ============================================================================

begin;

-- 1. Reconcile open assessment rosters to exclude inactive/non-in_class candidates
delete from public.assessment_roster ar
using public.students s, public.assessment_events ae
where ar.student_id = s.id
  and ar.assessment_id = ae.id
  and (
    s.lifecycle_status not in ('admitted', 'active')
    or coalesce(s.academic_phase, 'in_class') <> 'in_class'
  )
  and ae.status = 'open'
  and ae.marks_submitted_at is null
  and not exists (
    select 1 from public.assessment_results res
    where res.assessment_event_id = ae.id and res.student_id = s.id
  );

-- 2. Trigger function to synchronize student lifecycle transitions with assessment_roster
create or replace function public.handle_student_lifecycle_assessment_roster_sync()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if (
    new.lifecycle_status not in ('admitted', 'active')
    or coalesce(new.academic_phase, 'in_class') <> 'in_class'
  ) then
    delete from public.assessment_roster ar
    using public.assessment_events ae
    where ar.student_id = new.id
      and ar.assessment_id = ae.id
      and ae.status = 'open'
      and ae.marks_submitted_at is null
      and not exists (
        select 1 from public.assessment_results res
        where res.assessment_event_id = ae.id and res.student_id = new.id
      );
  end if;
  return new;
end;
$$;

drop trigger if exists trigger_sync_student_lifecycle_assessment_roster on public.students;
create trigger trigger_sync_student_lifecycle_assessment_roster
  after update of lifecycle_status, academic_phase on public.students
  for each row
  execute function public.handle_student_lifecycle_assessment_roster_sync();

-- 3. Upgrade ensure_unit_markbook_ready with active candidate filtering
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

  -- 1. Shared offerings
  select array_agg(distinct related_offering.unit_id)
  into v_related_unit_ids
  from public.unit_offerings base_offering
  join public.unit_offerings related_offering
    on related_offering.confirmed_shared_offering_id = base_offering.confirmed_shared_offering_id
   and related_offering.academic_period_id = p_academic_period_id
  join public.units related_unit
    on related_unit.id = related_offering.unit_id
  left join public.programmes related_programme
    on related_programme.id = related_unit.programme_id
  where base_offering.unit_id = p_unit_id
    and base_offering.academic_period_id = p_academic_period_id
    and base_offering.confirmed_shared_offering_id is not null
    and coalesce(related_unit.department_id, related_programme.department_id) = v_department_id;

  -- 2. Equivalence groups
  select coalesce(v_related_unit_ids, array[]::uuid[]) || coalesce(array_agg(distinct eq_sib.unit_id), array[]::uuid[])
  into v_related_unit_ids
  from public.unit_equivalence_members eq_base
  join public.unit_equivalence_members eq_sib
    on eq_sib.equivalence_group_id = eq_base.equivalence_group_id
   and eq_sib.status = 'approved'
  where eq_base.unit_id = p_unit_id
    and eq_base.status = 'approved';

  v_related_unit_ids := array_append(coalesce(v_related_unit_ids, array[]::uuid[]), p_unit_id);

  select id into v_event_id
  from public.assessment_events
  where academic_period_id = p_academic_period_id
    and unit_id = p_unit_id
    and assessment_type = 'exam'
  order by created_at desc
  limit 1;

  if v_event_id is not null then
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

  -- Populate / update roster strictly for active students expected to sit
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
    and coalesce(registered_unit.department_id, registered_programme.department_id) = v_department_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class'
  order by registration.student_id, registration.registered_at desc
  on conflict do nothing;

  return v_event_id;
end;
$$;

revoke all on function public.ensure_unit_markbook_ready(uuid, uuid) from public, anon;
grant execute on function public.ensure_unit_markbook_ready(uuid, uuid) to authenticated, service_role;

-- 4. Upgrade save_assessment_online_component_marks with active student cohort check
create or replace function public.save_assessment_online_component_marks(
  target_assessment_id uuid,
  target_component text,
  target_entries jsonb,
  submit_component boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  merged_entries jsonb;
  submission_cohorts uuid[];
  sibling_event_ids uuid[];
  sib_id uuid;
  result jsonb;
  final_ready boolean;
begin
  if auth.uid() is null or not public.assessment_actor_can_manage_assessment(target_assessment_id) then
    raise exception 'This assessment is outside your Teaching Allocations.' using errcode = '42501';
  end if;
  if target_component = 'all' and submit_component then
    raise exception 'Choose one component to submit.' using errcode = '22023';
  end if;

  -- Ensure any active students in target_entries exist in assessment_roster before validation
  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    pre_assessment_status
  )
  select distinct
    target_assessment_id,
    item.student_id,
    coalesce(s.current_cohort_id, s.admission_cohort_id),
    ae.academic_period_id,
    ae.unit_id,
    'expected'
  from jsonb_to_recordset(target_entries) as item(student_id uuid)
  join public.students s on s.id = item.student_id
  join public.assessment_events ae on ae.id = target_assessment_id
  where s.lifecycle_status in ('admitted', 'active')
    and coalesce(s.academic_phase, 'in_class') = 'in_class'
    and not exists (
      select 1 from public.assessment_roster r
      where r.assessment_id = target_assessment_id
        and r.student_id = item.student_id
    )
  on conflict (assessment_id, student_id) do nothing;

  -- Cohort completeness validation: only require active classroom students
  if submit_component and exists (
    select 1
    from (select distinct roster.cohort_id from public.assessment_roster roster
          join jsonb_to_recordset(target_entries) as item(student_id uuid)
            on item.student_id = roster.student_id
          where roster.assessment_id = target_assessment_id) selected_cohorts
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id
     and roster.cohort_id is not distinct from selected_cohorts.cohort_id
    join public.students student
      on student.id = roster.student_id
    where student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
      and not exists (
        select 1 from jsonb_to_recordset(target_entries) as item(student_id uuid)
        where item.student_id = roster.student_id
      )
  ) then
    raise exception 'Include every student in a cohort before submitting its component.' using errcode = '23514';
  end if;

  merged_entries := public.build_assessment_mark_component_entries(
    target_assessment_id, null, target_component, target_entries
  );

  -- Keep CAT absence as an explicit roster status.
  if target_component in ('all', 'cat') then
    update public.assessment_roster roster
    set cat_absent = coalesce(item.cat_absent, false)
    from jsonb_to_recordset(target_entries) as item(student_id uuid, cat_absent boolean)
    where roster.assessment_id = target_assessment_id
      and roster.student_id = item.student_id;
  end if;

  if submit_component and exists (
    select 1
    from jsonb_to_recordset(merged_entries) as item(
      student_id uuid, assignment numeric, presentation numeric, rat numeric, cat numeric, exam numeric
    )
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id and roster.student_id = item.student_id
    join public.students student
      on student.id = roster.student_id
    where student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
      and (
        (target_component = 'assignment' and item.assignment is null)
        or (target_component = 'presentation' and item.presentation is null)
        or (target_component = 'rat' and item.rat is null)
        or (target_component = 'cat' and item.cat is null and not roster.cat_absent)
        or (target_component = 'exam' and roster.pre_assessment_status = 'expected' and item.exam is null)
      )
  ) then
    raise exception 'Complete this component for the selected students before submitting.' using errcode = '23514';
  end if;

  result := public.save_assessment_online_marks(target_assessment_id, merged_entries);

  if submit_component then
    -- Discover target event + sibling events in shared offerings or approved equivalence groups
    select coalesce(array_agg(distinct sibling_id), array[target_assessment_id])
    into sibling_event_ids
    from (
      select target_assessment_id as sibling_id
      union
      -- Shared offerings
      select ae_sib.id as sibling_id
      from public.assessment_events ae_target
      join public.unit_offerings uo_target
        on uo_target.unit_id = ae_target.unit_id
       and uo_target.academic_period_id = ae_target.academic_period_id
       and uo_target.confirmed_shared_offering_id is not null
      join public.unit_offerings uo_sib
        on uo_sib.confirmed_shared_offering_id = uo_target.confirmed_shared_offering_id
       and uo_sib.academic_period_id = uo_target.academic_period_id
      join public.assessment_events ae_sib
        on ae_sib.unit_id = uo_sib.unit_id
       and ae_sib.academic_period_id = uo_sib.academic_period_id
       and ae_sib.assessment_type = 'exam'
      where ae_target.id = target_assessment_id
      union
      -- Approved unit equivalence groups
      select ae_sib.id as sibling_id
      from public.assessment_events ae_target
      join public.unit_equivalence_members eq_target
        on eq_target.unit_id = ae_target.unit_id
       and eq_target.status = 'approved'
      join public.unit_equivalence_members eq_sib
        on eq_sib.equivalence_group_id = eq_target.equivalence_group_id
       and eq_sib.status = 'approved'
      join public.assessment_events ae_sib
        on ae_sib.unit_id = eq_sib.unit_id
       and ae_sib.academic_period_id = ae_target.academic_period_id
       and ae_sib.assessment_type = 'exam'
      where ae_target.id = target_assessment_id
    ) s;

    select array_agg(distinct roster.cohort_id) into submission_cohorts
    from jsonb_to_recordset(merged_entries) as item(student_id uuid)
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id and roster.student_id = item.student_id;

    -- Record component submission across target and all sibling assessment events
    foreach sib_id in array sibling_event_ids loop
      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, submitted_by
      )
      select sib_id, cohort_id, target_component, auth.uid()
      from unnest(submission_cohorts) as cohort_id
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

      -- Also ensure global cohort fallback entry
      insert into public.assessment_mark_component_submissions (
        assessment_id, cohort_id, component_key, submitted_by
      )
      values (sib_id, null, target_component, auth.uid())
      on conflict (assessment_id, (coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid)), component_key) do nothing;

      -- Maintain cat_marks_finalized_at on assessment_events
      if target_component = 'cat' then
        update public.assessment_events
        set cat_marks_finalized_at = coalesce(cat_marks_finalized_at, now())
        where id = sib_id;
      end if;
    end loop;

    select not exists (
      select 1
      from (
        select distinct roster.cohort_id
        from public.assessment_roster roster
        join public.students s on s.id = roster.student_id
        where roster.assessment_id = target_assessment_id
          and s.lifecycle_status in ('admitted', 'active')
          and coalesce(s.academic_phase, 'in_class') = 'in_class'
      ) cohorts
      cross join unnest(array['assignment', 'presentation', 'rat', 'cat', 'exam']::text[]) components(component_key)
      where not exists (
        select 1 from public.assessment_mark_component_submissions submission
        where submission.assessment_id = target_assessment_id
          and submission.cohort_id is not distinct from cohorts.cohort_id
          and submission.component_key = components.component_key
      )
    ) into final_ready;

    if final_ready then
      update public.assessment_events
      set operational_workflow_status = 'submitted',
          marks_submitted_at = coalesce(marks_submitted_at, now())
      where id = any(sibling_event_ids);
    end if;
  end if;

  return result;
end;
$$;

revoke all on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) from public;
grant execute on function public.save_assessment_online_component_marks(uuid, text, jsonb, boolean) to authenticated;

-- 5. Upgrade submit_assessment_online_marks with active student filtering
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
  expected_count integer := 0;
  absent_count integer := 0;
  result_count integer := 0;
  submission_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not public.assessment_actor_can_manage_assessment(target_assessment_id) then
    raise exception 'This assessment is outside your Teaching Allocations.' using errcode = '42501';
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
  from public.assessment_event_workspace as workspace
  where workspace.id = target_assessment_id
  for update;

  if not found then
    raise exception 'Assessment was not found.' using errcode = 'P0002';
  end if;

  if target_status in ('submitted', 'finalised', 'archived') then
    raise exception 'This assessment has already left editable marks entry.' using errcode = '23514';
  end if;

  if target_locked_at is null then
    update public.assessment_events
    set population_locked_at = now()
    where id = target_assessment_id;
  end if;

  -- Ensure rule exists
  insert into public.assessment_rules (
    academic_period_id, unit_id, assessment_type, maximum_mark, pass_mark
  ) values (
    target_period_id, target_unit_id, 'exam', 100, 40
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
  join public.students as student on student.id = roster.student_id
  where roster.assessment_id = target_assessment_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class';

  if (expected_count + absent_count) = 0 then
    raise exception 'The assessment roster is empty. No active students found for this unit.' using errcode = 'P0002';
  end if;

  -- Verify all active students have draft marks
  if exists (
    select 1
    from public.assessment_roster as roster
    join public.students as student on student.id = roster.student_id
    left join public.assessment_online_mark_drafts as draft
      on draft.assessment_id = roster.assessment_id
     and draft.student_id = roster.student_id
    where roster.assessment_id = target_assessment_id
      and student.lifecycle_status in ('admitted', 'active')
      and coalesce(student.academic_phase, 'in_class') = 'in_class'
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

  delete from public.assessment_results
  where assessment_event_id = target_assessment_id;

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
  join public.students as student on student.id = roster.student_id
  join public.assessment_online_mark_drafts as draft
    on draft.assessment_id = roster.assessment_id
   and draft.student_id = roster.student_id
  where roster.assessment_id = target_assessment_id
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(student.academic_phase, 'in_class') = 'in_class';

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

revoke all on function public.submit_assessment_online_marks(uuid) from public;
grant execute on function public.submit_assessment_online_marks(uuid) to authenticated;

-- 6. Synchronize Diet Therapy I markbooks for both DND 1202 and CND 1202
do $$
begin
  perform public.ensure_unit_markbook_ready('2f94652a-1c40-4359-bd1b-21f25f92d2bf'::uuid, 'c11345b8-a7c8-44f0-a157-8b0a5fe2504f'::uuid);
  perform public.ensure_unit_markbook_ready('2f94652a-1c40-4359-bd1b-21f25f92d2bf'::uuid, '2db7ed51-a011-4e18-9b07-a9ef87625bc8'::uuid);
end $$;

commit;
