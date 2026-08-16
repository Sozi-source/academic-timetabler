-- Clinical Rotation is one approved full-day timetable session. It occupies
-- every teaching period from 08:00 to 16:00 while remaining one weekly
-- session and contributing eight workload hours.

alter table public.unit_offerings
  add column if not exists is_full_day_session boolean
    not null default false,
  add column if not exists full_day_end_time_slot_id uuid
    references public.time_slots(id) on delete restrict;

alter table public.teaching_allocations
  add column if not exists is_full_day_session boolean
    not null default false,
  add column if not exists fixed_end_time_slot_id uuid
    references public.time_slots(id) on delete restrict;

alter table public.unit_offering_fixed_slots
  drop constraint if exists unit_offering_fixed_slots_sequence_check;

alter table public.unit_offering_fixed_slots
  add constraint unit_offering_fixed_slots_sequence_check
  check (sequence_number between 1 and 20);

create or replace function public.standardize_clinical_rotation_offering()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_unit_name text;
begin
  select trim(regexp_replace(lower(unit_record.name), '[^a-z0-9]+', ' ', 'g'))
  into normalized_unit_name
  from public.units unit_record
  where unit_record.id = new.unit_id;

  if normalized_unit_name ~ '^clinical rotations?( (i|ii|iii|iv|v|vi|vii|viii|ix|x|[0-9]+))?$' then
    new.is_full_day_session := true;
    new.weekly_sessions := 1;
    new.session_duration_minutes := 480;
  end if;

  return new;
end;
$$;

drop trigger if exists unit_offerings_standardize_clinical_rotation
on public.unit_offerings;

create trigger unit_offerings_standardize_clinical_rotation
before insert or update of unit_id, weekly_sessions, session_duration_minutes
on public.unit_offerings
for each row
execute function public.standardize_clinical_rotation_offering();

update public.unit_offerings offering
set
  is_full_day_session = true,
  weekly_sessions = 1,
  session_duration_minutes = 480,
  fixed_time_slot_id = case
    when offering.fixed_schedule_required
      and offering.fixed_working_day_id is not null
    then (
      select slot.id
      from public.time_slots slot
      where slot.academic_period_id = offering.academic_period_id
        and slot.is_enabled = true
        and slot.slot_type = 'teaching'
      order by slot.sequence_number, slot.starts_at, slot.id
      limit 1
    )
    else offering.fixed_time_slot_id
  end,
  full_day_end_time_slot_id = case
    when offering.fixed_schedule_required
      and offering.fixed_working_day_id is not null
    then (
      select slot.id
      from public.time_slots slot
      where slot.academic_period_id = offering.academic_period_id
        and slot.is_enabled = true
        and slot.slot_type = 'teaching'
      order by slot.sequence_number desc, slot.ends_at desc, slot.id desc
      limit 1
    )
    else null
  end,
  updated_at = now()
from public.units unit_record
where unit_record.id = offering.unit_id
  and trim(regexp_replace(lower(unit_record.name), '[^a-z0-9]+', ' ', 'g'))
    ~ '^clinical rotations?( (i|ii|iii|iv|v|vi|vii|viii|ix|x|[0-9]+))?$';

delete from public.unit_offering_fixed_slots fixed_setting
using public.unit_offerings offering
where fixed_setting.unit_offering_id = offering.id
  and offering.is_full_day_session = true
  and offering.fixed_schedule_required = true
  and offering.fixed_working_day_id is not null;

insert into public.unit_offering_fixed_slots (
  unit_offering_id,
  working_day_id,
  time_slot_id,
  sequence_number,
  created_by
)
select
  offering.id,
  offering.fixed_working_day_id,
  slot.id,
  row_number() over (
    partition by offering.id
    order by slot.sequence_number, slot.starts_at, slot.id
  )::smallint,
  offering.updated_by
from public.unit_offerings offering
join public.time_slots slot
  on slot.academic_period_id = offering.academic_period_id
 and slot.is_enabled = true
 and slot.slot_type = 'teaching'
where offering.is_full_day_session = true
  and offering.fixed_schedule_required = true
  and offering.fixed_working_day_id is not null;

update public.teaching_offerings shared_offering
set
  weekly_sessions = 1,
  session_duration_minutes = 480,
  updated_at = now()
where exists (
  select 1
  from public.unit_offerings member
  where member.confirmed_shared_offering_id = shared_offering.id
    and member.is_full_day_session = true
);

alter table public.teaching_allocations
  disable trigger teaching_allocations_fixed_session_context;

update public.teaching_allocations allocation
set
  weekly_sessions = 1,
  session_duration_minutes = 480,
  delivery_mode = 'clinical'::public.teaching_delivery_mode,
  is_full_day_session = true,
  fixed_working_day_id = offering.fixed_working_day_id,
  fixed_time_slot_ids = array[offering.fixed_time_slot_id],
  fixed_end_time_slot_id = offering.full_day_end_time_slot_id
from public.unit_offerings offering
where allocation.academic_period_id = offering.academic_period_id
  and allocation.cohort_id = offering.cohort_id
  and allocation.unit_id = offering.unit_id
  and offering.is_full_day_session = true
  and offering.fixed_schedule_required = true
  and offering.fixed_working_day_id is not null
  and offering.fixed_time_slot_id is not null
  and offering.full_day_end_time_slot_id is not null;

