-- ============================================================================
-- Migration: Allow Trainer Access to Shared and Equivalent Assessments & Roster Sync
--
-- 1. Updates public.trainer_can_access_assessment to recognize:
--    - Direct unit allocations
--    - Shared offerings (confirmed_shared_offering_id)
--    - Approved equivalence groups (unit_equivalence_members)
-- 2. Hardens ensure_unit_markbook_ready to discover shared offering units
--    without depending on teaching_offerings table and ensures idempotent
--    roster insertion runs even when trainer_entry_open is true.
-- 3. Hardens save_assessment_online_component_marks to ensure all submitted
--    students are present in assessment_roster before building merged entries.
-- 4. Reconciles assessment_roster across all Food Production sibling events.
-- ============================================================================

begin;

-- 1. Update trainer_can_access_assessment
create or replace function public.trainer_can_access_assessment(
  target_assessment_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_cohort_id uuid;
  target_unit_id uuid;
begin
  if public.current_trainer_id() is null then
    return false;
  end if;

  select
    event.academic_period_id,
    event.cohort_id,
    event.unit_id
  into
    target_period_id,
    target_cohort_id,
    target_unit_id
  from public.assessment_events as event
  where event.id = target_assessment_id;

  if not found then
    return false;
  end if;

  return exists (
    select 1
    from public.teaching_allocations as allocation
    where allocation.trainer_id = public.current_trainer_id()
      and allocation.academic_period_id = target_period_id
      and (
        -- 1. Direct unit match
        allocation.unit_id = target_unit_id
        or
        -- 2. Shared offering match
        exists (
          select 1
          from public.unit_offerings uo_target
          join public.unit_offerings uo_alloc
            on uo_alloc.confirmed_shared_offering_id = uo_target.confirmed_shared_offering_id
           and uo_alloc.academic_period_id = uo_target.academic_period_id
          where uo_target.unit_id = target_unit_id
            and uo_target.academic_period_id = target_period_id
            and uo_target.confirmed_shared_offering_id is not null
            and uo_alloc.unit_id = allocation.unit_id
        )
        or
        -- 3. Approved unit equivalence match
        exists (
          select 1
          from public.unit_equivalence_members eq_target
          join public.unit_equivalence_members eq_alloc
            on eq_alloc.equivalence_group_id = eq_target.equivalence_group_id
           and eq_alloc.status = 'approved'
          where eq_target.unit_id = target_unit_id
            and eq_target.status = 'approved'
            and eq_alloc.unit_id = allocation.unit_id
        )
      )
      and (
        target_cohort_id is null
        or allocation.cohort_id is null
        or allocation.cohort_id = target_cohort_id
        or exists (
          select 1
          from public.unit_offerings uo
          where uo.unit_id = target_unit_id
            and uo.academic_period_id = target_period_id
            and uo.confirmed_shared_offering_id is not null
        )
        or exists (
          select 1
          from public.unit_equivalence_members eq
          where eq.unit_id = target_unit_id
            and eq.status = 'approved'
        )
      )
      and allocation.status::text in (
        'active',
        'completed'
      )
  );
end;
$$;

revoke all on function public.trainer_can_access_assessment(uuid) from public;
grant execute on function public.trainer_can_access_assessment(uuid) to authenticated;

comment on function public.trainer_can_access_assessment(uuid) is
  'True when the authenticated trainer has an active allocation for the unit, its confirmed shared offering group, or its approved equivalence group.';

-- 2. Update ensure_unit_markbook_ready
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

  -- Populate / update roster (idempotent, does not overwrite existing records)
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
    and (student.department_id is null or student.department_id = v_department_id)
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(registered_unit.department_id, registered_programme.department_id) = v_department_id
  order by registration.student_id, registration.registered_at desc
  on conflict (assessment_id, student_id) do nothing;

  -- Mirror into the assessment_population table for HOD/analysis views.
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
    and (student.department_id is null or student.department_id = v_department_id)
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(registered_unit.department_id, registered_programme.department_id) = v_department_id
  order by registration.student_id, registration.registered_at desc
  on conflict do nothing;

  return v_event_id;
end;
$$;

revoke all on function public.ensure_unit_markbook_ready(uuid, uuid) from public, anon;
grant execute on function public.ensure_unit_markbook_ready(uuid, uuid) to authenticated, service_role;

-- 3. Upgrade save_assessment_online_component_marks
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

  -- Ensure any students in target_entries exist in assessment_roster before validation
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
  where not exists (
    select 1 from public.assessment_roster r
    where r.assessment_id = target_assessment_id
      and r.student_id = item.student_id
  )
  on conflict (assessment_id, student_id) do nothing;

  if submit_component and exists (
    select 1
    from (select distinct roster.cohort_id from public.assessment_roster roster
          join jsonb_to_recordset(target_entries) as item(student_id uuid)
            on item.student_id = roster.student_id
          where roster.assessment_id = target_assessment_id) selected_cohorts
    join public.assessment_roster roster
      on roster.assessment_id = target_assessment_id
     and roster.cohort_id is not distinct from selected_cohorts.cohort_id
    where not exists (
      select 1 from jsonb_to_recordset(target_entries) as item(student_id uuid)
      where item.student_id = roster.student_id
    )
  ) then
    raise exception 'Include every student in a cohort before submitting its component.' using errcode = '23514';
  end if;

  merged_entries := public.build_assessment_mark_component_entries(
    target_assessment_id, null, target_component, target_entries
  );

  -- Keep CAT absence as an explicit roster status. This update and the mark
  -- submission share the same transaction because both happen in this RPC.
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
    where (target_component = 'assignment' and item.assignment is null)
       or (target_component = 'presentation' and item.presentation is null)
       or (target_component = 'rat' and item.rat is null)
       or (target_component = 'cat' and item.cat is null and not roster.cat_absent)
       or (target_component = 'exam' and roster.pre_assessment_status = 'expected' and item.exam is null)
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
      from (select distinct cohort_id from public.assessment_roster where assessment_id = target_assessment_id) cohorts
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

-- 4. Reconcile Food Production rosters across all 4 sibling events
do $$
begin
  perform public.ensure_unit_markbook_ready('2f94652a-1c40-4359-bd1b-21f25f92d2bf'::uuid, '6368bf1f-b5e6-41cc-b2d9-377c8c4105cd'::uuid);
  perform public.ensure_unit_markbook_ready('2f94652a-1c40-4359-bd1b-21f25f92d2bf'::uuid, '4b089b9e-3917-47b9-aa45-0288dce77edc'::uuid);
  perform public.ensure_unit_markbook_ready('2f94652a-1c40-4359-bd1b-21f25f92d2bf'::uuid, '3932e9f9-13e3-440b-a664-702da0c5b90e'::uuid);
  perform public.ensure_unit_markbook_ready('2f94652a-1c40-4359-bd1b-21f25f92d2bf'::uuid, '7e039be5-a48b-483a-bd30-c7babdce8951'::uuid);
end $$;

commit;
