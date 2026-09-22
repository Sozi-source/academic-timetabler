-- ============================================================
-- Migration: 20260908221000_repair_class_attendance_roster.sql
-- Description:
--   1. Backfill any missing cohort_id in student_unit_registrations.
--   2. Ensure department_register_student_units inserts cohort_id.
--   3. Upgrade open_class_attendance_session to handle both locked
--      and published-snapshot sessions, and include cross-cohort
--      unit registrations for shared classes.
-- ============================================================

-- 1. Backfill missing cohort_id from student's current cohort
update public.student_unit_registrations sur
set cohort_id = s.current_cohort_id
from public.students s
where sur.student_id = s.id
  and sur.cohort_id is null
  and s.current_cohort_id is not null;

-- 2. Update department_register_student_units to ensure cohort_id is recorded
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
      cohort_id,
      unit_id,
      academic_period_id,
      unit_offering_id,
      registration_status,
      source,
      registered_at
    )
    values (
      target_student_id,
      selected_student.current_cohort_id,
      selected_unit_id,
      target_academic_period_id,
      selected_offering_id,
      'registered',
      'department_manual',
      now()
    )
    on conflict (student_id, academic_period_id, unit_id)
    do update set
      cohort_id = excluded.cohort_id,
      unit_offering_id = excluded.unit_offering_id,
      registration_status = 'registered',
      registered_at = now();
  end loop;

  return submission_id_value;
end;
$$;

