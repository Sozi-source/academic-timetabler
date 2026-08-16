-- Make the configured scheduling rules authoritative in generation, manual
-- editing and publication. Soft rules remain preferences; hard rules are
-- enforced at the database boundary.

create or replace function public.validate_scheduling_constraint_reference()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.working_day_id is not null
    and not exists (
      select 1
      from public.working_days day
      where day.id = new.working_day_id
        and day.academic_period_id = new.academic_period_id
    ) then
    raise exception using
      errcode = '23514',
      message = 'The scheduling constraint working day belongs to another Academic Period';
  end if;

  if new.subject_type = 'trainer'
    and not exists (
      select 1
      from public.trainers trainer
      where trainer.id = new.subject_id
        and trainer.department_id = new.department_id
    ) then
    raise exception using
      errcode = '23503',
      message = 'Select a valid trainer for this scheduling constraint';
  elsif new.subject_type = 'room'
    and not exists (
      select 1
      from public.rooms room
      where room.id = new.subject_id
        and room.department_id = new.department_id
    ) then
    raise exception using
      errcode = '23503',
      message = 'Select a valid room for this scheduling constraint';
  elsif new.subject_type = 'cohort'
    and not exists (
      select 1
      from public.cohorts cohort
      join public.programmes programme on programme.id = cohort.programme_id
      where cohort.id = new.subject_id
        and programme.department_id = new.department_id
    ) then
    raise exception using
      errcode = '23503',
      message = 'Select a valid cohort for this scheduling constraint';
  end if;

  if new.constraint_type in ('preferred', 'required')
    and new.working_day_id is null
    and new.starts_at is null then
    raise exception using
      errcode = '23514',
      message = 'Preferred and required constraints need a working day or time window';
  end if;

  return new;
end;
$$;

drop trigger if exists scheduling_constraints_validate_reference
on public.scheduling_constraints;

create trigger scheduling_constraints_validate_reference
before insert or update
on public.scheduling_constraints
for each row
execute function public.validate_scheduling_constraint_reference();

