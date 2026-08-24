-- Migration: Allow draft edits while timetable is published
-- Redefine apply_same_department_trainer_exchange to allow live draft exchanges
-- without unpublishing or archiving active timetable versions.

create or replace function public.apply_same_department_trainer_exchange(
  target_allocation_id uuid,
  partner_allocation_id uuid,
  allow_protected_reopen boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  target_allocation public.teaching_allocations%rowtype;
  partner_allocation public.teaching_allocations%rowtype;
  target_trainer public.trainers%rowtype;
  partner_trainer public.trainers%rowtype;
  target_projected_hours numeric;
  partner_projected_hours numeric;
  cancelled_sessions integer := 0;
  reopened_version_count integer := 0;
  archived_published_version_count integer := 0;
  exchange_event_id uuid;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department before applying an exchange';
  end if;

  if target_allocation_id is null
    or partner_allocation_id is null
    or target_allocation_id = partner_allocation_id then
    raise exception using
      errcode = '22023',
      message = 'Select two different teaching allocations for the exchange';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-exchange:'
      || least(target_allocation_id::text, partner_allocation_id::text)
      || ':'
      || greatest(target_allocation_id::text, partner_allocation_id::text),
    0
  ));

  select allocation.*
  into target_allocation
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.id = target_allocation_id
    and programme.department_id = active_department
  for update of allocation;

  select allocation.*
  into partner_allocation
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.id = partner_allocation_id
    and programme.department_id = active_department
  for update of allocation;

  if target_allocation.id is null or partner_allocation.id is null then
    raise exception using
      errcode = '42501',
      message = 'Both exchange allocations must belong to the current working department';
  end if;

  if target_allocation.academic_period_id <> partner_allocation.academic_period_id then
    raise exception using
      errcode = '23514',
      message = 'Trainer exchanges must stay inside one Academic Period';
  end if;

  if target_allocation.status not in ('draft', 'active', 'suspended')
    or partner_allocation.status not in ('draft', 'active', 'suspended') then
    raise exception using
      errcode = '23514',
      message = 'Both teaching allocations must remain editable';
  end if;

  if target_allocation.trainer_id is null
    or partner_allocation.trainer_id is null
    or target_allocation.trainer_id = partner_allocation.trainer_id then
    raise exception using
      errcode = '23514',
      message = 'The exchange requires two different assigned trainers';
  end if;

  if target_allocation.session_duration_minutes
      <> partner_allocation.session_duration_minutes then
    raise exception using
      errcode = '23514',
      message = 'Only units with the same session duration may exchange trainers';
  end if;

  select trainer.* into target_trainer
  from public.trainers trainer
  where trainer.id = target_allocation.trainer_id
    and trainer.department_id = active_department
    and trainer.is_active
    and trainer.is_timetable_available;

  select trainer.* into partner_trainer
  from public.trainers trainer
  where trainer.id = partner_allocation.trainer_id
    and trainer.department_id = active_department
    and trainer.is_active
    and trainer.is_timetable_available;

  if target_trainer.id is null or partner_trainer.id is null then
    raise exception using
      errcode = '23514',
      message = 'Both trainers must be active, timetable-available members of the current department';
  end if;

  -- Verify locked sessions check is only executed if not allow_protected_reopen
  if not allow_protected_reopen and exists (
    select 1
    from public.scheduled_sessions session
    where session.teaching_allocation_id in (
      target_allocation.id,
      partner_allocation.id
    )
      and (session.is_locked or session.status = 'locked')
  ) then
    raise exception using
      errcode = '55000',
      message = 'Unlock the affected timetable sessions before applying this exchange';
  end if;

  -- Reopened loops and version status checking are bypassed to allow background draft modification.

  select coalesce(sum(
    allocation.weekly_sessions * allocation.session_duration_minutes
  ) / 60.0, 0)
  into target_projected_hours
  from public.teaching_allocations allocation
  where allocation.trainer_id = target_trainer.id
    and allocation.academic_period_id = target_allocation.academic_period_id
    and allocation.status in ('draft', 'active', 'suspended')
    and allocation.id not in (target_allocation.id, partner_allocation.id);

  target_projected_hours := target_projected_hours
    + partner_allocation.weekly_sessions
      * partner_allocation.session_duration_minutes / 60.0;

  select coalesce(sum(
    allocation.weekly_sessions * allocation.session_duration_minutes
  ) / 60.0, 0)
  into partner_projected_hours
  from public.teaching_allocations allocation
  where allocation.trainer_id = partner_trainer.id
    and allocation.academic_period_id = target_allocation.academic_period_id
    and allocation.status in ('draft', 'active', 'suspended')
    and allocation.id not in (target_allocation.id, partner_allocation.id);

  partner_projected_hours := partner_projected_hours
    + target_allocation.weekly_sessions
      * target_allocation.session_duration_minutes / 60.0;

  if target_projected_hours > target_trainer.maximum_weekly_hours
    or partner_projected_hours > partner_trainer.maximum_weekly_hours then
    raise exception using
      errcode = '23514',
      message = 'The exchange would exceed a trainer''s absolute weekly maximum';
  end if;

  update public.scheduled_sessions session
  set
    status = 'cancelled',
    conflict_state = 'clear',
    is_locked = false,
    notes = left(concat_ws(
      ' ',
      nullif(trim(session.notes), ''),
      'Cancelled for an approved same-department trainer exchange.'
    ), 1000),
    updated_at = now(),
    updated_by = auth.uid()
  where session.teaching_allocation_id in (
    target_allocation.id,
    partner_allocation.id
  )
    and session.status not in ('cancelled', 'archived');

  get diagnostics cancelled_sessions = row_count;

  update public.teaching_allocations allocation
  set
    trainer_id = case
      when allocation.id = target_allocation.id
        then partner_trainer.id
      else target_trainer.id
    end,
    notes = left(concat_ws(
      ' ',
      nullif(trim(allocation.notes), ''),
      'Trainer exchanged automatically with an equal-duration allocation.'
    ), 1500),
    updated_at = now(),
    updated_by = auth.uid()
  where allocation.id in (
    target_allocation.id,
    partner_allocation.id
  );

  if target_allocation.teaching_offering_id is not null then
    update public.teaching_offerings
    set
      trainer_id = partner_trainer.id,
      updated_at = now(),
      updated_by = auth.uid()
    where id = target_allocation.teaching_offering_id
      and department_id = active_department;
  end if;

  if partner_allocation.teaching_offering_id is not null then
    update public.teaching_offerings
    set
      trainer_id = target_trainer.id,
      updated_at = now(),
      updated_by = auth.uid()
    where id = partner_allocation.teaching_offering_id
      and department_id = active_department;
  end if;

  insert into public.timetable_trainer_exchange_events (
    department_id,
    academic_period_id,
    target_allocation_id,
    partner_allocation_id,
    target_previous_trainer_id,
    partner_previous_trainer_id,
    duration_minutes,
    cancelled_session_count,
    summary,
    applied_by
  ) values (
    active_department,
    target_allocation.academic_period_id,
    target_allocation.id,
    partner_allocation.id,
    target_trainer.id,
    partner_trainer.id,
    target_allocation.session_duration_minutes,
    cancelled_sessions,
    jsonb_build_object(
      'targetTrainerName', target_trainer.full_name,
      'partnerTrainerName', partner_trainer.full_name,
      'targetProjectedHours', target_projected_hours,
      'partnerProjectedHours', partner_projected_hours,
      'reopenedVersionCount', reopened_version_count,
      'archivedPublishedVersionCount', archived_published_version_count
    ),
    auth.uid()
  ) returning id into exchange_event_id;

  return jsonb_build_object(
    'exchangeEventId', exchange_event_id,
    'targetAllocationId', target_allocation.id,
    'partnerAllocationId', partner_allocation.id,
    'targetTrainerId', partner_trainer.id,
    'partnerTrainerId', target_trainer.id,
    'cancelledSessionCount', cancelled_sessions,
    'targetProjectedHours', target_projected_hours,
    'partnerProjectedHours', partner_projected_hours,
    'reopenedVersionCount', reopened_version_count,
    'archivedPublishedVersionCount', archived_published_version_count
  );
