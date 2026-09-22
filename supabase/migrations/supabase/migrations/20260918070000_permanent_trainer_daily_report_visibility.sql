-- Migration: 20260918070000_permanent_trainer_daily_report_visibility.sql
-- Description: Permanently resolves trainer daily reports visibility on HOD and Admin side:
--              1. Expands get_department_trainer_daily_reports so HODs see reports from trainers
--                 whose home department is active_department OR who taught lessons belonging to active_department.
--              2. Grants system_admin full visibility across all departments.
--              3. Robust submit_trainer_daily_report_v1 with LEFT JOIN so trainers with NULL department_id
--                 can submit cleanly with inferred department.
--              4. Updates trainer_daily_reports_read RLS policy to allow lesson-level department management access.

-- 1. Update RLS Policy on trainer_daily_reports
drop policy if exists trainer_daily_reports_read on public.trainer_daily_reports;

create policy trainer_daily_reports_read
on public.trainer_daily_reports
for select
to authenticated
using (
  trainer_profile_id = auth.uid()
  or public.current_user_can_manage_department(home_department_id)
  or public.current_user_has_role(array['system_admin']::public.app_role[])
  or exists (
    select 1
    from public.trainer_daily_report_lessons lesson
    where lesson.report_id = trainer_daily_reports.id
      and public.current_user_can_manage_department(lesson.department_id)
  )
);

-- 2. Upgrade get_department_trainer_daily_reports RPC
create or replace function public.get_department_trainer_daily_reports(
  target_report_date date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  is_sysadmin boolean := public.current_user_has_role(array['system_admin']::public.app_role[]);
  active_department uuid := public.current_user_primary_department_id();
  active_department_name text;
  expected_count integer := 0;
  submitted_count integer := 0;
  pending_count integer := 0;
  lesson_count integer := 0;
  absence_count integer := 0;
  concern_count integer := 0;
  pending_payload jsonb := '[]'::jsonb;
  reports_payload jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode = '42501';
  end if;

  if not is_sysadmin and (active_department is null or not public.current_user_can_manage_department(active_department)) then
    raise exception 'Select an authorized department before viewing trainer daily reports.' using errcode = '42501';
  end if;

  if active_department is not null then
    select name into active_department_name
    from public.departments
    where id = active_department;
  else
    active_department_name := 'All Departments';
  end if;

  -- Expected trainers: Trainers belonging to the department or scheduled to teach department lessons
  with expected as (
    select distinct
      trainer.id as trainer_id,
      trainer.full_name as trainer_name
    from public.trainers trainer
    where trainer.is_active
      and (
        is_sysadmin
        or trainer.department_id = active_department
        or exists (
          select 1
          from public._trainer_daily_schedule_v1(trainer.id, target_report_date) sched
          where sched.department_id = active_department
        )
      )
      and exists (
        select 1
        from public._trainer_daily_schedule_v1(trainer.id, target_report_date)
      )
  ),
  submitted as (
    select distinct report.trainer_id
    from public.trainer_daily_reports report
    where report.report_date = target_report_date
      and report.status = 'submitted'
      and (
        is_sysadmin
        or report.home_department_id = active_department
        or exists (
          select 1
          from public.trainer_daily_report_lessons lesson
          where lesson.report_id = report.id
            and lesson.department_id = active_department
        )
      )
  )
  select
    (select count(*)::integer from expected),
    (select count(*)::integer from submitted),
    (
      select count(*)::integer
      from expected
      where not exists (
        select 1
        from submitted
        where submitted.trainer_id = expected.trainer_id
      )
    ),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'trainerId', expected.trainer_id,
          'trainerName', expected.trainer_name
        )
        order by expected.trainer_name
      )
      from expected
      where not exists (
        select 1
        from submitted
        where submitted.trainer_id = expected.trainer_id
      )
    ), '[]'::jsonb)
  into expected_count, submitted_count, pending_count, pending_payload;

  -- Count lessons and absences belonging to this department
  select
    count(*)::integer,
    coalesce(sum(lesson.absent_count), 0)::integer
  into lesson_count, absence_count
  from public.trainer_daily_report_lessons lesson
  join public.trainer_daily_reports report
    on report.id = lesson.report_id
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and (
      is_sysadmin
      or lesson.department_id = active_department
      or report.home_department_id = active_department
    );

  -- Count concerns
  select count(*)::integer
  into concern_count
  from public.trainer_daily_reports report
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and nullif(trim(coalesce(report.concern, '')), '') is not null
    and (
      is_sysadmin
      or report.home_department_id = active_department
      or exists (
        select 1
        from public.trainer_daily_report_lessons lesson
        where lesson.report_id = report.id
          and lesson.department_id = active_department
      )
    );

  -- Aggregate reports payload
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reportId', report.id,
        'trainerId', report.trainer_id,
        'trainerName', report.trainer_name_snapshot,
        'trainerNumber', report.trainer_number_snapshot,
        'homeDepartmentId', report.home_department_id,
        'homeDepartmentName', report.home_department_name_snapshot,
        'submittedAt', report.submitted_at,
        'otherActivity', coalesce(report.other_activity, ''),
        'concern', coalesce(report.concern, ''),
        'lessons',
          coalesce((
            select jsonb_agg(
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
                'absentees', lesson.absentees
              )
              order by lesson.starts_at, lesson.unit_code_snapshot
            )
            from public.trainer_daily_report_lessons lesson
            where lesson.report_id = report.id
              and (is_sysadmin or lesson.department_id = active_department or report.home_department_id = active_department)
          ), '[]'::jsonb)
      )
      order by report.trainer_name_snapshot
    ),
    '[]'::jsonb
  )
  into reports_payload
  from public.trainer_daily_reports report
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and (
      is_sysadmin
      or report.home_department_id = active_department
      or exists (
        select 1
        from public.trainer_daily_report_lessons lesson
        where lesson.report_id = report.id
          and lesson.department_id = active_department
      )
    );

  return jsonb_build_object(
    'reportDate', target_report_date,
    'departmentId', coalesce(active_department, '00000000-0000-0000-0000-000000000000'::uuid),
    'departmentName', coalesce(active_department_name, 'Department'),
    'generatedAt', timezone('utc'::text, now()),
    'summary', jsonb_build_object(
      'expectedTrainers', expected_count,
      'submittedReports', submitted_count,
      'pendingReports', pending_count,
      'scheduledLessons', lesson_count,
      'recordedAbsences', absence_count,
      'concerns', concern_count
    ),
    'pendingTrainers', pending_payload,
    'reports', reports_payload
  );
