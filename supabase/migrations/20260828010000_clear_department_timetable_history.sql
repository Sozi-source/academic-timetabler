-- Authorized clean-slate reset for one department and Academic Period.
-- Academic setup and teaching allocations are deliberately preserved.

create or replace function public.clear_department_timetable_history(
  target_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  deleted_sessions integer := 0;
  deleted_runs integer := 0;
  deleted_versions integer := 0;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before clearing timetable history';
  end if;

  if target_academic_period_id is null
    or not exists (
      select 1 from public.academic_periods period
      where period.id = target_academic_period_id
    ) then
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
    from public.class_sessions class_session
    join public.scheduled_sessions scheduled
      on scheduled.id = class_session.scheduled_session_id
    join public.teaching_allocations allocation
      on allocation.id = scheduled.teaching_allocation_id
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where scheduled.academic_period_id = target_academic_period_id
      and programme.department_id = active_department
  ) then
    raise exception using
      errcode = '55000',
      message = 'Attendance records depend on this timetable. They must be retained or cleared through the attendance workflow first';
  end if;

  if exists (
    select 1
    from public.record_of_work_entries entry
    join public.timetable_versions version on version.id = entry.timetable_version_id
    where version.academic_period_id = target_academic_period_id
      and version.department_id = active_department
  ) or exists (
    select 1
    from public.trainer_daily_report_lessons lesson
    join public.timetable_versions version on version.id = lesson.timetable_version_id
    where version.academic_period_id = target_academic_period_id
      and version.department_id = active_department
  ) then
    raise exception using
      errcode = '55000',
      message = 'Teaching records depend on a published timetable version. Those statutory records cannot be removed by timetable reset';
  end if;

  delete from public.timetable_session_change_log change_log
  where change_log.academic_period_id = target_academic_period_id
    and exists (
      select 1
      from public.scheduled_sessions scheduled
      join public.teaching_allocations allocation
        on allocation.id = scheduled.teaching_allocation_id
      join public.cohorts cohort on cohort.id = allocation.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      where scheduled.id = change_log.scheduled_session_id
        and programme.department_id = active_department
    );

  delete from public.scheduled_sessions scheduled
  where scheduled.academic_period_id = target_academic_period_id
    and exists (
      select 1
      from public.teaching_allocations allocation
      join public.cohorts cohort on cohort.id = allocation.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      where allocation.id = scheduled.teaching_allocation_id
        and programme.department_id = active_department
    );
  get diagnostics deleted_sessions = row_count;

  delete from public.timetable_conflict_reviews review
  where review.academic_period_id = target_academic_period_id
    and review.department_id = active_department;

  delete from public.timetable_trainer_exchange_events exchange_event
  where exchange_event.academic_period_id = target_academic_period_id
    and exchange_event.department_id = active_department;

  delete from public.timetable_versions version
  where version.academic_period_id = target_academic_period_id
    and version.department_id = active_department;
  get diagnostics deleted_versions = row_count;

  delete from public.timetable_generation_runs generation_run
  where generation_run.academic_period_id = target_academic_period_id
    and generation_run.department_id = active_department;
  get diagnostics deleted_runs = row_count;

  return jsonb_build_object(
    'deletedSessions', deleted_sessions,
    'deletedGenerationRuns', deleted_runs,
    'deletedVersions', deleted_versions
  );
end;
$$;

revoke all on function public.clear_department_timetable_history(uuid) from public;
grant execute on function public.clear_department_timetable_history(uuid) to authenticated;

comment on function public.clear_department_timetable_history(uuid) is
  'Deletes generated timetable state and history for one managed department and period while preserving allocations and refusing to destroy dependent teaching records.';
