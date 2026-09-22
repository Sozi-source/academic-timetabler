-- ============================================================
-- HND App: Trainers
-- ============================================================

do $$
begin
  create type public.trainer_employment_type as enum (
    'full_time',
    'part_time',
    'visiting',
    'contract',
    'other'
  );
exception
  when duplicate_object then null;
end
$$;

create table public.trainers (
  id uuid primary key default gen_random_uuid(),

  profile_id uuid
    references public.profiles(id)
    on delete set null,

  staff_number text not null,

  full_name text not null,

  email text,

  phone_number text,

  employment_type public.trainer_employment_type
    not null
    default 'full_time',

  specialization text,

  qualifications text,

  maximum_weekly_hours numeric(5, 2)
    not null
    default 24,

  maximum_daily_hours numeric(4, 2)
    not null
    default 6,

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

  constraint trainers_staff_number_length_check
    check (
      char_length(trim(staff_number))
      between 1 and 40
    ),

  constraint trainers_full_name_length_check
    check (
      char_length(trim(full_name))
      between 2 and 150
    ),

  constraint trainers_email_length_check
    check (
      email is null
      or char_length(trim(email)) <= 254
    ),

  constraint trainers_email_format_check
    check (
      email is null
      or email ~*
        '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    ),

  constraint trainers_phone_length_check
    check (
      phone_number is null
      or char_length(trim(phone_number))
        between 7 and 30
    ),

  constraint trainers_specialization_length_check
    check (
      specialization is null
      or char_length(trim(specialization)) <= 250
    ),

  constraint trainers_qualifications_length_check
    check (
      qualifications is null
      or char_length(trim(qualifications)) <= 1000
    ),

  constraint trainers_weekly_hours_check
    check (
      maximum_weekly_hours > 0
      and maximum_weekly_hours <= 80
    ),

  constraint trainers_daily_hours_check
    check (
      maximum_daily_hours > 0
      and maximum_daily_hours <= 16
    ),

  constraint trainers_daily_not_above_weekly_check
    check (
      maximum_daily_hours <= maximum_weekly_hours
    ),

  constraint trainers_notes_length_check
    check (
      notes is null
      or char_length(notes) <= 1000
    )
);

create unique index trainers_staff_number_unique_idx
  on public.trainers (
    lower(trim(staff_number))
  );

create unique index trainers_email_unique_idx
  on public.trainers (
    lower(trim(email))
  )
  where email is not null;

create unique index trainers_profile_unique_idx
  on public.trainers (
    profile_id
  )
  where profile_id is not null;

create index trainers_name_idx
  on public.trainers (
    lower(full_name)
  );

create index trainers_employment_type_idx
  on public.trainers (
    employment_type
  );

create index trainers_status_idx
  on public.trainers (
    is_active,
    is_timetable_available
  );

-- ------------------------------------------------------------
-- Normalization and audit fields
-- ------------------------------------------------------------

create or replace function
  public.set_trainer_audit_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.staff_number =
    upper(trim(new.staff_number));

  new.full_name =
    trim(new.full_name);

  new.email =
    nullif(lower(trim(new.email)), '');

  new.phone_number =
    nullif(trim(new.phone_number), '');

  new.specialization =
    nullif(trim(new.specialization), '');

  new.qualifications =
    nullif(trim(new.qualifications), '');

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

create trigger trainers_set_audit_fields
before insert or update
on public.trainers
for each row
execute function
  public.set_trainer_audit_fields();

-- ------------------------------------------------------------
-- Row-Level Security
-- ------------------------------------------------------------

alter table public.trainers
enable row level security;

revoke all
on table public.trainers
from anon;

revoke all
on table public.trainers
from authenticated;

grant select, insert, update
on table public.trainers
to authenticated;

create policy
  "Authorized staff can view trainers"
on public.trainers
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
  "Authorized staff can create trainers"
on public.trainers
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
  "Authorized staff can update trainers"
on public.trainers
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
-- Trainers should be deactivated to preserve timetable history.

comment on table public.trainers is
  'Teaching staff available for unit allocation and timetable scheduling.';

comment on column public.trainers.profile_id is
  'Optional authenticated profile linked to the trainer record.';

comment on column public.trainers.maximum_weekly_hours is
  'Maximum total teaching hours assignable to the trainer in one week.';

comment on column public.trainers.maximum_daily_hours is
  'Maximum teaching hours assignable to the trainer in one day.';

comment on column public.trainers.is_timetable_available is
  'Determines whether the trainer may receive new timetable allocations.';