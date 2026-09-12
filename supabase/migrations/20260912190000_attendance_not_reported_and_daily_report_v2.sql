-- ============================================================================
-- Migration: 20260912190000_attendance_not_reported_and_daily_report_v2.sql
-- Description: Supports non-punitive 'not_reported' status for students who
--              have not reported for the semester, ensuring they are excluded
--              from absences and daily report absentees lists.
-- ============================================================================

begin;

-- 1. Expand class_attendance_entries check constraint
alter table public.class_attendance_entries
  drop constraint if exists class_attendance_entries_attendance_status_check;

alter table public.class_attendance_entries
  add constraint class_attendance_entries_attendance_status_check
  check (attendance_status in ('unmarked', 'present', 'absent', 'not_reported'));

-- 2. Add not_reported_count to trainer_daily_report_lessons
alter table public.trainer_daily_report_lessons
  add column if not exists not_reported_count integer not null default 0;

-- 3. Upgrade open_class_attendance_session to set un-reported students to 'not_reported'
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
      case
        when spr.reporting_status = 'reported' then 'unmarked'
        else 'not_reported'
      end
    from public.student_unit_registrations as reg
    left join public.student_period_reporting spr
      on spr.student_id = reg.student_id
     and spr.academic_period_id = schedule_row.academic_period_id
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
        case
          when spr.reporting_status = 'reported' then 'unmarked'
          else 'not_reported'
        end
      from public.students as st
      left join public.student_period_reporting spr
        on spr.student_id = st.id
       and spr.academic_period_id = schedule_row.academic_period_id
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
    case
      when spr.reporting_status = 'reported' then 'unmarked'
      else 'not_reported'
    end
  from public.student_unit_registrations as reg
  left join public.student_period_reporting spr
    on spr.student_id = reg.student_id
   and spr.academic_period_id = schedule_row.academic_period_id
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
      case
        when spr.reporting_status = 'reported' then 'unmarked'
        else 'not_reported'
      end
    from public.students as st
    left join public.student_period_reporting spr
      on spr.student_id = st.id
     and spr.academic_period_id = schedule_row.academic_period_id
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

