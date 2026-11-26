-- Consolidate unallocated draft teaching_allocations across confirmed shared classes
-- (so approving offerings then combining them never leaves duplicate unlinked drafts),
-- and harden assign_unit_offering_authoritatively / reserve_unit_offering_without_trainer
-- so assigning a trainer to a merged or unreserved offering never throws
-- "The exact trainer-pending allocation for this unit could not be found".

begin;

create or replace function public.sync_shared_class_draft_allocations(
  p_shared_offering_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  shared_offering public.teaching_offerings%rowtype;
  v_member_offering_ids uuid[];
  v_member_cohort_ids uuid[];
  v_lead_offering_id uuid;
  v_combined_size integer := 0;
  v_keeper_id uuid;
  v_duplicate_ids uuid[];
begin
  if p_shared_offering_id is null then
    return null;
  end if;

  select *
  into shared_offering
  from public.teaching_offerings
  where id = p_shared_offering_id
  for update;

  if shared_offering.id is null then
    return null;
  end if;

  select
    array_agg(member.id order by member.id),
    array_agg(distinct member.cohort_id order by member.cohort_id),
    (array_agg(member.id order by member.id))[1],
    coalesce(
      sum(
        case
          when coalesce(cohort.actual_size, 0) > 0 then cohort.actual_size
          else coalesce(cohort.planned_size, 0)
        end
      ),
      0
    )::integer
  into
    v_member_offering_ids,
    v_member_cohort_ids,
    v_lead_offering_id,
    v_combined_size
  from public.unit_offerings member
  join public.cohorts cohort
    on cohort.id = member.cohort_id
  where member.confirmed_shared_offering_id = p_shared_offering_id
    and member.approval_status = 'approved'
    and member.is_timetable_enabled = true
    and member.selection_state = 'included';

  if v_lead_offering_id is null or coalesce(cardinality(v_member_offering_ids), 0) = 0 then
    return null;
  end if;

  if exists (
    select 1
    from public.teaching_offering_participants participant
    left join public.unit_offerings member
      on member.id = participant.unit_offering_id
    where participant.teaching_offering_id = p_shared_offering_id
      and (
        member.id is null
        or member.approval_status <> 'approved'
        or not member.is_timetable_enabled
        or member.selection_state <> 'included'
      )
  ) then
    return null;
  end if;

  -- Lock matching allocations and check if an assigned trainer allocation already exists
  select candidate.id
  into v_keeper_id
  from public.teaching_allocations candidate
  where candidate.academic_period_id = shared_offering.academic_period_id
    and candidate.status in ('draft', 'active')
    and candidate.trainer_id is not null
    and (
      candidate.teaching_offering_id = p_shared_offering_id
      or candidate.source_unit_offering_id = any(v_member_offering_ids)
      or (
        candidate.teaching_offering_id is null
        and exists (
          select 1
          from public.unit_offerings member
          where member.id = any(v_member_offering_ids)
            and member.cohort_id = candidate.cohort_id
            and member.unit_id = candidate.unit_id
        )
      )
    )
  order by
    (candidate.teaching_offering_id = p_shared_offering_id) desc,
    candidate.created_at asc,
    candidate.id asc
  limit 1
  for update;

  if v_keeper_id is null then
    -- Pick one unassigned/draft allocation to become the single consolidated shared allocation
    select candidate.id
    into v_keeper_id
    from public.teaching_allocations candidate
    where candidate.academic_period_id = shared_offering.academic_period_id
      and candidate.status in ('draft', 'active', 'suspended')
      and candidate.trainer_id is null
      and (
        candidate.teaching_offering_id = p_shared_offering_id
        or candidate.source_unit_offering_id = any(v_member_offering_ids)
        or (
          candidate.teaching_offering_id is null
          and exists (
            select 1
            from public.unit_offerings member
            where member.id = any(v_member_offering_ids)
              and member.cohort_id = candidate.cohort_id
              and member.unit_id = candidate.unit_id
          )
        )
      )
    order by
      (candidate.teaching_offering_id = p_shared_offering_id) desc,
      (candidate.status in ('draft', 'active')) desc,
      (candidate.source_unit_offering_id = v_lead_offering_id) desc,
      candidate.created_at asc,
      candidate.id asc
    limit 1
    for update;
  end if;

  if v_keeper_id is null then
    return null;
  end if;

  select array_agg(candidate.id)
  into v_duplicate_ids
  from public.teaching_allocations candidate
  where candidate.id <> v_keeper_id
    and candidate.academic_period_id = shared_offering.academic_period_id
    and candidate.status in ('draft', 'active', 'suspended')
    and candidate.trainer_id is null
    and (
      candidate.teaching_offering_id = p_shared_offering_id
      or candidate.source_unit_offering_id = any(v_member_offering_ids)
      or (
        candidate.teaching_offering_id is null
        and exists (
          select 1
          from public.unit_offerings member
          where member.id = any(v_member_offering_ids)
            and member.cohort_id = candidate.cohort_id
            and member.unit_id = candidate.unit_id
        )
      )
    );

  if coalesce(cardinality(v_duplicate_ids), 0) > 0 then
    update public.scheduled_sessions
    set
      teaching_allocation_id = v_keeper_id,
      updated_at = now()
    where teaching_allocation_id = any(v_duplicate_ids);

    update public.teaching_allocations
    set
      status = 'archived',
      is_timetable_enabled = false,
      teaching_offering_id = null,
      notes = left(
        concat_ws(' ', nullif(trim(notes), ''), 'Consolidated into shared class allocation.'),
        1000
      ),
      updated_at = now()
    where id = any(v_duplicate_ids);
  end if;

  update public.teaching_allocations
  set
    teaching_offering_id = p_shared_offering_id,
    source_unit_offering_id = coalesce(source_unit_offering_id, v_lead_offering_id),
    participant_cohort_ids = v_member_cohort_ids,
    combined_cohort_size = v_combined_size,
    weekly_sessions = coalesce(shared_offering.weekly_sessions, weekly_sessions),
    session_duration_minutes = coalesce(shared_offering.session_duration_minutes, session_duration_minutes),
    is_timetable_enabled = true,
    status = case when status = 'suspended' then 'draft' else status end,
    updated_at = now()
  where id = v_keeper_id;

  return v_keeper_id;
end;
$$;

revoke all on function public.sync_shared_class_draft_allocations(uuid) from public;
grant execute on function public.sync_shared_class_draft_allocations(uuid) to authenticated;

-- Backfill: consolidate any unallocated shared draft allocations across planned/active periods
do $$
declare
  v_shared record;
begin
  for v_shared in
    select shared_offering.id
    from public.teaching_offerings shared_offering
    join public.academic_periods period
      on period.id = shared_offering.academic_period_id
    where period.status in ('planned', 'active')
    order by shared_offering.id
  loop
    perform public.sync_shared_class_draft_allocations(v_shared.id);
  end loop;
end;
$$;

-- Keep confirm_shared_unit_offerings in sync when merging offerings after approval
create or replace function public.confirm_shared_unit_offerings(
  p_offering_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_input_count integer;
  v_count integer;
  v_period_count integer;
  v_department_count integer;
  v_title_count integer;
  v_duration_count integer;
  v_existing_group_count integer;
  v_max_weekly_sessions smallint;
  v_session_duration smallint;
  v_period uuid;
  v_department uuid;
  v_title text;
  v_group uuid;
  v_key text;
  v_target_offering_ids uuid[];
begin
  if p_offering_ids is null or cardinality(p_offering_ids) < 2 then
    raise exception 'Select at least two matching units';
  end if;

  select
    count(*),
    count(distinct offering.confirmed_shared_offering_id),
    (
      array_agg(offering.confirmed_shared_offering_id)
      filter (where offering.confirmed_shared_offering_id is not null)
    )[1]
  into
    v_input_count,
    v_existing_group_count,
    v_group
  from public.unit_offerings offering
  where offering.id = any(p_offering_ids)
    and offering.allocation_status = 'unallocated';

  if v_input_count <> cardinality(p_offering_ids) then
    raise exception 'One or more selected units are unavailable or already allocated';
  end if;

  if v_existing_group_count > 1 then
    raise exception 'Units from two different confirmed shared classes cannot be merged';
  end if;

  if v_group is null then
    v_target_offering_ids := p_offering_ids;
  else
    select array_agg(offering.id order by offering.id)
    into v_target_offering_ids
    from public.unit_offerings offering
    where offering.confirmed_shared_offering_id = v_group
      or offering.id = any(p_offering_ids);
  end if;

  perform 1
  from public.unit_offerings offering
  where offering.id = any(v_target_offering_ids)
  order by offering.id
  for update;

  select
    count(*),
    count(distinct offering.academic_period_id),
    count(distinct programme.department_id),
    count(distinct public.canonical_shared_unit_title_for_unit(unit_record.id, unit_record.name)),
    count(distinct coalesce(offering.session_duration_minutes, 120)),
    max(coalesce(offering.weekly_sessions, unit_record.weekly_sessions, 1))::smallint,
    min(coalesce(offering.session_duration_minutes, 120))::smallint,
    (array_agg(offering.academic_period_id))[1],
    (array_agg(programme.department_id))[1],
    coalesce(
      max(
        (
          select group_row.canonical_name
          from public.unit_equivalence_members member
          join public.unit_equivalence_groups group_row
            on group_row.id = member.equivalence_group_id
          where member.unit_id = unit_record.id
            and member.status = 'approved'
            and group_row.status = 'active'
          limit 1
        )
      ),
      min(unit_record.name)
    )
  into
    v_count,
    v_period_count,
    v_department_count,
    v_title_count,
    v_duration_count,
    v_max_weekly_sessions,
    v_session_duration,
    v_period,
    v_department,
    v_title
  from public.unit_offerings offering
  join public.units unit_record on unit_record.id = offering.unit_id
  join public.cohorts cohort on cohort.id = offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(v_target_offering_ids)
    and offering.allocation_status = 'unallocated';

  if v_count <> cardinality(v_target_offering_ids) then
    raise exception 'Every shared-class member must still be unallocated';
  end if;
  if v_period_count <> 1 then
    raise exception 'Shared units must belong to the same Academic Period';
  end if;
  if v_department_count <> 1
    or not public.current_user_can_manage_department(v_department) then
    raise exception using
      errcode = '42501',
      message = 'Shared units must belong to your working department';
  end if;
  if v_title_count <> 1 then
    raise exception 'Only equivalent unit titles can be combined';
  end if;
  if v_duration_count <> 1 then
    raise exception 'Shared units must use the same session duration';
  end if;

  if v_group is not null and not exists (
    select 1
    from public.teaching_offerings shared_offering
    where shared_offering.id = v_group
      and shared_offering.academic_period_id = v_period
      and shared_offering.department_id = v_department
  ) then
    raise exception 'The existing shared class is unavailable in this department';
  end if;

  if exists (
    select 1
    from public.unit_offerings offering
    where offering.id = any(v_target_offering_ids)
      and offering.fixed_schedule_required
  ) and (
    exists (
      select 1
      from public.unit_offerings offering
      where offering.id = any(v_target_offering_ids)
        and not offering.fixed_schedule_required
    )
    or (
      select count(distinct concat(
        offering.fixed_working_day_id,
        ':',
        coalesce(
          (
            select string_agg(
              fixed_slot.time_slot_id::text,
              ',' order by fixed_slot.sequence_number
            )
            from public.unit_offering_fixed_slots fixed_slot
            where fixed_slot.unit_offering_id = offering.id
          ),
          offering.fixed_time_slot_id::text,
          ''
        )
      ))
      from public.unit_offerings offering
      where offering.id = any(v_target_offering_ids)
    ) <> 1
  ) then
    raise exception 'Fixed day and sessions must match for every shared unit';
  end if;

  if v_group is null then
    v_key := 'CONFIRMED-' || upper(substr(md5(array_to_string(
      (
        select array_agg(value order by value)
        from unnest(v_target_offering_ids) value
      ),
      ','
    )), 1, 20));

    insert into public.teaching_offerings (
      academic_period_id,
      department_id,
      title,
      shared_class_key,
      weekly_sessions,
      session_duration_minutes,
      status,
      is_timetable_enabled,
      notes
    ) values (
      v_period,
      v_department,
      v_title,
      v_key,
      v_max_weekly_sessions,
      v_session_duration,
      'draft',
      true,
      'HOD-confirmed shared class; highest weekly-session requirement applied'
    )
    returning id into v_group;
  else
    update public.teaching_offerings shared_offering
    set
      weekly_sessions = v_max_weekly_sessions,
      session_duration_minutes = v_session_duration,
      updated_at = now(),
      updated_by = auth.uid()
    where shared_offering.id = v_group;
  end if;

  insert into public.teaching_offering_participants (
    teaching_offering_id,
    cohort_id,
    unit_id,
    unit_offering_id,
    is_primary,
    notes
  )
  select
    v_group,
    offering.cohort_id,
    offering.unit_id,
    offering.id,
    not exists (
      select 1
      from public.teaching_offering_participants existing
      where existing.teaching_offering_id = v_group
    ) and row_number() over (order by offering.id) = 1,
    'Confirmed equivalent unit; weekly requirement reconciled to group maximum'
  from public.unit_offerings offering
  where offering.id = any(v_target_offering_ids)
    and not exists (
      select 1
      from public.teaching_offering_participants existing
      where existing.teaching_offering_id = v_group
        and existing.unit_offering_id = offering.id
    );

  update public.unit_offerings offering
  set
    weekly_sessions = v_max_weekly_sessions,
    session_duration_minutes = v_session_duration,
    confirmed_shared_offering_id = v_group,
    manually_reviewed = true,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    updated_at = now(),
    updated_by = auth.uid()
  where offering.id = any(v_target_offering_ids);

  perform public.sync_shared_class_draft_allocations(v_group);

  return v_group;
end;
$$;

revoke all on function public.confirm_shared_unit_offerings(uuid[]) from public;
grant execute on function public.confirm_shared_unit_offerings(uuid[]) to authenticated;

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

    allocation_id := public.sync_shared_class_draft_allocations(shared_offering.id);
  end if;

  if allocation_id is null then
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
  end if;

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
    case when offering.offering_type = 'practical'
      then 'practical'::public.teaching_delivery_mode
      else 'theory'::public.teaching_delivery_mode end,
    coalesce(shared_offering.weekly_sessions, offering.weekly_sessions, 1),
    coalesce(shared_offering.session_duration_minutes, offering.session_duration_minutes, 120),
    v_fixed_day_id,
    v_fixed_day_ids,
    v_fixed_slot_ids,
    v_is_full_day,
    v_end_slot_id,
    'draft',
    true,
    shared_offering.id,
    case when shared_offering.id is not null then (
      select array_agg(distinct member.cohort_id order by member.cohort_id)
      from public.unit_offerings member
      where member.confirmed_shared_offering_id = shared_offering.id
    ) else array[offering.cohort_id] end,
    case when shared_offering.id is not null then (
      select coalesce(sum(
        case when coalesce(cohort.actual_size, 0) > 0 then cohort.actual_size else coalesce(cohort.planned_size, 0) end
      ), 0)
      from public.unit_offerings member
      join public.cohorts cohort on cohort.id = member.cohort_id
      where member.confirmed_shared_offering_id = shared_offering.id
    ) else (
      select case when coalesce(cohort.actual_size, 0) > 0 then cohort.actual_size else coalesce(cohort.planned_size, 0) end
      from public.cohorts cohort
      where cohort.id = offering.cohort_id
    ) end,
    'Included in timetable as an unassigned placeholder; assign trainer before publication.'
  )
  on conflict (academic_period_id, cohort_id, unit_id) where status in ('draft', 'active', 'suspended')
  do update set
    source_unit_offering_id = excluded.source_unit_offering_id,
    teaching_offering_id = coalesce(excluded.teaching_offering_id, public.teaching_allocations.teaching_offering_id),
    participant_cohort_ids = coalesce(excluded.participant_cohort_ids, public.teaching_allocations.participant_cohort_ids),
    combined_cohort_size = coalesce(excluded.combined_cohort_size, public.teaching_allocations.combined_cohort_size),
    preferred_room_id = coalesce(excluded.preferred_room_id, public.teaching_allocations.preferred_room_id),
    fixed_working_day_id = coalesce(excluded.fixed_working_day_id, public.teaching_allocations.fixed_working_day_id),
    fixed_working_day_ids = case
      when cardinality(excluded.fixed_working_day_ids) > 0 then excluded.fixed_working_day_ids
      else public.teaching_allocations.fixed_working_day_ids
    end,
    fixed_time_slot_ids = case
      when cardinality(excluded.fixed_time_slot_ids) > 0 then excluded.fixed_time_slot_ids
      else public.teaching_allocations.fixed_time_slot_ids
    end,
    is_full_day_session = excluded.is_full_day_session,
    fixed_end_time_slot_id = coalesce(excluded.fixed_end_time_slot_id, public.teaching_allocations.fixed_end_time_slot_id),
    is_timetable_enabled = true,
    status = case
      when public.teaching_allocations.status = 'suspended' then 'draft'
      else public.teaching_allocations.status
    end,
    updated_at = now(),
    updated_by = auth.uid()
  returning id into allocation_id;

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
    'alreadyIncluded', false
  );
