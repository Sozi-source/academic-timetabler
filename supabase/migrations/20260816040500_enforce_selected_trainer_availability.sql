-- Selected trainer availability is a hard scheduling constraint. Enforce it
-- during generation, manual edits, conflict review and publication.

create or replace function public.enforce_scheduled_session_trainer_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  trainer_mode text;
  start_sequence integer;
  end_sequence integer;
begin
  if new.trainer_id is null
    or new.status in ('cancelled', 'archived') then
    return new;
  end if;

  select trainer.availability_mode
  into trainer_mode
  from public.trainers trainer
  where trainer.id = new.trainer_id;

  if trainer_mode is distinct from 'selected_slots_only' then
    return new;
  end if;

  select slot.sequence_number
  into start_sequence
  from public.time_slots slot
  where slot.id = new.start_time_slot_id;

  select slot.sequence_number
  into end_sequence
  from public.time_slots slot
  where slot.id = new.end_time_slot_id;

  if start_sequence is null or end_sequence is null then
    return new;
  end if;

  if exists (
    select 1
    from public.time_slots required_slot
    where required_slot.academic_period_id = new.academic_period_id
      and required_slot.is_enabled
      and required_slot.slot_type = 'teaching'
      and required_slot.sequence_number between start_sequence and end_sequence
      and not exists (
        select 1
        from public.trainer_availability availability
        where availability.trainer_id = new.trainer_id
          and availability.academic_period_id = new.academic_period_id
          and availability.working_day_id = new.working_day_id
          and availability.time_slot_id = required_slot.id
      )
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'Trainer availability clash: use one of the trainer checked available teaching periods';
  end if;

  return new;
end;
$$;

drop trigger if exists scheduled_sessions_enforce_trainer_availability
on public.scheduled_sessions;

create trigger scheduled_sessions_enforce_trainer_availability
before insert or update of
  trainer_id,
  academic_period_id,
  working_day_id,
  start_time_slot_id,
  end_time_slot_id,
  status
on public.scheduled_sessions
for each row
execute function public.enforce_scheduled_session_trainer_availability();

create or replace function public.block_timetable_version_with_pending_trainers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

comment on function public.enforce_scheduled_session_trainer_availability() is
  'Prevents assigned sessions from being placed outside a selected-time trainer checked availability, including every period of multi-slot sessions.';

comment on function public.block_timetable_version_with_pending_trainers() is
  'Validates snapshot completeness and selected trainer availability while allowing explicitly unassigned sessions.';
