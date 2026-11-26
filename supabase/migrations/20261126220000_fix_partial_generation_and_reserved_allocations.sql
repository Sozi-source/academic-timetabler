-- Fix provisional trainer-pending reservations (`reserve_unit_offering_without_trainer`)
-- so reserved allocations carry `source_unit_offering_id`, `preferred_room_id`, and
-- fixed-schedule metadata, making partial timetable generation + in-place trainer
-- assignment work seamlessly end-to-end.

begin;

-- 1. Backfill source_unit_offering_id for any existing trainer-pending allocations
update public.teaching_allocations allocation
set
  source_unit_offering_id = coalesce(
    (
      select offering.id
      from public.unit_offerings offering
      where offering.academic_period_id = allocation.academic_period_id
        and offering.confirmed_shared_offering_id = allocation.teaching_offering_id
      order by (offering.cohort_id = allocation.cohort_id) desc, offering.id
      limit 1
    ),
    (
      select offering.id
      from public.unit_offerings offering
      where offering.academic_period_id = allocation.academic_period_id
        and offering.cohort_id = allocation.cohort_id
        and offering.unit_id = allocation.unit_id
      limit 1
    )
  ),
  updated_at = now()
where allocation.source_unit_offering_id is null
  and allocation.status in ('draft', 'active', 'suspended');