alter table public.teaching_allocations
  enable trigger teaching_allocations_fixed_session_context;

alter table public.teaching_allocations
  drop constraint if exists teaching_allocations_fixed_slots_check;

alter table public.teaching_allocations
  add constraint teaching_allocations_fixed_slots_check
  check (
    (
      fixed_working_day_id is null
      and cardinality(fixed_time_slot_ids) = 0
      and fixed_end_time_slot_id is null
      and is_full_day_session = false
    )
    or (
      fixed_working_day_id is not null
      and is_full_day_session = false
      and fixed_end_time_slot_id is null
      and cardinality(fixed_time_slot_ids) between 1 and weekly_sessions
    )
    or (
      fixed_working_day_id is not null
      and is_full_day_session = true
      and fixed_end_time_slot_id is not null
      and cardinality(fixed_time_slot_ids) = 1
      and weekly_sessions = 1
      and session_duration_minutes = 480
    )
  );

create or replace function public.set_unit_offering_full_day_schedule(
  p_offering_id uuid,
  p_working_day_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  offering public.unit_offerings%rowtype;
  first_slot_id uuid;
  last_slot_id uuid;
  first_start time;
  last_end time;
  full_day_minutes integer;
  teaching_slot_count integer;
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
    raise exception 'Change the full-day schedule before assigning the trainer';
  end if;

  if not exists (
    select 1
    from public.working_days working_day
    where working_day.id = p_working_day_id
      and working_day.academic_period_id = offering.academic_period_id
      and working_day.is_enabled = true
  ) then
    raise exception 'Select an enabled working day for this Academic Period';
  end if;

  select
    (array_agg(slot.id order by slot.sequence_number, slot.starts_at, slot.id))[1],
    (array_agg(slot.id order by slot.sequence_number desc, slot.ends_at desc, slot.id desc))[1],
    min(slot.starts_at),
    max(slot.ends_at),
    extract(epoch from (max(slot.ends_at) - min(slot.starts_at)))::integer / 60,
    count(*)
  into
    first_slot_id,
    last_slot_id,
    first_start,
    last_end,
    full_day_minutes,
    teaching_slot_count
  from public.time_slots slot
  where slot.academic_period_id = offering.academic_period_id
    and slot.is_enabled = true
    and slot.slot_type = 'teaching';

  if teaching_slot_count = 0
    or first_start <> time '08:00'
    or last_end <> time '16:00'
    or full_day_minutes <> 480 then
    raise exception
      'Configure enabled teaching sessions covering 08:00 to 16:00 before saving a full-day rotation';
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
    raise exception 'No unallocated unit offerings are available for this full-day schedule';
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
    p_working_day_id,
    slot.id,
    row_number() over (
      partition by target_offering.id
      order by slot.sequence_number, slot.starts_at, slot.id
    )::smallint,
    auth.uid()
  from unnest(target_offering_ids) target_offering(id)
  cross join public.time_slots slot
  where slot.academic_period_id = offering.academic_period_id
    and slot.is_enabled = true
    and slot.slot_type = 'teaching';

  update public.unit_offerings member
  set
    fixed_schedule_required = true,
    fixed_working_day_id = p_working_day_id,
    fixed_time_slot_id = first_slot_id,
    is_full_day_session = true,
    full_day_end_time_slot_id = last_slot_id,
    weekly_sessions = 1,
    session_duration_minutes = 480,
    updated_at = now(),
    updated_by = auth.uid()
  where member.id = any(target_offering_ids);

  if offering.confirmed_shared_offering_id is not null then
    update public.teaching_offerings shared_offering
    set
      weekly_sessions = 1,
      session_duration_minutes = 480,
      updated_at = now(),
      updated_by = auth.uid()
    where shared_offering.id = offering.confirmed_shared_offering_id;
  end if;
end;
$$;

revoke all
on function public.set_unit_offering_full_day_schedule(uuid, uuid)
from public;

grant execute
on function public.set_unit_offering_full_day_schedule(uuid, uuid)
to authenticated;

create or replace function public.set_allocation_fixed_session_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_offering public.unit_offerings%rowtype;
  required_slots uuid[] := '{}'::uuid[];
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
    new.fixed_time_slot_ids := '{}'::uuid[];
    new.is_full_day_session := false;
    new.fixed_end_time_slot_id := null;
    return new;
  end if;

  select coalesce(
    array_agg(
      fixed_setting.time_slot_id
      order by fixed_setting.sequence_number
    ),
    '{}'::uuid[]
  )
  into required_slots
  from public.unit_offering_fixed_slots fixed_setting
  where fixed_setting.unit_offering_id = source_offering.id;

  if cardinality(required_slots) = 0
    and source_offering.fixed_time_slot_id is not null then
    required_slots := array[source_offering.fixed_time_slot_id];
  end if;

  if source_offering.fixed_working_day_id is null
    or cardinality(required_slots) = 0 then
    raise exception 'Set the fixed day and session before allocating this unit';
  end if;

  if source_offering.is_full_day_session then
    if source_offering.full_day_end_time_slot_id is null then
      raise exception 'Save the complete 08:00–16:00 full-day schedule before allocating this unit';
    end if;

    allocation_slots := array[required_slots[1]];
    new.weekly_sessions := 1;
    new.session_duration_minutes := 480;
    new.delivery_mode := 'clinical'::public.teaching_delivery_mode;
  else
    if cardinality(required_slots) > new.weekly_sessions then
      raise exception 'The fixed sessions exceed the required weekly sessions';
    end if;

    allocation_slots := required_slots;
  end if;

  select trainer.availability_mode
  into trainer_availability_mode
  from public.trainers trainer
  where trainer.id = new.trainer_id;

  if trainer_availability_mode = 'selected_slots_only'
    and exists (
      select 1
      from unnest(required_slots) required_slot(time_slot_id)
      where not exists (
        select 1
        from public.trainer_availability availability
        where availability.trainer_id = new.trainer_id
          and availability.academic_period_id = new.academic_period_id
          and availability.working_day_id = source_offering.fixed_working_day_id
          and availability.time_slot_id = required_slot.time_slot_id
      )
    ) then
    raise exception 'The trainer must be available for every fixed teaching session';
  end if;

  new.fixed_working_day_id := source_offering.fixed_working_day_id;
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

comment on column public.unit_offerings.is_full_day_session is
  'True when the offering must occupy one approved full-day timetable range.';

comment on column public.teaching_allocations.is_full_day_session is
  'True when the planner must create one full-day session using the saved start and end slots.';

comment on function public.set_unit_offering_full_day_schedule(uuid, uuid) is
  'Saves one 08:00–16:00 full-day session and synchronizes every member of a confirmed shared class.';

-- Retain all clash checks. The usual daily workload limit remains hard, but
-- an explicitly approved full-day allocation may occupy its complete day.
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
  session_duration_minutes integer;
  existing_daily_minutes integer;
  existing_weekly_minutes integer;
  trainer_conflict_exists boolean;
  cohort_conflict_exists boolean;
  room_conflict_exists boolean;
begin
  if new.status in ('cancelled', 'archived') then
    new.conflict_state := 'clear';
    return new;
  end if;

  select *
  into selected_start_slot
  from public.time_slots
  where id = new.start_time_slot_id;

  select *
  into selected_end_slot
  from public.time_slots
  where id = new.end_time_slot_id;

  select *
  into selected_trainer
  from public.trainers
  where id = new.trainer_id;

  select coalesce(allocation.is_full_day_session, false)
  into approved_full_day
  from public.teaching_allocations allocation
  where allocation.id = new.teaching_allocation_id;

  session_duration_minutes :=
    extract(epoch from (
      selected_end_slot.ends_at - selected_start_slot.starts_at
    ))::integer / 60;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and existing.trainer_id = new.trainer_id
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
  ) into trainer_conflict_exists;

  if trainer_conflict_exists then
    raise exception using
      errcode = '23P01',
      message = 'Trainer clash: the trainer already has another session during the selected time';
  end if;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and existing.cohort_id = new.cohort_id
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
  ) into cohort_conflict_exists;

  if cohort_conflict_exists then
    raise exception using
      errcode = '23P01',
      message = 'Cohort clash: the cohort already has another session during the selected time';
  end if;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id = existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id = existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id = new.academic_period_id
      and existing.working_day_id = new.working_day_id
      and existing.room_id = new.room_id
      and existing.status not in ('cancelled', 'archived')
      and existing_start.starts_at < selected_end_slot.ends_at
      and selected_start_slot.starts_at < existing_end.ends_at
  ) into room_conflict_exists;

  if room_conflict_exists then
    raise exception using
      errcode = '23P01',
      message = 'Room clash: the room already has another session during the selected time';
  end if;

  select coalesce(
    sum(
      extract(epoch from (
        existing_end.ends_at - existing_start.starts_at
      ))::integer / 60
    ),
    0
  )
  into existing_daily_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start
    on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end
    on existing_end.id = existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id = new.academic_period_id
    and existing.working_day_id = new.working_day_id
    and existing.trainer_id = new.trainer_id
    and existing.status not in ('cancelled', 'archived');

  if not approved_full_day
    and existing_daily_minutes + session_duration_minutes
      > selected_trainer.maximum_daily_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message = 'The scheduled session would exceed the trainer maximum daily workload';
  end if;

  select coalesce(
    sum(
      extract(epoch from (
        existing_end.ends_at - existing_start.starts_at
      ))::integer / 60
    ),
    0
  )
  into existing_weekly_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start
    on existing_start.id = existing.start_time_slot_id
  join public.time_slots existing_end
    on existing_end.id = existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id = new.academic_period_id
    and existing.trainer_id = new.trainer_id
    and existing.status not in ('cancelled', 'archived');

  if existing_weekly_minutes + session_duration_minutes
    > selected_trainer.maximum_weekly_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message = 'The scheduled session would exceed the trainer maximum weekly workload';
  end if;

  new.conflict_state := 'clear';
  return new;
end;
$$;
