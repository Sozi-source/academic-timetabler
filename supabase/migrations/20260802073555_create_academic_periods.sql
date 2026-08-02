-- ============================================================
-- HND App: Academic Periods
-- ============================================================

create extension if not exists btree_gist;

do $$
begin
  create type public.academic_period_status as enum (
    'planned',
    'active',
    'closed',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.academic_periods (
  id uuid primary key default gen_random_uuid(),

  academic_year_id uuid not null
    references public.academic_years(id)
    on delete restrict,

  name text not null,

  code text not null,

  sequence_number smallint not null,

  starts_on date not null,

  ends_on date not null,

  teaching_starts_on date not null,

  teaching_ends_on date not null,

  status public.academic_period_status
    not null
    default 'planned',

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

  constraint academic_periods_name_length_check
    check (
      char_length(trim(name)) between 2 and 100
    ),

  constraint academic_periods_code_length_check
    check (
      char_length(trim(code)) between 1 and 30
    ),

  constraint academic_periods_sequence_check
    check (
      sequence_number between 1 and 20
    ),

  constraint academic_periods_date_order_check
    check (
      ends_on > starts_on
    ),

  constraint academic_periods_teaching_date_order_check
    check (
      teaching_ends_on >= teaching_starts_on
    ),

  constraint academic_periods_teaching_dates_within_period_check
    check (
      teaching_starts_on >= starts_on
      and teaching_ends_on <= ends_on
    ),

  constraint academic_periods_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1000
    )
);

-- A period name must be unique within its Academic Year.
create unique index academic_periods_name_unique_idx
  on public.academic_periods (
    academic_year_id,
    lower(trim(name))
  );

-- Codes such as JAN-APR and MAY-AUG must be unique
-- within an Academic Year.
create unique index academic_periods_code_unique_idx
  on public.academic_periods (
    academic_year_id,
    lower(trim(code))
  );

-- Each sequence position can only appear once per year.
create unique index academic_periods_sequence_unique_idx
  on public.academic_periods (
    academic_year_id,
    sequence_number
  );

create index academic_periods_academic_year_idx
  on public.academic_periods (
    academic_year_id
  );

create index academic_periods_status_idx
  on public.academic_periods (
    status
  );

create index academic_periods_dates_idx
  on public.academic_periods (
    starts_on,
    ends_on
  );

-- Only one Academic Period may be active at a time.
create unique index academic_periods_one_active_idx
  on public.academic_periods ((status))
  where status = 'active';

-- Non-archived periods in the same Academic Year
-- must not overlap.
alter table public.academic_periods
add constraint academic_periods_no_overlap
exclude using gist (
  academic_year_id with =,
  daterange(
    starts_on,
    ends_on,
    '[]'
  ) with &&
)
where (
  status <> 'archived'
);

-- ------------------------------------------------------------
-- Ensure period dates remain inside the parent Academic Year
-- ------------------------------------------------------------

create or replace function
  public.validate_academic_period_dates()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  parent_starts_on date;
  parent_ends_on date;
  parent_status public.academic_year_status;
begin
  select
    starts_on,
    ends_on,
    status
  into
    parent_starts_on,
    parent_ends_on,
    parent_status
  from public.academic_years
  where id = new.academic_year_id;

  if parent_starts_on is null then
    raise exception 'Academic Year not found';
  end if;

  if parent_status = 'archived' then
    raise exception
      'Academic Periods cannot be added to an archived Academic Year';
  end if;

  if
    new.starts_on < parent_starts_on
    or new.ends_on > parent_ends_on
  then
    raise exception
      'Academic Period dates must fall within the Academic Year';
  end if;

  return new;
end;
$$;

create trigger academic_periods_validate_dates
before insert or update
on public.academic_periods
for each row
execute function
  public.validate_academic_period_dates();

-- ------------------------------------------------------------
-- Audit and normalization trigger
-- ------------------------------------------------------------

create or replace function
  public.set_academic_period_audit_fields()
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

create trigger academic_periods_set_audit_fields
before insert or update
on public.academic_periods
for each row
execute function
  public.set_academic_period_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.academic_periods
enable row level security;

revoke all
on table public.academic_periods
from anon;

revoke all
on table public.academic_periods
from authenticated;

grant select, insert, update
on table public.academic_periods
to authenticated;

create policy
  "Authorized staff can view academic periods"
on public.academic_periods
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
  "Authorized staff can create academic periods"
on public.academic_periods
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
  "Authorized staff can update academic periods"
on public.academic_periods
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
-- Academic Periods must be archived.

comment on table public.academic_periods is
  'Ordered academic calendar periods belonging to an Academic Year.';

comment on column public.academic_periods.sequence_number is
  'Display and operational order of the period within its Academic Year.';

comment on column public.academic_periods.teaching_starts_on is
  'First date on which normal teaching may be scheduled.';

comment on column public.academic_periods.teaching_ends_on is
  'Last date on which normal teaching may be scheduled.';