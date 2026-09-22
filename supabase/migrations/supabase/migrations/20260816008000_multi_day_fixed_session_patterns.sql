-- A multi-session unit may have a different fixed day for each weekly
-- session, for example ICT on Monday morning and Wednesday morning.

alter table public.teaching_allocations
  add column if not exists fixed_working_day_ids uuid[]
    not null default '{}'::uuid[];

alter table public.unit_offering_fixed_slots
  drop constraint if exists unit_offering_fixed_slots_unit_offering_id_time_slot_id_key;

alter table public.unit_offering_fixed_slots
  add constraint unit_offering_fixed_slots_offering_day_slot_unique
  unique (unit_offering_id, working_day_id, time_slot_id);

update public.teaching_allocations allocation
set fixed_working_day_ids = array_fill(
  allocation.fixed_working_day_id,
  array[cardinality(allocation.fixed_time_slot_ids)]
)
where allocation.fixed_working_day_id is not null
  and cardinality(allocation.fixed_time_slot_ids) > 0
  and cardinality(allocation.fixed_working_day_ids) = 0;

alter table public.teaching_allocations
  drop constraint if exists teaching_allocations_fixed_slots_check;

alter table public.teaching_allocations
  add constraint teaching_allocations_fixed_slots_check
  check (
    (
      fixed_working_day_id is null
      and cardinality(fixed_working_day_ids) = 0
      and cardinality(fixed_time_slot_ids) = 0
      and fixed_end_time_slot_id is null
      and is_full_day_session = false
    )
    or (
      fixed_working_day_id is not null
      and fixed_working_day_id = fixed_working_day_ids[1]
      and is_full_day_session = false
      and fixed_end_time_slot_id is null
      and cardinality(fixed_working_day_ids) = cardinality(fixed_time_slot_ids)
      and cardinality(fixed_time_slot_ids) between 1 and weekly_sessions
    )
    or (
      fixed_working_day_id is not null
      and fixed_working_day_id = fixed_working_day_ids[1]
      and is_full_day_session = true
      and fixed_end_time_slot_id is not null
      and cardinality(fixed_working_day_ids) = 1
      and cardinality(fixed_time_slot_ids) = 1
      and weekly_sessions = 1
      and session_duration_minutes = 480
    )
  );

