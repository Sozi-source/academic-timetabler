create or replace function public.assign_scheduled_session_room_safely(
  target_session_id uuid,
  target_room_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_session public.scheduled_sessions%rowtype;
  selected_room public.rooms%rowtype;
  selected_cohort public.cohorts%rowtype;
  start_time time;
  end_time time;
  required_capacity integer;
  previous_values jsonb;
  conflicting_room_code text;
begin
  if not public.current_user_has_role(
    array['hod', 'system_admin']::public.app_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'You are not authorized to edit the timetable.';
  end if;

  select * into selected_session
  from public.scheduled_sessions
  where id = target_session_id
  for update;

  if selected_session.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'The scheduled session was not found.';
  end if;

  if selected_session.is_locked or selected_session.status = 'locked' then
    raise exception using
      errcode = '23514',
      message = 'Unlock this session before assigning a room.';
  end if;

  if target_room_id is not null then
    select * into selected_room
    from public.rooms
    where id = target_room_id;

    if selected_room.id is null
      or not selected_room.is_active
      or not selected_room.is_timetable_available
    then
      raise exception using
        errcode = '23514',
        message = 'The selected room is unavailable.';
    end if;

    select * into selected_cohort
    from public.cohorts
    where id = selected_session.cohort_id;

    required_capacity := greatest(
      coalesce(selected_session.combined_cohort_size, 0),
      coalesce(selected_cohort.actual_size, 0)
    );

    if selected_room.capacity < required_capacity then
      raise exception using
        errcode = '23514',
        message = 'The selected room does not have enough capacity for this class.';
    end if;

    select starts_at into start_time
    from public.time_slots
    where id = selected_session.start_time_slot_id;

    select ends_at into end_time
    from public.time_slots
    where id = selected_session.end_time_slot_id;

    select room.code into conflicting_room_code
    from public.scheduled_sessions existing
    join public.rooms room on room.id = existing.room_id
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id <> selected_session.id
      and existing.academic_period_id = selected_session.academic_period_id
      and existing.working_day_id = selected_session.working_day_id
      and existing.status not in ('cancelled', 'archived')
      and existing.room_id = target_room_id
      and existing_start.starts_at < end_time
      and existing_end.ends_at > start_time
    limit 1;

    if conflicting_room_code is not null then
      raise exception using
        errcode = '23P01',
        message = 'Room ' || conflicting_room_code || ' is already occupied at this time.';
    end if;
  end if;

  if selected_session.room_id is not distinct from target_room_id then
    return;
  end if;

  previous_values := jsonb_build_object(
    'room_id', selected_session.room_id,
    'source', selected_session.source,
    'conflict_state', selected_session.conflict_state
  );

  update public.scheduled_sessions
  set
    room_id = target_room_id,
    source = 'reschedule'::public.scheduled_session_source,
    conflict_state = 'clear'::public.scheduled_session_conflict_state,
    updated_by = auth.uid(),
    updated_at = now()
  where id = selected_session.id;

  insert into public.timetable_session_change_log (
    academic_period_id,
    scheduled_session_id,
    change_type,
    previous_values,
    new_values
  ) values (
    selected_session.academic_period_id,
    selected_session.id,
    'move',
    previous_values,
    jsonb_build_object('room_id', target_room_id)
  );
end;
$$;

revoke all on function
  public.assign_scheduled_session_room_safely(uuid, uuid)
from public;

grant execute on function
  public.assign_scheduled_session_room_safely(uuid, uuid)
to authenticated;

comment on function
  public.assign_scheduled_session_room_safely(uuid, uuid)
is
  'Quickly assigns one session room with capacity, availability, overlap, authorization, and audit checks.';
