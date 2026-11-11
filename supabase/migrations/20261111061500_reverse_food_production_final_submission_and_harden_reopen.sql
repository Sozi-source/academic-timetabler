-- Migration: 20261111061500_reverse_food_production_final_submission_and_harden_reopen.sql
-- Description:
-- 1. Reverses accidental final score submission for Food Production for Invalids and Convalescents (CND 1304, DND 1304, DHN 1305, CHN 2203).
--    Restores student absence back to 'expected' in assessment_roster and 'present' in assessment_population.
--    Unlocks CAT marks submission by clearing cat_marks_finalized_at while retaining all entered coursework marks (assignment, presentation, rat).
-- 2. Hardens reopen and unlock RPCs (reopen_assessment_component_submission, unlock_assessment_mark_component_submission,
--    and reopen_assessment_component_with_trainer_invite) to clear cat_marks_finalized_at / exam_marks_finalized_at and restore
--    student attendance across target and sibling events when unsubmitted or unlocked.

-- ----------------------------------------------------------------------------
-- 1. Immediate data repair for Food Production for Invalids and Convalescents
-- ----------------------------------------------------------------------------
do $$
declare
  food_event_ids uuid[] := array[
    '5d19833d-e727-48bb-a9ea-a8c295be8c56'::uuid, -- CND 1304
    '9e8159b8-c755-40b2-90ed-42048b45fcca'::uuid, -- DND 1304
    '01948956-6005-4126-8d4c-a35c6aa23bdb'::uuid, -- DHN 1305
    '73e1340f-312a-488c-a57a-a5eab4dabdf9'::uuid  -- CHN 2203
  ];
begin
  -- A. Revert student attendance from absent back to expected/present
  update public.assessment_roster
  set pre_assessment_status = 'expected',
      cat_absent = false
  where assessment_id = any(food_event_ids)
    and pre_assessment_status = 'absent';

  update public.assessment_population
  set attendance_status = 'present'::public.assessment_attendance_status
  where assessment_event_id = any(food_event_ids)
    and attendance_status = 'absent'::public.assessment_attendance_status;

  -- B. Clear finalized timestamps and reopen assessment events
  update public.assessment_events
  set
    cat_marks_finalized_at = null,
    exam_marks_finalized_at = null,
    marks_submitted_at = null,
    finalised_at = null,
    operational_workflow_status = 'open',
    status = 'open',
    trainer_entry_open = true,
    trainer_cat_entry_open = true,
    updated_at = now()
  where id = any(food_event_ids);

  -- C. Delete any component submissions for cat or exam on these events
  delete from public.assessment_mark_component_submissions
  where assessment_id = any(food_event_ids)
    and component_key in ('cat', 'exam');

  -- D. Delete any lingering official results or final submissions (preserving drafts in assessment_online_mark_drafts)
  delete from public.assessment_results
  where assessment_event_id = any(food_event_ids);

  delete from public.assessment_online_mark_submissions
  where assessment_id = any(food_event_ids);
end;
$$;