-- 4. Upgrade get_trainer_daily_report_workspace to compute not_reported_count
create or replace function public.get_trainer_daily_report_workspace(
  target_report_date date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  trainer_row record;
  report_row record;
  lesson_payload jsonb;
  incomplete_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select
    trainer.id,
    trainer.full_name,
    trainer.staff_number,
    trainer.department_id,
    department.name as department_name
  into trainer_row
  from public.trainers trainer
  join public.departments department
    on department.id = trainer.department_id
  where trainer.profile_id = auth.uid()
    and trainer.is_active
  order by trainer.created_at
  limit 1;

  if not found then
    raise exception 'Your trainer profile could not be resolved.'
      using errcode = '42501';
  end if;

  select *
  into report_row
  from public.trainer_daily_reports
  where trainer_id = trainer_row.id
    and report_date = target_report_date
    and status = 'submitted'
  limit 1;

  if found then
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', lesson.id,
          'departmentId', lesson.department_id,
          'departmentName', lesson.department_name_snapshot,
          'timetableVersionId', lesson.timetable_version_id,
          'timetableVersionNumber', lesson.timetable_version_number,
          'timetableTitle', lesson.timetable_title,
          'scheduledSessionId', lesson.scheduled_session_id,
          'teachingAllocationId', lesson.teaching_allocation_id,
          'academicPeriodId', lesson.academic_period_id,
          'cohortId', lesson.cohort_id,
          'unitId', lesson.unit_id,
          'sessionNumber', lesson.session_number,
          'startsAt', lesson.starts_at,
          'endsAt', lesson.ends_at,
          'unitCode', lesson.unit_code_snapshot,
          'unitName', lesson.unit_name_snapshot,
          'cohortName', lesson.cohort_name_snapshot,
          'roomName', lesson.room_name_snapshot,
          'deliveryMode', lesson.delivery_mode_snapshot,
          'attendanceSessionId', lesson.attendance_session_id,
          'attendanceStatus', 'completed',
          'rosterCount', lesson.roster_count,
          'presentCount', lesson.present_count,
          'absentCount', lesson.absent_count,
          'notReportedCount', coalesce(lesson.not_reported_count, 0),
          'absentees', lesson.absentees
        )
        order by lesson.starts_at, lesson.unit_code_snapshot
      ),
      '[]'::jsonb
    )
    into lesson_payload
    from public.trainer_daily_report_lessons lesson
    where lesson.report_id = report_row.id;

    return jsonb_build_object(
      'reportDate', report_row.report_date,
      'trainerId', report_row.trainer_id,
      'trainerName', report_row.trainer_name_snapshot,
      'trainerNumber', report_row.trainer_number_snapshot,
      'homeDepartmentId', report_row.home_department_id,
      'homeDepartmentName', report_row.home_department_name_snapshot,
      'status', 'submitted',
      'reportId', report_row.id,
      'submittedAt', report_row.submitted_at,
      'otherActivity', coalesce(report_row.other_activity, ''),
      'concern', coalesce(report_row.concern, ''),
      'readyToSubmit', false,
      'blockingReason', null,
      'lessons', lesson_payload
    );
  end if;

  with schedule as (
    select *
    from public._trainer_daily_schedule_v1(
      trainer_row.id,
      target_report_date
    )
  ),
  enriched as (
    select
      schedule.*,
      attendance.id as attendance_session_id,
      coalesce(attendance.status, 'not_started') as attendance_status,
      coalesce(attendance.roster_count, 0) as roster_count,
      coalesce((
        select count(*)::integer
        from public.class_attendance_entries entry
        where entry.class_session_id = attendance.id
          and entry.attendance_status = 'present'
      ), 0) as present_count,
      coalesce((
        select count(*)::integer
        from public.class_attendance_entries entry
        where entry.class_session_id = attendance.id
          and entry.attendance_status = 'absent'
      ), 0) as absent_count,
      coalesce((
        select count(*)::integer
        from public.class_attendance_entries entry
        where entry.class_session_id = attendance.id
          and entry.attendance_status = 'not_reported'
      ), 0) as not_reported_count,
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'studentId', student.id,
            'admissionNumber', student.admission_number,
            'fullName', student.full_name,
            'note', entry.note
          )
          order by student.full_name, student.admission_number
        )
        from public.class_attendance_entries entry
        join public.students student on student.id = entry.student_id
        where entry.class_session_id = attendance.id
          and entry.attendance_status = 'absent'
      ), '[]'::jsonb) as absentees
    from schedule
    left join lateral (
      select session.id, session.status, session.roster_count
      from public.class_sessions session
      where session.scheduled_session_id = schedule.scheduled_session_id
        and session.session_date = target_report_date
        and session.status <> 'cancelled'
      order by session.updated_at desc
      limit 1
    ) attendance on true
  )
  select
    count(*) filter (where attendance_status not in ('completed', 'cancelled'))::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', null,
          'departmentId', enriched.department_id,
          'departmentName', enriched.department_name,
          'timetableVersionId', enriched.timetable_version_id,
          'timetableVersionNumber', enriched.timetable_version_number,
          'timetableTitle', enriched.timetable_title,
          'scheduledSessionId', enriched.scheduled_session_id,
          'teachingAllocationId', enriched.teaching_allocation_id,
          'academicPeriodId', enriched.academic_period_id,
          'cohortId', enriched.cohort_id,
          'unitId', enriched.unit_id,
          'sessionNumber', enriched.session_number,
          'startsAt', enriched.starts_at,
          'endsAt', enriched.ends_at,
          'unitCode', enriched.unit_code,
          'unitName', enriched.unit_name,
          'cohortName', enriched.cohort_name,
          'roomName', enriched.room_name,
          'deliveryMode', enriched.delivery_mode,
          'attendanceSessionId', enriched.attendance_session_id,
          'attendanceStatus',
            case
              when enriched.attendance_status in ('completed', 'cancelled') then enriched.attendance_status
              when enriched.attendance_status = 'open' then 'open'
              else 'not_started'
            end,
          'rosterCount', enriched.roster_count,
          'presentCount', enriched.present_count,
          'absentCount', enriched.absent_count,
          'notReportedCount', enriched.not_reported_count,
          'absentees', enriched.absentees
        )
        order by enriched.starts_at, enriched.unit_code
      ),
      '[]'::jsonb
    )
  into incomplete_count, lesson_payload
  from enriched;

  return jsonb_build_object(
    'reportDate', target_report_date,
    'trainerId', trainer_row.id,
    'trainerName', trainer_row.full_name,
    'trainerNumber', trainer_row.staff_number,
    'homeDepartmentId', trainer_row.department_id,
    'homeDepartmentName', trainer_row.department_name,
    'status', 'draft',
    'reportId', null,
    'submittedAt', null,
    'otherActivity', '',
    'concern', '',
    'readyToSubmit', incomplete_count = 0,
    'blockingReason',
      case
        when incomplete_count > 0 then
          'Complete Class Attendance for all scheduled lessons before submitting the daily report.'
        else null
      end,
    'lessons', lesson_payload
  );
end;
$$;

