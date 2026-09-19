-- Migration: Authoritative Participant Cohort Resolution & Phantom Clash Elimination
-- Date: 2026-09-19
-- Description:
--   Root-cause fix for false "Cohort Conflict" blocks reported when placing units on the
--   master timetable (e.g. CHN-JAN-MAR-2025 blocked by CHN 2207 and DHN-MAY-2024 blocked by
--   DHN 3104, for units those cohorts do not take).
--
--   Cause: shared-class membership is denormalised into
--   teaching_allocations.participant_cohort_ids and scheduled_sessions.participant_cohort_ids.
--   Nothing propagated membership changes (unit-offering drops/withdrawals/exclusions, cohort
--   merges, re-imports, cross-stage registration repairs) back into those arrays, and
--   public.resolve_participant_cohort_ids() accepted every teaching_offering_participants row
--   regardless of whether the cohort still holds a live unit offering for that unit. A cohort
--   that no longer takes a unit therefore stayed inside the session's participant array and
--   kept colliding with every new placement. Previous fixes (DNDT, CHN-MAY-2025, DND-SEP-2025)
--   deleted individual rows; this migration removes the class of defect.
--
--   Changes:
--     1. public.cohort_has_live_unit_offering() — authoritative membership predicate.
--     2. public.resolve_participant_cohort_ids() — ignores participants without a live offering.
--     3. Automatic propagation triggers on teaching_offering_participants and unit_offerings.
--     4. One-off repair: strips phantom cohorts from every live allocation and session
--        (shrink-only, so deliberate standalone/subset placements survive).
--     5. Clash detection now names the cohort that actually overlaps, plus the session owner.
--     6. public.audit_phantom_session_participants() for verification / ongoing monitoring.

begin;

-- ============================================================
-- 0. Pre-flight: fix a pre-existing invalid enum literal that this
--    migration's own cascade would otherwise hit.
--
--    public.validate_scheduled_session_relationships() (redefined most
--    recently in 20260919090000_fix_live_unit_offering_drop_rpc.sql) checks
--    `selected_period.status not in ('open', 'planned', 'active')`. There is
--    no 'open' member of public.academic_period_status (only 'planned',
--    'active', 'closed', 'archived' — see 20260802073555_create_academic_periods.sql),
--    so that comparison raises `invalid input value for enum
--    public.academic_period_status: "open"` (SQLSTATE 22P02) the moment the
--    trigger runs, unrelated to anything in this migration's own logic.
--
--    Section 3 below updates teaching_allocations, which fires the existing
--    AFTER UPDATE trigger sync_allocation_participants_to_sessions
--    (20260827092000_safe_shared_class_participant_sync.sql), which updates
--    scheduled_sessions, which fires the BEFORE UPDATE trigger
--    scheduled_sessions_validate_relationships — i.e. this bug. Fixing it
--    here, before section 3 runs, is required for this migration to apply at
--    all; it also fixes the underlying defect for every other write path
--    (manual placement, the timetable generator, quick-edit) going forward.
-- ============================================================

create or replace function public.validate_scheduled_session_relationships()
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
  selected_trainer public.trainers%rowtype;
  selected_room public.rooms%rowtype;
  included_slot_count integer;
  included_teaching_slot_count integer;
  scheduled_duration_minutes integer;
  active_session_count integer;
