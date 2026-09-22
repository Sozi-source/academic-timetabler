-- Equivalent programme units may be taught as one shared class even when
-- their imported weekly-session counts differ. HOD confirmation reconciles
-- the group to the highest requirement so no cohort is under-scheduled.

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
    count(distinct public.canonical_shared_unit_title(unit_record.name)),
    count(distinct coalesce(offering.session_duration_minutes, 120)),
    max(coalesce(offering.weekly_sessions, unit_record.weekly_sessions, 1))::smallint,
    min(coalesce(offering.session_duration_minutes, 120))::smallint,
    (array_agg(offering.academic_period_id))[1],
    (array_agg(programme.department_id))[1],
    min(unit_record.name)
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

  return v_group;
end;
$$;

grant execute
on function public.confirm_shared_unit_offerings(uuid[])
to authenticated;

comment on function public.confirm_shared_unit_offerings(uuid[]) is
  'Combines HOD-confirmed equivalent units with equal duration; differing weekly counts are reconciled to the highest requirement.';