create or replace function public.set_unit_offering_fixed_session_pattern(
  p_offering_id uuid,
  p_working_day_ids uuid[],
  p_time_slot_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  offering public.unit_offerings%rowtype;
  selected_session_count integer;
  matched_session_count integer;
  first_teaching_sequence bigint;
  second_teaching_sequence bigint;
  target_offering_ids uuid[];
begin
  if auth.uid() is null
    or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using
      errcode = '42501',
      message = 'Select an authorized working department first';
  end if;

  select unit_offering.*
  into offering
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
    raise exception 'Change the fixed sessions before assigning the trainer';
  end if;

  selected_session_count := coalesce(cardinality(p_time_slot_ids), 0);

  if selected_session_count = 0
    or cardinality(p_working_day_ids) <> selected_session_count then
    raise exception 'Select a day and teaching period for every fixed session';
  end if;

  if selected_session_count > coalesce(offering.weekly_sessions, 1) then
    raise exception
      'This unit requires only % session(s) per week',
      coalesce(offering.weekly_sessions, 1);
  end if;

  if (
    select count(*)
    from (
      select distinct requested.working_day_id, requested.time_slot_id
      from unnest(p_working_day_ids, p_time_slot_ids)
        requested(working_day_id, time_slot_id)
    ) distinct_pattern
  ) <> selected_session_count then
    raise exception 'Choose a different day or teaching period for each session';
  end if;

  select count(*)
  into matched_session_count
  from unnest(p_working_day_ids, p_time_slot_ids)
    requested(working_day_id, time_slot_id)
  join public.working_days working_day
    on working_day.id = requested.working_day_id
   and working_day.academic_period_id = offering.academic_period_id
   and working_day.is_enabled = true
  join public.time_slots time_slot
    on time_slot.id = requested.time_slot_id
   and time_slot.academic_period_id = offering.academic_period_id
   and time_slot.is_enabled = true
   and time_slot.slot_type = 'teaching'
   and extract(epoch from (time_slot.ends_at - time_slot.starts_at)) / 60
     = coalesce(offering.session_duration_minutes, 120);

  if matched_session_count <> selected_session_count then
    raise exception
      'Select enabled days and teaching sessions matching the unit duration';
  end if;

  if selected_session_count = 2
    and p_working_day_ids[1] = p_working_day_ids[2] then
    with ranked_teaching_slots as (
      select
        time_slot.id,
        row_number() over (
          order by time_slot.sequence_number, time_slot.id
        ) as teaching_sequence
      from public.time_slots time_slot
      where time_slot.academic_period_id = offering.academic_period_id
        and time_slot.is_enabled = true
        and time_slot.slot_type = 'teaching'
    )
    select
      max(ranked_slot.teaching_sequence)
        filter (where ranked_slot.id = p_time_slot_ids[1]),
      max(ranked_slot.teaching_sequence)
        filter (where ranked_slot.id = p_time_slot_ids[2])
    into first_teaching_sequence, second_teaching_sequence
    from ranked_teaching_slots ranked_slot;

    if second_teaching_sequence <> first_teaching_sequence + 1 then
      raise exception
        'On the same day, the second session must be the next teaching period';
    end if;
  end if;

  if offering.confirmed_shared_offering_id is null then
    target_offering_ids := array[offering.id];
  else
    select array_agg(member.id order by member.id)
    into target_offering_ids
    from public.unit_offerings member
    where member.confirmed_shared_offering_id = offering.confirmed_shared_offering_id
      and member.allocation_status = 'unallocated';
  end if;

  if coalesce(cardinality(target_offering_ids), 0) = 0 then
    raise exception 'No unallocated unit offerings are available for this fixed pattern';
  end if;

  delete from public.unit_offering_fixed_slots fixed_setting
  where fixed_setting.unit_offering_id = any(target_offering_ids);

  insert into public.unit_offering_fixed_slots (
    unit_offering_id,
    working_day_id,
    time_slot_id,
    sequence_number,
    created_by
  )
  select
    target_offering.id,
    requested.working_day_id,
    requested.time_slot_id,
    requested.position::smallint,
    auth.uid()
  from unnest(target_offering_ids) target_offering(id)
  cross join unnest(p_working_day_ids, p_time_slot_ids)
    with ordinality requested(working_day_id, time_slot_id, position);

  update public.unit_offerings member
  set
    fixed_schedule_required = true,
    fixed_working_day_id = p_working_day_ids[1],
    fixed_time_slot_id = p_time_slot_ids[1],
    is_full_day_session = false,
    full_day_end_time_slot_id = null,
    updated_at = now(),
    updated_by = auth.uid()
  where member.id = any(target_offering_ids);
end;
$$;

revoke all
on function public.set_unit_offering_fixed_session_pattern(uuid, uuid[], uuid[])
from public;

grant execute
on function public.set_unit_offering_fixed_session_pattern(uuid, uuid[], uuid[])
to authenticated;

create or replace function public.set_allocation_fixed_session_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_offering public.unit_offerings%rowtype;
  required_days uuid[] := '{}'::uuid[];
  required_slots uuid[] := '{}'::uuid[];
  allocation_days uuid[] := '{}'::uuid[];
  allocation_slots uuid[] := '{}'::uuid[];
  trainer_availability_mode text;
begin
  select offering.*
  into source_offering
  from public.unit_offerings offering
  where offering.academic_period_id = new.academic_period_id
    and offering.cohort_id = new.cohort_id
    and offering.unit_id = new.unit_id
  limit 1;

  if source_offering.id is null
    or not source_offering.fixed_schedule_required then
    new.fixed_working_day_id := null;
    new.fixed_working_day_ids := '{}'::uuid[];
    new.fixed_time_slot_ids := '{}'::uuid[];
    new.is_full_day_session := false;
    new.fixed_end_time_slot_id := null;
    return new;
  end if;

  select
    coalesce(
      array_agg(
        fixed_setting.working_day_id
        order by fixed_setting.sequence_number
      ),
      '{}'::uuid[]
    ),
    coalesce(
      array_agg(
        fixed_setting.time_slot_id
        order by fixed_setting.sequence_number
      ),
      '{}'::uuid[]
    )
  into required_days, required_slots
  from public.unit_offering_fixed_slots fixed_setting
  where fixed_setting.unit_offering_id = source_offering.id;

  if cardinality(required_slots) = 0
    and source_offering.fixed_time_slot_id is not null
    and source_offering.fixed_working_day_id is not null then
    required_days := array[source_offering.fixed_working_day_id];
    required_slots := array[source_offering.fixed_time_slot_id];
  end if;

  if cardinality(required_days) = 0
    or cardinality(required_days) <> cardinality(required_slots) then
    raise exception 'Set a valid day and teaching period for every fixed session';
  end if;

  if source_offering.is_full_day_session then
    if source_offering.full_day_end_time_slot_id is null then
      raise exception 'Save the complete 08:00–16:00 full-day schedule before allocating this unit';
    end if;

    allocation_days := array[required_days[1]];
    allocation_slots := array[required_slots[1]];
    new.weekly_sessions := 1;
    new.session_duration_minutes := 480;
    new.delivery_mode := 'clinical'::public.teaching_delivery_mode;
  else
    if cardinality(required_slots) > new.weekly_sessions then
      raise exception 'The fixed sessions exceed the required weekly sessions';
    end if;

    allocation_days := required_days;
    allocation_slots := required_slots;
  end if;

  select trainer.availability_mode
  into trainer_availability_mode
  from public.trainers trainer
  where trainer.id = new.trainer_id;

  if trainer_availability_mode = 'selected_slots_only'
    and exists (
      select 1
      from unnest(required_days, required_slots)
        required(working_day_id, time_slot_id)
      where not exists (
        select 1
        from public.trainer_availability availability
        where availability.trainer_id = new.trainer_id
          and availability.academic_period_id = new.academic_period_id
          and availability.working_day_id = required.working_day_id
          and availability.time_slot_id = required.time_slot_id
      )
    ) then
    raise exception 'The trainer must be available for every fixed teaching session';
  end if;

  new.fixed_working_day_id := allocation_days[1];
  new.fixed_working_day_ids := allocation_days;
  new.fixed_time_slot_ids := allocation_slots;
  new.is_full_day_session := source_offering.is_full_day_session;
  new.fixed_end_time_slot_id := case
    when source_offering.is_full_day_session
      then source_offering.full_day_end_time_slot_id
    else null
  end;
  return new;
end;
$$;

comment on column public.teaching_allocations.fixed_working_day_ids is
  'Ordered working days aligned with fixed_time_slot_ids for independently fixed weekly sessions.';

comment on function public.set_unit_offering_fixed_session_pattern(uuid, uuid[], uuid[]) is
  'Saves one or more ordered fixed day/session pairs, including patterns across different weekdays.';
