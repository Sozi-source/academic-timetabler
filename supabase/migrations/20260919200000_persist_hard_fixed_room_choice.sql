-- Migration: Persist a Manually-Chosen Room Back Onto the Allocation
-- Date: 2026-09-19
-- Description:
--   HOD reported: 6 sessions were hard-fixed via "Place Unit on Timetable" (no
--   conflict, confirmed placed and published). Regenerating the timetable later
--   reported the SAME 6 as "unresolved" again, as if they had never been placed.
--
--   Root cause, found in src/features/timetable-generator/planner.ts,
--   `sessionSatisfiesRequest()` -- the function that decides whether an existing
--   session already covers a slot the generator would otherwise try to fill:
--
--       (allocation.preferredRoomId !== null &&
--         session.roomId !== allocation.preferredRoomId)
--
--   -- an allocation with a stored preferred room only counts an existing
--   session as "satisfied" if that session's room matches EXACTLY. When a
--   session is hard-fixed with a DIFFERENT room than the allocation's stored
--   preference (the common case: the original preferred room was unavailable,
--   so the HOD picked a working room by hand), this check fails every single
--   time. The generator then treats the slot as still needing to be filled,
--   builds a brand-new candidate for it, collides with the very session that
--   already covers it, and reports it "unresolved" -- on every regeneration,
--   forever, regardless of how many times it gets hard-fixed.
--
--   This is the same shape of gap already fixed for trainer choices: both
--   public.schedule_allocation_session_safely() (used by "Place Unit on
--   Timetable") and public.move_scheduled_session_safely() (used by "Move /
--   Edit" and Quick Edit) already write a manually-chosen TRAINER back onto
--   teaching_allocations so it persists across regenerations -- but neither
--   one, nor public.assign_scheduled_session_room_safely() (Quick Edit's
--   room-only swap), ever did the same for a manually-chosen ROOM.
--
-- Fix:
--   1. All three RPCs now sync a manually-chosen room back onto
--      teaching_allocations.preferred_room_id when it differs, mirroring the
--      existing trainer-sync pattern exactly (only touches the row, only when
--      the value actually changes, same audit-log shape). Every other line of
--      each function -- clash detection, shared-class cohort naming, capacity
--      checks -- is unchanged from the currently-applied version; only the
--      new room-sync block was added to each.
--   2. A one-off repair: for every currently-placed, non-cancelled session
--      whose room differs from its allocation's stored preferred_room_id,
--      align the allocation to the session that's actually on the ground --
--      the physical placement is the fact; the stored preference was stale.
--   3. Companion note (not a SQL change): planner.ts's
--      sessionSatisfiesRequest() itself is correct as written -- once the
--      allocation's preferred_room_id is kept in sync by this migration, its
--      exact-match check works as intended, and no generator code change was
--      needed.

begin;

-- ============================================================
-- 1a. schedule_allocation_session_safely -- sync room on hard-fix placement
-- ============================================================

create or replace function public.schedule_allocation_session_safely(
  target_allocation_id uuid,
  target_working_day_id uuid,
  target_start_time_slot_id uuid,
  target_end_time_slot_id uuid,
  target_room_id uuid default null,
  target_notes text default null,
  target_trainer_id uuid default null,
  target_is_locked boolean default true,
  target_participant_cohort_ids uuid[] default null
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
  effective_participant_cohort_ids uuid[] := '{}'::uuid[];
  effective_cohort_size integer;
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

    select
      existing.id,
      t.full_name as trainer_name,
      u.code as unit_code,
      c.code as cohort_code,
      r.name as room_name
    into clash_record
    from public.scheduled_sessions existing
    join public.trainers t on t.id = existing.trainer_id
    join public.units u on u.id = existing.unit_id
    join public.cohorts c on c.id = existing.cohort_id
    left join public.rooms r on r.id = existing.room_id
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
      raise exception using errcode = '23P01',
        message = format('Trainer clash: %s is already scheduled to teach %s (%s)%s at this time.',
          clash_record.trainer_name, clash_record.unit_code, clash_record.cohort_code,
          case when clash_record.room_name is not null then ' in ' || clash_record.room_name else '' end
        );
    end if;
  end if;

  -- Resolve participant cohort IDs (explicit override vs authoritative shared-offering resolution)
  if target_participant_cohort_ids is not null and cardinality(target_participant_cohort_ids) > 0 then
    effective_participant_cohort_ids := array(
      select distinct c_id
      from unnest(array_append(target_participant_cohort_ids, selected_allocation.cohort_id)) as c_id
      where c_id is not null
    );
  else
    effective_participant_cohort_ids := public.resolve_participant_cohort_ids(
      selected_allocation.cohort_id,
      selected_allocation.teaching_offering_id
    );
  end if;

  if cardinality(effective_participant_cohort_ids) = 0 then
    effective_participant_cohort_ids := array[selected_allocation.cohort_id];
  end if;

  effective_cohort_size := public.resolve_participant_cohort_size(effective_participant_cohort_ids);
  if effective_cohort_size <= 0 then
    effective_cohort_size := coalesce(selected_allocation.cohort_actual_size, 0);
  end if;

  -- Cohort clash: report the cohort that genuinely overlaps, not merely the session owner.
  select
    existing.id,
    owner.code as owner_cohort_code,
    clashing.id as clash_cohort_id,
    clashing.code as clash_cohort_code,
    u.code as unit_code,
    u.name as unit_name,
    t.full_name as trainer_name,
    r.name as room_name
  into clash_record
  from public.scheduled_sessions existing
  join public.cohorts owner on owner.id = existing.cohort_id
  join public.units u on u.id = existing.unit_id
  left join public.trainers t on t.id = existing.trainer_id
  left join public.rooms r on r.id = existing.room_id
  join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
  join lateral (
    select c.id, c.code
    from public.cohorts c
    where c.id = any(
      array_append(coalesce(existing.participant_cohort_ids, '{}'::uuid[]), existing.cohort_id)
    )
      and c.id = any(effective_participant_cohort_ids)
    order by (c.id = selected_allocation.cohort_id) desc, c.code
    limit 1
  ) clashing on true
  where existing.academic_period_id = selected_allocation.academic_period_id
    and existing.working_day_id = target_working_day_id
    and existing.status not in ('cancelled','archived')
    and existing_start.starts_at < end_time
    and existing_end.ends_at > start_time
  limit 1;

  if clash_record.id is not null then
    if clash_record.clash_cohort_id = selected_allocation.cohort_id then
      raise exception using
        errcode = '23P01',
        message = format(
          'Cohort clash: Cohort "%s" already has %s (%s) with %s%s during this time.%s',
          clash_record.clash_cohort_code,
          clash_record.unit_code,
          clash_record.unit_name,
          coalesce(clash_record.trainer_name, 'Unassigned trainer'),
          case when clash_record.room_name is not null then ' in ' || clash_record.room_name else '' end,
          case
            when clash_record.owner_cohort_code is distinct from clash_record.clash_cohort_code
              then format(' That session is a shared class led by %s.', clash_record.owner_cohort_code)
            else ''
          end
        );
    else
      raise exception using
        errcode = '23P01',
        message = format(
          'Cohort clash: Shared partner cohort "%s" (participating in this unit) already has %s (%s) with %s%s during this time. All participating cohorts must be free simultaneously.',
          clash_record.clash_cohort_code,
          clash_record.unit_code,
          clash_record.unit_name,
          coalesce(clash_record.trainer_name, 'Unassigned trainer'),
          case when clash_record.room_name is not null then ' in ' || clash_record.room_name else '' end
        );
    end if;
  end if;

  if target_room_id is not null then
    select * into selected_room from public.rooms where id = target_room_id;
    if selected_room.id is null or not selected_room.is_active or not selected_room.is_timetable_available then
      raise exception using errcode = '23514', message = 'The selected room is unavailable.';
    end if;

    if selected_room.capacity < effective_cohort_size and selected_room.capacity > 0 and effective_cohort_size > 0 then
      raise exception using errcode = '23514', message = format('Room capacity (%s) is below cohort size (%s).', selected_room.capacity, effective_cohort_size);
    end if;

    select
      existing.id,
      r.name as room_name,
      u.code as unit_code,
      c.code as cohort_code
    into clash_record
    from public.scheduled_sessions existing
    join public.rooms r on r.id = existing.room_id
    join public.units u on u.id = existing.unit_id
    join public.cohorts c on c.id = existing.cohort_id
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
      raise exception using errcode = '23P01',
        message = format('Room clash: Room %s is already booked for %s (%s) at this time.',
          clash_record.room_name, clash_record.unit_code, clash_record.cohort_code);
    end if;
  end if;

  select coalesce(max(session_number), 0) + 1 into next_session_num
  from public.scheduled_sessions
  where teaching_allocation_id = selected_allocation.id
    and status not in ('cancelled','archived');

  if target_trainer_id is not null and target_trainer_id is distinct from selected_allocation.trainer_id then
    update public.teaching_allocations
    set trainer_id = target_trainer_id, updated_by = auth.uid(), updated_at = now()
    where id = selected_allocation.id;
  end if;

  -- NEW: mirror the trainer-sync above for a manually-chosen room, so a
  -- hard-fixed room persists as the allocation's own preference and the
  -- generator recognizes this exact session as already satisfied on every
  -- future regeneration, instead of re-requesting a duplicate for it.
  if target_room_id is not null and target_room_id is distinct from selected_allocation.preferred_room_id then
    update public.teaching_allocations
    set preferred_room_id = target_room_id, updated_by = auth.uid(), updated_at = now()
    where id = selected_allocation.id;
  end if;

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
    effective_participant_cohort_ids,
    effective_cohort_size,
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
      'session_number', next_session_num,
      'participant_cohort_ids', effective_participant_cohort_ids
    )
  );

  return new_session_id;
