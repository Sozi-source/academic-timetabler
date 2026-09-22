-- Fixed unit sessions may reserve timetable space before a trainer is known.
-- Draft generation accepts these reservations, while publication remains
-- blocked until every scheduled session has a trainer.

alter table public.teaching_allocations
  alter column trainer_id drop not null;

alter table public.scheduled_sessions
  alter column trainer_id drop not null;

alter table public.unit_offerings
  add column if not exists is_provisionally_reserved boolean
    not null default false;

create or replace function public.validate_teaching_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
  selected_trainer public.trainers%rowtype;
  selected_room public.rooms%rowtype;
begin
  select * into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using errcode = 'P0002', message = 'Academic Period not found';
  end if;

  select * into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using errcode = 'P0002', message = 'Cohort not found';
  end if;

  select * into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Unit not found';
  end if;

  if new.trainer_id is not null then
    select * into selected_trainer
    from public.trainers
    where id = new.trainer_id;

    if selected_trainer.id is null then
      raise exception using errcode = 'P0002', message = 'Trainer not found';
    end if;
  end if;

  if new.preferred_room_id is not null then
    select * into selected_room
    from public.rooms
    where id = new.preferred_room_id;

    if selected_room.id is null then
      raise exception using errcode = 'P0002', message = 'Preferred room not found';
    end if;
  end if;

  if selected_unit.programme_id <> selected_cohort.programme_id then
    raise exception using errcode = 'P0001',
      message = 'The selected unit does not belong to the cohort programme';
  end if;

  if selected_unit.academic_period_number <>
     selected_cohort.current_academic_period_number then
    raise exception using errcode = 'P0001',
      message = 'The unit does not belong to the cohort current programme period';
  end if;

  if new.is_timetable_enabled
     and selected_period.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'The selected Academic Period is not open for timetable allocation';
  end if;

  if new.is_timetable_enabled
     and selected_cohort.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'The selected cohort is not available for timetable allocation';
  end if;

  if new.is_timetable_enabled and not selected_cohort.is_timetable_available then
    raise exception using errcode = 'P0001',
      message = 'The selected cohort is not enabled for timetabling';
  end if;

  if new.is_timetable_enabled and (
    not selected_unit.is_active or not selected_unit.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The selected unit is not available for timetabling';
  end if;

  if new.is_timetable_enabled and new.trainer_id is not null and (
    not selected_trainer.is_active or not selected_trainer.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The selected trainer is not available for timetabling';
  end if;

  if new.is_timetable_enabled and new.preferred_room_id is not null and (
    not selected_room.is_active or not selected_room.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The preferred room is not available for timetabling';
  end if;

  if new.preferred_room_id is not null
     and selected_cohort.actual_size > 0
     and selected_room.capacity < selected_cohort.actual_size then
    raise exception using errcode = 'P0001',
      message = 'The preferred room capacity is below the cohort enrolment';
  end if;

  if new.status in ('suspended', 'completed', 'archived') then
    new.is_timetable_enabled = false;
  end if;

  return new;
end;
$$;

-- Keep the complete scheduled-session validation for assigned trainers. A
-- trainer-pending reservation uses a separate validator that retains all
-- cohort, unit, room, day, time and duration protections without inventing a
-- placeholder trainer.
create or replace function public.validate_pending_scheduled_session()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_allocation public.teaching_allocations%rowtype;
  selected_working_day public.working_days%rowtype;
  selected_start_slot public.time_slots%rowtype;
  selected_end_slot public.time_slots%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
  selected_room public.rooms%rowtype;
  included_slot_count integer;
  included_teaching_slot_count integer;
  scheduled_duration_minutes integer;
  active_session_count integer;
begin
  select * into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using errcode = 'P0002', message = 'Academic Period not found';
  end if;

  if selected_period.status <> 'active' then
    raise exception using errcode = 'P0001',
      message = 'Scheduled sessions require an active Academic Period';
  end if;

  select * into selected_allocation
  from public.teaching_allocations
  where id = new.teaching_allocation_id;

  if selected_allocation.id is null then
    raise exception using errcode = 'P0002', message = 'Teaching allocation not found';
  end if;

  if selected_allocation.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001',
      message = 'The teaching allocation belongs to a different Academic Period';
  end if;

  if selected_allocation.trainer_id is not null then
    raise exception using errcode = 'P0001',
      message = 'The scheduled session must use its assigned trainer';
  end if;

  if selected_allocation.status not in ('draft', 'active')
    or not selected_allocation.is_timetable_enabled then
    raise exception using errcode = 'P0001',
      message = 'The trainer-pending allocation is not enabled for timetabling';
  end if;

  if not exists (
    select 1
    from public.unit_offerings offering
    where offering.academic_period_id = selected_allocation.academic_period_id
      and offering.cohort_id = selected_allocation.cohort_id
      and offering.unit_id = selected_allocation.unit_id
      and offering.is_provisionally_reserved = true
  ) then
    raise exception using errcode = 'P0001',
      message = 'Reserve the fixed unit sessions before generating without a trainer';
  end if;

  new.cohort_id := selected_allocation.cohort_id;
  new.unit_id := selected_allocation.unit_id;
  new.trainer_id := null;
  new.delivery_mode := selected_allocation.delivery_mode;

  if new.session_number > selected_allocation.weekly_sessions then
    raise exception using errcode = 'P0001',
      message = 'The session number exceeds the allocation weekly session requirement';
  end if;

  select * into selected_working_day
  from public.working_days
  where id = new.working_day_id;

  if selected_working_day.id is null
    or selected_working_day.academic_period_id <> new.academic_period_id
    or not selected_working_day.is_enabled then
    raise exception using errcode = 'P0001',
      message = 'Select an enabled working day in the current Academic Period';
  end if;

  select * into selected_start_slot
  from public.time_slots
  where id = new.start_time_slot_id;

  select * into selected_end_slot
  from public.time_slots
  where id = new.end_time_slot_id;

  if selected_start_slot.id is null or selected_end_slot.id is null then
    raise exception using errcode = 'P0002', message = 'Teaching time slot not found';
  end if;

  if selected_start_slot.academic_period_id <> new.academic_period_id
    or selected_end_slot.academic_period_id <> new.academic_period_id
    or not selected_start_slot.is_enabled
    or not selected_end_slot.is_enabled
    or selected_start_slot.slot_type <> 'teaching'
    or selected_end_slot.slot_type <> 'teaching'
    or selected_end_slot.sequence_number < selected_start_slot.sequence_number then
    raise exception using errcode = 'P0001',
      message = 'Select a valid enabled teaching period in the current Academic Period';
  end if;

  select
    count(*),
    count(*) filter (where is_enabled and slot_type = 'teaching')
  into included_slot_count, included_teaching_slot_count
  from public.time_slots
  where academic_period_id = new.academic_period_id
    and sequence_number between selected_start_slot.sequence_number
      and selected_end_slot.sequence_number;

  if included_slot_count = 0
    or included_slot_count <> included_teaching_slot_count then
    raise exception using errcode = 'P0001',
      message = 'A scheduled session cannot span a break, lunch, assembly or disabled slot';
  end if;

  scheduled_duration_minutes := extract(epoch from (
    selected_end_slot.ends_at - selected_start_slot.starts_at
  ))::integer / 60;

  if scheduled_duration_minutes <> selected_allocation.session_duration_minutes then
    raise exception using errcode = 'P0001', message = format(
      'The selected slot range is %s minutes but the teaching allocation requires %s minutes',
      scheduled_duration_minutes,
      selected_allocation.session_duration_minutes
    );
  end if;

  select * into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null
    or selected_cohort.status not in ('planned', 'active')
    or not selected_cohort.is_timetable_available then
    raise exception using errcode = 'P0001',
      message = 'The cohort is not available for timetabling';
  end if;

  select * into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null
    or not selected_unit.is_active
    or not selected_unit.is_timetable_available then
    raise exception using errcode = 'P0001',
      message = 'The unit is not available for timetabling';
  end if;

  select * into selected_room
  from public.rooms
  where id = new.room_id;

  if selected_room.id is null
    or not selected_room.is_active
    or not selected_room.is_timetable_available then
    raise exception using errcode = 'P0001',
      message = 'The room is not available for timetabling';
  end if;

  if selected_cohort.actual_size > 0
    and selected_room.capacity < selected_cohort.actual_size then
    raise exception using errcode = 'P0001',
      message = 'The selected room capacity is below the cohort enrolment';
  end if;

  if selected_unit.preferred_room_type is not null
    and selected_room.room_type <> selected_unit.preferred_room_type then
    raise exception using errcode = 'P0001', message = format(
      'The unit requires a %s room but %s was selected',
      selected_unit.preferred_room_type,
      selected_room.room_type
    );
  end if;

  select count(*) into active_session_count
  from public.scheduled_sessions session
  where session.teaching_allocation_id = new.teaching_allocation_id
    and session.status not in ('cancelled', 'archived')
    and session.id <> new.id;

  if active_session_count >= selected_allocation.weekly_sessions then
    raise exception using errcode = 'P0001',
      message = 'The teaching allocation already has all required weekly sessions scheduled';
  end if;

  return new;
end;
$$;

drop trigger if exists scheduled_sessions_validate_relationships
on public.scheduled_sessions;

drop trigger if exists scheduled_sessions_validate_pending_relationships
on public.scheduled_sessions;

create trigger scheduled_sessions_validate_relationships
before insert or update
on public.scheduled_sessions
for each row
when (new.trainer_id is not null)
execute function public.validate_scheduled_session_relationships();

create trigger scheduled_sessions_validate_pending_relationships
before insert or update
on public.scheduled_sessions
for each row
when (new.trainer_id is null)
execute function public.validate_pending_scheduled_session();

create or replace function public.reserve_unit_offering_without_trainer(
  p_offering_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  offering public.unit_offerings%rowtype;
  shared_offering public.teaching_offerings%rowtype;
  allocation_id uuid;
  fixed_session_count integer;
  required_session_count integer;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before reserving timetable space';
  end if;

  select unit_offering.* into offering
  from public.unit_offerings unit_offering
  join public.cohorts cohort on cohort.id = unit_offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where unit_offering.id = p_offering_id
    and programme.department_id = active_department
  for update of unit_offering;

  if offering.id is null then
    raise exception 'The unit on offer was not found in the working department';
  end if;

  if offering.allocation_status = 'allocated' then
    raise exception 'This unit already has a trainer';
  end if;

  if offering.is_provisionally_reserved then
    select allocation.id into allocation_id
    from public.teaching_allocations allocation
    where allocation.academic_period_id = offering.academic_period_id
      and allocation.cohort_id = offering.cohort_id
      and allocation.unit_id = offering.unit_id
      and allocation.trainer_id is null
    limit 1;

    return jsonb_build_object(
      'allocationId', allocation_id,
      'reserved', true,
      'alreadyReserved', true
    );
  end if;

  required_session_count := coalesce(offering.weekly_sessions, 1);

  select count(*) into fixed_session_count
  from public.unit_offering_fixed_slots fixed_slot
  where fixed_slot.unit_offering_id = offering.id;

  if fixed_session_count = 0
    and offering.fixed_working_day_id is not null
    and offering.fixed_time_slot_id is not null then
    fixed_session_count := 1;
  end if;

  if not offering.fixed_schedule_required
    or (
      offering.is_full_day_session
      and fixed_session_count = 0
    )
    or (
      not offering.is_full_day_session
      and fixed_session_count <> required_session_count
    ) then
    raise exception
      'Save a fixed day and teaching period for all % weekly session(s) before reserving',
      required_session_count;
  end if;

  if offering.confirmed_shared_offering_id is not null then
    select * into shared_offering
    from public.teaching_offerings
    where id = offering.confirmed_shared_offering_id
      and department_id = active_department;

    if shared_offering.id is null then
      raise exception 'The confirmed shared class is not available';
    end if;
  end if;

  insert into public.teaching_allocations (
    academic_period_id,
    cohort_id,
    unit_id,
    trainer_id,
    delivery_mode,
    weekly_sessions,
    session_duration_minutes,
    status,
    is_timetable_enabled,
    teaching_offering_id,
    participant_cohort_ids,
    combined_cohort_size,
    notes
  ) values (
    offering.academic_period_id,
    offering.cohort_id,
    offering.unit_id,
    null,
    case when offering.offering_type = 'practical'
      then 'practical'::public.teaching_delivery_mode
      else 'theory'::public.teaching_delivery_mode end,
    case when shared_offering.id is null
      then coalesce(offering.weekly_sessions, 1)
      else shared_offering.weekly_sessions end,
    case when shared_offering.id is null
      then coalesce(offering.session_duration_minutes, 120)
      else shared_offering.session_duration_minutes end,
    'draft',
    true,
    shared_offering.id,
    case when shared_offering.id is null
      then array[offering.cohort_id]
      else (
        select array_agg(distinct participant.cohort_id)
        from public.teaching_offering_participants participant
        where participant.teaching_offering_id = shared_offering.id
      ) end,
    case when shared_offering.id is null
      then (select cohort.actual_size from public.cohorts cohort where cohort.id = offering.cohort_id)
      else (
        select coalesce(sum(cohort.actual_size), 0)
        from public.teaching_offering_participants participant
        join public.cohorts cohort on cohort.id = participant.cohort_id
        where participant.teaching_offering_id = shared_offering.id
      ) end,
    'Provisional timetable reservation; trainer assignment pending'
  )
  returning id into allocation_id;

  if shared_offering.id is not null then
    update public.unit_offerings
    set is_provisionally_reserved = true,
        updated_at = now(),
        updated_by = auth.uid()
    where confirmed_shared_offering_id = shared_offering.id;
  else
    update public.unit_offerings
    set is_provisionally_reserved = true,
        updated_at = now(),
        updated_by = auth.uid()
    where id = offering.id;
  end if;

  return jsonb_build_object(
    'allocationId', allocation_id,
    'reserved', true,
    'alreadyReserved', false
  );
end;
$$;

create or replace function public.assign_reserved_unit_offering(
  p_offering_id uuid,
  p_trainer_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  offering public.unit_offerings%rowtype;
  trainer public.trainers%rowtype;
  shared_offering public.teaching_offerings%rowtype;
  allocation public.teaching_allocations%rowtype;
  used_hours numeric;
  added_hours numeric;
  projected_hours numeric;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before allocating';
  end if;

  select unit_offering.* into offering
  from public.unit_offerings unit_offering
  join public.cohorts cohort on cohort.id = unit_offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where unit_offering.id = p_offering_id
    and programme.department_id = active_department
  for update of unit_offering;

  if offering.id is null then
    raise exception 'The unit on offer was not found in the working department';
  end if;

  if not offering.is_provisionally_reserved then
    raise exception 'This unit does not have a trainer-pending timetable reservation';
  end if;

  select * into trainer
  from public.trainers
  where id = p_trainer_id;

  if trainer.id is null or not trainer.is_active
    or not trainer.is_timetable_available then
    raise exception 'The selected trainer is not available';
  end if;

  if offering.confirmed_shared_offering_id is not null then
    select * into shared_offering
    from public.teaching_offerings
    where id = offering.confirmed_shared_offering_id
      and department_id = active_department;

    if exists (
      select 1
      from public.teaching_offering_participants participant
      where participant.teaching_offering_id = shared_offering.id
        and exists (
          select 1 from public.trainer_unit_eligibility eligibility
          where eligibility.unit_id = participant.unit_id
        )
        and not exists (
          select 1 from public.trainer_unit_eligibility eligibility
          where eligibility.unit_id = participant.unit_id
            and eligibility.trainer_id = trainer.id
        )
    ) then
      raise exception 'The trainer is not approved for every unit in this shared class';
    end if;

    select allocation_row.* into allocation
    from public.teaching_allocations allocation_row
    where allocation_row.teaching_offering_id = shared_offering.id
      and allocation_row.trainer_id is null
    for update;
  else
    if exists (
      select 1 from public.trainer_unit_eligibility eligibility
      where eligibility.unit_id = offering.unit_id
    ) and not exists (
      select 1 from public.trainer_unit_eligibility eligibility
      where eligibility.unit_id = offering.unit_id
        and eligibility.trainer_id = trainer.id
    ) then
      raise exception 'The trainer is not approved to teach this unit';
    end if;

    select allocation_row.* into allocation
    from public.teaching_allocations allocation_row
    where allocation_row.academic_period_id = offering.academic_period_id
      and allocation_row.cohort_id = offering.cohort_id
      and allocation_row.unit_id = offering.unit_id
      and allocation_row.trainer_id is null
    for update;
  end if;

  if allocation.id is null then
    raise exception 'The trainer-pending timetable reservation could not be found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-workload:' || trainer.id::text || ':' || offering.academic_period_id::text,
    0
  ));

  select coalesce(sum(
    existing.weekly_sessions * existing.session_duration_minutes
  ) / 60.0, 0)
  into used_hours
  from public.teaching_allocations existing
  where existing.trainer_id = trainer.id
    and existing.academic_period_id = offering.academic_period_id
    and existing.status in ('draft', 'active');

  added_hours := allocation.weekly_sessions * allocation.session_duration_minutes / 60.0;
  projected_hours := used_hours + added_hours;

  update public.teaching_allocations
  set
    trainer_id = trainer.id,
    status = 'active',
    notes = case when shared_offering.id is null
      then null
      else 'Shared class: workload counted once' end,
    updated_at = now(),
    updated_by = auth.uid()
  where id = allocation.id;

  update public.scheduled_sessions
  set
    trainer_id = trainer.id,
    conflict_state = 'unchecked',
    notes = 'Trainer assigned after provisional timetable reservation.',
    updated_at = now(),
    updated_by = auth.uid()
  where teaching_allocation_id = allocation.id
    and trainer_id is null
    and status in ('draft', 'confirmed');

  if shared_offering.id is not null then
    update public.teaching_offerings
    set trainer_id = trainer.id,
        status = 'active',
        updated_at = now(),
        updated_by = auth.uid()
    where id = shared_offering.id;

    update public.unit_offerings
    set allocation_status = 'allocated',
        is_provisionally_reserved = false,
        status = 'active',
        updated_at = now(),
        updated_by = auth.uid()
    where confirmed_shared_offering_id = shared_offering.id;
  else
    update public.unit_offerings
    set allocation_status = 'allocated',
        is_provisionally_reserved = false,
        status = 'active',
        updated_at = now(),
        updated_by = auth.uid()
    where id = offering.id;
  end if;

  return jsonb_build_object(
    'allocationId', allocation.id,
    'allocatedHours', projected_hours,
    'targetHours', trainer.normal_weekly_hours,
    'extraHours', greatest(projected_hours - trainer.normal_weekly_hours, 0),
    'isExtraLoad', projected_hours > trainer.normal_weekly_hours,
    'shared', shared_offering.id is not null,
    'wasReserved', true
  );
end;
$$;

create or replace function public.assign_unit_offering_with_reservation(
  p_offering_id uuid,
  p_trainer_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  reserved boolean;
begin
  select coalesce(unit_offering.is_provisionally_reserved, false)
  into reserved
  from public.unit_offerings unit_offering
  where unit_offering.id = p_offering_id;

  if reserved then
    return public.assign_reserved_unit_offering(p_offering_id, p_trainer_id);
  end if;

  return public.assign_unit_offering(p_offering_id, p_trainer_id);
end;
$$;

create or replace function public.block_timetable_version_with_pending_trainers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.scheduled_sessions session
    join public.cohorts cohort on cohort.id = session.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where session.academic_period_id = new.academic_period_id
      and programme.department_id = new.department_id
      and session.trainer_id is null
      and session.status in ('draft', 'confirmed', 'locked')
  ) then
    raise exception
      'Assign trainers to every provisional timetable session before creating or publishing a version';
  end if;

  return new;
end;
$$;

drop trigger if exists timetable_versions_require_trainers
on public.timetable_versions;

create trigger timetable_versions_require_trainers
before insert or update
on public.timetable_versions
for each row
execute function public.block_timetable_version_with_pending_trainers();

revoke all
on function public.reserve_unit_offering_without_trainer(uuid)
from public;

revoke all
on function public.assign_reserved_unit_offering(uuid, uuid)
from public;

revoke all
on function public.assign_unit_offering_with_reservation(uuid, uuid)
from public;

grant execute
on function public.reserve_unit_offering_without_trainer(uuid)
to authenticated;

grant execute
on function public.assign_reserved_unit_offering(uuid, uuid)
to authenticated;

grant execute
on function public.assign_unit_offering_with_reservation(uuid, uuid)
to authenticated;

comment on column public.unit_offerings.is_provisionally_reserved is
  'True when all fixed sessions are included in draft generation while trainer assignment is pending.';

comment on function public.reserve_unit_offering_without_trainer(uuid) is
  'Creates a fixed timetable allocation with a pending trainer for draft generation.';
