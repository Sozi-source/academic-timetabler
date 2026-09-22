-- Migration: 20260922090000_strict_department_scope_daily_reports.sql
-- Description: Hardens trainer daily report visibility to the HOD's own
--              department ONLY (e.g. Human Nutrition and Dietetics).
--
--              Migration 20260918070000 widened visibility so that a
--              trainer from ANOTHER department teaching a single service
--              lesson tagged with the active department would show up in
--              that department's daily report list/RLS reads. That
--              cross-department "fallback" is exactly what leaked other
--              departments' trainers into the Nutrition HOD's daily
--              reports. This migration removes that fallback entirely:
--              a trainer only ever appears under their own home
--              department. No lesson-based OR name-based fallback.

-- 1. Restore RLS policy on trainer_daily_reports to strict ownership:
--    the trainer themselves, their home department's HOD, or system_admin.
drop policy if exists trainer_daily_reports_read on public.trainer_daily_reports;

create policy trainer_daily_reports_read
on public.trainer_daily_reports
for select
to authenticated
using (
  trainer_profile_id = auth.uid()
  or public.current_user_can_manage_department(home_department_id)
  or public.current_user_has_role(array['system_admin']::public.app_role[])
);

-- 2. Restore get_department_trainer_daily_reports to strict home-department
--    scoping: expected trainers, submitted reports, lesson/absence counts,
--    concern counts, and the reports payload are all filtered strictly by
--    trainer.department_id = active_department / report.home_department_id
--    = active_department. No exists(...) lesson-department fallback.
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

  -- Expected trainers: strictly those whose home department is the active
  -- department (or every active trainer, for system_admin).
  with expected as (
    select distinct
      trainer.id as trainer_id,
      trainer.full_name as trainer_name
    from public.trainers trainer
    where trainer.is_active
      and (is_sysadmin or trainer.department_id = active_department)
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
      and (is_sysadmin or report.home_department_id = active_department)
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

  select
    count(*)::integer,
    coalesce(sum(lesson.absent_count), 0)::integer
  into lesson_count, absence_count
  from public.trainer_daily_report_lessons lesson
  join public.trainer_daily_reports report
    on report.id = lesson.report_id
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and (is_sysadmin or report.home_department_id = active_department);

  select count(*)::integer
  into concern_count
  from public.trainer_daily_reports report
  where report.report_date = target_report_date
    and report.status = 'submitted'
    and nullif(trim(coalesce(report.concern, '')), '') is not null
    and (is_sysadmin or report.home_department_id = active_department);

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
    and (is_sysadmin or report.home_department_id = active_department);

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

comment on function public.get_department_trainer_daily_reports(date) is
  'Strictly scoped to trainers whose home department is the caller''s active department (system_admin sees all). No cross-department lesson fallback.';
