-- Fix column name mismatch in public.save_generated_timetable_draft
-- (`summary` rather than `generation_summary` on `public.timetable_generation_runs`),
-- while preserving all class_sessions detachment and attendance reconciliation
-- from 20260920150000_resilient_class_attendance_pipeline.sql.

begin;

create or replace function public.save_generated_timetable_draft(
  target_academic_period_id uuid,
  generated_sessions jsonb,
  generation_summary jsonb default '{}'::jsonb
)
returns table (
  generation_run_id uuid,
  saved_session_count integer,
  locked_session_count integer,
  unscheduled_session_count integer
)
language plpgsql security definer set search_path = '' as $$
declare
  session_item jsonb;
  run_id uuid;
  active_department uuid := public.current_user_primary_department_id();
  saved_total integer := 0;
  locked_total integer := 0;
  unscheduled_total integer :=
    coalesce((generation_summary ->> 'unscheduledSessionCount')::integer, 0);
  requested_total integer :=
    coalesce((generation_summary ->> 'requestedSessionCount')::integer, 0);
  conflict_total integer :=
    coalesce((generation_summary ->> 'conflictCount')::integer, 0);
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before generating.';
  end if;

  if jsonb_typeof(generated_sessions) <> 'array' then
    raise exception using errcode = '22023',
      message = 'Generated sessions must be supplied as a JSON array.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-generation:' || active_department::text || ':'
      || target_academic_period_id::text, 0
  ));

  -- Detach any class_sessions from unlocked sessions being removed so attendance is never lost
  update public.class_sessions cs
  set scheduled_session_id = null,
      updated_at = now()
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where cs.scheduled_session_id = session.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (session.is_locked = false or session.status in ('draft', 'confirmed', 'cancelled'));

  -- Delete any orphaned/suspended sessions for this department so they never persist as ghost clashes
  delete from public.scheduled_sessions session
  using public.teaching_allocations allocation, public.cohorts cohort, public.programmes programme
  where session.teaching_allocation_id = allocation.id
    and session.cohort_id = cohort.id
    and cohort.programme_id = programme.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (allocation.status in ('suspended', 'archived') or not allocation.is_timetable_enabled or session.status = 'cancelled');

  select count(*) into locked_total
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (session.is_locked or session.status = 'locked');

  delete from public.scheduled_sessions session
  using public.cohorts cohort, public.programmes programme
  where session.cohort_id = cohort.id
    and cohort.programme_id = programme.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.is_locked = false
    and session.status in ('draft', 'confirmed', 'cancelled');

  for session_item in select value from jsonb_array_elements(generated_sessions)
  loop
    if coalesce((session_item ->> 'isLocked')::boolean, false) then
      continue;
    end if;

    if not exists (
      select 1
      from public.teaching_allocations allocation
      join public.cohorts cohort on cohort.id = allocation.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      where allocation.id =
          (session_item ->> 'teachingAllocationId')::uuid
        and allocation.academic_period_id = target_academic_period_id
        and programme.department_id = active_department
    ) then
      raise exception using errcode = '42501',
        message = 'A generated session belongs to another department.';
    end if;

    insert into public.scheduled_sessions (
      academic_period_id, teaching_allocation_id, cohort_id, unit_id,
      trainer_id, working_day_id, start_time_slot_id, end_time_slot_id,
      room_id, session_number, delivery_mode, status, source,
      conflict_state, is_locked, notes, created_by, updated_by
    ) values (
      target_academic_period_id,
      (session_item ->> 'teachingAllocationId')::uuid,
      (session_item ->> 'cohortId')::uuid,
      (session_item ->> 'unitId')::uuid,
      nullif(session_item ->> 'trainerId', '')::uuid,
      (session_item ->> 'workingDayId')::uuid,
      (session_item ->> 'startTimeSlotId')::uuid,
      (session_item ->> 'endTimeSlotId')::uuid,
      nullif(session_item ->> 'roomId', '')::uuid,
      (session_item ->> 'sessionNumber')::smallint,
      (session_item ->> 'deliveryMode')::public.teaching_delivery_mode,
      'draft'::public.scheduled_session_status,
      'generator'::public.scheduled_session_source,
      'clear'::public.scheduled_session_conflict_state,
      false,
      'Generated by the institutional timetabler.',
      auth.uid(),
      auth.uid()
    );
    saved_total := saved_total + 1;
  end loop;

  -- Automatically reconcile any detached class_sessions to the new scheduled sessions
  perform public.reconcile_attendance_to_scheduled_sessions(target_academic_period_id);

  insert into public.timetable_generation_runs (
    department_id, academic_period_id, status, generation_strategy,
    overwrite_existing, requested_session_count, scheduled_session_count,
    unscheduled_session_count, conflict_count, locked_session_count,
    summary, created_by
  ) values (
    active_department,
    target_academic_period_id,
    case when unscheduled_total > 0 or conflict_total > 0
      then 'completed_with_issues' else 'completed' end,
    'balanced',
    true,
    requested_total,
    saved_total + locked_total,
    unscheduled_total,
    conflict_total,
    locked_total,
    coalesce(generation_summary, '{}'::jsonb),
    auth.uid()
  ) returning id into run_id;

  return query select run_id, saved_total, locked_total, unscheduled_total;
end;
$$;

revoke all on function public.save_generated_timetable_draft(uuid, jsonb, jsonb) from public;
grant execute on function public.save_generated_timetable_draft(uuid, jsonb, jsonb) to authenticated;

commit;
