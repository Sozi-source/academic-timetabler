-- ============================================================================
-- Migration: 20260912180000_unified_unit_attendance_roster.sql
-- Description: Unifies multi-cohort registration and student rosters across
--              class attendance, CAT/Exam sessions, and trainer daily reports.
-- ============================================================================

-- 1. Upgrade open_class_attendance_session to seed the union of all registered
--    students and active students across all cohorts offering the unit.
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

  -- Collect all cohorts associated with this unit & period
  select array_agg(distinct cohort_id)
  into participant_cohorts
  from (
    select unnest(schedule_row.participant_cohort_ids) as cohort_id
    union
    select schedule_row.cohort_id as cohort_id where schedule_row.cohort_id is not null
    union
    select uo.cohort_id from public.unit_offerings uo
    where uo.academic_period_id = schedule_row.academic_period_id
      and uo.unit_id = schedule_row.unit_id
    union
    select ta.cohort_id from public.teaching_allocations ta
    where ta.academic_period_id = schedule_row.academic_period_id
      and ta.unit_id = schedule_row.unit_id
      and ta.cohort_id is not null
  ) c
  where cohort_id is not null;

  if participant_cohorts is null then
    participant_cohorts := array[]::uuid[];
  end if;

  -- Check existing active session
  select session.id
  into existing_session_id
  from public.class_sessions as session
  where session.scheduled_session_id = target_scheduled_session_id
    and session.session_date = target_session_date
    and session.status <> 'cancelled'
  limit 1;

  if existing_session_id is not null then
    -- Ensure all registered & enrolled students are seeded into existing session
    insert into public.class_attendance_entries (
      class_session_id,
      student_id,
      cohort_id,
      attendance_status
    )
    select distinct
      existing_session_id,
      reg.student_id,
      coalesce(reg.cohort_id, schedule_row.cohort_id),
      'unmarked'
    from public.student_unit_registrations as reg
    where reg.academic_period_id = schedule_row.academic_period_id
      and reg.unit_id = schedule_row.unit_id
      and reg.registration_status::text = 'registered'
    on conflict (class_session_id, student_id) do nothing;

    if cardinality(participant_cohorts) > 0 then
      insert into public.class_attendance_entries (
        class_session_id,
        student_id,
        cohort_id,
        attendance_status
      )
      select distinct
        existing_session_id,
        st.id,
        st.current_cohort_id,
        'unmarked'
      from public.students as st
      where st.current_cohort_id = any(participant_cohorts)
        and st.lifecycle_status in ('admitted', 'active')
      on conflict (class_session_id, student_id) do nothing;
    end if;

    select count(*)
    into roster_total
    from public.class_attendance_entries
    where class_session_id = existing_session_id;

    update public.class_sessions
    set roster_count = roster_total, updated_at = now()
    where id = existing_session_id;

    return existing_session_id;
  end if;

  -- Create new class session
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

  -- 1. Insert registered students for this unit
  insert into public.class_attendance_entries (
    class_session_id,
    student_id,
    cohort_id,
    attendance_status
  )
  select distinct
    new_session_id,
    reg.student_id,
    coalesce(reg.cohort_id, schedule_row.cohort_id),
    'unmarked'
  from public.student_unit_registrations as reg
  where reg.academic_period_id = schedule_row.academic_period_id
    and reg.unit_id = schedule_row.unit_id
    and reg.registration_status::text = 'registered'
  on conflict (class_session_id, student_id) do nothing;

  -- 2. Insert active enrolled students across all offering cohorts
  if cardinality(participant_cohorts) > 0 then
    insert into public.class_attendance_entries (
      class_session_id,
      student_id,
      cohort_id,
      attendance_status
    )
    select distinct
      new_session_id,
      st.id,
      st.current_cohort_id,
      'unmarked'
    from public.students as st
    where st.current_cohort_id = any(participant_cohorts)
      and st.lifecycle_status in ('admitted', 'active')
    on conflict (class_session_id, student_id) do nothing;
  end if;

  select count(*)
  into roster_total
  from public.class_attendance_entries
  where class_session_id = new_session_id;

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


-- 2. Upgrade _trainer_daily_schedule_v1 to resolve multi-cohort names
create or replace function public._trainer_daily_schedule_v1(
  target_trainer_id uuid,
  target_report_date date
)
returns table (
  department_id uuid,
  department_name text,
  timetable_version_id uuid,
  timetable_version_number integer,
  timetable_title text,
  academic_period_id uuid,
  scheduled_session_id uuid,
  teaching_allocation_id uuid,
  cohort_id uuid,
  unit_id uuid,
  session_number integer,
  starts_at time without time zone,
  ends_at time without time zone,
  unit_code text,
  unit_name text,
  cohort_name text,
  room_name text,
  delivery_mode text
)
language sql
stable
security definer
set search_path = ''
as $$
  with current_schedule as (
    select
      version.department_id,
      department.name as department_name,
      version.id as timetable_version_id,
      version.version_number as timetable_version_number,
      version.title as timetable_title,
      version.academic_period_id,
      item,
      row_number() over (
        partition by nullif(item ->> 'id', '')::uuid
        order by version.version_number desc
      ) as session_rank
    from public.timetable_versions version
    join public.departments department
      on department.id = version.department_id
    join public.academic_periods period
      on period.id = version.academic_period_id
    cross join lateral jsonb_array_elements(version.snapshot) item
    where version.status = 'published'
      and target_report_date between period.teaching_starts_on
                                 and period.teaching_ends_on
      and nullif(item ->> 'trainerId', '')::uuid = target_trainer_id
      and lower(trim(item ->> 'day')) =
          lower(trim(to_char(target_report_date, 'FMDay')))
  )
  select
    schedule.department_id,
    schedule.department_name,
    schedule.timetable_version_id,
    schedule.timetable_version_number,
    schedule.timetable_title,
    schedule.academic_period_id,
    scheduled.id,
    coalesce(
      nullif(schedule.item ->> 'teachingAllocationId', '')::uuid,
      scheduled.teaching_allocation_id
    ),
    scheduled.cohort_id,
    scheduled.unit_id,
    coalesce(
      nullif(schedule.item ->> 'sessionNumber', '')::integer,
      scheduled.session_number::integer
    ),
    nullif(schedule.item ->> 'startTime', '')::time,
    nullif(schedule.item ->> 'endTime', '')::time,
    coalesce(nullif(schedule.item ->> 'unitCode', ''), unit_record.code),
    coalesce(nullif(schedule.item ->> 'unitName', ''), unit_record.name),
    coalesce(
      (
        select string_agg(distinct c.name, ' / ' order by c.name)
        from public.cohorts c
        where c.id = any(scheduled.participant_cohort_ids)
           or c.id in (
             select uo.cohort_id from public.unit_offerings uo
             where uo.unit_id = scheduled.unit_id
               and uo.academic_period_id = scheduled.academic_period_id
           )
      ),
      nullif(schedule.item ->> 'cohortName', ''),
      cohort.name
    ),
    nullif(schedule.item ->> 'roomName', ''),
    coalesce(
      nullif(schedule.item ->> 'deliveryMode', ''),
      scheduled.delivery_mode::text
    )
  from current_schedule schedule
  join public.scheduled_sessions scheduled
    on scheduled.id = nullif(schedule.item ->> 'id', '')::uuid
  join public.units unit_record
    on unit_record.id = scheduled.unit_id
  left join public.cohorts cohort
    on cohort.id = scheduled.cohort_id
  where schedule.session_rank = 1
  order by
    nullif(schedule.item ->> 'startTime', '')::time,
    scheduled.session_number;
$$;
