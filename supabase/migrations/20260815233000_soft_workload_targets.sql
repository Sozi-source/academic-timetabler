-- Weekly workload is a reporting target, not an allocation blocker.
-- maximum_weekly_hours is retained only for compatibility with older clients.
-- The allocation RPC below no longer treats it as a weekly ceiling.

update public.trainers
set maximum_weekly_hours = 80
where maximum_weekly_hours <> 80;

update public.trainers
set normal_weekly_hours = case workload_role
  when 'hod' then 10
  when 'course_coordinator' then 16
  when 'full_time_trainer' then 20
  else normal_weekly_hours
end;

alter table public.trainers
  drop constraint if exists trainers_normal_workload_check;

alter table public.trainers
  add constraint trainers_normal_workload_check
  check (normal_weekly_hours > 0 and normal_weekly_hours <= 80);

create or replace function public.standardize_trainer_workload_target()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.normal_weekly_hours := case new.workload_role
    when 'hod' then 10
    when 'course_coordinator' then 16
    when 'full_time_trainer' then 20
    else new.normal_weekly_hours
  end;

  -- Keep the legacy RPC ceiling above every realistic weekly timetable load.
  new.maximum_weekly_hours := 80;
  return new;
end;
$$;

drop trigger if exists trainers_standardize_workload_target
on public.trainers;

create trigger trainers_standardize_workload_target
before insert or update of
  workload_role,
  normal_weekly_hours,
  maximum_weekly_hours
on public.trainers
for each row
execute function public.standardize_trainer_workload_target();

comment on column public.trainers.normal_weekly_hours is
  'Weekly teaching target: HOD 10h, course coordinator 16h, full-time trainer 20h; hours above target are reported as extra.';

comment on column public.trainers.maximum_weekly_hours is
  'Legacy compatibility value only; weekly teaching above normal_weekly_hours remains allocatable and is reported as extra workload.';

-- Replace the legacy allocation RPC so weekly targets never block an
-- allocation. Availability, eligibility and fixed-session rules still apply.
create or replace function public.assign_unit_offering(
  p_offering_id uuid,
  p_trainer_id uuid
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
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
    into
      fixed_required, fixed_day, fixed_slot,
      incomplete_fixed_count, fixed_pattern_count
    from public.teaching_offering_participants participant
    join public.unit_offerings member
      on member.id = participant.unit_offering_id
    where participant.teaching_offering_id = shared_offering.id;

    if fixed_required
      and (incomplete_fixed_count > 0 or fixed_pattern_count <> 1) then
      raise exception 'Every unit in the shared class must use the same fixed day and session';
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
    if fixed_required and (fixed_day is null or fixed_slot is null) then
      raise exception 'Set the fixed day and session before allocating this unit';
    end if;

    added_hours :=
      coalesce(offering.weekly_sessions, 1)
      * coalesce(offering.session_duration_minutes, 120) / 60.0;
  end if;

  if trainer.availability_mode = 'selected_slots_only'
    and not exists (
      select 1 from public.trainer_availability availability
      where availability.trainer_id = trainer.id
        and availability.academic_period_id = offering.academic_period_id
        and (
          not fixed_required
          or (
            availability.working_day_id = fixed_day
            and availability.time_slot_id = fixed_slot
          )
        )
    ) then
    raise exception 'Add an available teaching time for this trainer first';
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

  insert into public.teaching_allocations (
    academic_period_id, cohort_id, unit_id, trainer_id, delivery_mode,
    weekly_sessions, session_duration_minutes, status,
    is_timetable_enabled, teaching_offering_id, participant_cohort_ids,
    combined_cohort_size, notes
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
    case when shared_offering.id is null
      then null else 'Shared class: workload counted once' end
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
    'targetHours', trainer.normal_weekly_hours,
    'extraHours', greatest(projected_hours - trainer.normal_weekly_hours, 0),
    'isExtraLoad', projected_hours > trainer.normal_weekly_hours,
    'shared', shared_offering.id is not null
  );
end;
$$;
