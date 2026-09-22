-- Extend the authorized timetable reset to remove attendance records tied to
-- the selected department and Academic Period. The operation remains atomic:
-- if protected teaching records block the timetable reset, attendance deletes
-- are rolled back as part of the same transaction.

create or replace function public.clear_department_timetable_history_with_attendance(
  target_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  deleted_attendance_sessions integer := 0;
  deleted_attendance_entries integer := 0;
  deleted_attendance_events integer := 0;
  reset_result jsonb;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before clearing timetable and attendance history';
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

  if exists (
    select 1
    from public.trainer_daily_report_lessons lesson
    join public.class_sessions class_session
      on class_session.id = lesson.attendance_session_id
    join public.teaching_allocations allocation
      on allocation.id = class_session.teaching_allocation_id
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where class_session.academic_period_id = target_academic_period_id
      and programme.department_id = active_department
  ) then
    raise exception using
      errcode = '55000',
      message = 'Submitted trainer daily reports depend on attendance sessions. Those teaching records cannot be deleted by timetable reset';
  end if;

  delete from public.class_attendance_events attendance_event
  where exists (
    select 1
    from public.class_sessions class_session
    join public.teaching_allocations allocation
      on allocation.id = class_session.teaching_allocation_id
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where class_session.id = attendance_event.class_session_id
      and class_session.academic_period_id = target_academic_period_id
      and programme.department_id = active_department
  );
  get diagnostics deleted_attendance_events = row_count;

  delete from public.class_attendance_entries attendance_entry
  where exists (
    select 1
    from public.class_sessions class_session
    join public.teaching_allocations allocation
      on allocation.id = class_session.teaching_allocation_id
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where class_session.id = attendance_entry.class_session_id
      and class_session.academic_period_id = target_academic_period_id
      and programme.department_id = active_department
  );
  get diagnostics deleted_attendance_entries = row_count;

  delete from public.class_sessions class_session
  where class_session.academic_period_id = target_academic_period_id
    and exists (
      select 1
      from public.teaching_allocations allocation
      join public.cohorts cohort on cohort.id = allocation.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      where allocation.id = class_session.teaching_allocation_id
        and programme.department_id = active_department
    );
  get diagnostics deleted_attendance_sessions = row_count;

  reset_result := public.clear_department_timetable_history(
    target_academic_period_id
  );

  return reset_result || jsonb_build_object(
    'deletedAttendanceSessions', deleted_attendance_sessions,
    'deletedAttendanceEntries', deleted_attendance_entries,
    'deletedAttendanceEvents', deleted_attendance_events
  );
end;
$$;

revoke all on function public.clear_department_timetable_history_with_attendance(uuid) from public;
grant execute on function public.clear_department_timetable_history_with_attendance(uuid) to authenticated;

comment on function public.clear_department_timetable_history_with_attendance(uuid) is
  'Permanently removes attendance data followed by generated timetable state for one managed department and period, while preserving allocations and protected teaching reports.';
