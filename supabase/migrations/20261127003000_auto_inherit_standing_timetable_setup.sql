-- Automatically inherit standing timetable setup (working days, time slots,
-- trainer availability, and recurring scheduling constraints) from the active/canonical
-- period into all planned future periods and whenever new planned periods or standing
-- changes are saved.

begin;

create or replace function public.copy_timetable_setup_internal(
  p_source_period_id uuid,
  p_target_period_id uuid,
  p_actor_id uuid default auth.uid()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_status public.academic_period_status;
  v_copied_days integer := 0;
  v_copied_slots integer := 0;
  v_copied_availability integer := 0;
  v_copied_constraints integer := 0;
  v_day record;
  v_slot record;
begin
  if p_source_period_id is null or p_target_period_id is null
    or p_source_period_id = p_target_period_id then
    raise exception 'Select two different Academic Periods';
  end if;

  if not exists (
    select 1 from public.academic_periods where id = p_source_period_id
  ) then
    raise exception 'Source Academic Period was not found';
  end if;

  select status
  into v_target_status
  from public.academic_periods
  where id = p_target_period_id;

  if v_target_status is null then
    raise exception 'Target Academic Period was not found';
  end if;

  if v_target_status = 'archived' then
    raise exception 'Archived Academic Periods cannot be configured';
  end if;

  -- Copy working days idempotently
  for v_day in
    select day_of_week, sequence_number, is_enabled, notes
    from public.working_days
    where academic_period_id = p_source_period_id
      and is_enabled = true
    order by sequence_number
  loop
    if not exists (
      select 1
      from public.working_days existing
      where existing.academic_period_id = p_target_period_id
        and (
          existing.day_of_week = v_day.day_of_week
          or existing.sequence_number = v_day.sequence_number
        )
    ) then
      insert into public.working_days (
        academic_period_id,
        day_of_week,
        sequence_number,
        is_enabled,
        notes,
        created_by,
        updated_by
      ) values (
        p_target_period_id,
        v_day.day_of_week,
        v_day.sequence_number,
        v_day.is_enabled,
        v_day.notes,
        p_actor_id,
        p_actor_id
      );
      v_copied_days := v_copied_days + 1;
    end if;
  end loop;

  -- Copy time slots idempotently (respecting GiST overlap and unique indexes)
  for v_slot in
    select name, code, slot_type, starts_at, ends_at, sequence_number, is_enabled, notes
    from public.time_slots
    where academic_period_id = p_source_period_id
      and is_enabled = true
    order by sequence_number
  loop
    if not exists (
      select 1
      from public.time_slots existing
      where existing.academic_period_id = p_target_period_id
        and (
          lower(trim(existing.code)) = lower(trim(v_slot.code))
          or lower(trim(existing.name)) = lower(trim(v_slot.name))
          or existing.sequence_number = v_slot.sequence_number
          or (
            existing.is_enabled = true
            and existing.starts_at < v_slot.ends_at
            and v_slot.starts_at < existing.ends_at
          )
        )
    ) then
      insert into public.time_slots (
        academic_period_id,
        name,
        code,
        slot_type,
        starts_at,
        ends_at,
        sequence_number,
        is_enabled,
        notes,
        created_by,
        updated_by
      ) values (
        p_target_period_id,
        v_slot.name,
        v_slot.code,
        v_slot.slot_type,
        v_slot.starts_at,
        v_slot.ends_at,
        v_slot.sequence_number,
        v_slot.is_enabled,
        v_slot.notes,
        p_actor_id,
        p_actor_id
      );
      v_copied_slots := v_copied_slots + 1;
    end if;
  end loop;

  -- Copy trainer availability mapped by (day_of_week, slot.code)
  insert into public.trainer_availability (
    trainer_id,
    academic_period_id,
    working_day_id,
    time_slot_id,
    created_by
  )
  select
    source_avail.trainer_id,
    p_target_period_id,
    target_day.id,
    target_slot.id,
    p_actor_id
  from public.trainer_availability source_avail
  join public.working_days source_day
    on source_day.id = source_avail.working_day_id
  join public.time_slots source_slot
    on source_slot.id = source_avail.time_slot_id
  join public.working_days target_day
    on target_day.academic_period_id = p_target_period_id
   and target_day.day_of_week = source_day.day_of_week
   and target_day.is_enabled = true
  join public.time_slots target_slot
    on target_slot.academic_period_id = p_target_period_id
   and lower(trim(target_slot.code)) = lower(trim(source_slot.code))
   and target_slot.is_enabled = true
  where source_avail.academic_period_id = p_source_period_id
  on conflict (trainer_id, academic_period_id, working_day_id, time_slot_id) do nothing;

  get diagnostics v_copied_availability = row_count;

  -- Copy active recurring scheduling constraints idempotently
  insert into public.scheduling_constraints (
    academic_period_id,
    subject_type,
    subject_id,
    constraint_type,
    working_day_id,
    starts_at,
    ends_at,
    priority,
    reason,
    is_active,
    created_by,
    updated_by
  )
  select
    p_target_period_id,
    src.subject_type,
    src.subject_id,
    src.constraint_type,
    target_day.id,
    src.starts_at,
    src.ends_at,
    src.priority,
    src.reason,
    true,
    p_actor_id,
    p_actor_id
  from public.scheduling_constraints src
  left join public.working_days source_day
    on source_day.id = src.working_day_id
  left join public.working_days target_day
    on target_day.academic_period_id = p_target_period_id
   and source_day.id is not null
   and target_day.day_of_week = source_day.day_of_week
  where src.academic_period_id = p_source_period_id
    and src.is_active = true
    and (src.working_day_id is null or target_day.id is not null)
    and not exists (
      select 1
      from public.scheduling_constraints existing
      where existing.academic_period_id = p_target_period_id
        and existing.is_active = true
        and existing.subject_type = src.subject_type
        and existing.subject_id is not distinct from src.subject_id
        and existing.constraint_type = src.constraint_type
        and existing.working_day_id is not distinct from target_day.id
        and existing.starts_at is not distinct from src.starts_at
        and existing.ends_at is not distinct from src.ends_at
        and existing.reason = src.reason
    );

  get diagnostics v_copied_constraints = row_count;

  return jsonb_build_object(
    'copiedDays', v_copied_days,
    'copiedSlots', v_copied_slots,
    'copiedAvailability', v_copied_availability,
    'copiedConstraints', v_copied_constraints
  );
end;
$$;

revoke all on function public.copy_timetable_setup_internal(uuid, uuid, uuid) from public;

create or replace function public.carry_forward_timetable_setup(
  p_source_period_id uuid,
  p_target_period_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null
    or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception using
      errcode = '42501',
      message = 'You are not authorized to copy timetable setup';
  end if;

  return public.copy_timetable_setup_internal(
    p_source_period_id,
    p_target_period_id,
    v_user_id
  );
end;
$$;

revoke all on function public.carry_forward_timetable_setup(uuid, uuid) from public;
grant execute on function public.carry_forward_timetable_setup(uuid, uuid) to authenticated;

create or replace function public.propagate_timetable_setup_to_planned_periods(
  p_source_period_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_starts_on date;
  v_source_status public.academic_period_status;
  v_target record;
  v_updated_periods integer := 0;
begin
  if v_user_id is null
    or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception using
      errcode = '42501',
      message = 'You are not authorized to propagate timetable setup';
  end if;

  select starts_on, status
  into v_source_starts_on, v_source_status
  from public.academic_periods
  where id = p_source_period_id;

  if v_source_starts_on is null or v_source_status = 'archived' then
    return 0;
  end if;

  for v_target in
    select id
    from public.academic_periods
    where status = 'planned'
      and id <> p_source_period_id
      and starts_on >= v_source_starts_on
    order by starts_on
  loop
    perform public.copy_timetable_setup_internal(
      p_source_period_id,
      v_target.id,
      v_user_id
    );
    v_updated_periods := v_updated_periods + 1;
  end loop;

  return v_updated_periods;
end;
$$;

revoke all on function public.propagate_timetable_setup_to_planned_periods(uuid) from public;
grant execute on function public.propagate_timetable_setup_to_planned_periods(uuid) to authenticated;

create or replace function public.sync_trainer_availability_to_future_periods(
  p_trainer_id uuid,
  p_source_period_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_starts_on date;
  v_target record;
  v_synced_periods integer := 0;
begin
  if v_user_id is null
    or not public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]) then
    raise exception using
      errcode = '42501',
      message = 'You are not authorized to sync trainer availability';
  end if;

  if p_trainer_id is null or p_source_period_id is null then
    return 0;
  end if;

  select starts_on
  into v_source_starts_on
  from public.academic_periods
  where id = p_source_period_id;

  if v_source_starts_on is null then
    return 0;
  end if;

  for v_target in
    select period.id
    from public.academic_periods period
    where period.status = 'planned'
      and period.id <> p_source_period_id
      and period.starts_on >= v_source_starts_on
      and not exists (
        select 1
        from public.scheduled_sessions session
        where session.academic_period_id = period.id
          and session.trainer_id = p_trainer_id
          and session.status not in ('cancelled', 'archived')
      )
    order by period.starts_on
  loop
    -- Ensure target period has the source calendar days/slots first
    perform public.copy_timetable_setup_internal(
      p_source_period_id,
      v_target.id,
      v_user_id
    );

    delete from public.trainer_availability
    where trainer_id = p_trainer_id
      and academic_period_id = v_target.id;

    insert into public.trainer_availability (
      trainer_id,
      academic_period_id,
      working_day_id,
      time_slot_id,
      created_by
    )
    select
      p_trainer_id,
      v_target.id,
      target_day.id,
      target_slot.id,
      v_user_id
    from public.trainer_availability source_avail
    join public.working_days source_day
      on source_day.id = source_avail.working_day_id
    join public.time_slots source_slot
      on source_slot.id = source_avail.time_slot_id
    join public.working_days target_day
      on target_day.academic_period_id = v_target.id
     and target_day.day_of_week = source_day.day_of_week
     and target_day.is_enabled = true
    join public.time_slots target_slot
      on target_slot.academic_period_id = v_target.id
     and lower(trim(target_slot.code)) = lower(trim(source_slot.code))
     and target_slot.is_enabled = true
    where source_avail.trainer_id = p_trainer_id
      and source_avail.academic_period_id = p_source_period_id
    on conflict (trainer_id, academic_period_id, working_day_id, time_slot_id) do nothing;

    v_synced_periods := v_synced_periods + 1;
  end loop;

  return v_synced_periods;
end;
$$;

revoke all on function public.sync_trainer_availability_to_future_periods(uuid, uuid) from public;
grant execute on function public.sync_trainer_availability_to_future_periods(uuid, uuid) to authenticated;

create or replace function public.auto_inherit_standing_timetable_setup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
begin
  if new.status <> 'planned' then
    return new;
  end if;

  select period.id
  into v_source_id
  from public.academic_periods period
  where period.id <> new.id
    and exists (
      select 1
      from public.working_days wd
      where wd.academic_period_id = period.id
        and wd.is_enabled = true
    )
    and exists (
      select 1
      from public.time_slots ts
      where ts.academic_period_id = period.id
        and ts.is_enabled = true
        and ts.slot_type = 'teaching'
    )
  order by (period.status = 'active') desc, period.starts_on desc
  limit 1;

  if v_source_id is not null then
    perform public.copy_timetable_setup_internal(
      v_source_id,
      new.id,
      coalesce(auth.uid(), new.created_by)
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auto_inherit_standing_timetable_setup_trigger on public.academic_periods;
create trigger auto_inherit_standing_timetable_setup_trigger
after insert on public.academic_periods
for each row
execute function public.auto_inherit_standing_timetable_setup();

-- Backfill: inherit the standing active setup into JAN-APR-27 and all later planned periods
do $$
declare
  v_source_id uuid;
  v_source_starts_on date;
  v_target record;
begin
  select period.id, period.starts_on
  into v_source_id, v_source_starts_on
  from public.academic_periods period
  where exists (
      select 1
      from public.working_days wd
      where wd.academic_period_id = period.id
        and wd.is_enabled = true
    )
    and exists (
      select 1
      from public.time_slots ts
      where ts.academic_period_id = period.id
        and ts.is_enabled = true
        and ts.slot_type = 'teaching'
    )
  order by (period.status = 'active') desc, period.starts_on desc
  limit 1;

  if v_source_id is null then
    return;
  end if;

  for v_target in
    select period.id
    from public.academic_periods period
    where period.status = 'planned'
      and period.id <> v_source_id
      and period.starts_on >= v_source_starts_on
    order by period.starts_on
  loop
    perform public.copy_timetable_setup_internal(
      v_source_id,
      v_target.id,
      null
    );
  end loop;
end;
$$;

commit;
