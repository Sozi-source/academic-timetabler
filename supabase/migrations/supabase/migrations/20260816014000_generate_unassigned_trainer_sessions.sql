-- Units may participate in draft timetable generation before a trainer is
-- known. Fixed schedules are preserved when configured; otherwise the planner
-- chooses a valid cohort/room/day/time placement automatically.

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

  if offering.is_provisionally_reserved then
    select allocation.id into allocation_id
    from public.teaching_allocations allocation
    where allocation.academic_period_id = offering.academic_period_id
      and allocation.cohort_id = offering.cohort_id
      and allocation.unit_id = offering.unit_id
      and allocation.trainer_id is null
      and allocation.status in ('draft', 'active')
    limit 1;

    return jsonb_build_object(
      'allocationId', allocation_id,
      'included', true,
      'alreadyIncluded', true
    );
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

  insert into public.teaching_allocations (
    academic_period_id,
    cohort_id,
    unit_id,
    trainer_id,
    delivery_mode,
    weekly_sessions,
    session_duration_minutes,
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
    case when offering.offering_type = 'practical'
      then 'practical'::public.teaching_delivery_mode
      else 'theory'::public.teaching_delivery_mode end,
    case when shared_offering.id is null
      then coalesce(offering.weekly_sessions, 1)
      else shared_offering.weekly_sessions end,
    case when shared_offering.id is null
      then coalesce(offering.session_duration_minutes, 120)
      else shared_offering.session_duration_minutes end,
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
      else 'Unassigned trainer; automatic timetable placement included' end
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

-- An unassigned session must remain editable so a trainer can be attached
-- later without leaving an impossible locked placeholder.
update public.scheduled_sessions
set
  status = case when status = 'locked' then 'draft' else status end,
  is_locked = false,
  updated_at = now(),
  updated_by = auth.uid()
where trainer_id is null
  and (status = 'locked' or is_locked = true);

alter table public.scheduled_sessions
  drop constraint if exists scheduled_sessions_unassigned_not_locked_check;

alter table public.scheduled_sessions
  add constraint scheduled_sessions_unassigned_not_locked_check
  check (
    trainer_id is not null
    or (
      is_locked = false
      and status <> 'locked'
    )
  );

comment on function public.reserve_unit_offering_without_trainer(uuid) is
  'Includes a unit in draft timetable generation without a trainer; fixed placement is optional and publication remains blocked.';
