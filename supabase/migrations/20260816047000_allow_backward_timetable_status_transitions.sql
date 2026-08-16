-- Validation must protect timetable creation and forward publication states,
-- but it must not prevent an owner from moving a protected version backward
-- so that the live timetable can be repaired.

create or replace function public.block_timetable_version_hard_constraints()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.status in ('under_review', 'approved') and new.status = 'draft')
      or (old.status = 'published' and new.status = 'archived') then
      return new;
    end if;
  end if;

  if exists (
    select 1
    from public.scheduled_sessions session
    join public.cohorts cohort on cohort.id = session.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where session.academic_period_id = new.academic_period_id
      and programme.department_id = new.department_id
      and session.status in ('draft', 'confirmed', 'locked')
      and public.get_scheduled_session_hard_constraint_violation(
        session.academic_period_id,
        session.teaching_allocation_id,
        session.trainer_id,
        session.room_id,
        session.cohort_id,
        session.working_day_id,
        session.start_time_slot_id,
        session.end_time_slot_id
      ) is not null
  ) then
    raise exception
      'Resolve all hard scheduling-constraint conflicts before creating or publishing a timetable version';
  end if;

  return new;
end;
$$;

create or replace function public.block_timetable_version_with_pending_trainers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if (old.status in ('under_review', 'approved') and new.status = 'draft')
      or (old.status = 'published' and new.status = 'archived') then
      return new;
    end if;
  end if;

  if jsonb_typeof(new.snapshot) <> 'array'
    or jsonb_array_length(new.snapshot) <> new.session_count then
    raise exception
      'This version has an incomplete snapshot. Create a new timetable version before publishing';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.snapshot) snapshot_session
    join public.trainers trainer
      on trainer.id = nullif(snapshot_session ->> 'trainerId', '')::uuid
    join public.time_slots start_slot
      on start_slot.id = nullif(snapshot_session ->> 'startTimeSlotId', '')::uuid
    join public.time_slots end_slot
      on end_slot.id = nullif(snapshot_session ->> 'endTimeSlotId', '')::uuid
    where trainer.availability_mode = 'selected_slots_only'
      and exists (
        select 1
        from public.time_slots required_slot
        where required_slot.academic_period_id = new.academic_period_id
          and required_slot.is_enabled
          and required_slot.slot_type = 'teaching'
          and required_slot.sequence_number between
            start_slot.sequence_number and end_slot.sequence_number
          and not exists (
            select 1
            from public.trainer_availability availability
            where availability.trainer_id = trainer.id
              and availability.academic_period_id = new.academic_period_id
              and availability.working_day_id =
                nullif(snapshot_session ->> 'workingDayId', '')::uuid
              and availability.time_slot_id = required_slot.id
          )
      )
  ) then
    raise exception
      'Resolve all trainer selected-availability conflicts before creating or publishing a timetable version';
  end if;

  return new;
end;
$$;

comment on function public.block_timetable_version_hard_constraints() is
  'Blocks hard conflicts during version creation and forward publication while allowing audited backward repair transitions.';

comment on function public.block_timetable_version_with_pending_trainers() is
  'Blocks incomplete or availability-invalid snapshots during creation and forward publication while allowing audited backward repair transitions.';
