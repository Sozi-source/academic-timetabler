-- Migration: 20260920181500_restore_all_trainer_attendance_data.sql
-- Description:
--   Comprehensive database upgrade & data restoration for all trainers:
--   1. Upgrades get_trainer_daily_report_workspace and submit_trainer_daily_report_v1
--      with multi-key matching across scheduled_session_id, teaching_allocation_id, and unit_id.
--   2. Hardens reconcile_attendance_to_scheduled_sessions with participant cohort support.
--   3. Executes live data repair relinking scheduled_session_id and aligning trainer_id
--      across all historical records in class_sessions.

begin;

-- ============================================================================
-- 1. Upgrade get_trainer_daily_report_workspace: Multi-Key Attendance Matching
-- ============================================================================

drop function if exists public.get_trainer_daily_report_workspace(date);

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

  -- Return submitted report view if already submitted
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
          'attendanceStatus',
            coalesce(
              (select cs.status::text from public.class_sessions cs where cs.id = lesson.attendance_session_id),
              'completed'
            ),
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

  -- Build draft workspace with resilient multi-key attendance lookup
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
      coalesce(attendance.status::text, 'not_started') as attendance_status,
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
      -- Multi-key match:
      -- 1. Exact scheduled_session_id match
      -- 2. Teaching allocation match
      -- 3. Unit + cohort / trainer match
      select session.id, session.status, session.roster_count
      from public.class_sessions session
      where session.session_date = target_report_date
        and (
          session.scheduled_session_id = schedule.scheduled_session_id
          or (
            session.teaching_allocation_id is not null
            and session.teaching_allocation_id = schedule.teaching_allocation_id
          )
          or (
            session.unit_id = schedule.unit_id
            and (
              session.cohort_id = schedule.cohort_id
              or session.trainer_id = trainer_row.id
              or session.opened_by = auth.uid()
            )
          )
        )
      order by
        (case
          when session.scheduled_session_id = schedule.scheduled_session_id then 0
          when session.teaching_allocation_id = schedule.teaching_allocation_id then 1
          when session.unit_id = schedule.unit_id and session.starts_at = schedule.starts_at then 2
          else 3
        end),
        session.updated_at desc
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

revoke all on function public.get_trainer_daily_report_workspace(date) from public;
grant execute on function public.get_trainer_daily_report_workspace(date) to authenticated;

comment on function public.get_trainer_daily_report_workspace(date) is
  'Builds trainer daily report workspace with multi-key attendance matching (scheduled_session_id, allocation_id, unit_id) so recorded and cancelled sessions are always recognised across all trainers.';


-- ============================================================================
-- 2. Upgrade submit_trainer_daily_report_v1: Multi-Key Completeness Check
-- ============================================================================

drop function if exists public.submit_trainer_daily_report_v1(date, text, text);

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
  left join public.departments department
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

  -- Multi-key completeness check
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
        where attendance.session_date = target_report_date
          and attendance.status in ('completed', 'cancelled')
          and (
            attendance.scheduled_session_id = schedule.scheduled_session_id
            or (
              attendance.teaching_allocation_id is not null
              and attendance.teaching_allocation_id = schedule.teaching_allocation_id
            )
            or (
              attendance.unit_id = schedule.unit_id
              and (
                attendance.cohort_id = schedule.cohort_id
                or attendance.trainer_id = trainer_row.id
                or attendance.opened_by = auth.uid()
              )
            )
          )
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
    where session.session_date = target_report_date
      and (
        session.scheduled_session_id = schedule.scheduled_session_id
        or (
          session.teaching_allocation_id is not null
          and session.teaching_allocation_id = schedule.teaching_allocation_id
        )
        or (
          session.unit_id = schedule.unit_id
          and (
            session.cohort_id = schedule.cohort_id
            or session.trainer_id = trainer_row.id
            or session.opened_by = auth.uid()
          )
        )
      )
    order by
      (case
        when session.scheduled_session_id = schedule.scheduled_session_id then 0
        when session.teaching_allocation_id = schedule.teaching_allocation_id then 1
        when session.unit_id = schedule.unit_id and session.starts_at = schedule.starts_at then 2
        else 3
      end),
      session.updated_at desc
    limit 1
  ) attendance on true;

  return new_report_id;
end;
$$;

revoke all on function public.submit_trainer_daily_report_v1(date, text, text) from public;
grant execute on function public.submit_trainer_daily_report_v1(date, text, text) to authenticated;

comment on function public.submit_trainer_daily_report_v1(date, text, text) is
  'Submits daily report after multi-key completeness check (scheduled_session_id, allocation_id, unit_id) so all recorded and cancelled sessions are recognized.';

-- Re-expose the public alias
drop function if exists public.submit_trainer_daily_report(date, text, text);