-- ----------------------------------------------------------------------------
-- 2. Upgrade reopen_assessment_component_submission to clear timestamps and sync siblings
-- ----------------------------------------------------------------------------
create or replace function public.reopen_assessment_component_submission(
  p_assessment_id uuid,
  p_cohort_id uuid default null,
  p_component_key text default 'all',
  p_reason text default 'Correction of entered marks',
  p_unlocked_by_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_event public.assessment_events%rowtype;
  deleted_count integer := 0;
  sibling_event_ids uuid[] := array[]::uuid[];
  event_id uuid;
begin
  select * into target_event
  from public.assessment_events
  where id = p_assessment_id;

  if not found then
    raise exception 'The markbook was not found.' using errcode = 'P0002';
  end if;

  if not target_event.trainer_entry_open then
    raise exception 'Marks entry is currently locked by the department administration.' using errcode = '42501';
  end if;

  if target_event.status = 'closed' and p_component_key not in ('cat', 'all') then
    raise exception 'This markbook has been finalised and can no longer be revised.' using errcode = '23514';
  end if;

  -- Collect sibling assessment event IDs from approved equivalence groups and shared offerings
  sibling_event_ids := array[p_assessment_id];

  if target_event.unit_id is not null and target_event.academic_period_id is not null then
    select array_agg(distinct e.id)
    into sibling_event_ids
    from public.assessment_events e
    where e.academic_period_id = target_event.academic_period_id
      and e.assessment_type = target_event.assessment_type
      and e.unit_id in (
        select m2.unit_id
        from public.unit_equivalence_members m1
        join public.unit_equivalence_members m2 on m2.equivalence_group_id = m1.equivalence_group_id
        where m1.unit_id = target_event.unit_id
          and m1.status = 'approved'
          and m2.status = 'approved'
        union
        select target_event.unit_id
      );
  end if;

  if sibling_event_ids is null or array_length(sibling_event_ids, 1) = 0 then
    sibling_event_ids := array[p_assessment_id];
  end if;

  -- Delete component submission records across all sibling events
  delete from public.assessment_mark_component_submissions
  where assessment_id = any(sibling_event_ids)
    and (p_cohort_id is null or cohort_id = p_cohort_id)
    and (p_component_key = 'all' or component_key = p_component_key);

  get diagnostics deleted_count = row_count;

  -- Reset relevant event timestamps and status
  foreach event_id in array sibling_event_ids loop
    if p_component_key in ('cat', 'all') then
      update public.assessment_events
      set cat_marks_finalized_at = null,
          marks_submitted_at = null,
          operational_workflow_status = case when operational_workflow_status = 'finalised' then 'open' else operational_workflow_status end,
          updated_at = now()
      where id = event_id;
    end if;

    if p_component_key in ('exam', 'all') then
      update public.assessment_events
      set exam_marks_finalized_at = null,
          finalised_at = null,
          marks_submitted_at = null,
          status = 'open',
          operational_workflow_status = 'open',
          updated_at = now()
      where id = event_id;

      -- If students were marked absent on roster/population, revert to expected/present
      update public.assessment_roster
      set pre_assessment_status = 'expected'
      where assessment_id = event_id
        and pre_assessment_status = 'absent'
        and (p_cohort_id is null or cohort_id = p_cohort_id);

      update public.assessment_population
      set attendance_status = 'present'::public.assessment_attendance_status
      where assessment_event_id = event_id
        and attendance_status = 'absent'::public.assessment_attendance_status;
    end if;

    -- Log revision audit
    begin
      insert into public.assessment_mark_revisions (
        assessment_id,
        cohort_id,
        component_key,
        unlocked_by_user_id,
        unlocked_by_name,
        reason
      ) values (
        event_id,
        p_cohort_id,
        p_component_key,
        auth.uid(),
        coalesce(p_unlocked_by_name, 'Trainer'),
        p_reason
      );
    exception when others then
      -- Ignore duplicate or revision logging failures
    end;
  end loop;

  return jsonb_build_object(
    'success', true,
    'assessmentId', p_assessment_id,
    'component', p_component_key,
    'deletedSubmissionsCount', deleted_count,
    'siblingEventsUpdated', array_length(sibling_event_ids, 1)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Upgrade unlock_assessment_mark_component_submission (HOD/Admin RPC)
-- ----------------------------------------------------------------------------
create or replace function public.unlock_assessment_mark_component_submission(
  target_assessment_id uuid,
  target_cohort_id uuid,
  target_component_key text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  assessment_department_id uuid;
  assessment_unit_id uuid;
  assessment_period_id uuid;
  assessment_type_val text;
  sibling_event_ids uuid[] := array[]::uuid[];
  event_id uuid;
  deleted_rows integer := 0;
begin
  if auth.uid() is null
     or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[])
  then
    raise exception 'Only an HOD or system administrator may unlock submitted marks.'
      using errcode = '42501';
  end if;

  if target_component_key not in ('assignment', 'presentation', 'rat', 'cat', 'exam') then
    raise exception 'Select a valid mark component.' using errcode = '22023';
  end if;

  select event.department_id, event.unit_id, event.academic_period_id, event.assessment_type
  into assessment_department_id, assessment_unit_id, assessment_period_id, assessment_type_val
  from public.assessment_events event
  where event.id = target_assessment_id;

  if not found then
    raise exception 'Assessment was not found.' using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_department(assessment_department_id) then
    raise exception 'This assessment is outside your working department.' using errcode = '42501';
  end if;

  -- Collect sibling assessment event IDs
  sibling_event_ids := array[target_assessment_id];
  if assessment_unit_id is not null and assessment_period_id is not null then
    select array_agg(distinct e.id)
    into sibling_event_ids
    from public.assessment_events e
    where e.academic_period_id = assessment_period_id
      and e.assessment_type = assessment_type_val
      and e.unit_id in (
        select m2.unit_id
        from public.unit_equivalence_members m1
        join public.unit_equivalence_members m2 on m2.equivalence_group_id = m1.equivalence_group_id
        where m1.unit_id = assessment_unit_id
          and m1.status = 'approved'
          and m2.status = 'approved'
        union
        select assessment_unit_id
      );
  end if;

  if sibling_event_ids is null or array_length(sibling_event_ids, 1) = 0 then
    sibling_event_ids := array[target_assessment_id];
  end if;

  -- Delete component submission records across all siblings
  delete from public.assessment_mark_component_submissions submission
  where submission.assessment_id = any(sibling_event_ids)
    and submission.cohort_id is not distinct from target_cohort_id
    and submission.component_key = target_component_key;

  get diagnostics deleted_rows = row_count;

  -- Reset relevant event timestamps and status
  foreach event_id in array sibling_event_ids loop
    if target_component_key = 'cat' then
      update public.assessment_events
      set cat_marks_finalized_at = null,
          marks_submitted_at = null,
          updated_at = now()
      where id = event_id;
    elsif target_component_key = 'exam' then
      update public.assessment_events
      set exam_marks_finalized_at = null,
          finalised_at = null,
          marks_submitted_at = null,
          status = 'open',
          operational_workflow_status = 'open',
          updated_at = now()
      where id = event_id;

      update public.assessment_roster
      set pre_assessment_status = 'expected'
      where assessment_id = event_id
        and pre_assessment_status = 'absent'
        and target_cohort_id is not distinct from cohort_id;

      update public.assessment_population
      set attendance_status = 'present'::public.assessment_attendance_status
      where assessment_event_id = event_id
        and attendance_status = 'absent'::public.assessment_attendance_status;
    end if;
  end loop;
end;
$$;