create or replace function public.get_scheduled_session_hard_constraint_violation(
  target_academic_period_id uuid,
  target_teaching_allocation_id uuid,
  target_trainer_id uuid,
  target_room_id uuid,
  target_cohort_id uuid,
  target_working_day_id uuid,
  target_start_time_slot_id uuid,
  target_end_time_slot_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  session_start time;
  session_end time;
  participant_cohort_ids uuid[] := array[target_cohort_id];
  target_department_id uuid;
  violation_reason text;
begin
  select start_slot.starts_at, end_slot.ends_at
  into session_start, session_end
  from public.time_slots start_slot
  cross join public.time_slots end_slot
  where start_slot.id = target_start_time_slot_id
    and end_slot.id = target_end_time_slot_id;

  if session_start is null or session_end is null then
    return null;
  end if;

  select
    array(
      select distinct participant_id
      from unnest(
        array_append(
          coalesce(allocation.participant_cohort_ids, '{}'::uuid[]),
          coalesce(target_cohort_id, allocation.cohort_id)
        )
      ) as participant(participant_id)
      where participant_id is not null
    ),
    programme.department_id
  into participant_cohort_ids, target_department_id
  from public.teaching_allocations allocation
  join public.cohorts cohort on cohort.id = allocation.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where allocation.id = target_teaching_allocation_id;

  if coalesce(cardinality(participant_cohort_ids), 0) = 0 then
    participant_cohort_ids := array[target_cohort_id];
  end if;

  select string_agg(constraint_row.reason, '; ' order by constraint_row.id)
  into violation_reason
  from public.scheduling_constraints constraint_row
  where constraint_row.academic_period_id = target_academic_period_id
    and constraint_row.department_id = target_department_id
    and constraint_row.is_active
    and constraint_row.priority = 'hard'
    and constraint_row.constraint_type in ('unavailable', 'protected_day')
    and (
      constraint_row.subject_type = 'institution'
      or (
        constraint_row.subject_type = 'trainer'
        and constraint_row.subject_id = target_trainer_id
      )
      or (
        constraint_row.subject_type = 'room'
        and constraint_row.subject_id = target_room_id
      )
      or (
        constraint_row.subject_type = 'cohort'
        and constraint_row.subject_id = any(participant_cohort_ids)
      )
    )
    and (
      constraint_row.working_day_id is null
      or constraint_row.working_day_id = target_working_day_id
    )
    and (
      constraint_row.starts_at is null
      or (
        session_start < constraint_row.ends_at
        and constraint_row.starts_at < session_end
      )
    );

  if violation_reason is not null then
    return 'Hard scheduling constraint: ' || violation_reason;
  end if;

  select string_agg(grouped.reason, '; ' order by grouped.reason)
  into violation_reason
  from (
    select
      constraint_row.subject_type,
      constraint_row.subject_id,
      constraint_row.constraint_type,
      string_agg(constraint_row.reason, '; ' order by constraint_row.id) as reason
    from public.scheduling_constraints constraint_row
    where constraint_row.academic_period_id = target_academic_period_id
      and constraint_row.department_id = target_department_id
      and constraint_row.is_active
      and constraint_row.priority = 'hard'
      and constraint_row.constraint_type in ('preferred', 'required')
      and (
        constraint_row.subject_type = 'institution'
        or (
          constraint_row.subject_type = 'trainer'
          and constraint_row.subject_id = target_trainer_id
        )
        or (
          constraint_row.subject_type = 'room'
          and constraint_row.subject_id = target_room_id
        )
        or (
          constraint_row.subject_type = 'cohort'
          and constraint_row.subject_id = any(participant_cohort_ids)
        )
      )
    group by
      constraint_row.subject_type,
      constraint_row.subject_id,
      constraint_row.constraint_type
    having not bool_or(
      (
        constraint_row.working_day_id is null
        or constraint_row.working_day_id = target_working_day_id
      )
      and (
        constraint_row.starts_at is null
        or (
          session_start >= constraint_row.starts_at
          and session_end <= constraint_row.ends_at
        )
      )
    )
  ) grouped;

  if violation_reason is not null then
    return 'Hard required scheduling window: ' || violation_reason;
  end if;

  return null;
end;
$$;

create or replace function public.enforce_scheduled_session_hard_constraints()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  violation text;
begin
  if new.status in ('cancelled', 'archived') then
    return new;
  end if;

  violation := public.get_scheduled_session_hard_constraint_violation(
    new.academic_period_id,
    new.teaching_allocation_id,
    new.trainer_id,
    new.room_id,
    new.cohort_id,
    new.working_day_id,
    new.start_time_slot_id,
    new.end_time_slot_id
  );

  if violation is not null then
    raise exception using
      errcode = 'P0001',
      message = violation;
  end if;

  return new;
end;
$$;

drop trigger if exists scheduled_sessions_enforce_hard_constraints
on public.scheduled_sessions;

create trigger scheduled_sessions_enforce_hard_constraints
before insert or update of
  academic_period_id,
  teaching_allocation_id,
  trainer_id,
  room_id,
  cohort_id,
  working_day_id,
  start_time_slot_id,
  end_time_slot_id,
  status
on public.scheduled_sessions
for each row
execute function public.enforce_scheduled_session_hard_constraints();

create or replace function public.block_timetable_version_hard_constraints()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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

drop trigger if exists timetable_versions_require_hard_constraints
on public.timetable_versions;

create trigger timetable_versions_require_hard_constraints
before insert or update of status
on public.timetable_versions
for each row
execute function public.block_timetable_version_hard_constraints();

-- Return local sessions together with external resource occupancy. The
-- explicit marker lets the planner reserve shared trainers and rooms without
-- judging another department's sessions against the current department's
-- configured scheduling rules.
create or replace function public.get_scheduler_resource_bookings(
  target_academic_period_id uuid
)
returns table (
  id uuid,
  academic_period_id uuid,
  teaching_allocation_id uuid,
  cohort_id uuid,
  unit_id uuid,
  trainer_id uuid,
  working_day_id uuid,
  start_time_slot_id uuid,
  end_time_slot_id uuid,
  room_id uuid,
  session_number smallint,
  delivery_mode public.teaching_delivery_mode,
  status public.scheduled_session_status,
  source public.scheduled_session_source,
  conflict_state public.scheduled_session_conflict_state,
  is_locked boolean,
  is_external boolean,
  participant_cohort_ids uuid[],
  combined_cohort_size integer,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    session.id,
    session.academic_period_id,
    session.teaching_allocation_id,
    session.cohort_id,
    session.unit_id,
    session.trainer_id,
    session.working_day_id,
    session.start_time_slot_id,
    session.end_time_slot_id,
    session.room_id,
    session.session_number,
    session.delivery_mode,
    session.status,
    session.source,
    session.conflict_state,
    (
      session.is_locked
      or programme.department_id
        <> public.current_user_primary_department_id()
    ) as is_locked,
    programme.department_id
      <> public.current_user_primary_department_id() as is_external,
    session.participant_cohort_ids,
    session.combined_cohort_size,
    session.notes,
    session.created_at,
    session.updated_at
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and session.status in ('draft', 'confirmed', 'locked')
    and public.current_user_has_role(
      array['hod', 'system_admin']::public.app_role[]
    );
$$;

revoke all on function public.get_scheduler_resource_bookings(uuid) from public;
grant execute on function public.get_scheduler_resource_bookings(uuid)
  to authenticated;

revoke all on function public.validate_scheduling_constraint_reference()
  from public;
revoke all on function public.get_scheduled_session_hard_constraint_violation(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) from public;
revoke all on function public.enforce_scheduled_session_hard_constraints()
  from public;
revoke all on function public.block_timetable_version_hard_constraints()
  from public;

comment on function public.get_scheduled_session_hard_constraint_violation(
  uuid, uuid, uuid, uuid, uuid, uuid, uuid, uuid
) is
  'Returns the first hard configured constraint violation for a timetable placement, including participant cohorts and alternative required windows.';

comment on function public.enforce_scheduled_session_hard_constraints() is
  'Enforces active hard institution, trainer, room and cohort scheduling constraints for every session writer.';

comment on function public.get_scheduler_resource_bookings(uuid) is
  'Returns local timetable sessions and external occupancy records, explicitly marking external sessions for constraint-safe planning.';
