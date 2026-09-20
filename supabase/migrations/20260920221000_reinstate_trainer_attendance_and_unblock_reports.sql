-- Migration: 20260920221000_reinstate_trainer_attendance_and_unblock_reports.sql
-- Description:
--   1. Re-runs the historical relinking pass so every class_sessions row
--      trainers already logged is reattached to a live scheduled_sessions
--      row, a teaching_allocation, and a trainer_id. This is purely a
--      link/metadata repair — no attendance entry, present/absent mark, or
--      note that a trainer submitted is created, changed, or deleted.
--   2. Safety net: any session left in 'open' status where the trainer has
--      already marked every registered student (no 'unmarked' entries
--      remain) is promoted to 'completed' with a completed_at timestamp,
--      so genuinely finished registers stop being reported as "not yet
--      recorded". Sessions still mid-register (any 'unmarked' entries) are
--      left untouched.
--   3. Removes the hard "resolve previous records first" gate from the
--      trainer daily report submission RPC: overdue past sessions / past
--      unsubmitted reports are no longer allowed to block submission of the
--      CURRENT day's report. Completing today's own attendance is still
--      required.

begin;

-- ============================================================================
-- 1. Re-run comprehensive relinking across every academic period
-- ============================================================================

do $$
declare
  period_row record;
begin
  for period_row in select id from public.academic_periods loop
    perform public.reconcile_attendance_to_scheduled_sessions(period_row.id);
  end loop;
end $$;

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

-- ============================================================================
-- 2. Promote fully-marked 'open' sessions to 'completed'
--    (register was actually finished by the trainer, status update never
--    landed — e.g. a dropped network call after the last mark).
-- ============================================================================

update public.class_sessions cs
set status = 'completed',
    completed_at = coalesce(cs.completed_at, now()),
    updated_at = now()
where cs.status = 'open'
  and exists (
    select 1 from public.class_attendance_entries e
    where e.class_session_id = cs.id
  )
  and not exists (
    select 1 from public.class_attendance_entries e
    where e.class_session_id = cs.id
      and e.attendance_status = 'unmarked'
  );

-- ============================================================================
-- 3. Drop the "resolve previous records first" hard block from the
--    submission RPC. Only today's own attendance completeness still gates
--    submission; overdue past sessions/reports no longer do.
-- ============================================================================

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

  -- Completeness check now covers ONLY today's own schedule.
  -- (No lookback / no dependency on past unresolved sessions or reports.)
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
  'Submits daily report once TODAY''s own scheduled attendance is complete. No longer blocks on unresolved past sessions or unsubmitted past reports.';

commit;
