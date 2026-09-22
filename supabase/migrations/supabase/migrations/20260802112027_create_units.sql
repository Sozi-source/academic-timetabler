-- ============================================================
-- HND App: Units
-- ============================================================

do $$
begin
  create type public.unit_category as enum (
    'core',
    'common',
    'elective',
    'practical',
    'clinical',
    'project',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.units (
  id uuid primary key default gen_random_uuid(),

  programme_id uuid not null
    references public.programmes(id)
    on delete restrict,

  code text not null,

  name text not null,

  short_name text,

  category public.unit_category
    not null
    default 'core',

  academic_period_number smallint
    not null,

  theory_hours numeric(5, 2)
    not null
    default 0,

  practical_hours numeric(5, 2)
    not null
    default 0,

  weekly_sessions smallint
    not null
    default 1,

  preferred_room_type public.room_type,

  is_active boolean
    not null
    default true,

  is_timetable_available boolean
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

  constraint units_code_length_check
    check (
      char_length(trim(code)) between 1 and 50
    ),

  constraint units_name_length_check
    check (
      char_length(trim(name)) between 2 and 180
    ),

  constraint units_short_name_length_check
    check (
      short_name is null
      or char_length(trim(short_name))
        between 1 and 80
    ),

  constraint units_period_number_check
    check (
      academic_period_number between 1 and 60
    ),

  constraint units_theory_hours_check
    check (
      theory_hours >= 0
      and theory_hours <= 100
    ),

  constraint units_practical_hours_check
    check (
      practical_hours >= 0
      and practical_hours <= 100
    ),

  constraint units_total_hours_check
    check (
      theory_hours + practical_hours > 0
    ),

  constraint units_weekly_sessions_check
    check (
      weekly_sessions between 1 and 20
    ),

  constraint units_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1500
    )
);

create unique index units_programme_code_unique_idx
  on public.units (
    programme_id,
    lower(trim(code))
  );

create unique index units_programme_name_unique_idx
  on public.units (
    programme_id,
    lower(trim(name))
  );

create index units_programme_idx
  on public.units (
    programme_id
  );

create index units_period_idx
  on public.units (
    programme_id,
    academic_period_number
  );

create index units_category_idx
  on public.units (
    category
  );

create index units_status_idx
  on public.units (
    is_active,
    is_timetable_available
  );

-- ------------------------------------------------------------
-- Parent-programme validation
-- ------------------------------------------------------------

create or replace function
  public.validate_unit_parent_programme()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_programme public.programmes%rowtype;
begin
  select *
  into parent_programme
  from public.programmes
  where id = new.programme_id;

  if parent_programme.id is null then
    raise exception using
      errcode = 'P0002',
      message = 'Programme not found';
  end if;

  if new.academic_period_number >
     parent_programme.total_academic_periods then
    raise exception using
      errcode = 'P0001',
      message =
        'The unit Academic Period exceeds the programme structure';
  end if;

  if new.is_active = true
     and parent_programme.is_active = false then
    raise exception using
      errcode = 'P0001',
      message =
        'Active units cannot belong to an inactive programme';
  end if;

  if new.is_timetable_available = true
     and (
       parent_programme.is_active = false
       or parent_programme.is_timetable_available = false
     ) then
    raise exception using
      errcode = 'P0001',
      message =
        'The parent programme is not available for timetabling';
  end if;

  if new.is_active = false then
    new.is_timetable_available = false;
  end if;

  return new;
end;
$$;

create trigger units_validate_parent_programme
before insert or update
on public.units
for each row
execute function
  public.validate_unit_parent_programme();

-- ------------------------------------------------------------
-- Normalization and audit fields
-- ------------------------------------------------------------

create or replace function
  public.set_unit_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.code =
    upper(trim(new.code));

  new.name =
    trim(new.name);

  new.short_name =
    nullif(trim(new.short_name), '');

  new.notes =
    nullif(trim(new.notes), '');

  new.updated_at = now();
  new.updated_by = auth.uid();

  return new;
end;
$$;

create trigger units_set_audit_fields
before insert or update
on public.units
for each row
execute function
  public.set_unit_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.units
enable row level security;

revoke all
on table public.units
from anon;

revoke all
on table public.units
from authenticated;

grant select, insert, update
on table public.units
to authenticated;

create policy
  "Authorized staff can view units"
on public.units
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
  "Authorized staff can create units"
on public.units
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
  "Authorized staff can update units"
on public.units
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
-- Units must be retained for historical curriculum,
-- allocation and timetable records.

comment on table public.units is
  'Curriculum units belonging to academic programmes and used in timetable allocation.';

comment on column public.units.academic_period_number is
  'Programme period in which the unit is normally taught.';

comment on column public.units.theory_hours is
  'Expected total theory contact hours for the unit.';

comment on column public.units.practical_hours is
  'Expected total practical, laboratory or clinical contact hours for the unit.';

comment on column public.units.weekly_sessions is
  'Expected number of timetable sessions assigned to the unit each week.';

comment on column public.units.preferred_room_type is
  'Optional preferred room category used during timetable generation.';

comment on column public.units.is_timetable_available is
  'Determines whether the unit may receive new teaching allocations and timetable entries.';