end;
$$;

revoke all on function public.apply_same_department_trainer_exchange(uuid, uuid, boolean) from public;
grant execute on function public.apply_same_department_trainer_exchange(uuid, uuid, boolean) to authenticated;

comment on function public.apply_same_department_trainer_exchange(uuid, uuid, boolean) is
  'Exchanges equal-duration same-department trainer allocations in the live draft without affecting published snapshot versions.';


-- Overwrite create_timetable_version to include participantCohortIds in the version snapshot JSONB
create or replace function public.create_timetable_version(
  target_academic_period_id uuid,
  version_title text,
  version_change_summary text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  next_version integer;
  version_id uuid;
  sessions_total integer;
  blocked_total integer;
  version_snapshot jsonb;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before publishing.';
  end if;
  if nullif(trim(version_title), '') is null then
    raise exception using errcode = '22023',
      message = 'A timetable version title is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-version:' || active_department::text || ':'
      || target_academic_period_id::text, 0
  ));

  select count(*), count(*) filter (where session.conflict_state = 'blocked')
  into sessions_total, blocked_total
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.status in ('draft', 'confirmed', 'locked');

  if sessions_total = 0 then
    raise exception using errcode = 'P0001',
      message = 'No draft timetable sessions are available to version.';
  end if;
  if blocked_total > 0 then
    raise exception using errcode = 'P0001',
      message = 'Resolve all blocking timetable conflicts before creating a version.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', session.id,
    'cohortId', session.cohort_id,
    'cohortName', cohort.name,
    'unitId', session.unit_id,
    'unitCode', unit_record.code,
    'unitName', unit_record.name,
    'trainerId', session.trainer_id,
    'trainerName', coalesce(trainer.full_name, 'UNASSIGNED'),
    'roomId', session.room_id,
    'roomCode', room.code,
    'roomName', room.name,
    'workingDayId', session.working_day_id,
    'day', working_day.day_of_week,
    'daySequence', working_day.sequence_number,
    'startTimeSlotId', session.start_time_slot_id,
    'startTime', start_slot.starts_at,
    'endTimeSlotId', session.end_time_slot_id,
    'endTime', end_slot.ends_at,
    'sessionNumber', session.session_number,
    'deliveryMode', session.delivery_mode,
    'isLocked', session.is_locked,
    'notes', session.notes,
    'participantCohortIds', to_jsonb(session.participant_cohort_ids)
  ) order by working_day.sequence_number, start_slot.sequence_number,
    cohort.name, unit_record.code), '[]'::jsonb)
  into version_snapshot
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  join public.units unit_record on unit_record.id = session.unit_id
  left join public.trainers trainer on trainer.id = session.trainer_id
  left join public.rooms room on room.id = session.room_id
  join public.working_days working_day on working_day.id = session.working_day_id
  join public.time_slots start_slot on start_slot.id = session.start_time_slot_id
  join public.time_slots end_slot on end_slot.id = session.end_time_slot_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.status in ('draft', 'confirmed', 'locked');

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.timetable_versions
  where department_id = active_department
    and academic_period_id = target_academic_period_id;

  insert into public.timetable_versions (
    department_id, academic_period_id, version_number, status, title,
    change_summary, session_count, conflict_count, snapshot, created_by
  ) values (
    active_department, target_academic_period_id, next_version, 'draft',
    trim(version_title), nullif(trim(version_change_summary), ''),
    sessions_total, blocked_total, version_snapshot, auth.uid()
  ) returning id into version_id;

  insert into public.timetable_publication_events (
    timetable_version_id, event_type, from_status, to_status, note, performed_by
  ) values (
    version_id, 'created', null, 'draft',
    nullif(trim(version_change_summary), ''), auth.uid()
  );

  return version_id;
