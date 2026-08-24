-- Migration: Update move_scheduled_session_safely with trainer support and specific clash checks
drop function if exists public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text);
drop function if exists public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text,uuid);

create or replace function public.move_scheduled_session_safely(
  target_session_id uuid,
  target_working_day_id uuid,
  target_start_time_slot_id uuid,
  target_end_time_slot_id uuid,
  target_room_id uuid,
  target_notes text default null,
  target_trainer_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_session public.scheduled_sessions%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_room public.rooms%rowtype;
  selected_trainer public.trainers%rowtype;
  start_time time;
  end_time time;
  previous_values jsonb;
  clash_record record;
begin
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to edit the timetable.';
  end if;

  select * into selected_session
  from public.scheduled_sessions
  where id = target_session_id
  for update;

  if selected_session.id is null then
    raise exception using errcode = 'P0002', message = 'The scheduled session was not found.';
  end if;

  if selected_session.is_locked or selected_session.status = 'locked' then
    raise exception using errcode = '23514', message = 'Unlock this session before moving it.';
  end if;

  if not exists (
    select 1 from public.working_days
    where id = target_working_day_id
      and academic_period_id = selected_session.academic_period_id
      and is_enabled = true
  ) then
    raise exception using errcode = '23514', message = 'The selected working day is not available.';
  end if;

  select starts_at into start_time from public.time_slots
  where id = target_start_time_slot_id
    and academic_period_id = selected_session.academic_period_id
    and is_enabled = true and slot_type = 'teaching';

  select ends_at into end_time from public.time_slots
  where id = target_end_time_slot_id
    and academic_period_id = selected_session.academic_period_id
    and is_enabled = true and slot_type = 'teaching';

  if start_time is null or end_time is null or start_time >= end_time then
    raise exception using errcode = '23514', message = 'Select a valid teaching-time range.';
  end if;

  if target_room_id is not null then
    select * into selected_room from public.rooms where id = target_room_id;
    if selected_room.id is null or not selected_room.is_active or not selected_room.is_timetable_available then
      raise exception using errcode = '23514', message = 'The selected room is unavailable.';
    end if;
    
    select * into selected_cohort from public.cohorts where id = selected_session.cohort_id;
    if selected_room.capacity < selected_cohort.actual_size then
      raise exception using errcode = '23514', message = 'The selected room does not have enough capacity for the cohort.';
    end if;
  end if;

  if target_trainer_id is not null then
    select * into selected_trainer from public.trainers where id = target_trainer_id;
    if selected_trainer.id is null or not selected_trainer.is_active or not selected_trainer.is_timetable_available then
      raise exception using errcode = '23514', message = 'The selected trainer is unavailable.';
    end if;
  end if;

  -- Check for Trainer clash
  if target_trainer_id is not null then
    select existing.id, t.full_name into clash_record
    from public.scheduled_sessions existing
    join public.trainers t on t.id = existing.trainer_id
    join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
    where existing.id <> selected_session.id
      and existing.academic_period_id = selected_session.academic_period_id
      and existing.working_day_id = target_working_day_id
      and existing.status not in ('cancelled','archived')
      and existing_start.starts_at < end_time
      and existing_end.ends_at > start_time
      and existing.trainer_id = target_trainer_id
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
  where existing.id <> selected_session.id
    and existing.academic_period_id = selected_session.academic_period_id
    and existing.working_day_id = target_working_day_id
    and existing.status not in ('cancelled','archived')
    and existing_start.starts_at < end_time
    and existing_end.ends_at > start_time
    and existing.cohort_id = selected_session.cohort_id
  limit 1;
  
  if clash_record.id is not null then
    raise exception using errcode = '23P01', message = 'Cohort ' || clash_record.code || ' is already scheduled for another class at this time.';
  end if;

  -- Check for Room clash
  if target_room_id is not null then
    select existing.id, r.name into clash_record
    from public.scheduled_sessions existing
    join public.rooms r on r.id = existing.room_id
    join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
    where existing.id <> selected_session.id
      and existing.academic_period_id = selected_session.academic_period_id
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

  previous_values = jsonb_build_object(
    'working_day_id', selected_session.working_day_id,
    'start_time_slot_id', selected_session.start_time_slot_id,
    'end_time_slot_id', selected_session.end_time_slot_id,
    'room_id', selected_session.room_id,
    'trainer_id', selected_session.trainer_id,
    'notes', selected_session.notes,
    'status', selected_session.status,
    'source', selected_session.source,
    'conflict_state', selected_session.conflict_state,
    'is_locked', selected_session.is_locked
  );

  -- Update the parent teaching allocation first to keep triggers aligned
  update public.teaching_allocations
  set trainer_id = target_trainer_id,
      updated_by = auth.uid(),
      updated_at = now()
  where id = selected_session.teaching_allocation_id;

  -- Update all active sessions for this allocation to keep trainer consistent
  update public.scheduled_sessions
  set trainer_id = target_trainer_id,
      updated_by = auth.uid(),
      updated_at = now()
  where teaching_allocation_id = selected_session.teaching_allocation_id
    and status not in ('cancelled', 'archived');

  -- Move the current session details
  update public.scheduled_sessions
  set working_day_id = target_working_day_id,
      start_time_slot_id = target_start_time_slot_id,
      end_time_slot_id = target_end_time_slot_id,
      room_id = target_room_id,
      notes = nullif(trim(target_notes), ''),
      source = 'reschedule'::public.scheduled_session_source,
      conflict_state = 'clear'::public.scheduled_session_conflict_state,
      updated_by = auth.uid(),
      updated_at = now()
  where id = selected_session.id;

  insert into public.timetable_session_change_log (
    academic_period_id, scheduled_session_id, change_type, previous_values, new_values
  ) values (
    selected_session.academic_period_id,
    selected_session.id,
    'move',
    previous_values,
    jsonb_build_object(
      'working_day_id', target_working_day_id,
      'start_time_slot_id', target_start_time_slot_id,
      'end_time_slot_id', target_end_time_slot_id,
      'room_id', target_room_id,
      'trainer_id', target_trainer_id,
      'notes', nullif(trim(target_notes), '')
    )
  );
end;
$$;

revoke all on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text,uuid) from public;
grant execute on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text,uuid) to authenticated;

comment on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text,uuid) is
  'Safely updates a timetable session day, slots, room, notes, and trainer with complete clash detection.';
