-- Keep every unit-allocation entry point synchronized with the authoritative
-- teaching_allocations row and resolve reservations by exact offering identity.

create or replace function public.assign_unit_offering_authoritatively(
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
  allocation public.teaching_allocations%rowtype;
  assignment_result jsonb;
  new_allocation_id uuid;
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

  select * into trainer from public.trainers where id = p_trainer_id;
  if trainer.id is null or not trainer.is_active
    or not trainer.is_timetable_available then
    raise exception 'The selected trainer is not available';
  end if;

  if not coalesce(offering.is_provisionally_reserved, false) then
    assignment_result := public.assign_unit_offering(p_offering_id, p_trainer_id);
    new_allocation_id := (assignment_result ->> 'allocationId')::uuid;

    update public.teaching_allocations
    set source_unit_offering_id = offering.id,
        updated_at = now(),
        updated_by = auth.uid()
    where id = new_allocation_id;

    -- Re-run fixed-session propagation after recording the exact identity.
    update public.teaching_allocations
    set trainer_id = trainer_id
    where id = new_allocation_id;

    return assignment_result || jsonb_build_object(
      'sourceUnitOfferingId', offering.id
    );
  end if;

  if offering.confirmed_shared_offering_id is not null then
    if exists (
      select 1
      from public.teaching_offering_participants participant
      where participant.teaching_offering_id = offering.confirmed_shared_offering_id
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

    select candidate.* into allocation
    from public.teaching_allocations candidate
    where candidate.teaching_offering_id = offering.confirmed_shared_offering_id
      and candidate.trainer_id is null
      and candidate.status in ('draft', 'active')
    order by
      (candidate.source_unit_offering_id = offering.id) desc,
      candidate.created_at,
      candidate.id
    limit 1
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

    select candidate.* into allocation
    from public.teaching_allocations candidate
    where candidate.trainer_id is null
      and candidate.status in ('draft', 'active')
      and (
        candidate.source_unit_offering_id = offering.id
        or (
          candidate.source_unit_offering_id is null
          and candidate.academic_period_id = offering.academic_period_id
          and candidate.cohort_id = offering.cohort_id
          and candidate.unit_id = offering.unit_id
        )
      )
    order by
      (candidate.source_unit_offering_id = offering.id) desc,
      candidate.created_at,
      candidate.id
    limit 1
    for update;
  end if;

  if allocation.id is null then
    raise exception 'The exact trainer-pending allocation for this unit could not be found';
  end if;

  update public.teaching_allocations
  set trainer_id = trainer.id,
      status = 'active',
      updated_at = now(),
      updated_by = auth.uid()
  where id = allocation.id;

  update public.scheduled_sessions
  set trainer_id = trainer.id,
      conflict_state = 'unchecked',
      updated_at = now(),
      updated_by = auth.uid()
  where teaching_allocation_id = allocation.id
    and trainer_id is null
    and status in ('draft', 'confirmed');

  if offering.confirmed_shared_offering_id is not null then
    update public.teaching_offerings
    set trainer_id = trainer.id,
        status = 'active',
        updated_at = now(),
        updated_by = auth.uid()
    where id = offering.confirmed_shared_offering_id;

    update public.unit_offerings
    set allocation_status = 'allocated',
        is_provisionally_reserved = false,
        status = 'active',
        updated_at = now(),
        updated_by = auth.uid()
    where confirmed_shared_offering_id = offering.confirmed_shared_offering_id;
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
    'trainerId', trainer.id,
    'sourceUnitOfferingId', offering.id,
    'wasReserved', true
  );
end;
$$;

create or replace function public.update_teaching_allocation_readiness(
  p_teaching_offering_id uuid,
  p_academic_period_id uuid,
  p_trainer_id uuid,
  p_preferred_room_id uuid,
  p_status public.teaching_allocation_status,
  p_is_timetable_enabled boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  offering public.teaching_offerings%rowtype;
  allocation public.teaching_allocations%rowtype;
  matching_count integer;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before updating allocations';
  end if;

  select candidate.* into offering
  from public.teaching_offerings candidate
  where candidate.id = p_teaching_offering_id
    and candidate.academic_period_id = p_academic_period_id
    and candidate.department_id = active_department
  for update;

  if offering.id is null then
    raise exception 'The teaching offering was not found in the working department';
  end if;

  select count(distinct candidate.id) into matching_count
  from public.teaching_allocations candidate
  where candidate.academic_period_id = p_academic_period_id
    and candidate.status in ('draft', 'active', 'suspended')
    and (
      candidate.teaching_offering_id = offering.id
      or exists (
        select 1
        from public.teaching_offering_participants participant
        where participant.teaching_offering_id = offering.id
          and participant.unit_offering_id = candidate.source_unit_offering_id
      )
    );

  if matching_count = 0 then
    raise exception 'Allocate this unit from Teaching Allocations before editing readiness';
  end if;
  if matching_count > 1 then
    raise exception 'More than one active allocation matches this offering; reconcile duplicates first';
  end if;

  select candidate.* into allocation
  from public.teaching_allocations candidate
  where candidate.academic_period_id = p_academic_period_id
    and candidate.status in ('draft', 'active', 'suspended')
    and (
      candidate.teaching_offering_id = offering.id
      or exists (
        select 1
        from public.teaching_offering_participants participant
        where participant.teaching_offering_id = offering.id
          and participant.unit_offering_id = candidate.source_unit_offering_id
      )
    )
  for update;

  if p_trainer_id is not null and not exists (
    select 1 from public.trainers trainer
    where trainer.id = p_trainer_id
      and trainer.is_active
      and trainer.is_timetable_available
  ) then
    raise exception 'The selected trainer is not available for timetabling';
  end if;

  if p_preferred_room_id is not null and not exists (
    select 1 from public.rooms room
    where room.id = p_preferred_room_id
      and room.is_active
      and room.is_timetable_available
  ) then
    raise exception 'The selected room is not available for timetabling';
  end if;

  if p_trainer_id is not null and exists (
    select 1
    from public.teaching_offering_participants participant
    where participant.teaching_offering_id = offering.id
      and exists (
        select 1 from public.trainer_unit_eligibility eligibility
        where eligibility.unit_id = participant.unit_id
      )
      and not exists (
        select 1 from public.trainer_unit_eligibility eligibility
        where eligibility.unit_id = participant.unit_id
          and eligibility.trainer_id = p_trainer_id
      )
  ) then
    raise exception 'The selected trainer is not approved for every unit in this offering';
  end if;

  if allocation.trainer_id is not null and p_trainer_id is null then
    raise exception 'Use Teaching Allocations to unassign this trainer safely';
  end if;

  if (
    allocation.trainer_id is distinct from p_trainer_id
    or allocation.preferred_room_id is distinct from p_preferred_room_id
  ) and exists (
    select 1 from public.scheduled_sessions session
    where session.teaching_allocation_id = allocation.id
      and (session.is_locked or session.status = 'locked')
  ) then
    raise exception 'Unlock this allocation timetable sessions before changing its trainer or room';
  end if;

  update public.teaching_allocations
  set trainer_id = p_trainer_id,
      preferred_room_id = p_preferred_room_id,
      status = p_status,
      is_timetable_enabled = p_is_timetable_enabled,
      updated_at = now(),
      updated_by = auth.uid()
  where id = allocation.id;

  update public.scheduled_sessions
  set trainer_id = p_trainer_id,
      room_id = p_preferred_room_id,
      conflict_state = 'unchecked',
      updated_at = now(),
      updated_by = auth.uid()
  where teaching_allocation_id = allocation.id
    and status in ('draft', 'confirmed')
    and not is_locked;

  update public.teaching_offerings
  set trainer_id = p_trainer_id,
      preferred_room_id = p_preferred_room_id,
      status = p_status,
      is_timetable_enabled = p_is_timetable_enabled,
      updated_at = now(),
      updated_by = auth.uid()
  where id = offering.id;

  update public.unit_offerings unit_offering
  set allocation_status = case
        when p_trainer_id is null then 'unallocated'
        else 'allocated'
      end,
      is_provisionally_reserved = p_trainer_id is null,
      updated_at = now(),
      updated_by = auth.uid()
  where unit_offering.confirmed_shared_offering_id = offering.id
     or unit_offering.id = allocation.source_unit_offering_id;

  return allocation.id;
end;
$$;

revoke all on function public.assign_unit_offering_authoritatively(uuid, uuid)
from public;
grant execute on function public.assign_unit_offering_authoritatively(uuid, uuid)
to authenticated;

revoke all on function public.update_teaching_allocation_readiness(
  uuid, uuid, uuid, uuid, public.teaching_allocation_status, boolean
) from public;
grant execute on function public.update_teaching_allocation_readiness(
  uuid, uuid, uuid, uuid, public.teaching_allocation_status, boolean
) to authenticated;
