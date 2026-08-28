create or replace function public.clear_unit_offering_fixed_schedule(p_offering_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  offering public.unit_offerings%rowtype;
  target_offering_ids uuid[];
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501', message = 'Select an authorized working department first';
  end if;
  select unit_offering.* into offering
  from public.unit_offerings unit_offering
  join public.cohorts cohort on cohort.id = unit_offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where unit_offering.id = p_offering_id and programme.department_id = active_department
  for update of unit_offering;
  if offering.id is null then raise exception 'The unit on offer was not found in the working department'; end if;
  if offering.confirmed_shared_offering_id is null then
    target_offering_ids := array[offering.id];
  else
    select array_agg(member.id order by member.id) into target_offering_ids
    from public.unit_offerings member
    where member.confirmed_shared_offering_id = offering.confirmed_shared_offering_id;
  end if;
  if exists (select 1 from public.unit_offerings member
    where member.id = any(target_offering_ids) and member.allocation_status = 'allocated') then
    raise exception 'Unassign the shared delivery before removing its fixed time';
  end if;
  delete from public.unit_offering_fixed_slots fixed_slot
  where fixed_slot.unit_offering_id = any(target_offering_ids);
  update public.unit_offerings member
  set fixed_schedule_required = false, fixed_working_day_id = null,
      fixed_time_slot_id = null, is_full_day_session = false,
      updated_at = now(), updated_by = auth.uid()
  where member.id = any(target_offering_ids);
end;
$$;

revoke all on function public.clear_unit_offering_fixed_schedule(uuid) from public;
grant execute on function public.clear_unit_offering_fixed_schedule(uuid) to authenticated;
comment on function public.clear_unit_offering_fixed_schedule(uuid) is
  'Removes an unallocated offering fixed-time constraint so the planner can choose a compatible slot.';
