-- ============================================================
-- HND App: Academic Years
-- ============================================================

do $$
begin
  create type public.academic_year_status as enum (
    'planned',
    'active',
    'closed',
    'archived'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),

  name text not null,
  starts_on date not null,
  ends_on date not null,

  status public.academic_year_status
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

  constraint academic_years_name_length_check
    check (
      char_length(trim(name)) between 2 and 80
    ),

  constraint academic_years_dates_check
    check (
      ends_on > starts_on
    ),

  constraint academic_years_notes_length_check
    check (
      notes is null or
      char_length(notes) <= 1000
    )
);

-- Academic-year names are unique regardless of letter case.
create unique index academic_years_name_unique_idx
  on public.academic_years (
    lower(trim(name))
  );

create index academic_years_status_idx
  on public.academic_years (status);

create index academic_years_dates_idx
  on public.academic_years (
    starts_on,
    ends_on
  );

create index academic_years_created_by_idx
  on public.academic_years (created_by);

-- Only one academic year may be active at a time.
create unique index academic_years_one_active_idx
  on public.academic_years ((status))
  where status = 'active';

-- Prevent overlapping academic years unless a record is archived.
alter table public.academic_years
add constraint academic_years_no_overlap
exclude using gist (
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
-- Audit trigger
-- ------------------------------------------------------------

create or replace function
  public.set_academic_year_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.name = trim(new.name);
  new.notes = nullif(trim(new.notes), '');
  new.updated_at = now();
  new.updated_by = auth.uid();

  return new;
end;
$$;

create trigger academic_years_set_audit_fields
before insert or update
on public.academic_years
for each row
execute function
  public.set_academic_year_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.academic_years
enable row level security;

revoke all
on table public.academic_years
from anon;

revoke all
on table public.academic_years
from authenticated;

grant select, insert, update
on table public.academic_years
to authenticated;

create policy
  "Authorized staff can view academic years"
on public.academic_years
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
  "Authorized staff can create academic years"
on public.academic_years
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
  "Authorized staff can update academic years"
on public.academic_years
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

-- There is intentionally no DELETE policy.
-- Academic years must be archived to preserve history.

comment on table public.academic_years is
  'Institution-wide academic calendar years used by periods, timetables, cohorts and reports.';

comment on column public.academic_years.status is
  'Lifecycle state: planned, active, closed or archived.';