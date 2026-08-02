-- ============================================================
-- HND App: Teaching Allocations
-- ============================================================

do $$
begin
  create type public.teaching_delivery_mode as enum (
    'theory',
    'practical',
    'clinical',
    'blended',
    'project',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.teaching_allocation_status as enum (
    'draft',
    'active',
    'suspended',
    'completed',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.teaching_allocations (
  id uuid primary key default gen_random_uuid(),

  academic_period_id uuid not null
    references public.academic_periods(id)
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

  preferred_room_id uuid
    references public.rooms(id)
    on delete set null,

  delivery_mode public.teaching_delivery_mode
    not null
    default 'theory',

  weekly_sessions smallint
    not null,

  session_duration_minutes smallint
    not null
    default 120,

  status public.teaching_allocation_status
    not null
    default 'draft',

  is_timetable_enabled boolean
    not null
    default true,

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

  constraint teaching_allocations_weekly_sessions_check
    check (
      weekly_sessions between 1 and 20
    ),

  constraint teaching_allocations_duration_check
    check (
      session_duration_minutes
      between 30 and 480
    ),

  constraint teaching_allocations_duration_increment_check
    check (
      session_duration_minutes % 15 = 0
    ),

  constraint teaching_allocations_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1500
    )
);

-- One cohort should receive one allocation for a unit
-- within one institutional Academic Period.
create unique index
  teaching_allocations_period_cohort_unit_unique_idx
on public.teaching_allocations (
  academic_period_id,
  cohort_id,
  unit_id
);

create index teaching_allocations_period_idx
  on public.teaching_allocations (
    academic_period_id
  );

create index teaching_allocations_cohort_idx
  on public.teaching_allocations (
    cohort_id
  );

create index teaching_allocations_unit_idx
  on public.teaching_allocations (
    unit_id
  );

create index teaching_allocations_trainer_idx
  on public.teaching_allocations (
    trainer_id
  );

create index teaching_allocations_room_idx
  on public.teaching_allocations (
    preferred_room_id
  )
  where preferred_room_id is not null;

create index teaching_allocations_status_idx
  on public.teaching_allocations (
    status,
    is_timetable_enabled
  );

create index teaching_allocations_trainer_period_idx
  on public.teaching_allocations (
    academic_period_id,
    trainer_id
  );

create index teaching_allocations_cohort_period_idx
  on public.teaching_allocations (
    academic_period_id,
    cohort_id
  );

-- ------------------------------------------------------------
-- Relationship and lifecycle validation
-- ------------------------------------------------------------

create or replace function
  public.validate_teaching_allocation()
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

  select *
  into selected_cohort
  from public.cohorts
  where id = new.cohort_id;

  if selected_cohort.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Cohort not found';
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

  select *
  into selected_trainer
  from public.trainers
  where id = new.trainer_id;

  if selected_trainer.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Trainer not found';
  end if;

  if new.preferred_room_id is not null then
    select *
    into selected_room
    from public.rooms
    where id = new.preferred_room_id;

    if selected_room.id is null then
      raise exception using
        errcode = 'P0002',
        message = 'Preferred room not found';
    end if;
  end if;

  -- The unit and cohort must belong to the same programme.
  if selected_unit.programme_id <>
     selected_cohort.programme_id then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected unit does not belong to the cohort programme';
  end if;

  -- The unit must match the cohort's current programme period.
  if selected_unit.academic_period_number <>
     selected_cohort.current_academic_period_number then
    raise exception using
      errcode = 'P0001',
      message =
        'The unit does not belong to the cohort current programme period';
  end if;

  -- Only planned or active institutional periods may
  -- receive timetable-enabled allocations.
  if new.is_timetable_enabled = true
     and selected_period.status not in (
       'planned',
       'active'
     ) then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected Academic Period is not open for timetable allocation';
  end if;

  -- Only planned or active cohorts may receive new
  -- timetable-enabled allocations.
  if new.is_timetable_enabled = true
     and selected_cohort.status not in (
       'planned',
       'active'
     ) then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected cohort is not available for timetable allocation';
  end if;

  if new.is_timetable_enabled = true
     and selected_cohort.is_timetable_available = false then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected cohort is not enabled for timetabling';
  end if;

  if new.is_timetable_enabled = true
     and (
       selected_unit.is_active = false
       or selected_unit.is_timetable_available = false
     ) then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected unit is not available for timetabling';
  end if;

  if new.is_timetable_enabled = true
     and (
       selected_trainer.is_active = false
       or selected_trainer.is_timetable_available = false
     ) then
    raise exception using
      errcode = 'P0001',
      message =
        'The selected trainer is not available for timetabling';
  end if;

  if new.is_timetable_enabled = true
     and new.preferred_room_id is not null
     and (
       selected_room.is_active = false
       or selected_room.is_timetable_available = false
     ) then
    raise exception using
      errcode = 'P0001',
      message =
        'The preferred room is not available for timetabling';
  end if;

  -- A selected room must accommodate the cohort when
  -- a confirmed learner population is available.
  if new.preferred_room_id is not null
     and selected_cohort.actual_size > 0
     and selected_room.capacity <
       selected_cohort.actual_size then
    raise exception using
      errcode = 'P0001',
      message =
        'The preferred room capacity is below the cohort enrolment';
  end if;

  -- Completed, suspended, or archived allocations cannot
  -- remain enabled for timetable generation.
  if new.status in (
    'suspended',
    'completed',
    'archived'
  ) then
    new.is_timetable_enabled = false;
  end if;

  return new;
end;
$$;

create trigger
  teaching_allocations_validate_relationships
before insert or update
on public.teaching_allocations
for each row
execute function
  public.validate_teaching_allocation();

-- ------------------------------------------------------------
-- Normalization and audit fields
-- ------------------------------------------------------------

create or replace function
  public.set_teaching_allocation_audit_fields()
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

  return new;
end;
$$;

create trigger
  teaching_allocations_set_audit_fields
before insert or update
on public.teaching_allocations
for each row
execute function
  public.set_teaching_allocation_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.teaching_allocations
enable row level security;

revoke all
on table public.teaching_allocations
from anon;

revoke all
on table public.teaching_allocations
from authenticated;

grant select, insert, update
on table public.teaching_allocations
to authenticated;

create policy
  "Authorized staff can view teaching allocations"
on public.teaching_allocations
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
  "Authorized staff can create teaching allocations"
on public.teaching_allocations
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
  "Authorized staff can update teaching allocations"
on public.teaching_allocations
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
-- Allocations must be retained for curriculum,
-- workload and timetable history.

comment on table public.teaching_allocations is
  'Links Academic Periods, cohorts, units, trainers and preferred rooms before timetable generation.';

comment on column
  public.teaching_allocations.weekly_sessions is
  'Number of timetable sessions required for the unit each week.';

comment on column
  public.teaching_allocations.session_duration_minutes is
  'Expected duration of each timetable session in minutes.';

comment on column
  public.teaching_allocations.preferred_room_id is
  'Optional preferred teaching room; the generator may use another compatible room if required.';

comment on column
  public.teaching_allocations.is_timetable_enabled is
  'Determines whether the allocation may be included in timetable generation.';