-- 3. Upgrade open_class_attendance_session to handle scheduled session state resiliently
create or replace function public.open_class_attendance_session(
  target_scheduled_session_id uuid,
  target_session_date date
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  schedule_row record;
  participant_cohorts uuid[];
  existing_session_id uuid;
  new_session_id uuid;
  roster_total integer;
  expected_isodow integer;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if target_session_date is null then
    raise exception
      'Class date is required.'
      using errcode = '22023';
  end if;

  select
    scheduled.id,
    scheduled.academic_period_id,
    scheduled.teaching_allocation_id,
    scheduled.cohort_id,
    scheduled.participant_cohort_ids,
    scheduled.unit_id,
    scheduled.trainer_id,
    scheduled.room_id,
    scheduled.status::text as schedule_status,
    working_day.day_of_week::text as day_of_week,
    start_slot.starts_at,
    end_slot.ends_at,
    period.teaching_starts_on,
    period.teaching_ends_on
  into schedule_row
  from public.scheduled_sessions as scheduled
  left join public.working_days as working_day
    on working_day.id = scheduled.working_day_id
  left join public.time_slots as start_slot
    on start_slot.id = scheduled.start_time_slot_id
  left join public.time_slots as end_slot
    on end_slot.id = scheduled.end_time_slot_id
  left join public.academic_periods as period
    on period.id = scheduled.academic_period_id
  where scheduled.id = target_scheduled_session_id;

  if not found then
    raise exception
      'Published timetable session was not found.'
      using errcode = 'P0002';
  end if;

  -- Lock session if not already locked
  if schedule_row.schedule_status <> 'locked' then
    update public.scheduled_sessions
    set status = 'locked', is_locked = true, updated_at = now()
    where id = target_scheduled_session_id;
  end if;

  if not public.trainer_can_access_allocation(
    schedule_row.teaching_allocation_id
  ) then
    raise exception
      'This class is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  participant_cohorts =
    case
      when coalesce(cardinality(schedule_row.participant_cohort_ids), 0) > 0
      then schedule_row.participant_cohort_ids
      when schedule_row.cohort_id is not null
      then array[schedule_row.cohort_id]
      else array[]::uuid[]
    end;

  -- Check existing active session
  select session.id
  into existing_session_id
  from public.class_sessions as session
  where session.scheduled_session_id = target_scheduled_session_id
    and session.session_date = target_session_date
    and session.status <> 'cancelled'
  limit 1;

  if existing_session_id is not null then
    -- Ensure existing session has entries seeded if it was previously empty
    select count(*)
    into roster_total
    from public.class_attendance_entries
    where class_session_id = existing_session_id;

    if roster_total = 0 then
      insert into public.class_attendance_entries (
        class_session_id,
        student_id,
        cohort_id,
        attendance_status
      )
      select distinct
        existing_session_id,
        registration.student_id,
        coalesce(registration.cohort_id, schedule_row.cohort_id),
        'unmarked'
      from public.student_unit_registrations as registration
      where registration.academic_period_id = schedule_row.academic_period_id
        and registration.unit_id = schedule_row.unit_id
        and registration.registration_status::text = 'registered'
      on conflict (class_session_id, student_id) do nothing;

      get diagnostics roster_total = row_count;

      update public.class_sessions
      set roster_count = roster_total, updated_at = now()
      where id = existing_session_id;
    end if;

    return existing_session_id;
  end if;

  insert into public.class_sessions (
    academic_period_id,
    teaching_allocation_id,
    scheduled_session_id,
    cohort_id,
    unit_id,
    trainer_id,
    session_date,
    starts_at,
    ends_at,
    room_id,
    status,
    opened_by
  )
  values (
    schedule_row.academic_period_id,
    schedule_row.teaching_allocation_id,
    schedule_row.id,
    schedule_row.cohort_id,
    schedule_row.unit_id,
    schedule_row.trainer_id,
    target_session_date,
    coalesce(schedule_row.starts_at, '08:00:00'::time),
    coalesce(schedule_row.ends_at, '10:00:00'::time),
    schedule_row.room_id,
    'open',
    auth.uid()
  )
  returning id into new_session_id;

  -- 1. Insert registered students matching participating cohort(s)
  insert into public.class_attendance_entries (
    class_session_id,
    student_id,
    cohort_id,
    attendance_status
  )
  select distinct
    new_session_id,
    registration.student_id,
    coalesce(registration.cohort_id, schedule_row.cohort_id),
    'unmarked'
  from public.student_unit_registrations as registration
  where registration.academic_period_id = schedule_row.academic_period_id
    and (
      cardinality(participant_cohorts) = 0
      or registration.cohort_id = any(participant_cohorts)
    )
    and registration.unit_id = schedule_row.unit_id
    and registration.registration_status::text = 'registered'
  order by registration.student_id;

  get diagnostics roster_total = row_count;

  -- 2. If no students matched the specific cohort filter, include all registered students for the unit in this period
  if roster_total = 0 then
    insert into public.class_attendance_entries (
      class_session_id,
      student_id,
      cohort_id,
      attendance_status
    )
    select distinct
      new_session_id,
      registration.student_id,
      coalesce(registration.cohort_id, schedule_row.cohort_id),
      'unmarked'
    from public.student_unit_registrations as registration
    where registration.academic_period_id = schedule_row.academic_period_id
      and registration.unit_id = schedule_row.unit_id
      and registration.registration_status::text = 'registered'
    on conflict (class_session_id, student_id) do nothing;

    get diagnostics roster_total = row_count;
  end if;

  -- 3. If still 0, fallback to cohort students
  if roster_total = 0 and schedule_row.cohort_id is not null then
    insert into public.class_attendance_entries (
      class_session_id,
      student_id,
      cohort_id,
      attendance_status
    )
    select distinct
      new_session_id,
      st.id,
      schedule_row.cohort_id,
      'unmarked'
    from public.students as st
    where st.current_cohort_id = schedule_row.cohort_id
      and st.lifecycle_status in ('admitted', 'active')
    on conflict (class_session_id, student_id) do nothing;

    get diagnostics roster_total = row_count;
  end if;

  update public.class_sessions
  set
    roster_count = roster_total,
    updated_at = now()
  where id = new_session_id;

  insert into public.class_attendance_events (
    class_session_id,
    event_type,
    created_by,
    event_payload
  )
  values (
    new_session_id,
    'session_opened',
    auth.uid(),
    jsonb_build_object(
      'session_date', target_session_date,
      'roster_count', roster_total,
      'scheduled_session_id', target_scheduled_session_id
    )
  );

  return new_session_id;
end;
$$;