end;
$$;

-- 3. Upgrade submit_trainer_daily_report_v1 with resilient department inference
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
  inferred_department_id uuid;
  inferred_department_name text;
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

  inferred_department_id := trainer_row.department_id;
  inferred_department_name := trainer_row.department_name;

  -- If department is missing on trainer record, infer from today's scheduled lessons
  if inferred_department_id is null then
    select
      sched.department_id,
      sched.department_name
    into inferred_department_id, inferred_department_name
    from public._trainer_daily_schedule_v1(trainer_row.id, target_report_date) sched
    where sched.department_id is not null
    limit 1;
  end if;

  -- If still missing, fallback to trainer profile active department
  if inferred_department_id is null then
    select
      p.active_department_id,
      d.name
    into inferred_department_id, inferred_department_name
    from public.profiles p
    left join public.departments d on d.id = p.active_department_id
    where p.id = auth.uid();
  end if;

  -- Ultimate fallback to first department
  if inferred_department_id is null then
    select id, name
    into inferred_department_id, inferred_department_name
    from public.departments
    order by name
    limit 1;
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
    inferred_department_id,
    trainer_row.full_name,
    trainer_row.staff_number,
    coalesce(inferred_department_name, 'Department'),
    target_report_date,
    target_other_activity,
    target_concern,
    'submitted',
    now()
  )
  returning id into new_report_id;

  -- Record lesson snapshots
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
    cs.id,
    coalesce(cs.roster_count, 0),
    coalesce(cs.present_count, 0),
    coalesce(cs.absent_count, 0),
    coalesce(cs.not_reported_count, 0),
    coalesce(cs.absentees, '[]'::jsonb)
  from public._trainer_daily_schedule_v1(trainer_row.id, target_report_date) schedule
  left join lateral (
    select
      session.id,
      session.roster_count,
      count(record.id) filter (where record.status = 'present')::integer as present_count,
      count(record.id) filter (where record.status = 'absent')::integer as absent_count,
      count(record.id) filter (where record.status = 'not_reported')::integer as not_reported_count,
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'studentId', student.id,
            'admissionNumber', student.admission_number,
            'fullName', student.full_name,
            'note', record.note
          )
          order by student.full_name
        ) filter (where record.status = 'absent'),
        '[]'::jsonb
      ) as absentees
    from public.class_sessions session
    left join public.class_attendance_records record
      on record.class_session_id = session.id
    left join public.students student
      on student.id = record.student_id
    where session.scheduled_session_id = schedule.scheduled_session_id
      and session.session_date = target_report_date
      and session.status in ('completed', 'cancelled')
    group by session.id, session.roster_count
    limit 1
  ) cs on true;

  return new_report_id;
end;
$$;