begin
  -- Cancelled or archived sessions are inactive and do not require active allocations or resources
  if new.status in ('cancelled', 'archived') then
    new.conflict_state := 'clear'::public.scheduled_session_conflict_state;
    return new;
  end if;

  select * into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using errcode = 'P0002', message = 'Academic Period not found';
  end if;

  if selected_period.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'Scheduled sessions require a planned or active Academic Period';
  end if;

  select * into selected_allocation
  from public.teaching_allocations
  where id = new.teaching_allocation_id;

  -- Auto-healing: If the referenced allocation is missing or inactive, check if an active partner allocation can back this session
  if selected_allocation.id is null or selected_allocation.status not in ('draft', 'active') or not selected_allocation.is_timetable_enabled then
    select a.* into selected_allocation
    from public.teaching_allocations a
    where a.academic_period_id = new.academic_period_id
      and (
        a.cohort_id = any(coalesce(new.participant_cohort_ids, '{}'::uuid[]))
        or a.cohort_id = new.cohort_id
      )
      and (
        a.unit_id = coalesce(new.unit_id, selected_allocation.unit_id)
        or exists (
          select 1
          from public.unit_equivalence_members m1
          join public.unit_equivalence_members m2 on m2.equivalence_group_id = m1.equivalence_group_id
          where m1.unit_id = coalesce(new.unit_id, selected_allocation.unit_id)
            and m2.unit_id = a.unit_id
            and m1.status = 'approved'
            and m2.status = 'approved'
        )
      )
      and a.status in ('draft', 'active')
      and a.is_timetable_enabled = true
    order by case a.status when 'active' then 1 else 2 end, a.updated_at desc
    limit 1;

    if selected_allocation.id is not null then
      new.teaching_allocation_id := selected_allocation.id;
      new.cohort_id := selected_allocation.cohort_id;
      new.unit_id := selected_allocation.unit_id;
    end if;
  end if;

  if selected_allocation.id is null then
    if tg_op = 'UPDATE' then
      new.status := 'cancelled'::public.scheduled_session_status;
      new.conflict_state := 'clear'::public.scheduled_session_conflict_state;
      return new;
    end if;
    raise exception using errcode = 'P0002', message = 'Teaching allocation not found';
  end if;

  if selected_allocation.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001',
      message = 'The teaching allocation belongs to a different Academic Period';
  end if;

  if selected_allocation.status not in ('draft', 'active') or not selected_allocation.is_timetable_enabled then
    if tg_op = 'UPDATE' then
      new.status := 'cancelled'::public.scheduled_session_status;
      new.conflict_state := 'clear'::public.scheduled_session_conflict_state;
      return new;
    end if;
    raise exception using errcode = 'P0001',
      message = 'Only draft or active teaching allocations may be scheduled';
  end if;

  -- Allocation-owned fields are authoritative.
  new.cohort_id = selected_allocation.cohort_id;
  new.unit_id = selected_allocation.unit_id;
  new.trainer_id = selected_allocation.trainer_id;
  new.delivery_mode = selected_allocation.delivery_mode;

  if new.session_number > selected_allocation.weekly_sessions then
    raise exception using errcode = 'P0001',
      message = 'The session number exceeds the allocation weekly session requirement';
  end if;

  select * into selected_working_day
  from public.working_days
  where id = new.working_day_id;

  if selected_working_day.id is null then
    raise exception using errcode = 'P0002', message = 'Working day not found';
  end if;

  if selected_working_day.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001',
      message = 'The working day belongs to a different Academic Period';
  end if;

  if selected_working_day.is_enabled = false then
    raise exception using errcode = 'P0001', message = 'The selected working day is disabled';
  end if;

  select * into selected_start_slot
  from public.time_slots
  where id = new.start_time_slot_id;

  if selected_start_slot.id is null then
    raise exception using errcode = 'P0002', message = 'Start time slot not found';
  end if;

  select * into selected_end_slot
  from public.time_slots
  where id = new.end_time_slot_id;

  if selected_end_slot.id is null then
    raise exception using errcode = 'P0002', message = 'End time slot not found';
  end if;

  if selected_start_slot.academic_period_id <> new.academic_period_id
     or selected_end_slot.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001',
      message = 'The selected time slots belong to a different Academic Period';
  end if;

  if selected_start_slot.is_enabled = false or selected_end_slot.is_enabled = false then
    raise exception using errcode = 'P0001', message = 'Disabled time slots cannot be used for scheduling';
  end if;

  if selected_start_slot.slot_type <> 'teaching' or selected_end_slot.slot_type <> 'teaching' then
    raise exception using errcode = 'P0001', message = 'Scheduled sessions must begin and end in teaching slots';
  end if;

  if selected_end_slot.sequence_number < selected_start_slot.sequence_number then
    raise exception using errcode = 'P0001', message = 'The end time slot cannot precede the start time slot';
  end if;

  select count(*), count(*) filter (where is_enabled = true and slot_type = 'teaching')
  into included_slot_count, included_teaching_slot_count
  from public.time_slots
  where academic_period_id = new.academic_period_id
    and sequence_number between selected_start_slot.sequence_number and selected_end_slot.sequence_number;

  if included_slot_count = 0 or included_slot_count <> included_teaching_slot_count then
    raise exception using errcode = 'P0001', message = 'A scheduled session cannot span a break, lunch, assembly or disabled slot';
  end if;

  scheduled_duration_minutes := extract(epoch from (selected_end_slot.ends_at - selected_start_slot.starts_at))::integer / 60;

  if scheduled_duration_minutes <> selected_allocation.session_duration_minutes then
    raise exception using errcode = 'P0001',
      message = format('The selected slot range is %s minutes but the teaching allocation requires %s minutes',
        scheduled_duration_minutes, selected_allocation.session_duration_minutes);
  end if;

  select * into selected_cohort from public.cohorts where id = new.cohort_id;
  if selected_cohort.id is null then
    raise exception using errcode = 'P0002', message = 'Cohort not found';
  end if;

  if selected_cohort.status not in ('planned', 'active') or selected_cohort.is_timetable_available = false then
    raise exception using errcode = 'P0001', message = 'The cohort is not available for timetabling';
  end if;

  select * into selected_unit from public.units where id = new.unit_id;
  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Unit not found';
  end if;

  if selected_unit.is_active = false or selected_unit.is_timetable_available = false then
    raise exception using errcode = 'P0001', message = 'The unit is not available for timetabling';
  end if;

  if new.trainer_id is not null then
    select * into selected_trainer from public.trainers where id = new.trainer_id;
    if selected_trainer.id is null then
      raise exception using errcode = 'P0002', message = 'Trainer not found';
    end if;
    if selected_trainer.is_active = false or selected_trainer.is_timetable_available = false then
      raise exception using errcode = 'P0001', message = 'The trainer is not available for timetabling';
    end if;
  end if;

  if new.room_id is not null then
    select * into selected_room from public.rooms where id = new.room_id;
    if selected_room.id is null then
      raise exception using errcode = 'P0002', message = 'Room not found';
    end if;
    if selected_room.is_active = false or selected_room.is_timetable_available = false then
      raise exception using errcode = 'P0001', message = 'The room is not available for timetabling';
    end if;
    if selected_cohort.actual_size > 0 and selected_room.capacity < selected_cohort.actual_size then
      raise exception using errcode = 'P0001', message = 'The selected room capacity is below the cohort enrolment';
    end if;
    if selected_unit.preferred_room_type is not null and selected_room.room_type <> selected_unit.preferred_room_type then
      raise exception using errcode = 'P0001', message = format('The unit requires a %s room but %s was selected', selected_unit.preferred_room_type, selected_room.room_type);
    end if;
  end if;

  select count(*) into active_session_count
  from public.scheduled_sessions
  where teaching_allocation_id = new.teaching_allocation_id
    and status not in ('cancelled', 'archived')
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if active_session_count >= selected_allocation.weekly_sessions then
    raise exception using errcode = 'P0001', message = 'The teaching allocation already has all required weekly sessions scheduled';
  end if;

  return new;
