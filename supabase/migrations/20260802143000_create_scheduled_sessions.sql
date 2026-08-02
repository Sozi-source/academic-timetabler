-- ============================================================
-- HND App: Scheduled Sessions
-- ============================================================
--
-- Stores concrete weekly timetable placements generated from
-- teaching allocations.
--
-- A scheduled session is the canonical source for trainer,
-- cohort, room and time-slot timetable occupancy.
-- ============================================================

-- ------------------------------------------------------------
-- Enumerations
-- ------------------------------------------------------------

do $$
begin
  create type public.scheduled_session_status as enum (
    'draft',
    'confirmed',
    'locked',
    'cancelled',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.scheduled_session_source as enum (
    'manual',
    'generator',
    'import',
    'reschedule'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.scheduled_session_conflict_state as enum (
    'unchecked',
    'clear',
    'warning',
    'blocked'
  );
exception
  when duplicate_object then null;
end
$$;

-- ============================================================
-- Scheduled Sessions
-- ============================================================

create table public.scheduled_sessions (
  id uuid primary key default gen_random_uuid(),

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  teaching_allocation_id uuid not null
    references public.teaching_allocations(id)
    on delete restrict,

  cohort_id uuid not null
    references public.cohorts(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  trainer_id uuid not null
    references public.trainers(id)
    on delete restrict,

  working_day_id uuid not null
    references public.working_days(id)
    on delete restrict,

  start_time_slot_id uuid not null
    references public.time_slots(id)
    on delete restrict,

  end_time_slot_id uuid not null
    references public.time_slots(id)
    on delete restrict,

  room_id uuid not null
    references public.rooms(id)
    on delete restrict,

  session_number smallint not null,

  delivery_mode public.teaching_delivery_mode not null,

  status public.scheduled_session_status
    not null
    default 'draft',

  source public.scheduled_session_source
    not null
    default 'manual',

  conflict_state public.scheduled_session_conflict_state
    not null
    default 'unchecked',

  is_locked boolean
    not null
    default false,

  notes text,

  created_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  updated_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint scheduled_sessions_session_number_check
    check (
      session_number between 1 and 50
    ),

  constraint scheduled_sessions_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1000
    ),

  constraint scheduled_sessions_lock_state_check
    check (
      (
        status = 'locked'
        and is_locked = true
      )
      or (
        status <> 'locked'
        and is_locked = false
      )
    )
);

-- One numbered weekly session per teaching allocation.
create unique index
  scheduled_sessions_allocation_number_unique_idx
on public.scheduled_sessions (
  teaching_allocation_id,
  session_number
)
where status not in (
  'cancelled',
  'archived'
);

-- Prevent an identical active placement from being registered twice.
create unique index
  scheduled_sessions_placement_unique_idx
on public.scheduled_sessions (
  academic_period_id,
  teaching_allocation_id,
  working_day_id,
  start_time_slot_id,
  end_time_slot_id,
  room_id
)
where status not in (
  'cancelled',
  'archived'
);

create index scheduled_sessions_period_idx
  on public.scheduled_sessions (
    academic_period_id
  );

create index scheduled_sessions_allocation_idx
  on public.scheduled_sessions (
    teaching_allocation_id
  );

create index scheduled_sessions_period_day_idx
  on public.scheduled_sessions (
    academic_period_id,
    working_day_id
  );

create index scheduled_sessions_trainer_day_idx
  on public.scheduled_sessions (
    academic_period_id,
    working_day_id,
    trainer_id
  )
  where status not in (
    'cancelled',
    'archived'
  );

create index scheduled_sessions_cohort_day_idx
  on public.scheduled_sessions (
    academic_period_id,
    working_day_id,
    cohort_id
  )
  where status not in (
    'cancelled',
    'archived'
  );

create index scheduled_sessions_room_day_idx
  on public.scheduled_sessions (
    academic_period_id,
    working_day_id,
    room_id
  )
  where status not in (
    'cancelled',
    'archived'
  );

create index scheduled_sessions_unit_idx
  on public.scheduled_sessions (
    academic_period_id,
    unit_id
  );

create index scheduled_sessions_status_idx
  on public.scheduled_sessions (
    academic_period_id,
    status
  );

create index scheduled_sessions_conflict_state_idx
  on public.scheduled_sessions (
    academic_period_id,
    conflict_state
  );

create index scheduled_sessions_start_slot_idx
  on public.scheduled_sessions (
    start_time_slot_id
  );

create index scheduled_sessions_end_slot_idx
  on public.scheduled_sessions (
    end_time_slot_id
  );

-- ============================================================
-- Relationship, availability and placement validation
-- ============================================================

create or replace function
  public.validate_scheduled_session_relationships()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_allocation public.teaching_allocations%rowtype;
  selected_working_day public.working_days%rowtype;
  selected_start_slot public.time_slots%rowtype;
  selected_end_slot public.time_slots%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
  selected_trainer public.trainers%rowtype;
  selected_room public.rooms%rowtype;

  included_slot_count integer;
  included_teaching_slot_count integer;
  scheduled_duration_minutes integer;
  active_session_count integer;
begin
  select *
  into selected_period
  from public.academic_periods
  where id = new.academic_period_id;

  if selected_period.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  if selected_period.status <> 'open' then
    raise exception using
      errcode = 'P0001',
      message =
        'Scheduled sessions require an open Academic Period';
  end if;

  select *
  into selected_allocation
  from public.teaching_allocations
  where id = new.teaching_allocation_id;

  if selected_allocation.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Teaching allocation not found';
  end if;

  if selected_allocation.academic_period_id <>
     new.academic_period_id then
    raise exception using
      errcode = 'P0001',
      message =
        'The teaching allocation belongs to a different Academic Period';
  end if;

  if selected_allocation.status not in (
    'draft',
    'active'
  ) then
    raise exception using
      errcode = 'P0001',
      message =
        'Only draft or active teaching allocations may be scheduled';
  end if;

  if selected_allocation.is_timetable_enabled = false then
    raise exception using
      errcode = 'P0001',
      message =
        'The teaching allocation is not enabled for timetabling';
  end if;

  -- Allocation-owned fields are authoritative.
  new.cohort_id = selected_allocation.cohort_id;
  new.unit_id = selected_allocation.unit_id;
  new.trainer_id = selected_allocation.trainer_id;
  new.delivery_mode = selected_allocation.delivery_mode;

  if new.session_number >
     selected_allocation.weekly_sessions then
    raise exception using
      errcode = 'P0001',
      message =
        'The session number exceeds the allocation weekly session requirement';
  end if;

  select *
  into selected_working_day
  from public.working_days
  where id = new.working_day_id;

  if selected_working_day.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Working day not found';
  end if;

  if selected_working_day.academic_period_id <>
     new.academic_period_id then
    raise exception using
      errcode = 'P0001',
      message =
        'The working day belongs to a different Academic Period';
  end if;

  if selected_working_day.is_enabled = false then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected working day is disabled';
  end if;

  select *
  into selected_start_slot
  from public.time_slots
  where id = new.start_time_slot_id;

  if selected_start_slot.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Start time slot not found';
  end if;

  select *
  into selected_end_slot
  from public.time_slots
  where id = new.end_time_slot_id;

  if selected_end_slot.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'End time slot not found';
  end if;

  if selected_start_slot.academic_period_id <>
       new.academic_period_id
     or selected_end_slot.academic_period_id <>
       new.academic_period_id then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected time slots belong to a different Academic Period';
  end if;

  if selected_start_slot.is_enabled = false
     or selected_end_slot.is_enabled = false then
    raise exception using
      errcode = 'P0001',
      message =
        'Disabled time slots cannot be used for scheduling';
  end if;

  if selected_start_slot.slot_type <> 'teaching'
     or selected_end_slot.slot_type <> 'teaching' then
    raise exception using
      errcode = 'P0001',
      message =
        'Scheduled sessions must begin and end in teaching slots';
  end if;

  if selected_end_slot.sequence_number <
     selected_start_slot.sequence_number then
    raise exception using
      errcode = 'P0001',
      message =
        'The end time slot cannot precede the start time slot';
  end if;

  select
    count(*),
    count(*) filter (
      where is_enabled = true
      and slot_type = 'teaching'
    )
  into
    included_slot_count,
    included_teaching_slot_count
  from public.time_slots
  where academic_period_id = new.academic_period_id
    and sequence_number between
      selected_start_slot.sequence_number
      and selected_end_slot.sequence_number;

  if included_slot_count = 0
     or included_slot_count <>
       included_teaching_slot_count then
    raise exception using
      errcode = 'P0001',
      message =
        'A scheduled session cannot span a break, lunch, assembly or disabled slot';
  end if;

  scheduled_duration_minutes =
    extract(
      epoch from (
        selected_end_slot.ends_at -
        selected_start_slot.starts_at
      )
    )::integer / 60;

  if scheduled_duration_minutes <>
     selected_allocation.session_duration_minutes then
    raise exception using
      errcode = 'P0001',
      message = format(
        'The selected slot range is %s minutes but the teaching allocation requires %s minutes',
        scheduled_duration_minutes,
        selected_allocation.session_duration_minutes
      );
  end if;

  select *
  into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cohort not found';
  end if;

  if selected_cohort.status not in (
    'planned',
    'active'
  )
     or selected_cohort.is_timetable_available = false then
    raise exception using
      errcode = 'P0001',
      message =
        'The cohort is not available for timetabling';
  end if;

  select *
  into selected_unit
  from public.units
  where id = new.unit_id;

  if selected_unit.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Unit not found';
  end if;

  if selected_unit.is_active = false
     or selected_unit.is_timetable_available = false then
    raise exception using
      errcode = 'P0001',
      message =
        'The unit is not available for timetabling';
  end if;

  select *
  into selected_trainer
  from public.trainers
  where id = new.trainer_id;

  if selected_trainer.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Trainer not found';
  end if;

  if selected_trainer.is_active = false
     or selected_trainer.is_timetable_available = false then
    raise exception using
      errcode = 'P0001',
      message =
        'The trainer is not available for timetabling';
  end if;

  select *
  into selected_room
  from public.rooms
  where id = new.room_id;

  if selected_room.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Room not found';
  end if;

  if selected_room.is_active = false
     or selected_room.is_timetable_available = false then
    raise exception using
      errcode = 'P0001',
      message =
        'The room is not available for timetabling';
  end if;

  if selected_cohort.actual_size > 0
     and selected_room.capacity <
       selected_cohort.actual_size then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected room capacity is below the cohort enrolment';
  end if;

  if selected_unit.preferred_room_type is not null
     and selected_room.room_type <>
       selected_unit.preferred_room_type then
    raise exception using
      errcode = 'P0001',
      message = format(
        'The unit requires a %s room but %s was selected',
        selected_unit.preferred_room_type,
        selected_room.room_type
      );
  end if;

  select count(*)
  into active_session_count
  from public.scheduled_sessions
  where teaching_allocation_id =
        new.teaching_allocation_id
    and status not in (
      'cancelled',
      'archived'
    )
    and id <> new.id;

  if active_session_count >=
     selected_allocation.weekly_sessions then
    raise exception using
      errcode = 'P0001',
      message =
        'The teaching allocation already has all required weekly sessions scheduled';
  end if;

  return new;
end;
$$;

-- ============================================================
-- Clash and workload validation
-- ============================================================

create or replace function
  public.validate_scheduled_session_conflicts()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_start_slot public.time_slots%rowtype;
  selected_end_slot public.time_slots%rowtype;
  selected_trainer public.trainers%rowtype;

  session_duration_minutes integer;
  existing_daily_minutes integer;
  existing_weekly_minutes integer;

  trainer_conflict_exists boolean;
  cohort_conflict_exists boolean;
  room_conflict_exists boolean;
begin
  if new.status in (
    'cancelled',
    'archived'
  ) then
    new.conflict_state = 'clear';
    return new;
  end if;

  select *
  into selected_start_slot
  from public.time_slots
  where id = new.start_time_slot_id;

  select *
  into selected_end_slot
  from public.time_slots
  where id = new.end_time_slot_id;

  select *
  into selected_trainer
  from public.trainers
  where id = new.trainer_id;

  session_duration_minutes =
    extract(
      epoch from (
        selected_end_slot.ends_at -
        selected_start_slot.starts_at
      )
    )::integer / 60;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id =
         existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id =
         existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id =
          new.academic_period_id
      and existing.working_day_id =
          new.working_day_id
      and existing.trainer_id =
          new.trainer_id
      and existing.status not in (
        'cancelled',
        'archived'
      )
      and existing_start.starts_at <
          selected_end_slot.ends_at
      and selected_start_slot.starts_at <
          existing_end.ends_at
  )
  into trainer_conflict_exists;

  if trainer_conflict_exists then
    raise exception using
      errcode = '23P01',
      message =
        'Trainer clash: the trainer already has another session during the selected time';
  end if;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id =
         existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id =
         existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id =
          new.academic_period_id
      and existing.working_day_id =
          new.working_day_id
      and existing.cohort_id =
          new.cohort_id
      and existing.status not in (
        'cancelled',
        'archived'
      )
      and existing_start.starts_at <
          selected_end_slot.ends_at
      and selected_start_slot.starts_at <
          existing_end.ends_at
  )
  into cohort_conflict_exists;

  if cohort_conflict_exists then
    raise exception using
      errcode = '23P01',
      message =
        'Cohort clash: the cohort already has another session during the selected time';
  end if;

  select exists (
    select 1
    from public.scheduled_sessions existing
    join public.time_slots existing_start
      on existing_start.id =
         existing.start_time_slot_id
    join public.time_slots existing_end
      on existing_end.id =
         existing.end_time_slot_id
    where existing.id <> new.id
      and existing.academic_period_id =
          new.academic_period_id
      and existing.working_day_id =
          new.working_day_id
      and existing.room_id =
          new.room_id
      and existing.status not in (
        'cancelled',
        'archived'
      )
      and existing_start.starts_at <
          selected_end_slot.ends_at
      and selected_start_slot.starts_at <
          existing_end.ends_at
  )
  into room_conflict_exists;

  if room_conflict_exists then
    raise exception using
      errcode = '23P01',
      message =
        'Room clash: the room already has another session during the selected time';
  end if;

  select coalesce(
    sum(
      extract(
        epoch from (
          existing_end.ends_at -
          existing_start.starts_at
        )
      )::integer / 60
    ),
    0
  )
  into existing_daily_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start
    on existing_start.id =
       existing.start_time_slot_id
  join public.time_slots existing_end
    on existing_end.id =
       existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id =
        new.academic_period_id
    and existing.working_day_id =
        new.working_day_id
    and existing.trainer_id =
        new.trainer_id
    and existing.status not in (
      'cancelled',
      'archived'
    );

  if existing_daily_minutes +
     session_duration_minutes >
     selected_trainer.maximum_daily_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message =
        'The scheduled session would exceed the trainer maximum daily workload';
  end if;

  select coalesce(
    sum(
      extract(
        epoch from (
          existing_end.ends_at -
          existing_start.starts_at
        )
      )::integer / 60
    ),
    0
  )
  into existing_weekly_minutes
  from public.scheduled_sessions existing
  join public.time_slots existing_start
    on existing_start.id =
       existing.start_time_slot_id
  join public.time_slots existing_end
    on existing_end.id =
       existing.end_time_slot_id
  where existing.id <> new.id
    and existing.academic_period_id =
        new.academic_period_id
    and existing.trainer_id =
        new.trainer_id
    and existing.status not in (
      'cancelled',
      'archived'
    );

  if existing_weekly_minutes +
     session_duration_minutes >
     selected_trainer.maximum_weekly_hours * 60 then
    raise exception using
      errcode = 'P0001',
      message =
        'The scheduled session would exceed the trainer maximum weekly workload';
  end if;

  new.conflict_state = 'clear';

  return new;
