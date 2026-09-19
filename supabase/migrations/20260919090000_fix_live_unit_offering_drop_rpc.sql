-- Fix the live unit-offering drop RPC.
-- The previous migration is already applied remotely, so this replacement must
-- be delivered as a new migration.

drop function if exists public.set_unit_offering_approval(uuid[], boolean, text);
drop function if exists public.set_unit_offering_approval(uuid[], boolean);

create or replace function public.set_unit_offering_approval(
  p_offering_ids uuid[],
  p_approve boolean,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  changed integer := 0;
  clean_reason text := coalesce(
    nullif(trim(p_reason), ''),
    'Dropped from cohort teaching plan for this academic period'
  );
  blocked_ids uuid[];
  offering_row record;
  affected_allocation_ids uuid[];
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'Authentication required';
  end if;

  if coalesce(cardinality(p_offering_ids), 0) = 0 then
    raise exception 'Select at least one Unit on Offer';
  end if;

  if not p_approve and nullif(trim(p_reason), '') is null then
    raise exception 'Provide a reason when withdrawing an offering';
  end if;

  select array_agg(offering.id)
  into blocked_ids
  from public.unit_offerings offering
  join public.cohorts cohort on cohort.id = offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and not (
      programme.department_id = active_department
      or public.current_user_can_manage_department(programme.department_id)
    );

  update public.unit_offerings offering
  set approval_status = case when p_approve
        then 'approved'::public.unit_offering_approval_status
        else 'withdrawn'::public.unit_offering_approval_status end,
      selection_state = case when p_approve
        then 'included'::public.unit_offering_selection_state
        else 'excluded'::public.unit_offering_selection_state end,
      status = case when p_approve
        then 'draft'::public.unit_offering_status
        else 'cancelled'::public.unit_offering_status end,
      is_timetable_enabled = p_approve
        and offering.offering_type not in ('attachment', 'clinical_rotation', 'examination'),
      approved_by = case when p_approve then auth.uid() else null end,
      approved_at = case when p_approve then now() else null end,
      withdrawn_by = case when p_approve then null else auth.uid() end,
      withdrawn_at = case when p_approve then null else now() end,
      withdrawal_reason = case when p_approve then null else clean_reason end,
      exception_reason = case
        when not p_approve then clean_reason
        when offering.origin = 'curriculum' then offering.exception_reason
        else coalesce(offering.exception_reason, 'Approved cohort unit offering')
      end,
      manually_reviewed = true,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      updated_by = auth.uid(),
      updated_at = now()
  from public.cohorts cohort
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
    and offering.cohort_id = cohort.id
    and (
      programme.department_id = active_department
      or public.current_user_can_manage_department(programme.department_id)
    );

  get diagnostics changed = row_count;

  if p_approve then
    update public.teaching_allocations allocation
    set source_unit_offering_id = offering.id,
        is_timetable_enabled = offering.offering_type not in ('attachment', 'clinical_rotation', 'examination'),
        status = case when allocation.status in ('suspended', 'archived') then 'draft' else allocation.status end,
        updated_by = auth.uid(),
        updated_at = now()
    from public.unit_offerings offering
    where offering.id = any(p_offering_ids)
      and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and allocation.academic_period_id = offering.academic_period_id
      and allocation.cohort_id = offering.cohort_id
      and allocation.unit_id = offering.unit_id;

    insert into public.teaching_allocations (
      academic_period_id, cohort_id, unit_id, trainer_id,
      source_unit_offering_id, delivery_mode, weekly_sessions,
      session_duration_minutes, status, is_timetable_enabled,
      participant_cohort_ids, combined_cohort_size, notes,
      created_by, updated_by
    )
    select distinct on (offering.academic_period_id, offering.cohort_id, offering.unit_id)
      offering.academic_period_id, offering.cohort_id, offering.unit_id, null,
      offering.id,
      case when offering.offering_type = 'practical'
        then 'practical'::public.teaching_delivery_mode
        else 'theory'::public.teaching_delivery_mode end,
      coalesce(offering.weekly_sessions, unit.weekly_sessions, 1),
      coalesce(offering.session_duration_minutes, 120),
      'draft', true, array[offering.cohort_id], coalesce(cohort.actual_size, 0),
      'Approved cohort unit offering ready for timetabling', auth.uid(), auth.uid()
    from public.unit_offerings offering
    join public.cohorts cohort on cohort.id = offering.cohort_id
    join public.units unit on unit.id = offering.unit_id
    where offering.id = any(p_offering_ids)
      and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
      and offering.offering_type not in ('attachment', 'clinical_rotation', 'examination')
      and not exists (
        select 1 from public.teaching_allocations existing
        where existing.academic_period_id = offering.academic_period_id
          and existing.cohort_id = offering.cohort_id
          and existing.unit_id = offering.unit_id
      )
    on conflict (academic_period_id, cohort_id, unit_id)
      where status in ('draft', 'active', 'suspended')
    do update set
      source_unit_offering_id = excluded.source_unit_offering_id,
      is_timetable_enabled = true,
      status = 'draft',
      updated_by = auth.uid(),
      updated_at = now();
  else
    for offering_row in
      select offering.id as offering_id,
             offering.cohort_id,
             offering.unit_id,
             offering.academic_period_id
      from public.unit_offerings offering
      where offering.id = any(p_offering_ids)
        and not (offering.id = any(coalesce(blocked_ids, '{}'::uuid[])))
    loop
      select coalesce(array_agg(allocation.id), '{}'::uuid[])
      into affected_allocation_ids
      from public.teaching_allocations allocation
      where allocation.academic_period_id = offering_row.academic_period_id
        and allocation.unit_id = offering_row.unit_id
        and (
          allocation.source_unit_offering_id = offering_row.offering_id
          or allocation.cohort_id = offering_row.cohort_id
          or offering_row.cohort_id = any(coalesce(allocation.participant_cohort_ids, '{}'::uuid[]))
        );

      -- 1. Shared sessions with remaining partner cohorts: re-link allocation and remove dropped cohort
      update public.scheduled_sessions session
      set participant_cohort_ids = array_remove(session.participant_cohort_ids, offering_row.cohort_id),
          cohort_id = (select unnest(array_remove(session.participant_cohort_ids, offering_row.cohort_id)) limit 1),
          teaching_allocation_id = coalesce(
            (
              select partner_alloc.id
              from public.teaching_allocations partner_alloc
              where partner_alloc.academic_period_id = session.academic_period_id
                and partner_alloc.unit_id = session.unit_id
                and partner_alloc.cohort_id = (select unnest(array_remove(session.participant_cohort_ids, offering_row.cohort_id)) limit 1)
                and partner_alloc.status in ('draft', 'active')
              order by case partner_alloc.status when 'active' then 1 else 2 end, partner_alloc.updated_at desc
              limit 1
            ),
            session.teaching_allocation_id
          ),
          combined_cohort_size = public.resolve_participant_cohort_size(
            array_remove(session.participant_cohort_ids, offering_row.cohort_id)
          ),
          conflict_state = 'clear'::public.scheduled_session_conflict_state,
          updated_by = auth.uid(),
          updated_at = now()
      where session.academic_period_id = offering_row.academic_period_id
        and (session.unit_id = offering_row.unit_id or session.teaching_allocation_id = any(affected_allocation_ids))
        and offering_row.cohort_id = any(session.participant_cohort_ids)
        and cardinality(array_remove(session.participant_cohort_ids, offering_row.cohort_id)) > 0;

      -- 2. Solo sessions: cancel and unlock
      update public.scheduled_sessions session
      set status = 'cancelled'::public.scheduled_session_status,
          conflict_state = 'clear'::public.scheduled_session_conflict_state,
          is_locked = false,
          notes = left(concat_ws(
            ' ', nullif(trim(session.notes), ''),
            'Cancelled because unit offering was dropped by HOD.'
          ), 1000),
          updated_by = auth.uid(),
          updated_at = now()
      where session.academic_period_id = offering_row.academic_period_id
        and (
          session.teaching_allocation_id = any(affected_allocation_ids)
          or session.cohort_id = offering_row.cohort_id
        )
        and (
          session.participant_cohort_ids is null
          or session.participant_cohort_ids = array[offering_row.cohort_id]
          or cardinality(array_remove(session.participant_cohort_ids, offering_row.cohort_id)) = 0
        )
        and session.status not in ('cancelled', 'archived');

      delete from public.teaching_offering_participants participant
      where participant.unit_offering_id = offering_row.offering_id
         or (
           participant.cohort_id = offering_row.cohort_id
           and participant.unit_id = offering_row.unit_id
           and participant.teaching_offering_id in (
             select shared.id
             from public.teaching_offerings shared
             where shared.academic_period_id = offering_row.academic_period_id
           )
         );

      with ranked_own_allocations as (
        select allocation.id,
               row_number() over (
                 partition by allocation.academic_period_id, allocation.cohort_id, allocation.unit_id
                 order by
                   case allocation.status
                     when 'active' then 1
                     when 'draft' then 2
                     when 'suspended' then 3
                     else 4
                   end,
                   allocation.updated_at desc
               ) as rn
        from public.teaching_allocations allocation
        where allocation.id = any(affected_allocation_ids)
          and (
            allocation.cohort_id = offering_row.cohort_id
            or allocation.source_unit_offering_id = offering_row.offering_id
          )
      )
      update public.teaching_allocations allocation
      set is_timetable_enabled = false,
          status = case when ranked.rn = 1 then 'suspended'::public.teaching_allocation_status else 'archived'::public.teaching_allocation_status end,
          participant_cohort_ids = array_remove(
            coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
            offering_row.cohort_id
          ),
          combined_cohort_size = public.resolve_participant_cohort_size(
            array_remove(
              coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
              offering_row.cohort_id
            )
          ),
          updated_by = auth.uid(),
          updated_at = now()
      from ranked_own_allocations ranked
      where allocation.id = ranked.id;

      update public.teaching_allocations allocation
      set participant_cohort_ids = array_remove(
            coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
            offering_row.cohort_id
          ),
          combined_cohort_size = public.resolve_participant_cohort_size(
            array_remove(
              coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
              offering_row.cohort_id
            )
          ),
          updated_by = auth.uid(),
          updated_at = now()
      where allocation.academic_period_id = offering_row.academic_period_id
        and allocation.unit_id = offering_row.unit_id
        and offering_row.cohort_id = any(coalesce(allocation.participant_cohort_ids, '{}'::uuid[]));
    end loop;
  end if;

  return jsonb_build_object(
    'changed', changed,
    'blocked', coalesce(cardinality(blocked_ids), 0),
    'blocked_ids', coalesce(to_jsonb(blocked_ids), '[]'::jsonb),
    'message', case
      when coalesce(cardinality(blocked_ids), 0) = 0 then null
      when changed = 0 then 'Offerings could not be updated because they belong to departments you cannot manage.'
      else format('%s offering(s) updated. %s offering(s) were skipped because they belong to other departments.', changed, cardinality(blocked_ids))
    end
  );
end;
$$;

revoke all on function public.set_unit_offering_approval(uuid[], boolean, text) from public;
grant execute on function public.set_unit_offering_approval(uuid[], boolean, text) to authenticated;

-- Ensure scheduled session validation gracefully permits cancelled/archived sessions
-- and validates active/open periods
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

  if selected_period.status not in ('open', 'planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'Scheduled sessions require an active or open Academic Period';
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

  if selected_allocation.status not in ('draft', 'active') then
    raise exception using errcode = 'P0001',
      message = 'Only draft or active teaching allocations may be scheduled';
  end if;

  if selected_allocation.is_timetable_enabled = false then
    raise exception using errcode = 'P0001',
      message = 'The teaching allocation is not enabled for timetabling';
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

  if selected_period.status not in ('open', 'planned', 'active') then
    raise exception using errcode = 'P0001', message = 'Scheduled sessions require an active Academic Period';
  end if;

  select * into selected_allocation from public.teaching_allocations where id = new.teaching_allocation_id;
  if selected_allocation.id is null then
    raise exception using errcode = 'P0002', message = 'Teaching allocation not found';
  end if;

  if selected_allocation.academic_period_id <> new.academic_period_id then
    raise exception using errcode = 'P0001', message = 'The teaching allocation belongs to a different Academic Period';
  end if;

  if selected_allocation.trainer_id is not null then
    raise exception using errcode = 'P0001', message = 'The scheduled session must use its assigned trainer';
  end if;

  if selected_allocation.status not in ('draft', 'active') or not selected_allocation.is_timetable_enabled then
    raise exception using errcode = 'P0001', message = 'The trainer-pending allocation is not enabled for timetabling';
  end if;

  if not exists (
    select 1 from public.unit_offerings offering
    where offering.academic_period_id = selected_allocation.academic_period_id
      and offering.cohort_id = selected_allocation.cohort_id
      and offering.unit_id = selected_allocation.unit_id
      and offering.is_provisionally_reserved = true
  ) then
    raise exception using errcode = 'P0001', message = 'Reserve the fixed unit sessions before generating without a trainer';
  end if;

  new.cohort_id := selected_allocation.cohort_id;
  new.unit_id := selected_allocation.unit_id;
  new.trainer_id := null;
  new.delivery_mode := selected_allocation.delivery_mode;

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