end;
$$;

comment on function public.validate_scheduled_session_relationships() is
  'Validates a scheduled session against its allocation, working day, time slots, cohort, unit, trainer and room. Fixed 2026-09-19: academic period gate no longer references the nonexistent ''open'' enum value.';

-- scheduled_sessions carries a second, conditional trigger for rows with no trainer
-- assigned yet (`scheduled_sessions_validate_pending_relationships`, added in
-- 20260816011000_provisional_timetable_reservations.sql, `when (new.trainer_id is null)`),
-- executing public.validate_pending_scheduled_session(). It contains the exact same
-- `not in ('open', 'planned', 'active')` defect, independently of the fix above, and
-- fires for any unassigned-trainer session caught in this migration's cascade.

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
  if new.status in ('cancelled', 'archived') then
    new.conflict_state := 'clear'::public.scheduled_session_conflict_state;
    return new;
  end if;

  select * into selected_period from public.academic_periods where id = new.academic_period_id;
  if selected_period.id is null then
    raise exception using errcode = 'P0002', message = 'Academic Period not found';
  end if;

  if selected_period.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001', message = 'Scheduled sessions require a planned or active Academic Period';
  end if;

  select * into selected_allocation from public.teaching_allocations where id = new.teaching_allocation_id;
  -- If the referenced allocation is missing or inactive, check if an active partner allocation can back this session
  if selected_allocation.id is null or selected_allocation.status not in ('draft', 'active') or not selected_allocation.is_timetable_enabled then
    select a.* into selected_allocation
    from public.teaching_allocations a
    where a.academic_period_id = new.academic_period_id
      and (
        a.cohort_id = any(coalesce(new.participant_cohort_ids, '{}'::uuid[]))
        or a.cohort_id = new.cohort_id
      )
      and (
        a.unit_id = coalesce(new.unit_id, selected_allocation.unit_id)
        or exists (
          select 1
          from public.unit_equivalence_members m1
          join public.unit_equivalence_members m2 on m2.equivalence_group_id = m1.equivalence_group_id
          where m1.unit_id = coalesce(new.unit_id, selected_allocation.unit_id)
            and m2.unit_id = a.unit_id
            and m1.status = 'approved'
            and m2.status = 'approved'
        )
      )
      and a.status in ('draft', 'active')
      and a.is_timetable_enabled = true
    order by case a.status when 'active' then 1 else 2 end, a.updated_at desc
    limit 1;

    if selected_allocation.id is not null then
      new.teaching_allocation_id := selected_allocation.id;
      new.cohort_id := selected_allocation.cohort_id;
      new.unit_id := selected_allocation.unit_id;
    end if;
  end if;

  if selected_allocation.id is null then
    if tg_op = 'UPDATE' then
      new.status := 'cancelled'::public.scheduled_session_status;
      new.conflict_state := 'clear'::public.scheduled_session_conflict_state;
      return new;
    end if;
    raise exception using errcode = 'P0002', message = 'Teaching allocation not found';
  end if;

  if selected_allocation.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001', message = 'The teaching allocation belongs to a different Academic Period';
  end if;

  if selected_allocation.trainer_id is not null then
    raise exception using errcode = 'P0001', message = 'The scheduled session must use its assigned trainer';
  end if;

  if selected_allocation.status not in ('draft', 'active') or not selected_allocation.is_timetable_enabled then
    if tg_op = 'UPDATE' then
      new.status := 'cancelled'::public.scheduled_session_status;
      new.conflict_state := 'clear'::public.scheduled_session_conflict_state;
      return new;
    end if;
    raise exception using errcode = 'P0001', message = 'The trainer-pending allocation is not enabled for timetabling';
  end if;

  if not exists (
    select 1 from public.unit_offerings offering
    where offering.academic_period_id = selected_allocation.academic_period_id
      and offering.cohort_id = selected_allocation.cohort_id
      and offering.unit_id = selected_allocation.unit_id
      and offering.is_provisionally_reserved = true
  ) then
    raise exception using errcode = 'P0001',
      message = 'A session cannot be scheduled until its Unit on Offer is provisionally reserved';
  end if;

  new.cohort_id = selected_allocation.cohort_id;
  new.unit_id = selected_allocation.unit_id;
  new.delivery_mode = selected_allocation.delivery_mode;

  if new.session_number > selected_allocation.weekly_sessions then
    raise exception using errcode = 'P0001', message = 'The session number exceeds the allocation weekly session requirement';
  end if;

  select * into selected_working_day from public.working_days where id = new.working_day_id;
  if selected_working_day.id is null then
    raise exception using errcode = 'P0002', message = 'Working day not found';
  end if;

  if selected_working_day.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001', message = 'The working day belongs to a different Academic Period';
  end if;

  if selected_working_day.is_enabled = false then
    raise exception using errcode = 'P0001', message = 'The selected working day is disabled';
  end if;

  select * into selected_start_slot from public.time_slots where id = new.start_time_slot_id;
  if selected_start_slot.id is null then
    raise exception using errcode = 'P0002', message = 'Start time slot not found';
  end if;

  select * into selected_end_slot from public.time_slots where id = new.end_time_slot_id;
  if selected_end_slot.id is null then
    raise exception using errcode = 'P0002', message = 'End time slot not found';
  end if;

  if selected_start_slot.academic_period_id <> new.academic_period_id or selected_end_slot.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001', message = 'The selected time slots belong to a different Academic Period';
  end if;

  if selected_start_slot.is_enabled = false or selected_end_slot.is_enabled = false then
    raise exception using errcode = 'P0001', message = 'Disabled time slots cannot be used for scheduling';
  end if;

  if selected_start_slot.slot_type <> 'teaching' or selected_end_slot.slot_type <> 'teaching' then
    raise exception using errcode = 'P0001', message = 'Scheduled sessions must begin and end in teaching slots';
  end if;

  if selected_end_slot.sequence_number < selected_start_slot.sequence_number then
    raise exception using errcode = 'P0001', message = 'The end time slot cannot precede the start time slot';
  end if;

  select count(*), count(*) filter (where is_enabled = true and slot_type = 'teaching')
  into included_slot_count, included_teaching_slot_count
  from public.time_slots
  where academic_period_id = new.academic_period_id
    and sequence_number between selected_start_slot.sequence_number and selected_end_slot.sequence_number;

  if included_slot_count = 0 or included_slot_count <> included_teaching_slot_count then
    raise exception using errcode = 'P0001', message = 'A scheduled session cannot span a break, lunch, assembly or disabled slot';
  end if;

  scheduled_duration_minutes := extract(epoch from (selected_end_slot.ends_at - selected_start_slot.starts_at))::integer / 60;

  if scheduled_duration_minutes <> selected_allocation.session_duration_minutes then
    raise exception using errcode = 'P0001',
      message = format('The selected slot range is %s minutes but the teaching allocation requires %s minutes',
        scheduled_duration_minutes, selected_allocation.session_duration_minutes);
  end if;

  select * into selected_cohort from public.cohorts where id = new.cohort_id;
  if selected_cohort.id is null then
    raise exception using errcode = 'P0002', message = 'Cohort not found';
  end if;

  if selected_cohort.status not in ('planned', 'active') or selected_cohort.is_timetable_available = false then
    raise exception using errcode = 'P0001', message = 'The cohort is not available for timetabling';
  end if;

  select * into selected_unit from public.units where id = new.unit_id;
  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Unit not found';
  end if;

  if selected_unit.is_active = false or selected_unit.is_timetable_available = false then
    raise exception using errcode = 'P0001', message = 'The unit is not available for timetabling';
  end if;

  if new.room_id is not null then
    select * into selected_room from public.rooms where id = new.room_id;
    if selected_room.id is null then
      raise exception using errcode = 'P0002', message = 'Room not found';
    end if;
    if selected_room.is_active = false or selected_room.is_timetable_available = false then
      raise exception using errcode = 'P0001', message = 'The room is not available for timetabling';
    end if;
    if selected_cohort.actual_size > 0 and selected_room.capacity < selected_cohort.actual_size then
      raise exception using errcode = 'P0001', message = 'The selected room capacity is below the cohort enrolment';
    end if;
    if selected_unit.preferred_room_type is not null and selected_room.room_type <> selected_unit.preferred_room_type then
      raise exception using errcode = 'P0001', message = format('The unit requires a %s room but %s was selected', selected_unit.preferred_room_type, selected_room.room_type);
    end if;
  end if;

  select count(*) into active_session_count
  from public.scheduled_sessions
  where teaching_allocation_id = new.teaching_allocation_id
    and status not in ('cancelled', 'archived')
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if active_session_count >= selected_allocation.weekly_sessions then
    raise exception using errcode = 'P0001', message = 'The teaching allocation already has all required weekly sessions scheduled';
  end if;

  return new;