end;
$$;

revoke all on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean, uuid[]) from public;
grant execute on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean, uuid[]) to authenticated;

comment on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean, uuid[]) is
  'Hard-fixes a teaching allocation directly onto the timetable. Persists a manually-chosen trainer AND room back onto the allocation so future regenerations recognize this session as already satisfied.';


revoke all on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean, uuid[]) from public;
grant execute on function public.schedule_allocation_session_safely(uuid, uuid, uuid, uuid, uuid, text, uuid, boolean, uuid[]) to authenticated;

-- ============================================================
-- 1b. move_scheduled_session_safely -- sync room on manual move
-- ============================================================

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
  selected_allocation public.teaching_allocations%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_room public.rooms%rowtype;
  selected_trainer public.trainers%rowtype;
  start_time time;
  end_time time;
  previous_values jsonb;
  clash_record record;
  trainer_is_changing boolean;
  room_is_changing boolean;
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

  select * into selected_allocation
  from public.teaching_allocations
  where id = selected_session.teaching_allocation_id;

  -- Only a genuine trainer/room change should propagate anywhere beyond this row.
  trainer_is_changing := target_trainer_id is not null
    and target_trainer_id is distinct from selected_session.trainer_id;
  room_is_changing := target_room_id is not null
    and selected_allocation.id is not null
    and target_room_id is distinct from selected_allocation.preferred_room_id;

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

  if trainer_is_changing then
    select * into selected_trainer from public.trainers where id = target_trainer_id;
    if selected_trainer.id is null or not selected_trainer.is_active or not selected_trainer.is_timetable_available then
      raise exception using errcode = '23514', message = 'The selected trainer is unavailable.';
    end if;
  end if;

  -- Check for Trainer clash (only meaningful against the effective trainer for this session)
  if coalesce(target_trainer_id, selected_session.trainer_id) is not null then
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
      and existing.trainer_id = coalesce(target_trainer_id, selected_session.trainer_id)
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

  -- Only touch the parent allocation and sibling sessions when the trainer
  -- is actually changing. A plain day/time/room move never reaches here.
  if trainer_is_changing then
    update public.teaching_allocations
    set trainer_id = target_trainer_id,
        updated_by = auth.uid(),
        updated_at = now()
    where id = selected_session.teaching_allocation_id;

    update public.scheduled_sessions
    set trainer_id = target_trainer_id,
        updated_by = auth.uid(),
        updated_at = now()
    where teaching_allocation_id = selected_session.teaching_allocation_id
      and id <> selected_session.id
      and status not in ('cancelled', 'archived');
  end if;

  -- NEW: mirror the trainer-sync above for a manually-chosen room -- only
  -- the allocation's stored preference, never sibling sessions (each
  -- session keeps its own placed room; only the allocation's DEFAULT for
  -- future/new sessions of this allocation should follow the latest choice).
  if room_is_changing then
    update public.teaching_allocations
    set preferred_room_id = target_room_id,
        updated_by = auth.uid(),
        updated_at = now()
    where id = selected_session.teaching_allocation_id;
  end if;

  -- Move the current session details (always exactly this one row).
  update public.scheduled_sessions
  set working_day_id = target_working_day_id,
      start_time_slot_id = target_start_time_slot_id,
      end_time_slot_id = target_end_time_slot_id,
      room_id = target_room_id,
      trainer_id = case when trainer_is_changing then target_trainer_id else trainer_id end,
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
      'trainer_id', case when trainer_is_changing then target_trainer_id else selected_session.trainer_id end,
      'notes', nullif(trim(target_notes), '')
    )
  );
