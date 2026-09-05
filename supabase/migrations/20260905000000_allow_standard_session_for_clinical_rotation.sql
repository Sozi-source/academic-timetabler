-- Allow flexible standard session scheduling (e.g. morning supervision)
-- for clinical rotations and standard units.

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
    if tg_op = 'INSERT' then
      if new.is_full_day_session is null or new.is_full_day_session = true then
        new.is_full_day_session := true;
        new.weekly_sessions := coalesce(new.weekly_sessions, 1);
        new.session_duration_minutes := coalesce(new.session_duration_minutes, 480);
      else
        new.is_full_day_session := false;
        new.weekly_sessions := coalesce(new.weekly_sessions, 1);
        new.session_duration_minutes := coalesce(new.session_duration_minutes, 120);
      end if;
    elsif tg_op = 'UPDATE' then
      if new.is_full_day_session = true then
        new.weekly_sessions := 1;
        new.session_duration_minutes := 480;
      elsif new.is_full_day_session = false and new.session_duration_minutes = 480 then
        new.session_duration_minutes := 120;
      end if;
    end if;
  end if;

  return new;
end;
$$;

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
   and time_slot.slot_type = 'teaching';

  if matched_session_count <> selected_session_count then
    raise exception
      'Select enabled days and teaching sessions for the fixed schedule';
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
    weekly_sessions = selected_session_count,
    session_duration_minutes = 120,
    updated_at = now(),
    updated_by = auth.uid()
  where member.id = any(target_offering_ids);

  if offering.confirmed_shared_offering_id is not null then
    update public.teaching_offerings shared_offering
    set
      weekly_sessions = selected_session_count,
      session_duration_minutes = 120,
      updated_at = now(),
      updated_by = auth.uid()
    where shared_offering.id = offering.confirmed_shared_offering_id;
  end if;

  -- Synchronize any existing trainer-pending reservation.
  update public.teaching_allocations allocation
  set
    fixed_working_day_id = p_working_day_ids[1],
    fixed_working_day_ids = p_working_day_ids,
    fixed_time_slot_ids = p_time_slot_ids,
    is_full_day_session = false,
    fixed_end_time_slot_id = null,
    weekly_sessions = selected_session_count,
    session_duration_minutes = 120,
    delivery_mode = 'theory'::public.teaching_delivery_mode,
    updated_at = now(),
    updated_by = auth.uid()
  where allocation.academic_period_id = offering.academic_period_id
    and allocation.trainer_id is null
    and allocation.status in ('draft', 'active', 'suspended')
    and (
      (
        offering.confirmed_shared_offering_id is not null
        and allocation.teaching_offering_id =
          offering.confirmed_shared_offering_id
      )
      or (
        offering.confirmed_shared_offering_id is null
        and allocation.teaching_offering_id is null
        and allocation.cohort_id = offering.cohort_id
        and allocation.unit_id = offering.unit_id
      )
    );
end;
$$;

revoke all
on function public.set_unit_offering_fixed_session_pattern(uuid, uuid[], uuid[])
from public;

grant execute
on function public.set_unit_offering_fixed_session_pattern(uuid, uuid[], uuid[])
to authenticated;

-- Credit full-day clinical rotation deliveries with 2.0h (120m) supervision load
-- while keeping the full 08:00–16:00 (480m) block on the student & master timetables.

create or replace function public.get_institution_trainer_workloads(
  target_academic_period_id uuid
)
returns table (
  trainer_id uuid,
  allocated_hours numeric,
  department_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  return query
  with active_allocations as (
    select allocation.*, unit.name as unit_name
    from public.teaching_allocations allocation
    join public.unit_offerings source_offering
      on source_offering.id = allocation.source_unit_offering_id
    left join public.units unit
      on unit.id = allocation.unit_id
    where allocation.academic_period_id = target_academic_period_id
      and allocation.trainer_id is not null
      and allocation.status in ('draft', 'active')
      and source_offering.approval_status = 'approved'
      and source_offering.selection_state = 'included'
      and source_offering.is_timetable_enabled
  ), deliveries as (
    select allocation.trainer_id,
      coalesce(allocation.teaching_offering_id, allocation.id) as delivery_id,
      max(
        case
          when allocation.is_full_day_session
            or allocation.delivery_mode = 'clinical'
            or allocation.unit_name ilike 'clinical rotation%'
            or allocation.session_duration_minutes >= 480
          then 120 -- 2.0 hours supervision load credit
          else allocation.weekly_sessions * allocation.session_duration_minutes
        end
      ) as weekly_minutes
    from active_allocations allocation
    group by allocation.trainer_id,
      coalesce(allocation.teaching_offering_id, allocation.id)
  ), trainer_hours as (
    select delivery.trainer_id,
      coalesce(sum(delivery.weekly_minutes) / 60.0, 0)::numeric as allocated_hours
    from deliveries delivery
    group by delivery.trainer_id
  ), trainer_departments as (
    select allocation.trainer_id,
      count(distinct programme.department_id) as department_count
    from active_allocations allocation
    join public.cohorts cohort on cohort.id = allocation.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    group by allocation.trainer_id
  )
  select hours.trainer_id, hours.allocated_hours, departments.department_count
  from trainer_hours hours
  join trainer_departments departments on departments.trainer_id = hours.trainer_id;
end;
$$;

revoke all on function public.get_institution_trainer_workloads(uuid) from public;
grant execute on function public.get_institution_trainer_workloads(uuid) to authenticated;

comment on function public.get_institution_trainer_workloads(uuid) is
  'Aggregates approved institution-wide trainer workloads with 2.0h supervision credit for full-day clinical rotations.';