end;
$$;

comment on function public.validate_pending_scheduled_session() is
  'Validates a trainer-pending scheduled session. Fixed 2026-09-19: academic period gate no longer references the nonexistent ''open'' enum value.';

-- 1. Authoritative membership predicate
-- ============================================================

create or replace function public.cohort_has_live_unit_offering(
  p_academic_period_id uuid,
  p_cohort_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unit_offerings offering
    where offering.academic_period_id = p_academic_period_id
      and offering.cohort_id = p_cohort_id
      and offering.unit_id = p_unit_id
      and offering.status in ('draft', 'active')
      and offering.is_timetable_enabled
      and offering.approval_status = 'approved'
      and offering.selection_state = 'included'
  );
$$;

revoke all on function public.cohort_has_live_unit_offering(uuid, uuid, uuid) from public;
grant execute on function public.cohort_has_live_unit_offering(uuid, uuid, uuid) to authenticated;

comment on function public.cohort_has_live_unit_offering(uuid, uuid, uuid) is
  'True when the cohort still holds an approved, included, timetable-enabled offering for the unit in the period.';

-- Cohorts with no unit offerings at all in a period are not managed by the offerings module
-- (legacy or manually curated shared classes). Those keep their historical membership.
create or replace function public.cohort_offerings_are_managed(
  p_academic_period_id uuid,
  p_cohort_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.unit_offerings offering
    where offering.academic_period_id = p_academic_period_id
      and offering.cohort_id = p_cohort_id
  );
