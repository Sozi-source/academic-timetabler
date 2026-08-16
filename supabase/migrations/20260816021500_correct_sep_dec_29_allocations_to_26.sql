-- Correct allocations entered under SEP-DEC-29 that were intended for
-- SEP-DEC-26. Source allocations and any source draft sessions are archived
-- for audit; corrected allocations are created or reconciled in SEP-DEC-26.

do $migration$
declare
  source_period_id uuid;
  target_period_id uuid;
  source_allocation public.teaching_allocations%rowtype;
  target_allocation public.teaching_allocations%rowtype;
  target_offering public.unit_offerings%rowtype;
  target_allocation_id uuid;
  target_teaching_offering_id uuid;
  conflicting_allocation_count integer := 0;
  corrected_allocation_count integer := 0;
begin
  select period.id
  into source_period_id
  from public.academic_periods period
  where upper(trim(period.code)) = 'SEP-DEC-29';

  select period.id
  into target_period_id
  from public.academic_periods period
  where upper(trim(period.code)) = 'SEP-DEC-26';

  if source_period_id is null then
    raise exception 'Academic Period SEP-DEC-29 was not found';
  end if;

  if target_period_id is null then
    raise exception 'Academic Period SEP-DEC-26 was not found';
  end if;

  if source_period_id = target_period_id then
    raise exception 'The source and target Academic Periods must be different';
  end if;

  if not exists (
    select 1
    from public.teaching_allocations allocation
    where allocation.academic_period_id = source_period_id
      and allocation.status in ('draft', 'active')
  ) then
    raise notice 'No current SEP-DEC-29 allocations require correction';
    return;
  end if;

  -- Never silently replace a different trainer already confirmed in 2026.
  select count(*)
  into conflicting_allocation_count
  from public.teaching_allocations source_row
  join public.teaching_allocations existing_target
    on existing_target.academic_period_id = target_period_id
   and existing_target.cohort_id = source_row.cohort_id
   and existing_target.unit_id = source_row.unit_id
   and existing_target.status in ('draft', 'active', 'suspended')
  where source_row.academic_period_id = source_period_id
    and source_row.status in ('draft', 'active')
    and source_row.trainer_id is not null
    and existing_target.trainer_id is not null
    and existing_target.trainer_id <> source_row.trainer_id;

  if conflicting_allocation_count > 0 then
    raise exception
      'The correction stopped because % SEP-DEC-26 allocation(s) already use a different trainer',
      conflicting_allocation_count;
  end if;

  perform public.initialize_standard_timetable_calendar(target_period_id);

  create temporary table correction_day_map (
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;

  insert into correction_day_map (source_id, target_id)
  select source_day.id, target_day.id
  from public.working_days source_day
  join public.working_days target_day
    on target_day.academic_period_id = target_period_id
   and target_day.day_of_week = source_day.day_of_week
  where source_day.academic_period_id = source_period_id;

  create temporary table correction_slot_map (
    source_id uuid primary key,
    target_id uuid not null
  ) on commit drop;

  insert into correction_slot_map (source_id, target_id)
  select source_slot.id, matched_target.id
  from public.time_slots source_slot
  cross join lateral (
    select target_slot.id
    from public.time_slots target_slot
    where target_slot.academic_period_id = target_period_id
      and target_slot.slot_type = source_slot.slot_type
    order by
      (target_slot.code = source_slot.code) desc,
      (
        target_slot.starts_at = source_slot.starts_at
        and target_slot.ends_at = source_slot.ends_at
      ) desc,
      (target_slot.sequence_number = source_slot.sequence_number) desc,
      target_slot.sequence_number,
      target_slot.id
    limit 1
  ) matched_target
  where source_slot.academic_period_id = source_period_id;

  if exists (
    select 1
    from public.unit_offerings source_offering
    join public.teaching_allocations allocation
      on allocation.academic_period_id = source_offering.academic_period_id
     and allocation.cohort_id = source_offering.cohort_id
     and allocation.unit_id = source_offering.unit_id
     and allocation.status in ('draft', 'active')
    where source_offering.academic_period_id = source_period_id
      and source_offering.fixed_schedule_required
      and (
        not exists (
          select 1 from correction_day_map day_map
          where day_map.source_id = source_offering.fixed_working_day_id
        )
        or not exists (
          select 1 from correction_slot_map slot_map
          where slot_map.source_id = source_offering.fixed_time_slot_id
        )
      )
  ) then
    raise exception
      'The SEP-DEC-26 calendar does not contain every fixed day and session required by the source allocations';
  end if;

  -- Copy selected-slot trainer availability to equivalent 2026 periods.
  insert into public.trainer_availability (
    trainer_id,
    academic_period_id,
    working_day_id,
    time_slot_id,
    created_by
  )
  select
    availability.trainer_id,
    target_period_id,
    day_map.target_id,
    slot_map.target_id,
    availability.created_by
  from public.trainer_availability availability
  join correction_day_map day_map
    on day_map.source_id = availability.working_day_id
  join correction_slot_map slot_map
    on slot_map.source_id = availability.time_slot_id
  where availability.academic_period_id = source_period_id
  on conflict (
    trainer_id,
    academic_period_id,
    working_day_id,
    time_slot_id
  ) do nothing;

  -- Create or refresh the corresponding 2026 Units on Offer, including fixed
  -- timetable rules. Shared-class links are mapped in the next step.
  insert into public.unit_offerings (
    academic_period_id,
    cohort_id,
    unit_id,
    offering_type,
    status,
    is_timetable_enabled,
    weekly_sessions,
    session_duration_minutes,
    delivery_notes,
    source,
    origin,
    selection_state,
    recommended_stage_number,
    exception_reason,
    manually_reviewed,
    allocation_status,
    fixed_working_day_id,
    fixed_time_slot_id,
    fixed_schedule_required,
    is_provisionally_reserved,
    is_full_day_session,
    full_day_end_time_slot_id
  )
  select distinct
    target_period_id,
    source_offering.cohort_id,
    source_offering.unit_id,
    source_offering.offering_type,
    source_offering.status,
    true,
    source_offering.weekly_sessions,
    source_offering.session_duration_minutes,
    source_offering.delivery_notes,
    'period_correction_sep_dec_29',
    source_offering.origin,
    'included'::public.unit_offering_selection_state,
    source_offering.recommended_stage_number,
    case
      when source_offering.origin = 'curriculum'
        then source_offering.exception_reason
      else coalesce(
        source_offering.exception_reason,
        'Academic Period corrected from SEP-DEC-29 to SEP-DEC-26'
      )
    end,
    false,
    source_offering.allocation_status,
    day_map.target_id,
    slot_map.target_id,
    source_offering.fixed_schedule_required,
    source_offering.is_provisionally_reserved,
    source_offering.is_full_day_session,
    end_slot_map.target_id
  from public.unit_offerings source_offering
  join public.teaching_allocations allocation
    on allocation.academic_period_id = source_offering.academic_period_id
   and allocation.cohort_id = source_offering.cohort_id
   and allocation.unit_id = source_offering.unit_id
   and allocation.status in ('draft', 'active')
  left join correction_day_map day_map
    on day_map.source_id = source_offering.fixed_working_day_id
  left join correction_slot_map slot_map
    on slot_map.source_id = source_offering.fixed_time_slot_id
  left join correction_slot_map end_slot_map
    on end_slot_map.source_id = source_offering.full_day_end_time_slot_id
  where source_offering.academic_period_id = source_period_id
  on conflict (academic_period_id, cohort_id, unit_id)
  do update set
    offering_type = excluded.offering_type,
    status = excluded.status,
    is_timetable_enabled = true,
    weekly_sessions = excluded.weekly_sessions,
    session_duration_minutes = excluded.session_duration_minutes,
    delivery_notes = excluded.delivery_notes,
    allocation_status = excluded.allocation_status,
    fixed_working_day_id = excluded.fixed_working_day_id,
    fixed_time_slot_id = excluded.fixed_time_slot_id,
    fixed_schedule_required = excluded.fixed_schedule_required,
    is_provisionally_reserved = excluded.is_provisionally_reserved,
    is_full_day_session = excluded.is_full_day_session,
    full_day_end_time_slot_id = excluded.full_day_end_time_slot_id,
    updated_at = now();

  -- Copy the ordered fixed-session pattern to the target Units on Offer.
  delete from public.unit_offering_fixed_slots target_fixed
  using public.unit_offerings target_unit,
        public.unit_offerings source_unit
  where target_fixed.unit_offering_id = target_unit.id
    and target_unit.academic_period_id = target_period_id
    and source_unit.academic_period_id = source_period_id
    and source_unit.cohort_id = target_unit.cohort_id
    and source_unit.unit_id = target_unit.unit_id
    and exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = source_period_id
        and allocation.cohort_id = source_unit.cohort_id
        and allocation.unit_id = source_unit.unit_id
        and allocation.status in ('draft', 'active')
    );

  insert into public.unit_offering_fixed_slots (
    unit_offering_id,
    working_day_id,
    time_slot_id,
    sequence_number,
    created_by
  )
  select
    target_unit.id,
    day_map.target_id,
    slot_map.target_id,
    source_fixed.sequence_number,
    source_fixed.created_by
  from public.unit_offering_fixed_slots source_fixed
  join public.unit_offerings source_unit
    on source_unit.id = source_fixed.unit_offering_id
   and source_unit.academic_period_id = source_period_id
  join public.unit_offerings target_unit
    on target_unit.academic_period_id = target_period_id
   and target_unit.cohort_id = source_unit.cohort_id
   and target_unit.unit_id = source_unit.unit_id
  join correction_day_map day_map
    on day_map.source_id = source_fixed.working_day_id
  join correction_slot_map slot_map
    on slot_map.source_id = source_fixed.time_slot_id
  where exists (
    select 1
    from public.teaching_allocations allocation
    where allocation.academic_period_id = source_period_id
      and allocation.cohort_id = source_unit.cohort_id
      and allocation.unit_id = source_unit.unit_id
      and allocation.status in ('draft', 'active')
  )
  on conflict (unit_offering_id, sequence_number)
  do update set
    working_day_id = excluded.working_day_id,
    time_slot_id = excluded.time_slot_id;

  -- Reconnect corrected shared Units on Offer to the equivalent 2026 teaching
  -- offering. Participant count is used to prefer the matching shared class.
  update public.unit_offerings target_unit
  set
    confirmed_shared_offering_id = matched_target.id,
    updated_at = now()
  from public.unit_offerings source_unit
  cross join lateral (
    select target_shared.id
    from public.teaching_offerings target_shared
    join public.teaching_offering_participants target_participant
      on target_participant.teaching_offering_id = target_shared.id
    where target_shared.academic_period_id = target_period_id
      and target_participant.cohort_id = source_unit.cohort_id
      and target_participant.unit_id = source_unit.unit_id
    order by
      (
        target_shared.normalized_title = (
          select source_shared.normalized_title
          from public.teaching_offerings source_shared
          where source_shared.id = source_unit.confirmed_shared_offering_id
        )
      ) desc,
      (
        select count(*)
        from public.teaching_offering_participants member
        where member.teaching_offering_id = target_shared.id
      ) desc,
      target_shared.created_at,
      target_shared.id
    limit 1
  ) matched_target
  where target_unit.academic_period_id = target_period_id
    and source_unit.academic_period_id = source_period_id
    and source_unit.cohort_id = target_unit.cohort_id
    and source_unit.unit_id = target_unit.unit_id
    and source_unit.confirmed_shared_offering_id is not null
    and exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = source_period_id
        and allocation.cohort_id = source_unit.cohort_id
        and allocation.unit_id = source_unit.unit_id
        and allocation.status in ('draft', 'active')
    );

  -- Archive any generated timetable rows under the erroneous period. The
  -- corrected 2026 timetable can then be generated from the copied allocation.
  update public.scheduled_sessions session
  set
    status = 'archived',
    is_locked = false,
    notes = left(concat_ws(
      ' ',
      nullif(trim(session.notes), ''),
      'Archived because the allocation Academic Period was corrected to SEP-DEC-26.'
    ), 1000),
    updated_at = now(),
    updated_by = auth.uid()
  where session.academic_period_id = source_period_id
    and session.teaching_allocation_id in (
      select allocation.id
      from public.teaching_allocations allocation
      where allocation.academic_period_id = source_period_id
        and allocation.status in ('draft', 'active')
    )
    and session.status not in ('cancelled', 'archived');

  for source_allocation in
    select allocation.*
    from public.teaching_allocations allocation
    where allocation.academic_period_id = source_period_id
      and allocation.status in ('draft', 'active')
    order by allocation.created_at, allocation.id
  loop
    select unit_offering.*
    into target_offering
    from public.unit_offerings unit_offering
    where unit_offering.academic_period_id = target_period_id
      and unit_offering.cohort_id = source_allocation.cohort_id
      and unit_offering.unit_id = source_allocation.unit_id;

    if target_offering.id is null then
      raise exception
        'No SEP-DEC-26 Unit on Offer was created for allocation %',
        source_allocation.id;
    end if;

    target_teaching_offering_id := target_offering.confirmed_shared_offering_id;

    select allocation.*
    into target_allocation
    from public.teaching_allocations allocation
    where allocation.academic_period_id = target_period_id
      and allocation.cohort_id = source_allocation.cohort_id
      and allocation.unit_id = source_allocation.unit_id
      and allocation.status in ('draft', 'active', 'suspended')
    order by
      (allocation.trainer_id is not null) desc,
      allocation.created_at desc,
      allocation.id
    limit 1
    for update;

    if target_allocation.id is null then
      insert into public.teaching_allocations (
        academic_period_id,
        cohort_id,
        unit_id,
        trainer_id,
        preferred_room_id,
        delivery_mode,
        weekly_sessions,
        session_duration_minutes,
        status,
        is_timetable_enabled,
        notes,
        teaching_offering_id,
        participant_cohort_ids,
        combined_cohort_size,
        created_by,
        updated_by
      ) values (
        target_period_id,
        source_allocation.cohort_id,
        source_allocation.unit_id,
        source_allocation.trainer_id,
        source_allocation.preferred_room_id,
        source_allocation.delivery_mode,
        source_allocation.weekly_sessions,
        source_allocation.session_duration_minutes,
        case
          when source_allocation.trainer_id is null
            then 'draft'::public.teaching_allocation_status
          else 'active'::public.teaching_allocation_status
        end,
        true,
        left(concat_ws(
          ' ',
          nullif(trim(source_allocation.notes), ''),
          'Academic Period corrected from SEP-DEC-29 to SEP-DEC-26.'
        ), 1500),
        target_teaching_offering_id,
        source_allocation.participant_cohort_ids,
        source_allocation.combined_cohort_size,
        source_allocation.created_by,
        auth.uid()
      )
      returning id into target_allocation_id;
    else
      update public.teaching_allocations allocation
      set
        trainer_id = coalesce(
          source_allocation.trainer_id,
          allocation.trainer_id
        ),
        preferred_room_id = coalesce(
          source_allocation.preferred_room_id,
          allocation.preferred_room_id
        ),
        delivery_mode = source_allocation.delivery_mode,
        weekly_sessions = source_allocation.weekly_sessions,
        session_duration_minutes = source_allocation.session_duration_minutes,
        status = case
          when coalesce(
            source_allocation.trainer_id,
            allocation.trainer_id
          ) is null
            then 'draft'::public.teaching_allocation_status
          else 'active'::public.teaching_allocation_status
        end,
        is_timetable_enabled = true,
        teaching_offering_id = coalesce(
          target_teaching_offering_id,
          allocation.teaching_offering_id
        ),
        participant_cohort_ids = case
          when cardinality(source_allocation.participant_cohort_ids) > 0
            then source_allocation.participant_cohort_ids
          else allocation.participant_cohort_ids
        end,
        combined_cohort_size = greatest(
          source_allocation.combined_cohort_size,
          allocation.combined_cohort_size
        ),
        notes = left(concat_ws(
          ' ',
          nullif(trim(allocation.notes), ''),
          'Reconciled with the SEP-DEC-29 allocation entered for SEP-DEC-26.'
        ), 1500),
        updated_at = now(),
        updated_by = auth.uid()
      where allocation.id = target_allocation.id
      returning allocation.id into target_allocation_id;
    end if;

    update public.teaching_allocations allocation
    set
      status = 'archived',
      is_timetable_enabled = false,
      notes = left(concat_ws(
        ' ',
        nullif(trim(allocation.notes), ''),
        'Archived after correction to SEP-DEC-26 allocation '
          || target_allocation_id::text || '.'
      ), 1500),
      updated_at = now(),
      updated_by = auth.uid()
    where allocation.id = source_allocation.id;

    corrected_allocation_count := corrected_allocation_count + 1;
  end loop;

  update public.unit_offerings target_unit
  set
    allocation_status = 'allocated',
    is_provisionally_reserved = false,
    status = 'active',
    updated_at = now(),
    updated_by = auth.uid()
  where target_unit.academic_period_id = target_period_id
    and exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = target_period_id
        and allocation.status in ('draft', 'active')
        and allocation.trainer_id is not null
        and (
          allocation.teaching_offering_id =
            target_unit.confirmed_shared_offering_id
          or (
            allocation.cohort_id = target_unit.cohort_id
            and allocation.unit_id = target_unit.unit_id
          )
        )
    );

  update public.unit_offerings target_unit
  set
    allocation_status = 'unallocated',
    is_provisionally_reserved = true,
    status = 'draft',
    updated_at = now(),
    updated_by = auth.uid()
  where target_unit.academic_period_id = target_period_id
    and not exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = target_period_id
        and allocation.status in ('draft', 'active')
        and allocation.trainer_id is not null
        and (
          allocation.teaching_offering_id =
            target_unit.confirmed_shared_offering_id
          or (
            allocation.cohort_id = target_unit.cohort_id
            and allocation.unit_id = target_unit.unit_id
          )
        )
    )
    and exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = target_period_id
        and allocation.status in ('draft', 'active')
        and allocation.trainer_id is null
        and (
          allocation.teaching_offering_id =
            target_unit.confirmed_shared_offering_id
          or (
            allocation.cohort_id = target_unit.cohort_id
            and allocation.unit_id = target_unit.unit_id
          )
        )
    );

  -- Synchronize the target teaching-offering compatibility fields so both the
  -- readiness dashboard and allocation register show the corrected trainer.
  update public.teaching_offerings offering
  set
    trainer_id = (
      select allocation.trainer_id
      from public.teaching_offering_participants participant
      join public.teaching_allocations allocation
        on allocation.academic_period_id = target_period_id
       and allocation.status in ('draft', 'active')
       and allocation.trainer_id is not null
       and (
         allocation.teaching_offering_id = offering.id
         or (
           allocation.cohort_id = participant.cohort_id
           and allocation.unit_id = participant.unit_id
         )
       )
      where participant.teaching_offering_id = offering.id
      order by
        (allocation.teaching_offering_id = offering.id) desc,
        allocation.updated_at desc,
        allocation.id
      limit 1
    ),
    status = 'active',
    updated_at = now(),
    updated_by = auth.uid()
  where offering.academic_period_id = target_period_id
    and exists (
      select 1
      from public.teaching_offering_participants participant
      join public.teaching_allocations allocation
        on allocation.academic_period_id = target_period_id
       and allocation.status in ('draft', 'active')
       and allocation.trainer_id is not null
       and (
         allocation.teaching_offering_id = offering.id
         or (
           allocation.cohort_id = participant.cohort_id
           and allocation.unit_id = participant.unit_id
         )
       )
      where participant.teaching_offering_id = offering.id
    );

  update public.unit_offerings source_unit
  set
    allocation_status = 'unallocated',
    is_provisionally_reserved = false,
    status = 'draft',
    updated_at = now(),
    updated_by = auth.uid()
  where source_unit.academic_period_id = source_period_id
    and not exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = source_period_id
        and allocation.cohort_id = source_unit.cohort_id
        and allocation.unit_id = source_unit.unit_id
        and allocation.status in ('draft', 'active')
    );

  update public.teaching_offerings source_offering
  set
    trainer_id = null,
    status = 'draft',
    updated_at = now(),
    updated_by = auth.uid()
  where source_offering.academic_period_id = source_period_id
    and source_offering.trainer_id is not null
    and not exists (
      select 1
      from public.teaching_allocations allocation
      where allocation.academic_period_id = source_period_id
        and allocation.teaching_offering_id = source_offering.id
        and allocation.status in ('draft', 'active')
    );

  raise notice
    'Corrected % allocation(s) from SEP-DEC-29 to SEP-DEC-26',
    corrected_allocation_count;
end;
$migration$;