-- 2. Upgrade reserve_unit_offering_without_trainer(uuid) to persist full metadata
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
  v_fixed_day_ids uuid[] := '{}'::uuid[];
  v_fixed_slot_ids uuid[] := '{}'::uuid[];
  v_fixed_day_id uuid;
  v_is_full_day boolean;
  v_end_slot_id uuid;
  v_preferred_room_id uuid;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before including an unassigned unit';
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

  if offering.confirmed_shared_offering_id is not null then
    select * into shared_offering
    from public.teaching_offerings
    where id = offering.confirmed_shared_offering_id
      and department_id = active_department;

    if shared_offering.id is null then
      raise exception 'The confirmed shared class is not available';
    end if;
  end if;

  -- Check if an active/draft allocation already exists for this offering or shared group
  select allocation.id into allocation_id
  from public.teaching_allocations allocation
  where allocation.academic_period_id = offering.academic_period_id
    and allocation.status in ('draft', 'active')
    and (
      allocation.source_unit_offering_id = offering.id
      or (
        offering.confirmed_shared_offering_id is not null
        and allocation.teaching_offering_id = offering.confirmed_shared_offering_id
      )
      or (
        allocation.cohort_id = offering.cohort_id
        and allocation.unit_id = offering.unit_id
      )
    )
  order by (allocation.trainer_id is null) desc, allocation.created_at
  limit 1;

  if allocation_id is not null then
    update public.teaching_allocations
    set
      source_unit_offering_id = coalesce(source_unit_offering_id, offering.id),
      is_timetable_enabled = true,
      updated_at = now(),
      updated_by = auth.uid()
    where id = allocation_id;

    if shared_offering.id is not null then
      update public.unit_offerings
      set is_provisionally_reserved = true, updated_at = now(), updated_by = auth.uid()
      where confirmed_shared_offering_id = shared_offering.id;
    else
      update public.unit_offerings
      set is_provisionally_reserved = true, updated_at = now(), updated_by = auth.uid()
      where id = offering.id;
    end if;

    return jsonb_build_object(
      'allocationId', allocation_id,
      'included', true,
      'alreadyIncluded', true
    );
  end if;

  -- Resolve fixed schedule arrays if configured on the unit offering
  select
    coalesce(array_agg(slot_row.working_day_id order by slot_row.sequence_number), '{}'::uuid[]),
    coalesce(array_agg(slot_row.time_slot_id order by slot_row.sequence_number), '{}'::uuid[])
  into v_fixed_day_ids, v_fixed_slot_ids
  from public.unit_offering_fixed_slots slot_row
  where slot_row.unit_offering_id = offering.id;

  if cardinality(v_fixed_slot_ids) = 0 and offering.fixed_time_slot_id is not null then
    v_fixed_slot_ids := array[offering.fixed_time_slot_id];
  end if;
  if cardinality(v_fixed_day_ids) = 0 and offering.fixed_working_day_id is not null then
    v_fixed_day_ids := array[offering.fixed_working_day_id];
  end if;

  v_fixed_day_id := coalesce(offering.fixed_working_day_id, v_fixed_day_ids[1]);
  v_is_full_day := coalesce(offering.is_full_day_session, false);
  v_end_slot_id := offering.full_day_end_time_slot_id;
  v_preferred_room_id := coalesce(shared_offering.preferred_room_id, offering.preferred_room_id);

  insert into public.teaching_allocations (
    academic_period_id,
    cohort_id,
    unit_id,
    trainer_id,
    source_unit_offering_id,
    preferred_room_id,
    delivery_mode,
    weekly_sessions,
    session_duration_minutes,
    fixed_working_day_id,
    fixed_working_day_ids,
    fixed_time_slot_ids,
    is_full_day_session,
    fixed_end_time_slot_id,
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
    offering.id,
    v_preferred_room_id,
    case
      when offering.offering_type = 'clinical' or v_is_full_day
        then 'clinical'::public.teaching_delivery_mode
      when offering.offering_type = 'practical'
        then 'practical'::public.teaching_delivery_mode
      else 'theory'::public.teaching_delivery_mode
    end,
    case when shared_offering.id is null
      then greatest(1, coalesce(offering.weekly_sessions, 1))
      else greatest(1, coalesce(shared_offering.weekly_sessions, 1)) end,
    case
      when v_is_full_day then 480
      when shared_offering.id is null
        then coalesce(offering.session_duration_minutes, 120)
      else coalesce(shared_offering.session_duration_minutes, 120)
    end,
    v_fixed_day_id,
    case when cardinality(v_fixed_day_ids) > 0 then v_fixed_day_ids else null end,
    case when cardinality(v_fixed_slot_ids) > 0 then v_fixed_slot_ids else null end,
    v_is_full_day,
    v_end_slot_id,
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
      then (
        select cohort.actual_size
        from public.cohorts cohort
        where cohort.id = offering.cohort_id
      )
      else (
        select coalesce(sum(cohort.actual_size), 0)
        from public.teaching_offering_participants participant
        join public.cohorts cohort on cohort.id = participant.cohort_id
        where participant.teaching_offering_id = shared_offering.id
      ) end,
    case when offering.fixed_schedule_required
      then 'Unassigned trainer; fixed timetable placement included'
      else 'Unassigned trainer; provisional slot reserved for external trainer' end
  )
  returning id into allocation_id;

  if shared_offering.id is not null then
    update public.unit_offerings
    set
      is_provisionally_reserved = true,
      updated_at = now(),
      updated_by = auth.uid()
    where confirmed_shared_offering_id = shared_offering.id;
  else
    update public.unit_offerings
    set
      is_provisionally_reserved = true,
      updated_at = now(),
      updated_by = auth.uid()
    where id = offering.id;
  end if;

  return jsonb_build_object(
    'allocationId', allocation_id,
    'included', true,
    'alreadyIncluded', false,
    'fixedPlacement', offering.fixed_schedule_required
  );
end;
$$;

revoke all on function public.reserve_unit_offering_without_trainer(uuid) from public;
grant execute on function public.reserve_unit_offering_without_trainer(uuid) to authenticated;

