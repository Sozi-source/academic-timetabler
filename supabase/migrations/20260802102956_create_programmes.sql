-- ============================================================
-- HND App: Programmes
-- ============================================================

do $$
begin
  create type public.programme_award_level as enum (
    'certificate',
    'craft_certificate',
    'artisan_certificate',
    'diploma',
    'higher_diploma',
    'degree',
    'short_course',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.programme_duration_unit as enum (
    'months',
    'years'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.programmes (
  id uuid primary key default gen_random_uuid(),

  code text not null,

  name text not null,

  short_name text,

  award_level public.programme_award_level
    not null,

  awarding_body text,

  duration_value numeric(5, 2)
    not null,

  duration_unit public.programme_duration_unit
    not null
    default 'years',

  total_academic_periods smallint
    not null,

  maximum_cohort_size integer,

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

  constraint programmes_code_length_check
    check (
      char_length(trim(code)) between 1 and 40
    ),

  constraint programmes_name_length_check
    check (
      char_length(trim(name)) between 2 and 180
    ),

  constraint programmes_short_name_length_check
    check (
      short_name is null
      or char_length(trim(short_name))
        between 1 and 60
    ),

  constraint programmes_awarding_body_length_check
    check (
      awarding_body is null
      or char_length(trim(awarding_body)) <= 150
    ),

  constraint programmes_duration_check
    check (
      duration_value > 0
      and duration_value <= 20
    ),

  constraint programmes_periods_check
    check (
      total_academic_periods between 1 and 60
    ),

  constraint programmes_cohort_size_check
    check (
      maximum_cohort_size is null
      or maximum_cohort_size between 1 and 5000
    ),

  constraint programmes_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1500
    )
);

create unique index programmes_code_unique_idx
  on public.programmes (
    lower(trim(code))
  );

create unique index programmes_name_unique_idx
  on public.programmes (
    lower(trim(name))
  );

create index programmes_award_level_idx
  on public.programmes (
    award_level
  );

create index programmes_status_idx
  on public.programmes (
    is_active,
    is_timetable_available
  );

create index programmes_name_search_idx
  on public.programmes (
    lower(name)
  );

-- ------------------------------------------------------------
-- Normalization and audit fields
-- ------------------------------------------------------------

create or replace function
  public.set_programme_audit_fields()
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

  new.awarding_body =
    nullif(trim(new.awarding_body), '');

  new.notes =
    nullif(trim(new.notes), '');

  new.updated_at = now();
  new.updated_by = auth.uid();

  if new.is_active = false then
    new.is_timetable_available = false;
  end if;

  return new;
end;
$$;

create trigger programmes_set_audit_fields
before insert or update
on public.programmes
for each row
execute function
  public.set_programme_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.programmes
enable row level security;

revoke all
on table public.programmes
from anon;

revoke all
on table public.programmes
from authenticated;

grant select, insert, update
on table public.programmes
to authenticated;

create policy
  "Authorized staff can view programmes"
on public.programmes
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
  "Authorized staff can create programmes"
on public.programmes
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
  "Authorized staff can update programmes"
on public.programmes
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
-- Programmes must be deactivated to preserve historical
-- cohort, unit, allocation and timetable relationships.

comment on table public.programmes is
  'Academic programmes used by cohorts, curriculum units and timetable allocations.';

comment on column public.programmes.code is
  'Official institution programme identifier.';

comment on column public.programmes.total_academic_periods is
  'Expected total number of academic periods required to complete the programme.';

comment on column public.programmes.maximum_cohort_size is
  'Optional planning limit for the number of learners admitted into one cohort.';

comment on column public.programmes.is_timetable_available is
  'Determines whether the programme may receive new cohorts and timetable allocations.';