$$;

revoke all on function public.cohort_offerings_are_managed(uuid, uuid) from public;
grant execute on function public.cohort_offerings_are_managed(uuid, uuid) to authenticated;

comment on function public.cohort_offerings_are_managed(uuid, uuid) is
  'True when the cohort has unit offerings recorded for the period, i.e. its membership is authoritative.';

-- ============================================================
-- 2. Authoritative participant resolution
-- ============================================================

create or replace function public.resolve_participant_cohort_ids(
  p_primary_cohort_id uuid,
  p_teaching_offering_id uuid
)
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct member.cohort_id order by member.cohort_id),
    array[p_primary_cohort_id]
  )
  from (
    select p_primary_cohort_id as cohort_id
    where p_primary_cohort_id is not null

    union

    select participant.cohort_id
    from public.teaching_offering_participants participant
    join public.teaching_offerings offering
      on offering.id = participant.teaching_offering_id
    where participant.teaching_offering_id = p_teaching_offering_id
      and (
        public.cohort_has_live_unit_offering(
          offering.academic_period_id,
          participant.cohort_id,
          participant.unit_id
        )
        or not public.cohort_offerings_are_managed(
          offering.academic_period_id,
          participant.cohort_id
        )
      )
  ) member;
$$;

comment on function public.resolve_participant_cohort_ids(uuid, uuid) is
  'Resolves the cohorts that genuinely share a teaching offering: the primary cohort plus every participant that still holds a live unit offering for its own equivalent unit.';

