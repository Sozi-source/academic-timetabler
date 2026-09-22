-- Preserve the exact First session / Second session order submitted by the UI.

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

  if (
    select count(distinct requested_slot.time_slot_id)
    from unnest(p_time_slot_ids) requested_slot(time_slot_id)
  ) <> selected_slot_count then
    raise exception 'Choose two different sessions for a double session';
  end if;

  if selected_slot_count > coalesce(offering.weekly_sessions, 1) then
    raise exception
      'This unit requires only % session(s) per week',
      coalesce(offering.weekly_sessions, 1);
  end if;

  select count(*)
  into matched_slot_count
  from public.time_slots time_slot
  where time_slot.id = any(p_time_slot_ids)
    and time_slot.academic_period_id = offering.academic_period_id
    and time_slot.is_enabled = true
    and time_slot.slot_type = 'teaching'
    and extract(epoch from (time_slot.ends_at - time_slot.starts_at)) / 60
      = coalesce(offering.session_duration_minutes, 120);

  if matched_slot_count <> selected_slot_count then
    raise exception
      'Select valid teaching sessions that match the unit session duration';
  end if;

  if selected_slot_count = 2 then
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
        'Second session must be the next teaching period after First session';
    end if;
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
    raise exception
      'No unallocated unit offerings are available for this fixed schedule';
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
    requested_slot.time_slot_id,
    requested_slot.position::smallint,
    auth.uid()
  from unnest(target_offering_ids) target_offering(id)
  cross join unnest(p_time_slot_ids)
    with ordinality requested_slot(time_slot_id, position);

  update public.unit_offerings member
  set
    fixed_schedule_required = true,
    fixed_working_day_id = p_working_day_id,
    fixed_time_slot_id = p_time_slot_ids[1],
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

comment on function public.set_unit_offering_fixed_schedule(uuid, uuid, uuid[]) is
  'Saves one fixed session or an ordered consecutive double session exactly as submitted by the allocation form.';
