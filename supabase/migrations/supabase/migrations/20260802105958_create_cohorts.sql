-- ============================================================
-- HND App: Cohorts
-- ============================================================

do $$
begin
  create type public.cohort_status as enum (
    'planned',
    'active',
    'completed',
    'suspended',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.cohorts (
  id uuid primary key default gen_random_uuid(),

  programme_id uuid not null
    references public.programmes(id)
    on delete restrict,

  code text not null,

  name text not null,

  intake_date date not null,

  expected_completion_date date not null,

  current_academic_period_number smallint
    not null
    default 1,

  planned_size integer,

  actual_size integer
    not null
    default 0,

  status public.cohort_status
    not null
    default 'planned',

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

  constraint cohorts_code_length_check
    check (
      char_length(trim(code)) between 1 and 50
    ),

  constraint cohorts_name_length_check
    check (
      char_length(trim(name)) between 2 and 150
    ),

  constraint cohorts_date_order_check
    check (
      expected_completion_date > intake_date
    ),

  constraint cohorts_current_period_check
    check (
      current_academic_period_number
      between 1 and 60
    ),

  constraint cohorts_planned_size_check
    check (
      planned_size is null
      or planned_size between 1 and 5000
    ),

  constraint cohorts_actual_size_check
    check (
      actual_size between 0 and 5000
    ),

  constraint cohorts_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1500
    )
);

create unique index cohorts_code_unique_idx
  on public.cohorts (
    lower(trim(code))
  );

create unique index cohorts_programme_name_unique_idx
  on public.cohorts (
    programme_id,
    lower(trim(name))
  );

create index cohorts_programme_idx
  on public.cohorts (
    programme_id
  );

create index cohorts_status_idx
  on public.cohorts (
    status,
    is_timetable_available
  );

create index cohorts_intake_date_idx
  on public.cohorts (
    intake_date
  );

create index cohorts_completion_date_idx
  on public.cohorts (
    expected_completion_date
  );

-- ------------------------------------------------------------
-- Parent-programme and lifecycle validation
-- ------------------------------------------------------------

create or replace function
  public.validate_cohort_parent_programme()
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

  if new.current_academic_period_number >
     parent_programme.total_academic_periods then
    raise exception using
      errcode = 'P0001',
      message =
        'The cohort Academic Period number exceeds the programme structure';
  end if;

  if new.status in ('planned', 'active')
     and parent_programme.is_active = false then
    raise exception using
      errcode = 'P0001',
      message =
        'New or active cohorts cannot belong to an inactive programme';
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

  if new.status in (
    'completed',
    'suspended',
    'archived'
  ) then
    new.is_timetable_available = false;
  end if;

  return new;
end;
$$;

create trigger cohorts_validate_parent_programme
before insert or update
on public.cohorts
for each row
execute function
  public.validate_cohort_parent_programme();

-- ------------------------------------------------------------
-- Normalization and audit fields
-- ------------------------------------------------------------

create or replace function
  public.set_cohort_audit_fields()
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

  new.notes =
    nullif(trim(new.notes), '');

  new.updated_at = now();
  new.updated_by = auth.uid();

  return new;
end;
$$;

create trigger cohorts_set_audit_fields
before insert or update
on public.cohorts
for each row
execute function
  public.set_cohort_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.cohorts
enable row level security;

revoke all
on table public.cohorts
from anon;

revoke all
on table public.cohorts
from authenticated;

grant select, insert, update
on table public.cohorts
to authenticated;

create policy
  "Authorized staff can view cohorts"
on public.cohorts
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
  "Authorized staff can create cohorts"
on public.cohorts
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
  "Authorized staff can update cohorts"
on public.cohorts
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
-- Cohorts are retained for historical enrolment,
-- curriculum, allocation and timetable records.

comment on table public.cohorts is
  'Programme-specific learner groups used for curriculum delivery and timetable generation.';

comment on column public.cohorts.current_academic_period_number is
  'Current programme period number, such as term 2 or semester 4.';

comment on column public.cohorts.planned_size is
  'Expected learner population used during resource and room planning.';

comment on column public.cohorts.actual_size is
  'Current confirmed learner population in the cohort.';

comment on column public.cohorts.is_timetable_available is
  'Determines whether the cohort may receive new teaching allocations and timetable entries.';