-- ============================================================
-- 3. One-off repair of drifted denormalised membership
-- ============================================================

-- 3a. Allocations own membership, so they are recomputed outright.
update public.teaching_allocations allocation
set
  participant_cohort_ids = public.resolve_participant_cohort_ids(
    allocation.cohort_id,
    allocation.teaching_offering_id
  ),
  combined_cohort_size = public.resolve_participant_cohort_size(
    public.resolve_participant_cohort_ids(
      allocation.cohort_id,
      allocation.teaching_offering_id
    )
  ),
  updated_at = now()
where allocation.status in ('draft', 'active')
  and allocation.is_timetable_enabled
  and allocation.participant_cohort_ids is distinct from
      public.resolve_participant_cohort_ids(
        allocation.cohort_id,
        allocation.teaching_offering_id
      )
  -- shrink only: never re-introduce a cohort into an existing live allocation here
  and coalesce(allocation.participant_cohort_ids, '{}'::uuid[]) @>
      public.resolve_participant_cohort_ids(
        allocation.cohort_id,
        allocation.teaching_offering_id
      );

-- 3b. Sessions: intersect the stored array with live membership so that deliberate
--     standalone / subset placements are preserved, and empty arrays inherit the
--     allocation's live membership.
update public.scheduled_sessions session
set
  participant_cohort_ids = repaired.next_ids,
  combined_cohort_size = public.resolve_participant_cohort_size(repaired.next_ids),
  updated_at = now()
from (
  select
    s.id as session_id,
    array(
      select distinct candidate
      from unnest(
        array_append(coalesce(s.participant_cohort_ids, '{}'::uuid[]), s.cohort_id)
      ) as candidate
      where candidate = s.cohort_id
         or candidate = any(coalesce(a.participant_cohort_ids, '{}'::uuid[]))
      order by candidate
    ) as next_ids
  from public.scheduled_sessions s
  join public.teaching_allocations a on a.id = s.teaching_allocation_id
  where s.status in ('draft', 'confirmed', 'locked')
    and coalesce(s.participant_cohort_ids, '{}'::uuid[]) <> '{}'::uuid[]
) repaired
where session.id = repaired.session_id
  and cardinality(repaired.next_ids) > 0
  and session.participant_cohort_ids is distinct from repaired.next_ids
  -- shrink only: this repair never widens a session's participant set
  and coalesce(session.participant_cohort_ids, '{}'::uuid[]) @> repaired.next_ids;

-- ============================================================
-- 4. Keep membership in sync automatically
-- ============================================================

create or replace function public.propagate_offering_participant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_offering_id uuid;
begin
  affected_offering_id := coalesce(
    (case when tg_op = 'DELETE' then old.teaching_offering_id else new.teaching_offering_id end),
    null
  );

  if affected_offering_id is not null then
    begin
      perform public.refresh_shared_class_participant_context(affected_offering_id);
    exception when others then
      -- Membership propagation must never block the operation that triggered it.
      raise warning 'Participant context refresh skipped for offering %: %', affected_offering_id, sqlerrm;
    end;
  end if;

  if tg_op = 'UPDATE' and new.teaching_offering_id is distinct from old.teaching_offering_id then
    begin
      perform public.refresh_shared_class_participant_context(old.teaching_offering_id);
    exception when others then
      raise warning 'Participant context refresh skipped for offering %: %', old.teaching_offering_id, sqlerrm;
    end;
  end if;

  return null;
end;
$$;

drop trigger if exists teaching_offering_participants_propagate_membership
  on public.teaching_offering_participants;

create trigger teaching_offering_participants_propagate_membership
after insert or update or delete on public.teaching_offering_participants
for each row
execute function public.propagate_offering_participant_change();

create or replace function public.propagate_unit_offering_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  offering_id_var uuid;
begin
  if new.status is not distinct from old.status
    and new.is_timetable_enabled is not distinct from old.is_timetable_enabled
    and new.approval_status is not distinct from old.approval_status
    and new.selection_state is not distinct from old.selection_state then
    return null;
  end if;

  for offering_id_var in
    select distinct participant.teaching_offering_id
    from public.teaching_offering_participants participant
    where participant.cohort_id = new.cohort_id
      and participant.unit_id = new.unit_id
  loop
    begin
      perform public.refresh_shared_class_participant_context(offering_id_var);
    exception when others then
      raise warning 'Participant context refresh skipped for offering %: %', offering_id_var, sqlerrm;
    end;
  end loop;

  return null;
