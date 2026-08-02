-- ============================================================
-- HND App: Working Days and Time Slots
-- ============================================================

create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- Enumerations
-- ------------------------------------------------------------

do $$
begin
  create type public.weekday_code as enum (
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.time_slot_type as enum (
    'teaching',
    'break',
    'lunch',
    'assembly',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

-- ============================================================
-- Working Days
-- ============================================================

create table public.working_days (
  id uuid primary key default gen_random_uuid(),

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  day_of_week public.weekday_code not null,

  sequence_number smallint not null,

  is_enabled boolean
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

  constraint working_days_sequence_check
    check (
      sequence_number between 1 and 7
    ),

  constraint working_days_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 500
    )
);

create unique index working_days_period_day_unique_idx
  on public.working_days (
    academic_period_id,
    day_of_week
  );

create unique index working_days_period_sequence_unique_idx
  on public.working_days (
    academic_period_id,
    sequence_number
  );

create index working_days_academic_period_idx
  on public.working_days (
    academic_period_id
  );

create index working_days_enabled_idx
  on public.working_days (
    academic_period_id,
    is_enabled
  );

-- ============================================================
-- Time Slots
-- ============================================================

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  name text not null,

  code text not null,

  slot_type public.time_slot_type
    not null
    default 'teaching',

  starts_at time without time zone not null,

  ends_at time without time zone not null,

  sequence_number smallint not null,

  is_enabled boolean
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

  constraint time_slots_name_length_check
    check (
      char_length(trim(name)) between 2 and 80
    ),

  constraint time_slots_code_length_check
    check (
      char_length(trim(code)) between 1 and 30
    ),

  constraint time_slots_time_order_check
    check (
      ends_at > starts_at
    ),

  constraint time_slots_sequence_check
    check (
      sequence_number between 1 and 50
    ),

  constraint time_slots_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 500
    )
);

create unique index time_slots_period_name_unique_idx
  on public.time_slots (
    academic_period_id,
    lower(trim(name))
  );

create unique index time_slots_period_code_unique_idx
  on public.time_slots (
    academic_period_id,
    lower(trim(code))
  );

create unique index time_slots_period_sequence_unique_idx
  on public.time_slots (
    academic_period_id,
    sequence_number
  );

create index time_slots_academic_period_idx
  on public.time_slots (
    academic_period_id
  );

create index time_slots_type_idx
  on public.time_slots (
    academic_period_id,
    slot_type
  );

create index time_slots_enabled_idx
  on public.time_slots (
    academic_period_id,
    is_enabled
  );

-- Active slots in the same Academic Period cannot overlap.
--
-- A fixed reference date converts the time values into a
-- PostgreSQL timestamp range suitable for GiST exclusion.
alter table public.time_slots
add constraint time_slots_no_overlap
exclude using gist (
  academic_period_id with =,

  tsrange(
    date '2000-01-01' + starts_at,
    date '2000-01-01' + ends_at,
    '[)'
  ) with &&
)
where (
  is_enabled = true
);

-- ============================================================
-- Parent Academic Period validation
-- ============================================================

create or replace function
  public.validate_timetable_calendar_parent()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_status public.academic_period_status;
begin
  select status
  into parent_status
  from public.academic_periods
  where id = new.academic_period_id;

  if parent_status is null then
    raise exception using
      errcode = 'P0002',
      message = 'Academic Period not found';
  end if;

  if parent_status = 'archived' then
    raise exception using
      errcode = 'P0001',
      message =
        'Archived Academic Periods cannot be configured';
  end if;

  return new;
end;
$$;

create trigger working_days_validate_parent
before insert or update
on public.working_days
for each row
execute function
  public.validate_timetable_calendar_parent();

create trigger time_slots_validate_parent
before insert or update
on public.time_slots
for each row
execute function
  public.validate_timetable_calendar_parent();

-- ============================================================
-- Audit and normalization
-- ============================================================

create or replace function
  public.set_working_day_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.notes = nullif(trim(new.notes), '');
  new.updated_at = now();
  new.updated_by = auth.uid();

  return new;
end;
$$;

create trigger working_days_set_audit_fields
before insert or update
on public.working_days
for each row
execute function
  public.set_working_day_audit_fields();

create or replace function
  public.set_time_slot_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name = trim(new.name);
  new.code = upper(trim(new.code));
  new.notes = nullif(trim(new.notes), '');
  new.updated_at = now();
  new.updated_by = auth.uid();

  return new;
end;
$$;

create trigger time_slots_set_audit_fields
before insert or update
on public.time_slots
for each row
execute function
  public.set_time_slot_audit_fields();

-- ============================================================
-- Row-Level Security: Working Days
-- ============================================================

alter table public.working_days
enable row level security;

revoke all
on table public.working_days
from anon;

revoke all
on table public.working_days
from authenticated;

grant select, insert, update
on table public.working_days
to authenticated;

create policy
  "Authorized staff can view working days"
on public.working_days
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
  "Authorized staff can create working days"
on public.working_days
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
  "Authorized staff can update working days"
on public.working_days
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

-- ============================================================
-- Row-Level Security: Time Slots
-- ============================================================

alter table public.time_slots
enable row level security;

revoke all
on table public.time_slots
from anon;

revoke all
on table public.time_slots
from authenticated;

grant select, insert, update
on table public.time_slots
to authenticated;

create policy
  "Authorized staff can view time slots"
on public.time_slots
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
  "Authorized staff can create time slots"
on public.time_slots
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
  "Authorized staff can update time slots"
on public.time_slots
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

-- No DELETE policies are intentionally provided.

comment on table public.working_days is
  'Ordered teaching days configured for each Academic Period.';

comment on table public.time_slots is
  'Ordered daily timetable slots configured for each Academic Period.';

comment on column public.time_slots.slot_type is
  'Classifies a slot as teaching, break, lunch, assembly or another activity.';

comment on column public.time_slots.is_enabled is
  'Disabled slots remain historically available but cannot be used by timetable generation.';