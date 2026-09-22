-- Complete clean-slate reset approved for a managed department and period.
-- Removes teaching evidence tied to superseded timetable versions before the
-- attendance-inclusive timetable reset. The transaction is all-or-nothing.

create or replace function public.clear_department_timetable_history_complete(
  target_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  affected_report_ids uuid[] := array[]::uuid[];
  deleted_record_of_work_entries integer := 0;
  deleted_daily_report_lessons integer := 0;
  deleted_daily_reports integer := 0;
  reset_result jsonb;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before clearing teaching and timetable history';
  end if;

  if target_academic_period_id is null then
    raise exception using
      errcode = '22023',
      message = 'Select a valid Academic Period';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'clear-timetable:' || active_department::text || ':' || target_academic_period_id::text,
    0
  ));

  select coalesce(array_agg(distinct lesson.report_id), array[]::uuid[])
  into affected_report_ids
  from public.trainer_daily_report_lessons lesson
  join public.timetable_versions version
    on version.id = lesson.timetable_version_id
  where version.academic_period_id = target_academic_period_id
    and version.department_id = active_department;

  delete from public.record_of_work_entries entry
  where exists (
    select 1
    from public.timetable_versions version
    where version.id = entry.timetable_version_id
      and version.academic_period_id = target_academic_period_id
      and version.department_id = active_department
  );
  get diagnostics deleted_record_of_work_entries = row_count;

  delete from public.trainer_daily_report_lessons lesson
  where exists (
    select 1
    from public.timetable_versions version
    where version.id = lesson.timetable_version_id
      and version.academic_period_id = target_academic_period_id
      and version.department_id = active_department
  );
  get diagnostics deleted_daily_report_lessons = row_count;

  delete from public.trainer_daily_reports report
  where report.id = any(affected_report_ids)
    and not exists (
      select 1
      from public.trainer_daily_report_lessons remaining_lesson
      where remaining_lesson.report_id = report.id
    );
  get diagnostics deleted_daily_reports = row_count;

  reset_result := public.clear_department_timetable_history_with_attendance(
    target_academic_period_id
  );

  return reset_result || jsonb_build_object(
    'deletedRecordOfWorkEntries', deleted_record_of_work_entries,
    'deletedDailyReportLessons', deleted_daily_report_lessons,
    'deletedDailyReports', deleted_daily_reports
  );
end;
$$;

revoke all on function public.clear_department_timetable_history_complete(uuid) from public;
grant execute on function public.clear_department_timetable_history_complete(uuid) to authenticated;

comment on function public.clear_department_timetable_history_complete(uuid) is
  'Permanently removes linked record-of-work, daily-report, attendance and timetable history for one managed department and Academic Period while preserving allocations and master setup.';