end;
$$;

drop trigger if exists unit_offerings_propagate_membership on public.unit_offerings;

create trigger unit_offerings_propagate_membership
after update on public.unit_offerings
for each row
execute function public.propagate_unit_offering_membership_change();

comment on function public.propagate_offering_participant_change() is
  'Refreshes shared-class participant arrays whenever offering membership rows change.';
comment on function public.propagate_unit_offering_membership_change() is
  'Refreshes shared-class participant arrays whenever a unit offering is dropped, excluded, withdrawn or re-enabled.';

-- ============================================================
-- 5. Precise clash reporting (manual placement RPC)
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

-- ============================================================
-- 6. Precise clash reporting (session validation trigger)
-- ============================================================

create or replace function public.validate_scheduled_session_conflicts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_start_slot public.time_slots%rowtype;
  selected_end_slot public.time_slots%rowtype;
  selected_trainer public.trainers%rowtype;
  approved_full_day boolean := false;
  selected_participant_cohort_ids uuid[] := '{}'::uuid[];
  session_duration_minutes integer;
  existing_daily_minutes integer;
  existing_weekly_minutes integer;
  clashing_record record;
begin
  if new.status in ('cancelled', 'archived') then
    new.conflict_state := 'clear';
    return new;
  end if;

  select * into selected_start_slot from public.time_slots where id = new.start_time_slot_id;
  select * into selected_end_slot from public.time_slots where id = new.end_time_slot_id;
  select * into selected_trainer from public.trainers where id = new.trainer_id;

  select coalesce(allocation.is_full_day_session, false)
  into approved_full_day
  from public.teaching_allocations allocation
  where allocation.id = new.teaching_allocation_id;

  -- Explicit per-session participants win; otherwise resolve authoritative membership.
  if new.participant_cohort_ids is not null and cardinality(new.participant_cohort_ids) > 0 then
    selected_participant_cohort_ids := array(
      select distinct c_id
      from unnest(array_append(new.participant_cohort_ids, new.cohort_id)) as c_id
      where c_id is not null
    );
  else
    select public.resolve_participant_cohort_ids(
      allocation.cohort_id,
      allocation.teaching_offering_id
    )
    into selected_participant_cohort_ids
    from public.teaching_allocations allocation
    where allocation.id = new.teaching_allocation_id;

    if selected_participant_cohort_ids is null
      or cardinality(selected_participant_cohort_ids) = 0 then
      selected_participant_cohort_ids := array[new.cohort_id];
    end if;
  end if;

  session_duration_minutes :=
    extract(epoch from (selected_end_slot.ends_at - selected_start_slot.starts_at))::integer / 60;

  -- Trainer clash
  if new.trainer_id is not null then
    select
      existing.id,
      t.full_name as trainer_name,
      u.code as unit_code,
      c.code as cohort_code
    into clashing_record
    from public.scheduled_sessions existing
    join public.trainers t on t.id = existing.trainer_id
    join public.units u on u.id = existing.unit_id
    join public.cohorts c on c.id = existing.cohort_id
    join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and existing.trainer_id = new.trainer_id
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
    limit 1;

    if clashing_record.id is not null then
      raise exception using
        errcode = '23P01',
        message = format('Trainer clash: Trainer %s already has session %s (%s) during the selected time.', clashing_record.trainer_name, clashing_record.unit_code, clashing_record.cohort_code);
    end if;
  end if;

  -- Cohort clash, naming the cohort that actually overlaps
  select
    existing.id,
    clashing.code as clash_cohort_code,
    owner.code as owner_cohort_code,
    u.code as unit_code,
    u.name as unit_name
  into clashing_record
  from public.scheduled_sessions existing
  join public.cohorts owner on owner.id = existing.cohort_id
  join public.units u on u.id = existing.unit_id
  join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
  join lateral (
    select c.id, c.code
    from public.cohorts c
    where c.id = any(
      array_append(coalesce(existing.participant_cohort_ids, '{}'::uuid[]), existing.cohort_id)
    )
      and c.id = any(selected_participant_cohort_ids)
    order by (c.id = new.cohort_id) desc, c.code
    limit 1
  ) clashing on true
  where existing.id <> new.id
    and existing.academic_period_id = new.academic_period_id
    and existing.working_day_id = new.working_day_id
    and existing.status not in ('cancelled', 'archived')
    and existing_start.starts_at < selected_end_slot.ends_at
    and selected_start_slot.starts_at < existing_end.ends_at
  limit 1;

  if clashing_record.id is not null then
    raise exception using
      errcode = '23P01',
      message = format(
        'Cohort clash: Participating cohort %s already has %s (%s) during the selected time.%s',
        clashing_record.clash_cohort_code,
        clashing_record.unit_code,
        clashing_record.unit_name,
        case
          when clashing_record.owner_cohort_code is distinct from clashing_record.clash_cohort_code
            then format(' That session is a shared class led by %s.', clashing_record.owner_cohort_code)
          else ''
        end
      );
  end if;

  -- Room clash
  if new.room_id is not null then
    select
      existing.id,
      r.name as room_name,
      u.code as unit_code,
      c.code as cohort_code
    into clashing_record
    from public.scheduled_sessions existing
    join public.rooms r on r.id = existing.room_id
    join public.units u on u.id = existing.unit_id
    join public.cohorts c on c.id = existing.cohort_id
    join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and existing.room_id = new.room_id
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
    limit 1;

    if clashing_record.id is not null then
      raise exception using
        errcode = '23P01',
        message = format('Room clash: Room %s is already booked for %s (%s) during the selected time.', clashing_record.room_name, clashing_record.unit_code, clashing_record.cohort_code);
    end if;
  end if;

  select coalesce(
    sum(extract(epoch from (existing_end.ends_at - existing_start.starts_at))::integer / 60),
    0
  )
  into existing_daily_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id = new.academic_period_id
    and existing.working_day_id = new.working_day_id
    and existing.trainer_id = new.trainer_id
    and existing.status not in ('cancelled', 'archived');

  if not approved_full_day
    and selected_trainer.id is not null
    and existing_daily_minutes + session_duration_minutes
      > selected_trainer.maximum_daily_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message = 'The scheduled session would exceed the trainer maximum daily workload';
  end if;

  select coalesce(
    sum(extract(epoch from (existing_end.ends_at - existing_start.starts_at))::integer / 60),
    0
  )
  into existing_weekly_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end on existing_end.id = existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id = new.academic_period_id
    and existing.trainer_id = new.trainer_id
    and existing.status not in ('cancelled', 'archived');

  if selected_trainer.id is not null
    and existing_weekly_minutes + session_duration_minutes
      > selected_trainer.maximum_weekly_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message = 'The scheduled session would exceed the trainer maximum weekly workload';
  end if;

  new.conflict_state := 'clear';
  return new;
