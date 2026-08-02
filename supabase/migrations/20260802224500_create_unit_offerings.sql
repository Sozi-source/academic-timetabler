-- ============================================================
-- Units on Offer foundation
-- ============================================================

do $$
begin
  create type public.unit_offering_type as enum (
    'classroom',
    'practical',
    'clinical_rotation',
    'attachment',
    'project',
    'examination',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.unit_offering_status as enum (
    'draft',
    'active',
    'completed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.unit_offerings (
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

  offering_type public.unit_offering_type
    not null
    default 'classroom',

  status public.unit_offering_status
    not null
    default 'draft',

  is_timetable_enabled boolean
    not null
    default true,

  weekly_sessions smallint,

  session_duration_minutes smallint,

  delivery_notes text,

  source text
    not null
    default 'manual',

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

  constraint unit_offerings_weekly_sessions_check
    check (
      weekly_sessions is null
      or weekly_sessions between 1 and 20
    ),

  constraint unit_offerings_duration_check
    check (
      session_duration_minutes is null
      or session_duration_minutes between 30 and 480
    ),

  constraint unit_offerings_duration_increment_check
    check (
      session_duration_minutes is null
      or session_duration_minutes % 15 = 0
    ),

  constraint unit_offerings_delivery_notes_length_check
    check (
      delivery_notes is null
      or char_length(delivery_notes) <= 1500
    ),

  constraint unit_offerings_source_length_check
    check (
      char_length(trim(source))
      between 2 and 100
    ),

  constraint unit_offerings_timetable_context_check
    check (
      offering_type in (
        'classroom',
        'practical',
        'project',
        'other'
      )
      or is_timetable_enabled = false
    )
);

create unique index
  unit_offerings_period_cohort_unit_unique_idx
on public.unit_offerings (
  academic_period_id,
  cohort_id,
  unit_id
);

create index unit_offerings_period_idx
  on public.unit_offerings (
    academic_period_id
  );

create index unit_offerings_cohort_idx
  on public.unit_offerings (
    cohort_id
  );

create index unit_offerings_unit_idx
  on public.unit_offerings (
    unit_id
  );

create index unit_offerings_period_status_idx
  on public.unit_offerings (
    academic_period_id,
    status,
    is_timetable_enabled
  );

create index unit_offerings_type_idx
  on public.unit_offerings (
    offering_type
  );

-- ------------------------------------------------------------
-- Validation
-- ------------------------------------------------------------

create or replace function
  public.validate_unit_offering()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_period public.academic_periods%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
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

  if selected_cohort.programme_id
      <> selected_unit.programme_id then
    raise exception using
      errcode = '23514',
      message =
        'The selected unit and cohort must belong to the same programme';
  end if;

  if new.offering_type in (
    'clinical_rotation',
    'attachment',
    'examination'
  ) then
    new.is_timetable_enabled = false;
  end if;

  new.source = trim(new.source);

  return new;
end;
$$;

create or replace function
  public.set_unit_offering_audit_fields()
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

create trigger
  unit_offerings_validate_relationships
before insert or update
on public.unit_offerings
for each row
execute function
  public.validate_unit_offering();

create trigger
  unit_offerings_set_audit_fields
before insert or update
on public.unit_offerings
for each row
execute function
  public.set_unit_offering_audit_fields();

-- ------------------------------------------------------------
-- Backfill existing Teaching Offering participants
-- ------------------------------------------------------------

insert into public.unit_offerings (
  academic_period_id,
  cohort_id,
  unit_id,
  offering_type,
  status,
  is_timetable_enabled,
  weekly_sessions,
  session_duration_minutes,
  delivery_notes,
  source,
  created_by,
  updated_by,
  created_at,
  updated_at
)
select
  offering.academic_period_id,
  participant.cohort_id,
  participant.unit_id,

  case
    when offering.delivery_mode::text = 'practical'
      then 'practical'::public.unit_offering_type
    else 'classroom'::public.unit_offering_type
  end,

  case
    when offering.status::text = 'active'
      then 'active'::public.unit_offering_status
    else 'draft'::public.unit_offering_status
  end,

  offering.is_timetable_enabled,
  offering.weekly_sessions,
  offering.session_duration_minutes,
  participant.notes,
  'teaching_offering_backfill',
  participant.created_by,
  participant.updated_by,
  participant.created_at,
  participant.updated_at

from public.teaching_offering_participants participant

join public.teaching_offerings offering
  on offering.id =
     participant.teaching_offering_id

on conflict (
  academic_period_id,
  cohort_id,
  unit_id
)
do nothing;

-- ------------------------------------------------------------
-- Connect participants to authoritative Units on Offer
-- ------------------------------------------------------------

alter table public.teaching_offering_participants
add column unit_offering_id uuid
  references public.unit_offerings(id)
  on delete restrict;

create index
  teaching_offering_participants_unit_offering_idx
on public.teaching_offering_participants (
  unit_offering_id
)
where unit_offering_id is not null;

update public.teaching_offering_participants participant
set unit_offering_id =
  unit_offering.id
from
  public.teaching_offerings offering,
  public.unit_offerings unit_offering
where
  offering.id =
    participant.teaching_offering_id

  and unit_offering.academic_period_id =
    offering.academic_period_id

  and unit_offering.cohort_id =
    participant.cohort_id

  and unit_offering.unit_id =
    participant.unit_id

  and participant.unit_offering_id is null;

create unique index
  teaching_offering_participants_offering_unit_offering_unique_idx
on public.teaching_offering_participants (
  teaching_offering_id,
  unit_offering_id
)
where unit_offering_id is not null;

-- ------------------------------------------------------------
-- Extend participant validation
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
  selected_unit_offering public.unit_offerings%rowtype;
begin
  select *
  into selected_offering
  from public.teaching_offerings
  where id = new.teaching_offering_id;

  if selected_offering.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Teaching Offering not found';
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

  if new.unit_offering_id is not null then
    select *
    into selected_unit_offering
    from public.unit_offerings
    where id = new.unit_offering_id;

    if selected_unit_offering.id is null then
      raise exception using
        errcode = 'P0002',
        message = 'Unit on Offer not found';
    end if;

    if selected_unit_offering.academic_period_id
        <> selected_offering.academic_period_id then
      raise exception using
        errcode = '23514',
        message =
          'The Unit on Offer must belong to the Teaching Offering Academic Period';
    end if;

    if selected_unit_offering.cohort_id
        <> new.cohort_id then
      raise exception using
        errcode = '23514',
        message =
          'The Unit on Offer does not belong to the selected cohort';
    end if;

    if selected_unit_offering.unit_id
        <> new.unit_id then
      raise exception using
        errcode = '23514',
        message =
          'The Unit on Offer does not match the selected curriculum unit';
    end if;
  end if;

  return new;
end;
$$;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.unit_offerings
  enable row level security;

revoke all
on table public.unit_offerings
from anon;

revoke all
on table public.unit_offerings
from authenticated;

grant select, insert, update
on table public.unit_offerings
to authenticated;

create policy
  "Authorized staff can view units on offer"
on public.unit_offerings
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
  "Authorized staff can create units on offer"
on public.unit_offerings
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
  "Authorized staff can update units on offer"
on public.unit_offerings
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

comment on table public.unit_offerings is
  'Official curriculum units offered to specific cohorts during specific Academic Periods. Timetable scheduling consumes this table rather than the full unit catalogue.';

comment on column
  public.unit_offerings.offering_type is
  'Academic delivery context. Attachment, clinical rotation and examination offerings are excluded from ordinary timetable generation.';

comment on column
  public.teaching_offering_participants.unit_offering_id is
  'Authoritative semester-specific Unit on Offer represented by this Teaching Offering participant.';