end;
$$;

revoke all on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text,uuid) from public;
grant execute on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text,uuid) to authenticated;

comment on function public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text,uuid) is
  'Safely updates a single timetable session day, slots, room, notes, and (only when actually changing) trainer, with complete clash detection. Sibling sessions and the parent allocation trainer are only touched when the trainer changes; the allocation''s preferred_room_id follows a genuine room change so future regenerations recognize this placement.';


-- ============================================================
-- 1c. assign_scheduled_session_room_safely -- sync room on Quick Edit swap
-- ============================================================

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

  -- NEW: mirror the sync now applied in schedule_allocation_session_safely
  -- and move_scheduled_session_safely, so a Quick Edit room swap also
  -- persists as the allocation's own preference.
  if target_room_id is not null then
    update public.teaching_allocations
    set preferred_room_id = target_room_id,
        updated_by = auth.uid(),
        updated_at = now()
    where id = selected_session.teaching_allocation_id
      and preferred_room_id is distinct from target_room_id;
  end if;

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
  'Quickly assigns one session room with capacity, availability, overlap, authorization, and audit checks. Persists the choice onto the allocation''s preferred_room_id so future regenerations recognize this placement.';


-- ============================================================
-- 2. One-off repair: align stale preferred_room_id to what is actually placed
-- ============================================================

update public.teaching_allocations allocation
set
  preferred_room_id = placed.room_id,
  updated_at = now(),
  updated_by = coalesce(auth.uid(), allocation.updated_by)
from (
  select distinct on (session.teaching_allocation_id)
    session.teaching_allocation_id,
    session.room_id
  from public.scheduled_sessions session
  where session.status not in ('cancelled', 'archived')
    and session.room_id is not null
  order by session.teaching_allocation_id, session.session_number
) placed
where allocation.id = placed.teaching_allocation_id
  and allocation.preferred_room_id is distinct from placed.room_id;

commit;
