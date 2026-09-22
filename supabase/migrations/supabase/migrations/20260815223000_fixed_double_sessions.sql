-- Fixed single and consecutive double teaching sessions.
-- The legacy first-slot columns remain populated for compatibility.

create table if not exists public.unit_offering_fixed_slots (
  id uuid primary key default gen_random_uuid(),
  unit_offering_id uuid not null
    references public.unit_offerings(id) on delete cascade,
  working_day_id uuid not null
    references public.working_days(id) on delete cascade,
  time_slot_id uuid not null
    references public.time_slots(id) on delete cascade,
  sequence_number smallint not null,
  created_by uuid references auth.users(id) on delete set null
    default auth.uid(),
  created_at timestamptz not null default now(),
  constraint unit_offering_fixed_slots_sequence_check
    check (sequence_number between 1 and 2),
  unique (unit_offering_id, time_slot_id),
  unique (unit_offering_id, sequence_number)
);

create index if not exists unit_offering_fixed_slots_lookup_idx
  on public.unit_offering_fixed_slots (
    unit_offering_id,
    sequence_number
  );

alter table public.unit_offering_fixed_slots enable row level security;
revoke all on table public.unit_offering_fixed_slots from anon;
grant select on table public.unit_offering_fixed_slots to authenticated;

drop policy if exists unit_offering_fixed_slots_read
on public.unit_offering_fixed_slots;

create policy unit_offering_fixed_slots_read
on public.unit_offering_fixed_slots
for select to authenticated
using (
  exists (
    select 1
    from public.unit_offerings offering
    join public.cohorts cohort on cohort.id = offering.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where offering.id = unit_offering_fixed_slots.unit_offering_id
      and public.current_user_can_access_department(programme.department_id)
  )
);

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
  offering.fixed_time_slot_id,
  1,
  offering.updated_by
from public.unit_offerings offering
where offering.fixed_schedule_required
  and offering.fixed_working_day_id is not null
  and offering.fixed_time_slot_id is not null
on conflict (unit_offering_id, sequence_number)
do update set
  working_day_id = excluded.working_day_id,
  time_slot_id = excluded.time_slot_id;

alter table public.teaching_allocations
  add column if not exists fixed_working_day_id uuid
    references public.working_days(id) on delete restrict,
  add column if not exists fixed_time_slot_ids uuid[]
    not null default '{}'::uuid[];

update public.teaching_allocations allocation
set
  fixed_working_day_id = offering.fixed_working_day_id,
  fixed_time_slot_ids = coalesce(
    (
      select array_agg(
        fixed_slot.time_slot_id
        order by fixed_slot.sequence_number
      )
      from public.unit_offering_fixed_slots fixed_slot
      where fixed_slot.unit_offering_id = offering.id
    ),
    array[offering.fixed_time_slot_id]
  )
from public.unit_offerings offering
where allocation.academic_period_id = offering.academic_period_id
  and allocation.cohort_id = offering.cohort_id
  and allocation.unit_id = offering.unit_id
  and offering.fixed_schedule_required
  and offering.fixed_working_day_id is not null
  and offering.fixed_time_slot_id is not null;

alter table public.teaching_allocations
  drop constraint if exists teaching_allocations_fixed_slots_check;

alter table public.teaching_allocations
  add constraint teaching_allocations_fixed_slots_check
  check (
    (
      fixed_working_day_id is null
      and cardinality(fixed_time_slot_ids) = 0
    )
    or (
      fixed_working_day_id is not null
      and cardinality(fixed_time_slot_ids)
        between 1 and weekly_sessions
    )
  );