end;
$$;

-- ============================================================
-- Audit, lifecycle and locking
-- ============================================================

create or replace function
  public.set_scheduled_session_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.notes =
    nullif(trim(new.notes), '');

  new.updated_at = now();
  new.updated_by = auth.uid();

  if new.status = 'locked' then
    new.is_locked = true;
  else
    new.is_locked = false;
  end if;

  if tg_op = 'UPDATE'
     and old.is_locked = true
     and (
       new.academic_period_id <>
         old.academic_period_id
       or new.teaching_allocation_id <>
         old.teaching_allocation_id
       or new.working_day_id <>
         old.working_day_id
       or new.start_time_slot_id <>
         old.start_time_slot_id
       or new.end_time_slot_id <>
         old.end_time_slot_id
       or new.room_id <> old.room_id
       or new.session_number <>
         old.session_number
     )
     and not (
       select public.current_user_has_role(
         array[
           'system_admin'
         ]::public.app_role[]
       )
     ) then
    raise exception using
      errcode = 'P0001',
      message =
        'Locked scheduled sessions can only be repositioned by a system administrator';
  end if;

  return new;
end;
$$;

create trigger
  scheduled_sessions_set_audit_fields
before insert or update
on public.scheduled_sessions
for each row
execute function
  public.set_scheduled_session_audit_fields();

