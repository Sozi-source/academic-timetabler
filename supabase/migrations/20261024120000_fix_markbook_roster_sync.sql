begin;

-- ============================================================================
-- Fix: Unit Markbook Roster Does Not Reflect Student Registration
--
-- Three bugs addressed:
--
--  1. ensure_unit_markbook_ready: student.department_id = v_department_id
--     silently excludes students whose department_id is NULL (derived only
--     through their programme). Relaxed to allow NULL student department.
--
--  2. set_unit_markbook_trainer_entry: when should_open = false (HOD closes
--     trainer entry) the roster is not refreshed, so students who registered
--     during the open window are never added. Now calls ensure_unit_markbook_ready
--     after locking to flush any pending registrations.
--
--  3. department_register_student_units: writes to student_unit_registrations
--     but never syncs the assessment_roster. Now calls ensure_unit_markbook_ready
--     for every registered unit so the markbook roster stays live.
-- ============================================================================


-- ============================================================================
-- 1. Rebuild ensure_unit_markbook_ready with relaxed department filter
--    Replace: student.department_id = v_department_id
--    With:    (student.department_id IS NULL OR student.department_id = v_department_id)
--
--    This preserves the intent (only students belonging to this department's
--    programme appear) while not dropping students whose department_id column
--    is NULL because their department is inferred via programme.
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

  -- FIX 1: Student department filter is relaxed.
  -- Previously: student.department_id = v_department_id
  -- This excluded students with NULL department_id even when their programme
  -- belongs to v_department_id. We now accept NULL (department inferred via
  -- programme) and still require the registered unit to belong to v_department_id.
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
    -- Allow students whose department_id is NULL (inferred from programme)
    and (student.department_id is null or student.department_id = v_department_id)
    and student.lifecycle_status in ('admitted', 'active')
    and coalesce(registered_unit.department_id, registered_programme.department_id) = v_department_id
  order by registration.student_id, registration.registered_at desc
  on conflict (assessment_id, student_id) do nothing;

  -- Mirror into the legacy assessment_population table for HOD/analysis views.
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

comment on function public.ensure_unit_markbook_ready(uuid, uuid) is
  'Prepares unit markbooks from active students registered for the unit or its explicitly confirmed same-department shared offering. Students with NULL department_id (department inferred via programme) are included. Cohort membership alone never enrolls students in a unit.';


-- ============================================================================
-- 2. Fix set_unit_markbook_trainer_entry: re-sync roster when closing
--
--    When the HOD closes trainer entry (should_open = false), any students
--    who registered during the open window are flushed into the roster by
--    calling ensure_unit_markbook_ready immediately after the lock.
--    Opening trainer entry is unchanged — the guard in ensure_unit_markbook_ready
--    prevents mid-entry roster mutations.
-- ============================================================================

create or replace function public.set_unit_markbook_trainer_entry(
  target_assessment_id uuid,
  should_open boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_department_id uuid;
  v_academic_period_id   uuid;
  v_unit_id              uuid;
begin
  if auth.uid() is null or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception 'HOD access is required.' using errcode = '42501';
  end if;

  select active_department_id into selected_department_id
  from public.profiles
  where id = auth.uid() and is_active;

  if not found or selected_department_id is null then
    raise exception 'Select an active department.' using errcode = '42501';
  end if;

  -- Capture period + unit for the post-close roster sync below.
  select academic_period_id, unit_id
  into v_academic_period_id, v_unit_id
  from public.assessment_events
  where id = target_assessment_id
    and department_id = selected_department_id
    and title = 'Unit Markbook'
    and assessment_type = 'exam';

  update public.assessment_events
  set trainer_entry_open = should_open,
      updated_at = now()
  where id = target_assessment_id
    and department_id = selected_department_id
    and title = 'Unit Markbook'
    and assessment_type = 'exam'
    and status <> 'closed'
    and exam_marks_finalized_at is null
    and not exists (
      select 1 from public.assessment_event_workspace workspace
      where workspace.id = assessment_events.id
        and workspace.workflow_status in ('submitted', 'finalised', 'archived')
    );

  if not found then
    raise exception 'This unit markbook cannot be opened or locked.' using errcode = '23514';
  end if;

  -- FIX 2: When the HOD locks trainer entry, immediately flush any students
  -- who registered during the open window into the assessment_roster.
  -- ensure_unit_markbook_ready's own guard now sees trainer_entry_open = false
  -- (we just committed the update above via the same transaction) so the sync
  -- will proceed. If v_unit_id is null the call is a safe no-op.
  if not should_open and v_academic_period_id is not null and v_unit_id is not null then
    perform public.ensure_unit_markbook_ready(v_academic_period_id, v_unit_id);
  end if;
end;
$$;

revoke all on function public.set_unit_markbook_trainer_entry(uuid, boolean) from public, anon;
grant execute on function public.set_unit_markbook_trainer_entry(uuid, boolean) to authenticated;

comment on function public.set_unit_markbook_trainer_entry(uuid, boolean) is
  'HOD-controlled gate for trainer mark entry. Closing (should_open = false) re-syncs the roster so students who registered while the markbook was open are captured before submission.';


-- ============================================================================
-- 3. Fix department_register_student_units: sync markbook roster after each
--    unit registration.
--
--    The function previously wrote only to student_unit_registrations and left
--    the markbook assessment_roster out of sync. Now calls
--    ensure_unit_markbook_ready for each registered unit so the markbook roster
--    reflects the change immediately.
--
--    The call is a no-op if trainer_entry_open = true for that markbook (the
--    guard inside ensure_unit_markbook_ready prevents mid-entry mutations).
--    The HOD will need to close and reopen trainer entry to admit late-registered
--    students — which is the correct operational workflow.
-- ============================================================================

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

    -- FIX 3: Sync the markbook roster for this unit immediately after
    -- inserting/updating the registration. This is a no-op when trainer_entry_open
    -- is true (the guard in ensure_unit_markbook_ready skips the roster sync to
    -- protect an in-progress mark entry session).
    perform public.ensure_unit_markbook_ready(
      target_academic_period_id,
      selected_unit_id
    );
  end loop;

  return submission_id_value;
end;
$$;


-- ============================================================================
-- 4. Back-fill: re-sync all active markbooks now that the department filter is
--    relaxed. This recovers any students who were silently excluded by the
--    strict student.department_id = v_department_id predicate introduced in
--    migration 20261024103000.
-- ============================================================================

do $$
declare
  rec record;
begin
  for rec in (
    select distinct ae.academic_period_id, ae.unit_id
    from public.assessment_events ae
    where ae.title = 'Unit Markbook'
      and ae.assessment_type = 'exam'
      and ae.status <> 'closed'
      and not ae.trainer_entry_open
      and not exists (
        select 1 from public.assessment_event_workspace workspace
        where workspace.id = ae.id
          and workspace.workflow_status in ('submitted', 'finalised', 'archived')
      )
  ) loop
    begin
      perform public.ensure_unit_markbook_ready(rec.academic_period_id, rec.unit_id);
    exception when others then
      -- Log and continue; do not abort the whole migration for a single bad row
      raise warning 'ensure_unit_markbook_ready failed for period % unit %: %',
        rec.academic_period_id, rec.unit_id, sqlerrm;
    end;
  end loop;
end;
$$;

commit;
