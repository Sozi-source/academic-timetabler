-- ============================================================
-- Teaching Offerings
--
-- A teaching offering is the schedulable delivery of a subject
-- during one Academic Period.
--
-- One offering may contain one or several cohort/unit members.
-- Each member retains its programme-specific curriculum unit.
--
-- This migration is intentionally backward compatible:
-- existing teaching_allocations remain operational and are
-- linked to newly backfilled single-participant offerings.
-- ============================================================

create table public.teaching_offerings (
  id uuid primary key default gen_random_uuid(),

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  title text not null,

  normalized_title text generated always as (
    lower(
      regexp_replace(
        trim(title),
        '[^a-z0-9]+',
        ' ',
        'gi'
      )
    )
  ) stored,

  trainer_id uuid
    references public.trainers(id)
    on delete restrict,

  preferred_room_id uuid
    references public.rooms(id)
    on delete set null,

  delivery_mode public.teaching_delivery_mode
    not null
    default 'theory',

  weekly_sessions smallint
    not null
    default 1,

  session_duration_minutes smallint
    not null
    default 120,

  status public.teaching_allocation_status
    not null
    default 'draft',

  is_timetable_enabled boolean
    not null
    default true,

  legacy_teaching_allocation_id uuid
    references public.teaching_allocations(id)
    on delete set null,

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

  constraint teaching_offerings_title_check
    check (
      char_length(trim(title))
      between 2 and 250
    ),

  constraint teaching_offerings_weekly_sessions_check
    check (
      weekly_sessions between 1 and 20
    ),

  constraint teaching_offerings_duration_check
    check (
      session_duration_minutes
      between 30 and 480
    ),

  constraint teaching_offerings_duration_increment_check
    check (
      session_duration_minutes % 15 = 0
    ),

  constraint teaching_offerings_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1500
    )
);

create unique index
  teaching_offerings_legacy_allocation_unique_idx
on public.teaching_offerings (
  legacy_teaching_allocation_id
)
where legacy_teaching_allocation_id is not null;

create index teaching_offerings_period_idx
  on public.teaching_offerings (
    academic_period_id
  );

create index teaching_offerings_trainer_idx
  on public.teaching_offerings (
    trainer_id
  )
  where trainer_id is not null;

create index teaching_offerings_room_idx
  on public.teaching_offerings (
    preferred_room_id
  )
  where preferred_room_id is not null;

create index teaching_offerings_status_idx
  on public.teaching_offerings (
    status,
    is_timetable_enabled
  );

create index teaching_offerings_normalized_title_idx
  on public.teaching_offerings (
    normalized_title
  );

-- ------------------------------------------------------------
-- Offering participants
-- ------------------------------------------------------------

create table public.teaching_offering_participants (
  id uuid primary key default gen_random_uuid(),

  teaching_offering_id uuid not null
    references public.teaching_offerings(id)
    on delete cascade,

  cohort_id uuid not null
    references public.cohorts(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  is_primary boolean
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

  constraint teaching_offering_participants_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1000
    )
);

-- A cohort may participate only once in one offering.
create unique index
  teaching_offering_participants_offering_cohort_unique_idx
on public.teaching_offering_participants (
  teaching_offering_id,
  cohort_id
);

create index teaching_offering_participants_offering_idx
  on public.teaching_offering_participants (
    teaching_offering_id
  );

create index teaching_offering_participants_cohort_idx
  on public.teaching_offering_participants (
    cohort_id
  );

create index teaching_offering_participants_unit_idx
  on public.teaching_offering_participants (
    unit_id
  );

-- Only one member should be marked as the primary participant.
create unique index
  teaching_offering_participants_primary_unique_idx
on public.teaching_offering_participants (
  teaching_offering_id
)
where is_primary;

-- ------------------------------------------------------------
-- Audit functions
-- ------------------------------------------------------------

create or replace function
  public.set_teaching_offering_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();

  if tg_op = 'INSERT' then
    new.created_at =
      coalesce(new.created_at, now());

    new.created_by =
      coalesce(new.created_by, auth.uid());
  end if;

  return new;
end;
$$;

create or replace function
  public.set_teaching_offering_participant_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();

  if tg_op = 'INSERT' then
    new.created_at =
      coalesce(new.created_at, now());

    new.created_by =
      coalesce(new.created_by, auth.uid());
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Offering validation
-- ------------------------------------------------------------

create or replace function
  public.validate_teaching_offering()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
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

  if new.trainer_id is not null then
    select *
    into selected_trainer
    from public.trainers
    where id = new.trainer_id;

    if selected_trainer.id is null then
      raise exception using
        errcode = 'P0002',
        message = 'Trainer not found';
    end if;
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

  new.title = trim(new.title);

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Participant validation
-- ------------------------------------------------------------