-- 3. Restrict include_all_unassigned_unit_offerings to approved, included offerings
create or replace function public.include_all_unassigned_unit_offerings(
  p_academic_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  candidate record;
  included_allocation_count integer := 0;
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before including unassigned units';
  end if;

  if not exists (
    select 1
    from public.academic_periods period
    where period.id = p_academic_period_id
      and period.status in ('planned', 'active')
  ) then
    raise exception 'Select a planned or active Academic Period';
  end if;

  for candidate in
    select offering.id
    from public.unit_offerings offering
    join public.cohorts cohort on cohort.id = offering.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where offering.academic_period_id = p_academic_period_id
      and programme.department_id = active_department
      and offering.approval_status = 'approved'
      and offering.selection_state = 'included'
      and offering.is_timetable_enabled = true
      and offering.allocation_status = 'unallocated'
      and not exists (
        select 1
        from public.teaching_allocations allocation
        where allocation.academic_period_id = offering.academic_period_id
          and allocation.status in ('draft', 'active')
          and (
            allocation.source_unit_offering_id = offering.id
            or (
              offering.confirmed_shared_offering_id is not null
              and allocation.teaching_offering_id = offering.confirmed_shared_offering_id
            )
            or (
              allocation.cohort_id = offering.cohort_id
              and allocation.unit_id = offering.unit_id
            )
          )
      )
      and (
        offering.confirmed_shared_offering_id is null
        or offering.id = (
          select min(member.id::text)::uuid
          from public.unit_offerings member
          where member.confirmed_shared_offering_id = offering.confirmed_shared_offering_id
            and member.allocation_status = 'unallocated'
            and member.approval_status = 'approved'
            and member.selection_state = 'included'
        )
      )
    order by offering.id
  loop
    perform public.reserve_unit_offering_without_trainer(candidate.id);
    included_allocation_count := included_allocation_count + 1;
  end loop;

  return jsonb_build_object(
    'includedAllocationCount', included_allocation_count
  );
end;
$$;

revoke all on function public.include_all_unassigned_unit_offerings(uuid) from public;
grant execute on function public.include_all_unassigned_unit_offerings(uuid) to authenticated;

-- 4. Update assign_unit_offering_authoritatively to handle reserved placeholder session clashes gracefully
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
  v_reschedule_needed boolean := false;
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

  select candidate.* into allocation
  from public.teaching_allocations candidate
  where candidate.status in ('draft', 'active')
    and (
      candidate.source_unit_offering_id = offering.id
      or (
        offering.confirmed_shared_offering_id is not null
        and candidate.teaching_offering_id = offering.confirmed_shared_offering_id
      )
      or (
        candidate.source_unit_offering_id is null
        and candidate.teaching_offering_id is null
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

  if allocation.id is not null and allocation.trainer_id is not null then
    if allocation.trainer_id = trainer.id then
      return jsonb_build_object(
        'allocationId', allocation.id,
        'trainerId', trainer.id,
        'sourceUnitOfferingId', offering.id,
        'alreadyAssigned', true
      );
    end if;

    raise exception 'This unit is already assigned to another trainer';
  end if;

  if not coalesce(offering.is_provisionally_reserved, false)
    and allocation.id is null then
    assignment_result := public.assign_unit_offering(p_offering_id, p_trainer_id);
    new_allocation_id := (assignment_result ->> 'allocationId')::uuid;

    update public.teaching_allocations
    set source_unit_offering_id = offering.id,
        updated_at = now(),
        updated_by = auth.uid()
    where id = new_allocation_id;

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
      source_unit_offering_id = coalesce(source_unit_offering_id, offering.id),
      status = 'active',
      updated_at = now(),
      updated_by = auth.uid()
  where id = allocation.id;

  -- Try attaching the newly assigned trainer onto any pre-reserved draft slots.
  -- If the temporary placeholder slot violates this trainer's availability or clashes
  -- with another session, clear the stale placeholder so incremental generation re-places it.
  begin
    update public.scheduled_sessions
    set trainer_id = trainer.id,
        conflict_state = 'unchecked',
        updated_at = now(),
        updated_by = auth.uid()
    where teaching_allocation_id = allocation.id
      and trainer_id is null
      and status in ('draft', 'confirmed');
  exception
    when others then
      delete from public.scheduled_sessions
      where teaching_allocation_id = allocation.id
        and trainer_id is null
        and is_locked = false
        and status in ('draft', 'confirmed');
      v_reschedule_needed := true;
  end;

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
    'wasReserved', true,
    'rescheduleRequired', v_reschedule_needed
  );
end;
$$;

revoke all on function public.assign_unit_offering_authoritatively(uuid, uuid) from public;
grant execute on function public.assign_unit_offering_authoritatively(uuid, uuid) to authenticated;

commit;
