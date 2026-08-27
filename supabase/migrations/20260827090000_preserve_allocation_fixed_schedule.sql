-- Preserve the exact unit-offering source of an allocation. Previously the
-- fixed-session trigger inferred it with an unordered period/cohort/unit
-- lookup. A trainer-only update could therefore select a duplicate offering
-- and silently clear or replace the allocation's fixed timetable pattern.

alter table public.teaching_allocations
  add column if not exists source_unit_offering_id uuid
  references public.unit_offerings(id) on delete set null;

create index if not exists teaching_allocations_source_unit_offering_idx
  on public.teaching_allocations (source_unit_offering_id)
  where source_unit_offering_id is not null;

update public.teaching_allocations allocation
set source_unit_offering_id = coalesce(
  (
    select participant.unit_offering_id
    from public.teaching_offering_participants participant
    where participant.teaching_offering_id = allocation.teaching_offering_id
      and participant.cohort_id = allocation.cohort_id
      and participant.unit_id = allocation.unit_id
      and participant.unit_offering_id is not null
    order by participant.is_primary desc, participant.id
    limit 1
  ),
  (
    select offering.id
    from public.unit_offerings offering
    where offering.academic_period_id = allocation.academic_period_id
      and offering.cohort_id = allocation.cohort_id
      and offering.unit_id = allocation.unit_id
    order by
      offering.fixed_schedule_required desc,
      offering.is_provisionally_reserved desc,
      (offering.status = 'active') desc,
      offering.updated_at desc,
      offering.id
    limit 1
  )
)
where allocation.source_unit_offering_id is null;

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
  if new.source_unit_offering_id is not null then
    select offering.* into source_offering
    from public.unit_offerings offering
    where offering.id = new.source_unit_offering_id
      and offering.academic_period_id = new.academic_period_id
      and offering.cohort_id = new.cohort_id
      and offering.unit_id = new.unit_id;
  end if;

  if source_offering.id is null and new.teaching_offering_id is not null then
    select offering.* into source_offering
    from public.teaching_offering_participants participant
    join public.unit_offerings offering
      on offering.id = participant.unit_offering_id
    where participant.teaching_offering_id = new.teaching_offering_id
      and participant.cohort_id = new.cohort_id
      and participant.unit_id = new.unit_id
    order by participant.is_primary desc, participant.id
    limit 1;
  end if;

  if source_offering.id is null then
    select offering.* into source_offering
    from public.unit_offerings offering
    where offering.academic_period_id = new.academic_period_id
      and offering.cohort_id = new.cohort_id
      and offering.unit_id = new.unit_id
    order by
      offering.fixed_schedule_required desc,
      offering.is_provisionally_reserved desc,
      (offering.status = 'active') desc,
      offering.updated_at desc,
      offering.id
    limit 1;
  end if;

  new.source_unit_offering_id := source_offering.id;

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
    coalesce(array_agg(setting.working_day_id order by setting.sequence_number), '{}'::uuid[]),
    coalesce(array_agg(setting.time_slot_id order by setting.sequence_number), '{}'::uuid[])
  into required_days, required_slots
  from public.unit_offering_fixed_slots setting
  where setting.unit_offering_id = source_offering.id;

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
      raise exception 'Save the complete full-day schedule before allocating this unit';
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

  select trainer.availability_mode into trainer_availability_mode
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

-- Re-run the corrected trigger for existing allocations so a previously
-- cleared or incorrectly copied pattern is repaired immediately on deploy.
-- Invalid selected-slot trainer assignments fail visibly instead of allowing
-- the generator to place them at an unauthorized time.
update public.teaching_allocations allocation
set trainer_id = allocation.trainer_id
where allocation.source_unit_offering_id is not null;

comment on column public.teaching_allocations.source_unit_offering_id is
  'Exact unit offering whose fixed timetable pattern is copied to this allocation.';

comment on function public.set_allocation_fixed_session_context() is
  'Copies fixed sessions from the allocation exact source offering and validates every selected-time trainer period.';