create or replace function
  public.validate_teaching_offering_participant()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_offering public.teaching_offerings%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
begin
  select *
  into selected_offering
  from public.teaching_offerings
  where id = new.teaching_offering_id;

  if selected_offering.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Teaching offering not found';
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

  if selected_cohort.programme_id
      <> selected_unit.programme_id then
    raise exception using
      errcode = '23514',
      message =
        'The selected cohort and unit must belong to the same programme';
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- Triggers
-- ------------------------------------------------------------

create trigger
  teaching_offerings_validate_relationships
before insert or update
on public.teaching_offerings
for each row
execute function
  public.validate_teaching_offering();

create trigger
  teaching_offerings_set_audit_fields
before insert or update
on public.teaching_offerings
for each row
execute function
  public.set_teaching_offering_audit_fields();

create trigger
  teaching_offering_participants_validate_relationships
before insert or update
on public.teaching_offering_participants
for each row
execute function
  public.validate_teaching_offering_participant();

create trigger
  teaching_offering_participants_set_audit_fields
before insert or update
on public.teaching_offering_participants
for each row
execute function
  public.set_teaching_offering_participant_audit_fields();

-- ------------------------------------------------------------
-- Backward-compatible link from current allocations
-- ------------------------------------------------------------

alter table public.teaching_allocations
add column teaching_offering_id uuid
  references public.teaching_offerings(id)
  on delete set null;

create index teaching_allocations_offering_idx
  on public.teaching_allocations (
    teaching_offering_id
  )
  where teaching_offering_id is not null;

-- ------------------------------------------------------------
-- Backfill one offering for every current allocation
-- ------------------------------------------------------------

insert into public.teaching_offerings (
  academic_period_id,
  title,
  trainer_id,
  preferred_room_id,
  delivery_mode,
  weekly_sessions,
  session_duration_minutes,
  status,
  is_timetable_enabled,
  legacy_teaching_allocation_id,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  allocation.academic_period_id,
  unit_record.name,
  allocation.trainer_id,
  allocation.preferred_room_id,
  allocation.delivery_mode,
  allocation.weekly_sessions,
  allocation.session_duration_minutes,
  allocation.status,
  allocation.is_timetable_enabled,
  allocation.id,
  allocation.notes,
  allocation.created_by,
  allocation.updated_by,
  allocation.created_at,
  allocation.updated_at
from public.teaching_allocations allocation
join public.units unit_record
  on unit_record.id = allocation.unit_id
on conflict (
  legacy_teaching_allocation_id
)
where legacy_teaching_allocation_id is not null
do nothing;

update public.teaching_allocations allocation
set teaching_offering_id =
  offering.id
from public.teaching_offerings offering
where
  offering.legacy_teaching_allocation_id =
    allocation.id
  and allocation.teaching_offering_id is null;

insert into public.teaching_offering_participants (
  teaching_offering_id,
  cohort_id,
  unit_id,
  is_primary,
  notes,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  allocation.teaching_offering_id,
  allocation.cohort_id,
  allocation.unit_id,
  true,
  allocation.notes,
  allocation.created_by,
  allocation.updated_by,
  allocation.created_at,
  allocation.updated_at
from public.teaching_allocations allocation
where allocation.teaching_offering_id is not null
on conflict (
  teaching_offering_id,
  cohort_id
)
do nothing;

-- ------------------------------------------------------------
-- Secure-by-default RLS foundation
--
-- Policies will be added when the application query/action layer
-- starts using these tables. Until then, authenticated API access
-- is intentionally denied.
-- ------------------------------------------------------------

alter table public.teaching_offerings
  enable row level security;

alter table public.teaching_offering_participants
  enable row level security;

-- ------------------------------------------------------------
-- Documentation
-- ------------------------------------------------------------

comment on table public.teaching_offerings is
  'A schedulable delivery of a subject during one Academic Period. One offering may serve one or several cohorts.';

comment on table public.teaching_offering_participants is
  'Cohort and programme-specific curriculum-unit members attending a teaching offering.';

comment on column
  public.teaching_offerings.title is
  'Human-readable subject or shared-class title. Unit codes are not used to determine sharing.';

comment on column
  public.teaching_offerings.normalized_title is
  'Normalized title supporting future shared-unit suggestions. It does not automatically approve equivalence.';

comment on column
  public.teaching_offerings.legacy_teaching_allocation_id is
  'Temporary backward-compatibility link to the allocation from which this offering was backfilled.';

comment on column
  public.teaching_offering_participants.unit_id is
  'Official programme-specific curriculum unit for this participating cohort.';

comment on column
  public.teaching_offering_participants.is_primary is
  'Identifies the participant used as the primary display or legacy reference during migration.';