-- 5. Upgrade submit_trainer_daily_report_v1 to store not_reported_count and accept cancelled sessions
create or replace function public.submit_trainer_daily_report_v1(
  target_report_date date,
  target_other_activity text default null,
  target_concern text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  trainer_row record;
  new_report_id uuid;
  schedule_count integer := 0;
  incomplete_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  select
    trainer.id,
    trainer.full_name,
    trainer.staff_number,
    trainer.department_id,
    department.name as department_name
  into trainer_row
  from public.trainers trainer
  join public.departments department
    on department.id = trainer.department_id
  where trainer.profile_id = auth.uid()
    and trainer.is_active
  order by trainer.created_at
  limit 1;

  if not found then
    raise exception 'Your trainer profile could not be resolved.'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'trainer-daily-report:' || trainer_row.id::text || ':' ||
      target_report_date::text,
      0
    )
  );

  if exists (
    select 1
    from public.trainer_daily_reports
    where trainer_id = trainer_row.id
      and report_date = target_report_date
      and status = 'submitted'
  ) then
    raise exception 'The daily report for this date has already been submitted.'
      using errcode = '23505';
  end if;

  with schedule as (
    select *
    from public._trainer_daily_schedule_v1(
      trainer_row.id,
      target_report_date
    )
  )
  select
    count(*)::integer,
    count(*) filter (
      where not exists (
        select 1
        from public.class_sessions attendance
        where attendance.scheduled_session_id = schedule.scheduled_session_id
          and attendance.session_date = target_report_date
          and attendance.status in ('completed', 'cancelled')
      )
    )::integer
  into schedule_count, incomplete_count
  from schedule;

  if incomplete_count > 0 then
    raise exception
      'Complete Class Attendance for every scheduled lesson before submitting the daily report.'
      using errcode = '23514';
  end if;

  if schedule_count = 0
     and nullif(trim(coalesce(target_other_activity, '')), '') is null
     and nullif(trim(coalesce(target_concern, '')), '') is null
  then
    raise exception
      'There are no scheduled lessons. Add another activity or concern before submitting.'
      using errcode = '23514';
  end if;

  insert into public.trainer_daily_reports (
    trainer_id,
    trainer_profile_id,
    home_department_id,
    trainer_name_snapshot,
    trainer_number_snapshot,
    home_department_name_snapshot,
    report_date,
    other_activity,
    concern,
    status,
    submitted_at
  )
  values (
    trainer_row.id,
    auth.uid(),
    trainer_row.department_id,
    trainer_row.full_name,
    trainer_row.staff_number,
    trainer_row.department_name,
    target_report_date,
    nullif(trim(coalesce(target_other_activity, '')), ''),
    nullif(trim(coalesce(target_concern, '')), ''),
    'submitted',
    now()
  )
  returning id into new_report_id;

  insert into public.trainer_daily_report_lessons (
    report_id,
    department_id,
    department_name_snapshot,
    timetable_version_id,
    timetable_version_number,
    timetable_title,
    scheduled_session_id,
    teaching_allocation_id,
    academic_period_id,
    cohort_id,
    unit_id,
    session_number,
    starts_at,
    ends_at,
    unit_code_snapshot,
    unit_name_snapshot,
    cohort_name_snapshot,
    room_name_snapshot,
    delivery_mode_snapshot,
    attendance_session_id,
    roster_count,
    present_count,
    absent_count,
    not_reported_count,
    absentees
  )
  select
    new_report_id,
    schedule.department_id,
    schedule.department_name,
    schedule.timetable_version_id,
    schedule.timetable_version_number,
    schedule.timetable_title,
    schedule.scheduled_session_id,
    schedule.teaching_allocation_id,
    schedule.academic_period_id,
    schedule.cohort_id,
    schedule.unit_id,
    schedule.session_number,
    schedule.starts_at,
    schedule.ends_at,
    schedule.unit_code,
    schedule.unit_name,
    schedule.cohort_name,
    schedule.room_name,
    schedule.delivery_mode,
    attendance.id,
    coalesce(attendance.roster_count, 0),
    coalesce((
      select count(*)::integer
      from public.class_attendance_entries entry
      where entry.class_session_id = attendance.id
        and entry.attendance_status = 'present'
    ), 0),
    coalesce((
      select count(*)::integer
      from public.class_attendance_entries entry
      where entry.class_session_id = attendance.id
        and entry.attendance_status = 'absent'
    ), 0),
    coalesce((
      select count(*)::integer
      from public.class_attendance_entries entry
      where entry.class_session_id = attendance.id
        and entry.attendance_status = 'not_reported'
    ), 0),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'studentId', student.id,
          'admissionNumber', student.admission_number,
          'fullName', student.full_name,
          'note', entry.note
        )
        order by student.full_name, student.admission_number
      )
      from public.class_attendance_entries entry
      join public.students student on student.id = entry.student_id
      where entry.class_session_id = attendance.id
        and entry.attendance_status = 'absent'
    ), '[]'::jsonb)
  from public._trainer_daily_schedule_v1(
    trainer_row.id,
    target_report_date
  ) schedule
  left join lateral (
    select session.id, session.roster_count
    from public.class_sessions session
    where session.scheduled_session_id = schedule.scheduled_session_id
      and session.session_date = target_report_date
      and session.status <> 'cancelled'
    order by session.updated_at desc
    limit 1
  ) attendance on true;

  return new_report_id;
end;
$$;

commit;