end;
$$;

-- ============================================================
-- 7. Verification / monitoring
-- ============================================================

create or replace function public.audit_phantom_session_participants(
  target_academic_period_id uuid
)
returns table (
  session_id uuid,
  working_day text,
  starts_at time,
  unit_code text,
  owner_cohort_code text,
  phantom_cohort_code text,
  reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session.id,
    day.day_of_week::text,
    slot.starts_at,
    unit.code,
    owner.code,
    phantom.code,
    case
      when allocation.id is null then 'Session has no live teaching allocation'
      when not exists (
        select 1
        from public.teaching_offering_participants participant
        where participant.teaching_offering_id = allocation.teaching_offering_id
          and participant.cohort_id = phantom.id
      ) then 'Cohort is not a participant of the shared offering'
      else 'Cohort has no approved, included, timetable-enabled unit offering'
    end
  from public.scheduled_sessions session
  join public.cohorts owner on owner.id = session.cohort_id
  join public.units unit on unit.id = session.unit_id
  join public.working_days day on day.id = session.working_day_id
  join public.time_slots slot on slot.id = session.start_time_slot_id
  left join public.teaching_allocations allocation on allocation.id = session.teaching_allocation_id
  cross join lateral unnest(coalesce(session.participant_cohort_ids, '{}'::uuid[])) as candidate_id
  join public.cohorts phantom on phantom.id = candidate_id
  where session.academic_period_id = target_academic_period_id
    and session.status in ('draft', 'confirmed', 'locked')
    and phantom.id <> session.cohort_id
    and not (
      phantom.id = any(
        coalesce(
          public.resolve_participant_cohort_ids(allocation.cohort_id, allocation.teaching_offering_id),
          '{}'::uuid[]
        )
      )
    )
  order by day.sequence_number, slot.starts_at, unit.code;
$$;

revoke all on function public.audit_phantom_session_participants(uuid) from public;
grant execute on function public.audit_phantom_session_participants(uuid) to authenticated;

comment on function public.audit_phantom_session_participants(uuid) is
  'Lists scheduled sessions still carrying cohorts that no longer belong to the shared class — each one is a false clash waiting to happen.';

commit;
