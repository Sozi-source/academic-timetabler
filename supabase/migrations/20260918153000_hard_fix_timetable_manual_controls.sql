-- Migration: Hard-Fix Master Timetable & Surgical Manual Scheduling Controls
-- Date: 2026-09-18
-- Description: Adds enterprise-grade RPCs to bulk lock/unlock department timetable sessions,
-- manually schedule unplaced allocations with full collision detection, and safely unschedule sessions.

begin;

-- 1. Bulk Lock / Unlock Department Timetable Sessions
create or replace function public.bulk_lock_department_timetable_sessions(
  target_academic_period_id uuid,
  target_lock_state boolean
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  affected_count integer := 0;
  next_status public.scheduled_session_status;
begin
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to lock timetable sessions.';
  end if;

  next_status := case when target_lock_state then 'locked' else 'draft' end;

  with target_sessions as (
    select session.id, session.academic_period_id, session.status, session.is_locked
    from public.scheduled_sessions session
    join public.cohorts cohort on cohort.id = session.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where session.academic_period_id = target_academic_period_id
      and (active_department is null or programme.department_id = active_department)
      and session.status in ('draft', 'confirmed', 'locked')
      and session.is_locked <> target_lock_state
    for update of session
  ),
  updated_sessions as (
    update public.scheduled_sessions session
    set is_locked = target_lock_state,
        status = next_status,
        updated_by = auth.uid(),
        updated_at = now()
    from target_sessions
    where session.id = target_sessions.id
    returning session.id, session.academic_period_id, target_sessions.status as old_status, target_sessions.is_locked as old_locked
  ),
  logged as (
    insert into public.timetable_session_change_log (
      academic_period_id, scheduled_session_id, change_type, previous_values, new_values
    )
    select
      u.academic_period_id,
      u.id,
      case when target_lock_state then 'lock' else 'unlock' end,
      jsonb_build_object('is_locked', u.old_locked, 'status', u.old_status),
      jsonb_build_object('is_locked', target_lock_state, 'status', next_status)
    from updated_sessions u
  )
  select count(*) into affected_count from updated_sessions;

  return affected_count;
end;
$$;

revoke all on function public.bulk_lock_department_timetable_sessions(uuid, boolean) from public;
grant execute on function public.bulk_lock_department_timetable_sessions(uuid, boolean) to authenticated;

comment on function public.bulk_lock_department_timetable_sessions(uuid, boolean) is
  'Atomically locks or unlocks all active timetable sessions for the current department in an academic period.';

-- 2. Safely Schedule an Allocation Session Manually
create or replace function public.schedule_allocation_session_safely(
  target_allocation_id uuid,
  target_working_day_id uuid,
  target_start_time_slot_id uuid,
  target_end_time_slot_id uuid,
  target_room_id uuid default null,
  target_notes text default null,
  target_trainer_id uuid default null,
  target_is_locked boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  selected_allocation record;
  selected_room public.rooms%rowtype;
  selected_trainer public.trainers%rowtype;
  start_time time;
  end_time time;
  effective_trainer_id uuid;
  active_session_count integer;
  next_session_num smallint;
  clash_record record;
  new_session_id uuid;
begin
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to schedule timetable sessions.';
  end if;

  select
    allocation.*,
    cohort.actual_size as cohort_actual_size,
    cohort.code as cohort_code
  into selected_allocation
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.id = target_allocation_id
    and (active_department is null or programme.department_id = active_department)
  for update of allocation;

  if selected_allocation.id is null then
    raise exception using errcode = 'P0002', message = 'Teaching allocation not found in your department.';
  end if;

  if not selected_allocation.is_timetable_enabled then
    raise exception using errcode = '23514', message = 'This teaching allocation is not enabled for timetabling.';
  end if;

  select count(*) into active_session_count
  from public.scheduled_sessions
  where teaching_allocation_id = selected_allocation.id
    and status not in ('cancelled', 'archived');

  if active_session_count >= selected_allocation.weekly_sessions then
    raise exception using errcode = '23514', message = format('All required sessions (%s) for this unit are already scheduled.', selected_allocation.weekly_sessions);
  end if;

  if not exists (
    select 1 from public.working_days
    where id = target_working_day_id
      and academic_period_id = selected_allocation.academic_period_id
      and is_enabled = true
  ) then
    raise exception using errcode = '23514', message = 'The selected working day is not available.';
  end if;

  select starts_at into start_time from public.time_slots
  where id = target_start_time_slot_id
    and academic_period_id = selected_allocation.academic_period_id
    and is_enabled = true and slot_type = 'teaching';

  select ends_at into end_time from public.time_slots
  where id = target_end_time_slot_id
    and academic_period_id = selected_allocation.academic_period_id
    and is_enabled = true and slot_type = 'teaching';

  if start_time is null or end_time is null or start_time >= end_time then
    raise exception using errcode = '23514', message = 'Select a valid teaching-time range.';
  end if;

  effective_trainer_id := coalesce(target_trainer_id, selected_allocation.trainer_id);

  if effective_trainer_id is not null then
    select * into selected_trainer from public.trainers where id = effective_trainer_id;
    if selected_trainer.id is null or not selected_trainer.is_active or not selected_trainer.is_timetable_available then
      raise exception using errcode = '23514', message = 'The selected trainer is unavailable.';
    end if;

    -- Check for Trainer clash
    select existing.id, t.full_name into clash_record
    from public.scheduled_sessions existing
    join public.trainers t on t.id = existing.trainer_id
    join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
    where existing.academic_period_id = selected_allocation.academic_period_id
      and existing.working_day_id = target_working_day_id
      and existing.status not in ('cancelled','archived')
      and existing_start.starts_at < end_time
      and existing_end.ends_at > start_time
      and existing.trainer_id = effective_trainer_id
    limit 1;

    if clash_record.id is not null then
      raise exception using errcode = '23P01', message = 'Trainer ' || clash_record.full_name || ' is already scheduled for another class at this time.';
    end if;
  end if;

  -- Check for Cohort clash
  select existing.id, c.code into clash_record
  from public.scheduled_sessions existing
  join public.cohorts c on c.id = existing.cohort_id
  join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
  where existing.academic_period_id = selected_allocation.academic_period_id
    and existing.working_day_id = target_working_day_id
    and existing.status not in ('cancelled','archived')
    and existing_start.starts_at < end_time
    and existing_end.ends_at > start_time
    and existing.cohort_id = selected_allocation.cohort_id
  limit 1;

  if clash_record.id is not null then
    raise exception using errcode = '23P01', message = 'Cohort ' || clash_record.code || ' is already scheduled for another class at this time.';
  end if;

  -- Check for Room clash & capacity
  if target_room_id is not null then
    select * into selected_room from public.rooms where id = target_room_id;
    if selected_room.id is null or not selected_room.is_active or not selected_room.is_timetable_available then
      raise exception using errcode = '23514', message = 'The selected room is unavailable.';
    end if;

    if selected_room.capacity < selected_allocation.cohort_actual_size and selected_room.capacity > 0 and selected_allocation.cohort_actual_size > 0 then
      raise exception using errcode = '23514', message = format('Room capacity (%s) is below cohort size (%s).', selected_room.capacity, selected_allocation.cohort_actual_size);
    end if;

    select existing.id, r.name into clash_record
    from public.scheduled_sessions existing
    join public.rooms r on r.id = existing.room_id
    join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
    where existing.academic_period_id = selected_allocation.academic_period_id
      and existing.working_day_id = target_working_day_id
      and existing.status not in ('cancelled','archived')
      and existing_start.starts_at < end_time
      and existing_end.ends_at > start_time
      and existing.room_id = target_room_id
    limit 1;

    if clash_record.id is not null then
      raise exception using errcode = '23P01', message = 'Room ' || clash_record.name || ' is already occupied at this time.';
    end if;
  end if;

  -- Find next session number
  select coalesce(max(session_number), 0) + 1 into next_session_num
  from public.scheduled_sessions
  where teaching_allocation_id = selected_allocation.id
    and status not in ('cancelled','archived');

  -- If trainer was updated, synchronize parent allocation
  if target_trainer_id is not null and target_trainer_id is distinct from selected_allocation.trainer_id then
    update public.teaching_allocations
    set trainer_id = target_trainer_id, updated_by = auth.uid(), updated_at = now()
    where id = selected_allocation.id;
  end if;

  -- Insert scheduled session
  insert into public.scheduled_sessions (
    academic_period_id,
    teaching_allocation_id,
    cohort_id,
    unit_id,
    trainer_id,
    working_day_id,
    start_time_slot_id,
    end_time_slot_id,
    room_id,
    session_number,
    delivery_mode,
    status,
    source,
    conflict_state,
    is_locked,
    notes,
    participant_cohort_ids,
    combined_cohort_size,
    created_by,
    updated_by
  ) values (
    selected_allocation.academic_period_id,
    selected_allocation.id,
    selected_allocation.cohort_id,
    selected_allocation.unit_id,
    effective_trainer_id,
    target_working_day_id,
    target_start_time_slot_id,
    target_end_time_slot_id,
    target_room_id,
    next_session_num,
    selected_allocation.delivery_mode,
    case when target_is_locked then 'locked'::public.scheduled_session_status else 'draft'::public.scheduled_session_status end,
    'manual'::public.scheduled_session_source,
    'clear'::public.scheduled_session_conflict_state,
    target_is_locked,
    nullif(trim(target_notes), ''),
    selected_allocation.participant_cohort_ids,
    selected_allocation.combined_cohort_size,
    auth.uid(),
    auth.uid()
  ) returning id into new_session_id;

  insert into public.timetable_session_change_log (
    academic_period_id, scheduled_session_id, change_type, previous_values, new_values
  ) values (
    selected_allocation.academic_period_id,
    new_session_id,
    'move',
    '{}'::jsonb,
    jsonb_build_object(
      'working_day_id', target_working_day_id,
      'start_time_slot_id', target_start_time_slot_id,
      'end_time_slot_id', target_end_time_slot_id,
      'room_id', target_room_id,
      'trainer_id', effective_trainer_id,
      'notes', nullif(trim(target_notes), ''),
      'is_locked', target_is_locked,
      'session_number', next_session_num
    )
  );

  return new_session_id;
end;
$$;

revoke all on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean) from public;
grant execute on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean) to authenticated;

comment on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean) is
  'Safely schedules a session for an unplaced teaching allocation with full clash detection and optional lock.';

-- 3. Safely Unschedule a Session
create or replace function public.unschedule_session_safely(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  selected_session public.scheduled_sessions%rowtype;
begin
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to unschedule sessions.';
  end if;

  select s.* into selected_session
  from public.scheduled_sessions s
  join public.cohorts c on c.id = s.cohort_id
  join public.programmes p on p.id = c.programme_id
  where s.id = target_session_id
    and (active_department is null or p.department_id = active_department)
  for update;

  if selected_session.id is null then
    raise exception using errcode = 'P0002', message = 'The scheduled session was not found.';
  end if;

  if exists (
    select 1 from public.class_sessions
    where scheduled_session_id = target_session_id
  ) then
    raise exception using errcode = '23503', message = 'Cannot unschedule a session that already has recorded class attendance.';
  end if;

  delete from public.scheduled_sessions where id = selected_session.id;
end;
$$;

revoke all on function public.unschedule_session_safely(uuid) from public;
grant execute on function public.unschedule_session_safely(uuid) to authenticated;

comment on function public.unschedule_session_safely(uuid) is
  'Safely removes a timetable session, returning the allocation back to the unplaced list.';

commit;