create or replace function public.set_unit_offering_fixed_schedule(
  p_offering_id uuid,
  p_working_day_id uuid,
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
  selected_slot_count integer;
  matched_slot_count integer;
  minimum_slot_sequence integer;
  maximum_slot_sequence integer;
  first_slot_id uuid;
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

  if not exists (
    select 1
    from public.working_days working_day
    where working_day.id = p_working_day_id
      and working_day.academic_period_id = offering.academic_period_id
      and working_day.is_enabled = true
  ) then
    raise exception 'Select an enabled working day for this Academic Period';
  end if;

  selected_slot_count := coalesce(cardinality(p_time_slot_ids), 0);

  if selected_slot_count not between 1 and 2 then
    raise exception 'Select one session, or two consecutive sessions';
  end if;

  if selected_slot_count > coalesce(offering.weekly_sessions, 1) then
    raise exception
      'This unit requires only % session(s) per week',
      coalesce(offering.weekly_sessions, 1);
  end if;

  select
    count(distinct time_slot.id),
    min(time_slot.teaching_sequence_number),
    max(time_slot.teaching_sequence_number),
    (array_agg(
      time_slot.id
      order by time_slot.sequence_number, time_slot.id
    ))[1]
  into
    matched_slot_count,
    minimum_slot_sequence,
    maximum_slot_sequence,
    first_slot_id
  from (
    select
      enabled_slot.*,
      row_number() over (
        order by enabled_slot.sequence_number, enabled_slot.id
      ) as teaching_sequence_number
    from public.time_slots enabled_slot
    where enabled_slot.academic_period_id = offering.academic_period_id
      and enabled_slot.is_enabled = true
      and enabled_slot.slot_type = 'teaching'
  ) time_slot
  where time_slot.id = any(p_time_slot_ids)
    and extract(epoch from (time_slot.ends_at - time_slot.starts_at)) / 60
      = coalesce(offering.session_duration_minutes, 120);

  if matched_slot_count <> selected_slot_count then
    raise exception 'Select valid enabled teaching sessions for this Academic Period';
  end if;

  if selected_slot_count = 2
    and maximum_slot_sequence - minimum_slot_sequence <> 1 then
    raise exception 'The two sessions must be consecutive teaching periods';
  end if;

  if offering.confirmed_shared_offering_id is null then
    target_offering_ids := array[offering.id];
  else
    select array_agg(member.id order by member.id)
    into target_offering_ids
    from public.unit_offerings member
    where member.confirmed_shared_offering_id =
      offering.confirmed_shared_offering_id
      and member.allocation_status = 'unallocated';
  end if;

  if coalesce(cardinality(target_offering_ids), 0) = 0 then
    raise exception 'No unallocated unit offerings are available for this fixed schedule';
  end if;

  delete from public.unit_offering_fixed_slots fixed_slot
  where fixed_slot.unit_offering_id = any(target_offering_ids);

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
    time_slot.id,
    (row_number() over (
      partition by target_offering.id
      order by time_slot.sequence_number, time_slot.id
    ))::smallint,
    auth.uid()
  from unnest(target_offering_ids) target_offering(id)
  cross join public.time_slots time_slot
  where time_slot.id = any(p_time_slot_ids);

  update public.unit_offerings member
  set
    fixed_schedule_required = true,
    fixed_working_day_id = p_working_day_id,
    fixed_time_slot_id = first_slot_id,
    updated_at = now(),
    updated_by = auth.uid()
  where member.id = any(target_offering_ids);
end;
$$;

revoke all
on function public.set_unit_offering_fixed_schedule(uuid, uuid, uuid[])
from public;

grant execute
on function public.set_unit_offering_fixed_schedule(uuid, uuid, uuid[])
to authenticated;

-- Confirmed shared units must carry the same complete fixed-slot pattern.
create or replace function public.confirm_shared_unit_offerings(
  p_offering_ids uuid[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
  v_period_count integer;
  v_department_count integer;
  v_title_count integer;
  v_pattern_count integer;
  v_period uuid;
  v_department uuid;
  v_title text;
  v_group uuid;
  v_key text;
begin
  select count(*), count(distinct offering.academic_period_id),
    count(distinct programme.department_id),
    count(distinct lower(regexp_replace(trim(unit.name),'[^a-z0-9]+',' ','gi'))),
    count(distinct concat(
      coalesce(offering.weekly_sessions, unit.weekly_sessions),
      ':', coalesce(offering.session_duration_minutes, 120)
    )),
    (array_agg(offering.academic_period_id))[1],
    (array_agg(programme.department_id))[1],
    min(unit.name)
  into v_count, v_period_count, v_department_count,
    v_title_count, v_pattern_count, v_period, v_department, v_title
  from public.unit_offerings offering
  join public.units unit on unit.id = offering.unit_id
  join public.cohorts cohort on cohort.id = offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where offering.id = any(p_offering_ids)
    and offering.allocation_status = 'unallocated';

  if v_count < 2 then raise exception 'Select at least two unallocated units'; end if;
  if v_count <> cardinality(p_offering_ids) then
    raise exception 'One or more selected units are unavailable or already allocated';
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
    raise exception 'Only units with the same normalized title can be combined';
  end if;
  if v_pattern_count <> 1 then
    raise exception 'Shared units must have the same weekly sessions and duration';
  end if;
  if exists (
    select 1 from public.unit_offerings offering
    where offering.id = any(p_offering_ids)
      and offering.confirmed_shared_offering_id is not null
  ) then
    raise exception 'One or more units already belong to a confirmed shared class';
  end if;

  if exists (
    select 1 from public.unit_offerings offering
    where offering.id = any(p_offering_ids)
      and offering.fixed_schedule_required
  ) and (
    exists (
      select 1 from public.unit_offerings offering
      where offering.id = any(p_offering_ids)
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
      where offering.id = any(p_offering_ids)
    ) <> 1
  ) then
    raise exception 'Fixed day and sessions must match for every shared unit';
  end if;

  v_key := 'CONFIRMED-' || upper(substr(md5(array_to_string(
    (select array_agg(value order by value) from unnest(p_offering_ids) value),
    ','
  )), 1, 20));

  insert into public.teaching_offerings (
    academic_period_id, department_id, title, shared_class_key, weekly_sessions,
    session_duration_minutes, status, is_timetable_enabled, notes
  )
  select v_period, v_department, v_title, v_key,
    coalesce(offering.weekly_sessions, unit.weekly_sessions),
    coalesce(offering.session_duration_minutes, 120),
    'draft', true, 'HOD-confirmed shared class'
  from public.unit_offerings offering
  join public.units unit on unit.id = offering.unit_id
  where offering.id = p_offering_ids[1]
  returning id into v_group;

  insert into public.teaching_offering_participants (
    teaching_offering_id, cohort_id, unit_id, unit_offering_id,
    is_primary, notes
  )
  select v_group, offering.cohort_id, offering.unit_id, offering.id,
    row_number() over(order by offering.id) = 1,
    'Confirmed equivalent unit'
  from public.unit_offerings offering
  where offering.id = any(p_offering_ids);

  update public.unit_offerings
  set
    confirmed_shared_offering_id = v_group,
    manually_reviewed = true,
    reviewed_by = auth.uid(),
    reviewed_at = now()
  where id = any(p_offering_ids);

  return v_group;
end;
$$;

grant execute
on function public.confirm_shared_unit_offerings(uuid[])
to authenticated;

/*
The earlier full assign_unit_offering replacement is intentionally retained as
reference but disabled. The smaller trigger below extends the already-applied
multi-department allocation function without duplicating its long body.

-- Copy the complete fixed-slot pattern into the allocation consumed by the
-- timetable planner and validate every selected-slot trainer period.
create or replace function public.assign_unit_offering(
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
  used_hours numeric;
  added_hours numeric;
  projected_hours numeric;
  allocation_id uuid;
  fixed_required boolean := false;
  fixed_day uuid;
  fixed_slot uuid;
  fixed_slots uuid[] := '{}'::uuid[];
  incomplete_fixed_count integer := 0;
  fixed_pattern_count integer := 0;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before allocating.';
  end if;

  select unit_offering.* into offering
  from public.unit_offerings unit_offering
  join public.cohorts cohort on cohort.id = unit_offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where unit_offering.id = p_offering_id
    and programme.department_id = active_department
  for update of unit_offering;

  if offering.id is null then
    raise exception 'Unit on offer was not found in the working department';
  end if;
  if offering.allocation_status = 'allocated' then
    raise exception 'This unit on offer is already allocated';
  end if;

  select * into trainer from public.trainers where id = p_trainer_id;
  if trainer.id is null or not trainer.is_active
    or not trainer.is_timetable_available then
    raise exception 'The selected trainer is not available';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-workload:' || trainer.id::text || ':'
      || offering.academic_period_id::text, 0
  ));

  if offering.confirmed_shared_offering_id is not null then
    select * into shared_offering
    from public.teaching_offerings
    where id = offering.confirmed_shared_offering_id
      and department_id = active_department;

    if shared_offering.id is null then
      raise exception 'The confirmed shared class is not available';
    end if;

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

    select
      coalesce(bool_or(member.fixed_schedule_required), false),
      min(member.fixed_working_day_id),
      min(member.fixed_time_slot_id),
      count(*) filter (
        where not member.fixed_schedule_required
          or member.fixed_working_day_id is null
          or member.fixed_time_slot_id is null
      ),
      count(distinct concat(
        member.fixed_working_day_id, ':', member.fixed_time_slot_id
      )) filter (where member.fixed_schedule_required)
    into fixed_required, fixed_day, fixed_slot,
      incomplete_fixed_count, fixed_pattern_count
    from public.teaching_offering_participants participant
    join public.unit_offerings member
      on member.id = participant.unit_offering_id
    where participant.teaching_offering_id = shared_offering.id;

    if fixed_required
      and (incomplete_fixed_count > 0 or fixed_pattern_count <> 1) then
      raise exception 'Every unit in the shared class must use the same fixed day and sessions';
    end if;

    select coalesce(
      array_agg(fixed_setting.time_slot_id order by fixed_setting.sequence_number),
      '{}'::uuid[]
    )
    into fixed_slots
    from public.unit_offering_fixed_slots fixed_setting
    where fixed_setting.unit_offering_id = offering.id;

    if fixed_required and cardinality(fixed_slots) = 0 and fixed_slot is not null then
      fixed_slots := array[fixed_slot];
    end if;

    if fixed_required and exists (
      select 1
      from public.teaching_offering_participants participant
      join public.unit_offerings member
        on member.id = participant.unit_offering_id
      where participant.teaching_offering_id = shared_offering.id
        and coalesce(
          (
            select array_agg(
              fixed_setting.time_slot_id
              order by fixed_setting.sequence_number
            )
            from public.unit_offering_fixed_slots fixed_setting
            where fixed_setting.unit_offering_id = member.id
          ),
          array[member.fixed_time_slot_id]
        ) is distinct from fixed_slots
    ) then
      raise exception 'Every unit in the shared class must use the same fixed sessions';
    end if;

    added_hours :=
      shared_offering.weekly_sessions
      * shared_offering.session_duration_minutes / 60.0;
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

    fixed_required := offering.fixed_schedule_required;
    fixed_day := offering.fixed_working_day_id;
    fixed_slot := offering.fixed_time_slot_id;

    select coalesce(
      array_agg(fixed_setting.time_slot_id order by fixed_setting.sequence_number),
      '{}'::uuid[]
    )
    into fixed_slots
    from public.unit_offering_fixed_slots fixed_setting
    where fixed_setting.unit_offering_id = offering.id;

    if fixed_required and cardinality(fixed_slots) = 0 and fixed_slot is not null then
      fixed_slots := array[fixed_slot];
    end if;

    if fixed_required and (
      fixed_day is null
      or cardinality(fixed_slots) = 0
    ) then
      raise exception 'Set the fixed day and session before allocating this unit';
    end if;

    added_hours :=
      coalesce(offering.weekly_sessions, 1)
      * coalesce(offering.session_duration_minutes, 120) / 60.0;
  end if;

  if fixed_required and cardinality(fixed_slots) >
    case when shared_offering.id is null
      then coalesce(offering.weekly_sessions, 1)
      else shared_offering.weekly_sessions end then
    raise exception 'The fixed sessions exceed the required weekly sessions';
  end if;

  if trainer.availability_mode = 'selected_slots_only' and (
    (
      fixed_required
      and exists (
        select 1
        from unnest(fixed_slots) required_slot(time_slot_id)
        where not exists (
          select 1
          from public.trainer_availability availability
          where availability.trainer_id = trainer.id
            and availability.academic_period_id = offering.academic_period_id
            and availability.working_day_id = fixed_day
            and availability.time_slot_id = required_slot.time_slot_id
        )
      )
    )
    or (
      not fixed_required
      and not exists (
        select 1
        from public.trainer_availability availability
        where availability.trainer_id = trainer.id
          and availability.academic_period_id = offering.academic_period_id
      )
    )
  ) then
    raise exception 'The trainer must be available for every fixed teaching session';
  end if;

  select coalesce(sum(
    allocation.weekly_sessions * allocation.session_duration_minutes
  ) / 60.0, 0)
  into used_hours
  from public.teaching_allocations allocation
  where allocation.trainer_id = trainer.id
    and allocation.academic_period_id = offering.academic_period_id
    and allocation.status in ('draft', 'active');

  projected_hours := used_hours + added_hours;
  if projected_hours > trainer.maximum_weekly_hours then
    raise exception
      'Maximum workload exceeded: %h projected, %h maximum',
      projected_hours, trainer.maximum_weekly_hours;
  end if;

  insert into public.teaching_allocations (
    academic_period_id, cohort_id, unit_id, trainer_id, delivery_mode,
    weekly_sessions, session_duration_minutes, status,
    is_timetable_enabled, teaching_offering_id, participant_cohort_ids,
    combined_cohort_size, fixed_working_day_id, fixed_time_slot_ids, notes
  ) values (
    offering.academic_period_id,
    offering.cohort_id,
    offering.unit_id,
    trainer.id,
    case when offering.offering_type = 'practical'
      then 'practical'::public.teaching_delivery_mode
      else 'theory'::public.teaching_delivery_mode end,
    case when shared_offering.id is null
      then coalesce(offering.weekly_sessions, 1)
      else shared_offering.weekly_sessions end,
    case when shared_offering.id is null
      then coalesce(offering.session_duration_minutes, 120)
      else shared_offering.session_duration_minutes end,
    'active',
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
      then (select actual_size from public.cohorts where id = offering.cohort_id)
      else (
        select coalesce(sum(cohort.actual_size), 0)
        from public.teaching_offering_participants participant
        join public.cohorts cohort on cohort.id = participant.cohort_id
        where participant.teaching_offering_id = shared_offering.id
      ) end,
    case when fixed_required then fixed_day else null end,
    case when fixed_required then fixed_slots else '{}'::uuid[] end,
    case
      when fixed_required and cardinality(fixed_slots) = 2
        then 'Fixed consecutive double session configured on unit offering'
      when fixed_required
        then 'Fixed session configured on unit offering'
      when shared_offering.id is not null
        then 'Shared class: workload counted once'
      else null
    end
  ) returning id into allocation_id;

  if shared_offering.id is not null then
    update public.teaching_offerings
    set trainer_id = trainer.id, status = 'active'
    where id = shared_offering.id;

    update public.unit_offerings
    set allocation_status = 'allocated', status = 'active', updated_at = now()
    where confirmed_shared_offering_id = shared_offering.id;
  else
    update public.unit_offerings
    set allocation_status = 'allocated', status = 'active', updated_at = now()
    where id = offering.id;
  end if;

  return jsonb_build_object(
    'allocationId', allocation_id,
    'allocatedHours', projected_hours,
    'normalHours', trainer.normal_weekly_hours,
    'maximumHours', trainer.maximum_weekly_hours,
    'isExtraLoad', projected_hours > trainer.normal_weekly_hours,
    'shared', shared_offering.id is not null,
    'fixedSessionCount', cardinality(fixed_slots)
  );
end;
$$;

grant execute
on function public.assign_unit_offering(uuid, uuid)
to authenticated;
*/

create or replace function public.set_allocation_fixed_session_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_offering public.unit_offerings%rowtype;
  required_slots uuid[] := '{}'::uuid[];
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

  if cardinality(required_slots) > new.weekly_sessions then
    raise exception 'The fixed sessions exceed the required weekly sessions';
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
          and availability.working_day_id =
            source_offering.fixed_working_day_id
          and availability.time_slot_id = required_slot.time_slot_id
      )
    ) then
    raise exception 'The trainer must be available for every fixed teaching session';
  end if;

  new.fixed_working_day_id := source_offering.fixed_working_day_id;
  new.fixed_time_slot_ids := required_slots;
  return new;
end;
$$;

drop trigger if exists teaching_allocations_fixed_session_context
on public.teaching_allocations;

create trigger teaching_allocations_fixed_session_context
before insert or update of
  academic_period_id,
  cohort_id,
  unit_id,
  trainer_id,
  weekly_sessions
on public.teaching_allocations
for each row
execute function public.set_allocation_fixed_session_context();

comment on table public.unit_offering_fixed_slots is
  'Ordered one- or two-session fixed timetable pattern for a unit offering.';

comment on function public.set_unit_offering_fixed_schedule(uuid, uuid, uuid[]) is
  'Validates and saves one fixed session or two consecutive fixed sessions, synchronizing every member of a confirmed shared class.';

comment on function public.assign_unit_offering(uuid, uuid) is
  'Allocates a trainer; the allocation trigger copies validated fixed-session requirements into the planner allocation.';