end;
$$;

revoke all on function public.reserve_unit_offering_without_trainer(uuid) from public;
grant execute on function public.reserve_unit_offering_without_trainer(uuid) to authenticated;

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

  if offering.confirmed_shared_offering_id is not null then
    perform public.sync_shared_class_draft_allocations(offering.confirmed_shared_offering_id);
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
        offering.confirmed_shared_offering_id is null
        and candidate.teaching_offering_id is null
        and candidate.academic_period_id = offering.academic_period_id
        and candidate.cohort_id = offering.cohort_id
        and candidate.unit_id = offering.unit_id
      )
    )
  order by
    (candidate.trainer_id is not null) desc,
    (candidate.teaching_offering_id = offering.confirmed_shared_offering_id) desc nulls last,
    (candidate.source_unit_offering_id = offering.id) desc,
    candidate.created_at asc,
    candidate.id asc
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

  -- If no unassigned allocation exists yet, delegate cleanly to assign_unit_offering
  if allocation.id is null then
    assignment_result := public.assign_unit_offering(p_offering_id, p_trainer_id);
    new_allocation_id := (assignment_result ->> 'allocationId')::uuid;

    if new_allocation_id is not null then
      update public.teaching_allocations
      set source_unit_offering_id = coalesce(source_unit_offering_id, offering.id),
          updated_at = now(),
          updated_by = auth.uid()
      where id = new_allocation_id;
    end if;

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
  end if;

  update public.teaching_allocations
  set trainer_id = trainer.id,
      source_unit_offering_id = coalesce(source_unit_offering_id, offering.id),
      teaching_offering_id = coalesce(offering.confirmed_shared_offering_id, teaching_offering_id),
      status = 'active',
      is_timetable_enabled = true,
      updated_at = now(),
      updated_by = auth.uid()
  where id = allocation.id;

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
