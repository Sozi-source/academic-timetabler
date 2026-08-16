-- A readiness offering can intentionally be retained from another curriculum
-- stage. Unit on Offer records already audit that exception as origin=legacy
-- with a required reason. Honour that narrow exception when the corresponding
-- trainer-pending allocation is created, while retaining strict validation for
-- every ordinary teaching allocation.

create or replace function public.validate_teaching_allocation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
  selected_trainer public.trainers%rowtype;
  selected_room public.rooms%rowtype;
  has_audited_legacy_offering boolean := false;
begin
  select * into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  select * into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using errcode = 'P0002', message = 'Cohort not found';
  end if;

  select * into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Unit not found';
  end if;

  if new.trainer_id is not null then
    select * into selected_trainer
    from public.trainers
    where id = new.trainer_id;

    if selected_trainer.id is null then
      raise exception using errcode = 'P0002', message = 'Trainer not found';
    end if;
  end if;

  if new.preferred_room_id is not null then
    select * into selected_room
    from public.rooms
    where id = new.preferred_room_id;

    if selected_room.id is null then
      raise exception using errcode = 'P0002',
        message = 'Preferred room not found';
    end if;
  end if;

  if selected_unit.programme_id <> selected_cohort.programme_id then
    raise exception using errcode = 'P0001',
      message = 'The selected unit does not belong to the cohort programme';
  end if;

  if selected_unit.academic_period_number is distinct from
     selected_cohort.current_academic_period_number then
    select exists (
      select 1
      from public.unit_offerings offering
      where offering.academic_period_id = new.academic_period_id
        and offering.cohort_id = new.cohort_id
        and offering.unit_id = new.unit_id
        and offering.is_timetable_enabled = true
        and offering.origin = 'legacy'
        and nullif(trim(offering.exception_reason), '') is not null
    ) into has_audited_legacy_offering;

    if not has_audited_legacy_offering then
      raise exception using errcode = 'P0001',
        message = 'The unit does not belong to the cohort current programme period';
    end if;
  end if;

  if new.is_timetable_enabled
     and selected_period.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'The selected Academic Period is not open for timetable allocation';
  end if;

  if new.is_timetable_enabled
     and selected_cohort.status not in ('planned', 'active') then
    raise exception using errcode = 'P0001',
      message = 'The selected cohort is not available for timetable allocation';
  end if;

  if new.is_timetable_enabled and not selected_cohort.is_timetable_available then
    raise exception using errcode = 'P0001',
      message = 'The selected cohort is not enabled for timetabling';
  end if;

  if new.is_timetable_enabled and (
    not selected_unit.is_active or not selected_unit.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The selected unit is not available for timetabling';
  end if;

  if new.is_timetable_enabled and new.trainer_id is not null and (
    not selected_trainer.is_active or not selected_trainer.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The selected trainer is not available for timetabling';
  end if;

  if new.is_timetable_enabled and new.preferred_room_id is not null and (
    not selected_room.is_active or not selected_room.is_timetable_available
  ) then
    raise exception using errcode = 'P0001',
      message = 'The preferred room is not available for timetabling';
  end if;

  if new.preferred_room_id is not null
     and selected_cohort.actual_size > 0
     and selected_room.capacity < selected_cohort.actual_size then
    raise exception using errcode = 'P0001',
      message = 'The preferred room capacity is below the cohort enrolment';
  end if;

  if new.status in ('suspended', 'completed', 'archived') then
    new.is_timetable_enabled = false;
  end if;

  return new;
end;
$$;

comment on function public.validate_teaching_allocation() is
  'Validates timetable allocations and permits cross-stage units only through an enabled, audited legacy Unit on Offer exception.';