create trigger
  scheduled_sessions_validate_relationships
before insert or update
on public.scheduled_sessions
for each row
execute function
  public.validate_scheduled_session_relationships();

create trigger
  scheduled_sessions_validate_conflicts
before insert or update
on public.scheduled_sessions
for each row
execute function
  public.validate_scheduled_session_conflicts();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table public.scheduled_sessions
enable row level security;

revoke all
on table public.scheduled_sessions
from anon;

revoke all
on table public.scheduled_sessions
from authenticated;

grant select, insert, update
on table public.scheduled_sessions
to authenticated;

create policy
  "Authorized staff can view scheduled sessions"
on public.scheduled_sessions
for select
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

create policy
  "Authorized staff can create scheduled sessions"
on public.scheduled_sessions
for insert
to authenticated
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
  and created_by = (select auth.uid())
);

create policy
  "Authorized staff can update scheduled sessions"
on public.scheduled_sessions
for update
to authenticated
using (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
)
with check (
  (
    select public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
  )
);

-- No DELETE policy is intentionally provided.
-- Scheduled sessions are cancelled or archived to preserve
-- timetable, workload and audit history.

-- ============================================================
-- Documentation
-- ============================================================

comment on table public.scheduled_sessions is
  'Concrete weekly timetable placements generated from teaching allocations.';

comment on column
  public.scheduled_sessions.teaching_allocation_id is
  'Teaching requirement from which the scheduled session was created.';

comment on column
  public.scheduled_sessions.session_number is
  'Numbered weekly occurrence within the teaching allocation requirement.';

comment on column
  public.scheduled_sessions.start_time_slot_id is
  'First timetable slot occupied by the session.';

comment on column
  public.scheduled_sessions.end_time_slot_id is
  'Last timetable slot occupied by the session.';

comment on column
  public.scheduled_sessions.source is
  'Identifies whether the placement was manual, generated, imported or rescheduled.';

comment on column
  public.scheduled_sessions.conflict_state is
  'Cached result of the latest database conflict validation.';

comment on column
  public.scheduled_sessions.is_locked is
  'Prevents ordinary repositioning of an approved timetable session.';