end;
$$;

revoke all on function public.create_timetable_version(uuid, text, text) from public;
grant execute on function public.create_timetable_version(uuid, text, text) to authenticated;

comment on function public.create_timetable_version(uuid, text, text) is
  'Creates a new timetable version with snapshot including participantCohortIds.';


-- Redefine get_institution_trainer_workloads as plpgsql to bypass RLS via security definer and prevent SQL inlining
create or replace function public.get_institution_trainer_workloads(
  target_academic_period_id uuid
)
returns table (
  trainer_id uuid,
  allocated_hours numeric,
  department_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  select
    allocation.trainer_id,
    coalesce(sum(
      allocation.weekly_sessions * allocation.session_duration_minutes
    ) / 60.0, 0)::numeric as allocated_hours,
    count(distinct programme.department_id) as department_count
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.academic_period_id = target_academic_period_id
    and allocation.trainer_id is not null
    and allocation.status in ('draft', 'active')
  group by allocation.trainer_id;
end;
$$;

revoke all on function public.get_institution_trainer_workloads(uuid) from public;
grant execute on function public.get_institution_trainer_workloads(uuid) to authenticated;

comment on function public.get_institution_trainer_workloads(uuid) is
  'Aggregates institution-wide trainer workloads in PL/pgSQL to bypass row level security filters.';


-- Redefine move_scheduled_session_safely to support trainer assignment
drop function if exists public.move_scheduled_session_safely(uuid,uuid,uuid,uuid,uuid,text);

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
        (target_trainer_id is not null and existing.trainer_id = target_trainer_id)
        or existing.cohort_id = selected_session.cohort_id
        or (target_room_id is not null and existing.room_id = target_room_id)
      )
  ) then
    raise exception using errcode = '23P01', message = 'This move would create a trainer, cohort or room clash.';
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

  update public.scheduled_sessions
  set working_day_id = target_working_day_id,
      start_time_slot_id = target_start_time_slot_id,
      end_time_slot_id = target_end_time_slot_id,
      room_id = target_room_id,
      trainer_id = target_trainer_id,
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
