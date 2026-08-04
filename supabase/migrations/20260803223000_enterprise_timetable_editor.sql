begin;

create table if not exists public.timetable_session_change_log (
  id uuid primary key default gen_random_uuid(),
  academic_period_id uuid not null references public.academic_periods(id) on delete cascade,
  scheduled_session_id uuid not null references public.scheduled_sessions(id) on delete cascade,
  change_type text not null check (change_type in ('move', 'lock', 'unlock', 'undo')),
  previous_values jsonb not null,
  new_values jsonb not null,
  changed_by uuid references auth.users(id) on delete set null default auth.uid(),
  changed_at timestamptz not null default now(),
  reverted_at timestamptz,
  reverted_by uuid references auth.users(id) on delete set null
);

create index if not exists timetable_session_change_log_period_idx
  on public.timetable_session_change_log (academic_period_id, changed_at desc);

alter table public.timetable_session_change_log enable row level security;

drop policy if exists timetable_session_change_log_select on public.timetable_session_change_log;
create policy timetable_session_change_log_select
on public.timetable_session_change_log for select
to authenticated
using (public.current_user_has_role(array['hod','system_admin']::public.app_role[]));

create or replace function public.move_scheduled_session_safely(
  target_session_id uuid,
  target_working_day_id uuid,
  target_start_time_slot_id uuid,
  target_end_time_slot_id uuid,
  target_room_id uuid,
  target_notes text default null
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
  start_time time;
  end_time time;
  previous_values jsonb;
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

  select * into selected_room from public.rooms where id = target_room_id;
  select * into selected_cohort from public.cohorts where id = selected_session.cohort_id;

  if selected_room.id is null or not selected_room.is_active or not selected_room.is_timetable_available then
    raise exception using errcode = '23514', message = 'The selected room is unavailable.';
  end if;

  if selected_room.capacity < selected_cohort.actual_size then
    raise exception using errcode = '23514', message = 'The selected room does not have enough capacity for the cohort.';
  end if;

  if exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
    where existing.id <> selected_session.id
      and existing.academic_period_id = selected_session.academic_period_id
      and existing.working_day_id = target_working_day_id
      and existing.status not in ('cancelled','archived')
      and existing_start.starts_at < end_time
      and existing_end.ends_at > start_time
      and (
        existing.trainer_id = selected_session.trainer_id
        or existing.cohort_id = selected_session.cohort_id
        or existing.room_id = target_room_id
      )
  ) then
    raise exception using errcode = '23P01', message = 'This move would create a trainer, cohort or room clash.';
  end if;

  previous_values = jsonb_build_object(
    'working_day_id', selected_session.working_day_id,
    'start_time_slot_id', selected_session.start_time_slot_id,
    'end_time_slot_id', selected_session.end_time_slot_id,
    'room_id', selected_session.room_id,
    'notes', selected_session.notes,
    'status', selected_session.status,
    'source', selected_session.source,
    'conflict_state', selected_session.conflict_state,
    'is_locked', selected_session.is_locked
  );

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
      'notes', nullif(trim(target_notes), ''),
      'status', selected_session.status,
      'source', 'reschedule',
      'conflict_state', 'clear',
      'is_locked', false
    )
  );
end;
$$;

create or replace function public.toggle_scheduled_session_lock(target_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_session public.scheduled_sessions%rowtype;
  next_locked boolean;
  next_status public.scheduled_session_status;
begin
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to lock timetable sessions.';
  end if;

  select * into selected_session from public.scheduled_sessions where id = target_session_id for update;
  if selected_session.id is null then raise exception using errcode = 'P0002', message = 'The scheduled session was not found.'; end if;

  next_locked = not selected_session.is_locked;
  next_status = (case when next_locked then 'locked' else 'draft' end)::public.scheduled_session_status;

  update public.scheduled_sessions
  set is_locked = next_locked,
      status = next_status,
      updated_by = auth.uid(),
      updated_at = now()
  where id = selected_session.id;

  insert into public.timetable_session_change_log (
    academic_period_id, scheduled_session_id, change_type, previous_values, new_values
  ) values (
    selected_session.academic_period_id,
    selected_session.id,
    case when next_locked then 'lock' else 'unlock' end,
    jsonb_build_object('status', selected_session.status, 'is_locked', selected_session.is_locked),
    jsonb_build_object('status', next_status, 'is_locked', next_locked)
  );
end;
$$;

create or replace function public.undo_last_timetable_session_change(target_academic_period_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_change public.timetable_session_change_log%rowtype;
  previous jsonb;
begin
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception using errcode = '42501', message = 'You are not authorized to undo timetable changes.';
  end if;

  select * into selected_change
  from public.timetable_session_change_log
  where academic_period_id = target_academic_period_id
    and reverted_at is null
    and change_type in ('move','lock','unlock')
  order by changed_at desc
  limit 1
  for update;

  if selected_change.id is null then
    raise exception using errcode = 'P0002', message = 'There is no timetable edit to undo.';
  end if;

  previous = selected_change.previous_values;

  if selected_change.change_type = 'move' then
    update public.scheduled_sessions
    set working_day_id = (previous ->> 'working_day_id')::uuid,
        start_time_slot_id = (previous ->> 'start_time_slot_id')::uuid,
        end_time_slot_id = (previous ->> 'end_time_slot_id')::uuid,
        room_id = (previous ->> 'room_id')::uuid,
        notes = previous ->> 'notes',
        status = (previous ->> 'status')::public.scheduled_session_status,
        source = (previous ->> 'source')::public.scheduled_session_source,
        conflict_state = (previous ->> 'conflict_state')::public.scheduled_session_conflict_state,
        is_locked = (previous ->> 'is_locked')::boolean,
        updated_by = auth.uid(), updated_at = now()
    where id = selected_change.scheduled_session_id;
  else
    update public.scheduled_sessions
    set status = (previous ->> 'status')::public.scheduled_session_status,
        is_locked = (previous ->> 'is_locked')::boolean,
        updated_by = auth.uid(), updated_at = now()
    where id = selected_change.scheduled_session_id;
  end if;

  update public.timetable_session_change_log
  set reverted_at = now(), reverted_by = auth.uid()
  where id = selected_change.id;
end;
$$;

revoke all on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text) from public;
grant execute on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text) to authenticated;
revoke all on function public.toggle_scheduled_session_lock(uuid) from public;
grant execute on function public.toggle_scheduled_session_lock(uuid) to authenticated;
revoke all on function public.undo_last_timetable_session_change(uuid) from public;
grant execute on function public.undo_last_timetable_session_change(uuid) to authenticated;

commit;