create or replace function public.submit_trainer_daily_report(
  target_report_date date,
  target_other_activity text default null,
  target_concern text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.submit_trainer_daily_report_v1(
    target_report_date,
    target_other_activity,
    target_concern
  );
end;
$$;

revoke all on function public.submit_trainer_daily_report(date, text, text) from public;
grant execute on function public.submit_trainer_daily_report(date, text, text) to authenticated;


-- ============================================================================
-- 3. Upgrade reconcile_attendance_to_scheduled_sessions: Comprehensive Relinking
-- ============================================================================

drop function if exists public.reconcile_attendance_to_scheduled_sessions(uuid);

create or replace function public.reconcile_attendance_to_scheduled_sessions(
  target_academic_period_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  relinked_count integer := 0;
begin
  with candidate_matches as (
    select distinct on (cs.id)
      cs.id as class_session_id,
      ss.id as live_session_id
    from public.class_sessions cs
    join public.scheduled_sessions ss
      on (
        ss.teaching_allocation_id = cs.teaching_allocation_id
        or (
          ss.unit_id = cs.unit_id
          and (
            ss.cohort_id = cs.cohort_id
            or cs.cohort_id = any(ss.participant_cohort_ids)
            or ss.participant_cohort_ids is not null
            or cs.cohort_id is null
          )
        )
      )
    join public.working_days wd on wd.id = ss.working_day_id
    join public.time_slots ts on ts.id = ss.start_time_slot_id
    where (cs.academic_period_id = target_academic_period_id or cs.academic_period_id is null)
      and (
        cs.scheduled_session_id is null
        or not exists (select 1 from public.scheduled_sessions s2 where s2.id = cs.scheduled_session_id)
      )
      and lower(wd.day_of_week::text) = lower(to_char(cs.session_date, 'FMDay'))
    order by cs.id,
      (case when ss.teaching_allocation_id = cs.teaching_allocation_id then 0 else 1 end),
      (case when ts.starts_at = cs.starts_at then 0 else 1 end)
  ),
  updated as (
    update public.class_sessions cs
    set scheduled_session_id = cm.live_session_id,
        academic_period_id = coalesce(cs.academic_period_id, target_academic_period_id),
        updated_at = now()
    from candidate_matches cm
    where cs.id = cm.class_session_id
    returning cs.id
  )
  select count(*) into relinked_count from updated;

  return relinked_count;
end;
$$;

revoke all on function public.reconcile_attendance_to_scheduled_sessions(uuid) from public;
grant execute on function public.reconcile_attendance_to_scheduled_sessions(uuid) to authenticated;

comment on function public.reconcile_attendance_to_scheduled_sessions(uuid) is
  'Re-links unattached or drifted class_sessions to live scheduled_sessions using allocation, unit, and participant cohorts.';


-- ============================================================================
-- 4. Execute Complete Data Repair Across All Trainers and Academic Periods
-- ============================================================================

-- Repair 1: Re-link all unattached scheduled_session_ids in class_sessions across all periods
do $$
declare
  period_row record;
begin
  for period_row in select id from public.academic_periods loop
    perform public.reconcile_attendance_to_scheduled_sessions(period_row.id);
  end loop;
end $$;

-- Repair 2: Direct relink for any remaining class_sessions matching live scheduled_sessions by unit & day
update public.class_sessions cs
set scheduled_session_id = live_match.live_id,
    academic_period_id = coalesce(cs.academic_period_id, live_match.period_id),
    updated_at = now()
from (
  select distinct on (cs2.id)
    cs2.id as cs_id,
    ss.id as live_id,
    ss.academic_period_id as period_id
  from public.class_sessions cs2
  join public.scheduled_sessions ss on ss.unit_id = cs2.unit_id
  join public.working_days wd on wd.id = ss.working_day_id
  join public.time_slots ts on ts.id = ss.start_time_slot_id
  where (
    cs2.scheduled_session_id is null
    or not exists (select 1 from public.scheduled_sessions s2 where s2.id = cs2.scheduled_session_id)
  )
  and lower(wd.day_of_week::text) = lower(to_char(cs2.session_date, 'FMDay'))
  order by cs2.id, (case when ts.starts_at = cs2.starts_at then 0 else 1 end)
) live_match
where cs.id = live_match.cs_id;

-- Repair 3: Align missing trainer_id on class_sessions with allocation or opened_by trainer
update public.class_sessions cs
set trainer_id = ta.trainer_id,
    updated_at = now()
from public.teaching_allocations ta
where cs.teaching_allocation_id = ta.id
  and cs.trainer_id is null
  and ta.trainer_id is not null;

update public.class_sessions cs
set trainer_id = t.id,
    updated_at = now()
from public.trainers t
where cs.trainer_id is null
  and cs.opened_by is not null
  and t.profile_id = cs.opened_by;

commit;
