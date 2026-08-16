-- Multi-school, multi-department tenancy foundation.
-- Existing records are retained and assigned to the initial HND department.

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(code)) between 2 and 30),
  check (char_length(trim(name)) between 2 and 160)
);
create unique index schools_code_unique_idx on public.schools ((lower(trim(code))));
create unique index schools_name_unique_idx on public.schools ((lower(trim(name))));

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  code text not null,
  name text not null,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(trim(code)) between 2 and 30),
  check (char_length(trim(name)) between 2 and 160)
);
create unique index departments_school_code_unique_idx
  on public.departments (school_id, (lower(trim(code))));
create unique index departments_school_name_unique_idx
  on public.departments (school_id, (lower(trim(name))));

do $$
begin
  create type public.department_membership_role as enum (
    'school_admin', 'hod', 'timetable_officer', 'staff'
  );
exception when duplicate_object then null;
end
$$;

create table public.department_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  membership_role public.department_membership_role not null default 'staff',
  is_primary boolean not null default false,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (profile_id, department_id)
);
create unique index department_memberships_one_primary_idx
  on public.department_memberships (profile_id) where is_primary and is_active;

alter table public.profiles add column active_department_id uuid
  references public.departments(id) on delete set null;
alter table public.programmes add column department_id uuid
  references public.departments(id) on delete restrict;
alter table public.trainers add column department_id uuid
  references public.departments(id) on delete restrict;
alter table public.units add column department_id uuid
  references public.departments(id) on delete restrict;
alter table public.rooms add column department_id uuid
  references public.departments(id) on delete set null;
alter table public.teaching_offerings add column department_id uuid
  references public.departments(id) on delete restrict;

do $$
declare
  school_uuid uuid;
  department_uuid uuid;
begin
  insert into public.schools (code, name)
  values ('SHS', 'School of Health Sciences')
  on conflict ((lower(trim(code)))) do update set name = excluded.name
  returning id into school_uuid;

  insert into public.departments (school_id, code, name)
  values (school_uuid, 'HND', 'Human Nutrition and Dietetics')
  on conflict (school_id, (lower(trim(code)))) do update set name = excluded.name
  returning id into department_uuid;

  update public.programmes set department_id = department_uuid where department_id is null;
  update public.trainers
    set department_id = department_uuid,
        home_department = 'Human Nutrition and Dietetics'
    where department_id is null;
  update public.units unit_record
    set department_id = programme.department_id
    from public.programmes programme
    where programme.id = unit_record.programme_id and unit_record.department_id is null;

  update public.teaching_offerings offering
  set department_id = coalesce((
    select programme.department_id
    from public.teaching_offering_participants participant
    join public.cohorts cohort on cohort.id = participant.cohort_id
    join public.programmes programme on programme.id = cohort.programme_id
    where participant.teaching_offering_id = offering.id
    order by participant.is_primary desc, participant.created_at
    limit 1
  ), department_uuid)
  where offering.department_id is null;

  insert into public.department_memberships (
    profile_id, department_id, membership_role, is_primary
  )
  select profile.id, department_uuid,
    case when profile.role = 'hod'
      then 'hod'::public.department_membership_role
      else 'school_admin'::public.department_membership_role end,
    true
  from public.profiles profile
  where profile.is_active
  on conflict (profile_id, department_id) do nothing;

  update public.profiles
  set active_department_id = department_uuid
  where active_department_id is null and is_active;

  if not exists (
    select 1 from public.profiles where role = 'system_admin'
  ) then
    update public.profiles
    set role = 'system_admin'
    where id = (
      select id from public.profiles
      where is_active
      order by created_at, id
      limit 1
    );
  end if;
end
$$;

create or replace function public.ensure_initial_system_administrator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.profiles where role = 'system_admin'
  ) then
    update public.profiles
    set role = 'system_admin'
    where id = new.id;
  end if;
  return new;
end;
$$;
create trigger profiles_ensure_initial_system_administrator
after insert on public.profiles
for each row execute function public.ensure_initial_system_administrator();

alter table public.programmes alter column department_id set not null;
alter table public.trainers alter column department_id set not null;
alter table public.units alter column department_id set not null;
alter table public.teaching_offerings alter column department_id set not null;

drop index if exists public.programmes_code_unique_idx;
drop index if exists public.programmes_name_unique_idx;
create unique index programmes_department_code_unique_idx
  on public.programmes (department_id, (lower(trim(code))));
create unique index programmes_department_name_unique_idx
  on public.programmes (department_id, (lower(trim(name))));

create or replace function public.current_user_is_department_member(requested_department uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_has_role(array['system_admin']::public.app_role[])
    or exists (
      select 1
      from public.department_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      where membership.profile_id = auth.uid()
        and membership.department_id = requested_department
        and membership.is_active and profile.is_active
    );
$$;

create or replace function public.current_user_can_access_department(requested_department uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select requested_department = (
    select profile.active_department_id
    from public.profiles profile
    where profile.id = auth.uid() and profile.is_active
  ) and public.current_user_is_department_member(requested_department);
$$;

create or replace function public.current_user_can_manage_department(requested_department uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.current_user_can_access_department(requested_department)
    and (
      public.current_user_has_role(array['system_admin']::public.app_role[])
      or exists (
      select 1
      from public.department_memberships membership
      join public.profiles profile on profile.id = membership.profile_id
      where membership.profile_id = auth.uid()
        and membership.department_id = requested_department
        and membership.membership_role in ('school_admin', 'hod', 'timetable_officer')
        and membership.is_active and profile.is_active
      )
    );
$$;

create or replace function public.current_user_primary_department_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select active_department_id from public.profiles
      where id = auth.uid() and is_active),
    (select department_id from public.department_memberships
      where profile_id = auth.uid() and is_active
      order by is_primary desc, created_at limit 1)
  );
$$;

grant execute on function public.current_user_is_department_member(uuid) to authenticated;
grant execute on function public.current_user_can_access_department(uuid) to authenticated;
grant execute on function public.current_user_can_manage_department(uuid) to authenticated;
grant execute on function public.current_user_primary_department_id() to authenticated;

alter table public.programmes alter column department_id
  set default public.current_user_primary_department_id();
alter table public.trainers alter column department_id
  set default public.current_user_primary_department_id();
alter table public.rooms alter column department_id
  set default public.current_user_primary_department_id();
alter table public.teaching_offerings alter column department_id
  set default public.current_user_primary_department_id();

create or replace function public.set_unit_owning_department()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  select department_id into new.department_id
  from public.programmes where id = new.programme_id;
  return new;
end;
$$;
create trigger units_set_department before insert or update of programme_id on public.units
  for each row execute function public.set_unit_owning_department();

create or replace function public.set_trainer_home_department()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  select name into new.home_department
  from public.departments where id = new.department_id;
  return new;
end;
$$;
create trigger trainers_set_home_department
  before insert or update of department_id on public.trainers
  for each row execute function public.set_trainer_home_department();

create or replace function public.enforce_teaching_offering_department()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  offering_department uuid;
  cohort_department uuid;
begin
  select department_id into offering_department
  from public.teaching_offerings where id = new.teaching_offering_id;
  select programme.department_id into cohort_department
  from public.cohorts cohort
  join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = new.cohort_id;
  if offering_department is distinct from cohort_department then
    raise exception using errcode = '23514',
      message = 'All cohorts in a combined teaching offering must belong to its owning department';
  end if;
  return new;
end;
$$;
create trigger teaching_offering_participants_enforce_department
  before insert or update of teaching_offering_id, cohort_id
  on public.teaching_offering_participants for each row
  execute function public.enforce_teaching_offering_department();

create trigger schools_set_updated_at before update on public.schools
  for each row execute function public.set_updated_at();
create trigger departments_set_updated_at before update on public.departments
  for each row execute function public.set_updated_at();

alter table public.schools enable row level security;
alter table public.departments enable row level security;
alter table public.department_memberships enable row level security;
revoke all on table public.schools, public.departments, public.department_memberships from anon;
grant select, insert, update on table public.schools, public.departments,
  public.department_memberships to authenticated;

create policy schools_read on public.schools for select to authenticated
  using (public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]));
create policy schools_insert on public.schools for insert to authenticated
  with check (public.current_user_has_role(array['system_admin']::public.app_role[]));
create policy schools_update on public.schools for update to authenticated
  using (public.current_user_has_role(array['system_admin']::public.app_role[]))
  with check (public.current_user_has_role(array['system_admin']::public.app_role[]));

create policy departments_read on public.departments for select to authenticated
  using (public.current_user_has_role(array['system_admin']::public.app_role[])
    or public.current_user_is_department_member(id));
create policy departments_insert on public.departments for insert to authenticated
  with check (public.current_user_has_role(array['system_admin']::public.app_role[]));
create policy departments_update on public.departments for update to authenticated
  using (public.current_user_has_role(array['system_admin']::public.app_role[]))
  with check (public.current_user_has_role(array['system_admin']::public.app_role[]));

create policy memberships_read on public.department_memberships for select to authenticated
  using (profile_id = auth.uid()
    or public.current_user_has_role(array['system_admin']::public.app_role[]));
create policy memberships_insert on public.department_memberships for insert to authenticated
  with check (public.current_user_has_role(array['system_admin']::public.app_role[]));
create policy memberships_update on public.department_memberships for update to authenticated
  using (public.current_user_has_role(array['system_admin']::public.app_role[]))
  with check (public.current_user_has_role(array['system_admin']::public.app_role[]));

create policy profiles_system_admin_read on public.profiles for select to authenticated
  using (public.current_user_has_role(array['system_admin']::public.app_role[]));
create policy profiles_system_admin_update on public.profiles for update to authenticated
  using (public.current_user_has_role(array['system_admin']::public.app_role[]))
  with check (public.current_user_has_role(array['system_admin']::public.app_role[]));

-- Replace institution-wide policies on department-owned records.
do $$
declare policy_record record;
begin
  for policy_record in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename = any (array[
      'programmes', 'trainers', 'units', 'cohorts', 'unit_offerings',
      'teaching_allocations', 'scheduled_sessions', 'teaching_offerings',
      'teaching_offering_participants', 'rooms'
    ])
  loop
    execute format('drop policy %I on public.%I',
      policy_record.policyname, policy_record.tablename);
  end loop;
end
$$;

-- Helper expressions are repeated intentionally so PostgreSQL can enforce the
-- same department boundary for every direct table API call.
create policy programmes_read on public.programmes for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy programmes_insert on public.programmes for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy programmes_update on public.programmes for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

create policy units_read on public.units for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy units_insert on public.units for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy units_update on public.units for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

-- Trainer names and constraints form an institution-wide service directory.
-- Only a trainer's home department can alter the trainer record.
create policy trainers_read on public.trainers for select to authenticated
  using (public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]));
create policy trainers_insert on public.trainers for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy trainers_update on public.trainers for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

create policy cohorts_read on public.cohorts for select to authenticated using (exists (
  select 1 from public.programmes programme where programme.id = cohorts.programme_id
    and public.current_user_can_access_department(programme.department_id)));
create policy cohorts_insert on public.cohorts for insert to authenticated with check (exists (
  select 1 from public.programmes programme where programme.id = cohorts.programme_id
    and public.current_user_can_manage_department(programme.department_id)));
create policy cohorts_update on public.cohorts for update to authenticated using (exists (
  select 1 from public.programmes programme where programme.id = cohorts.programme_id
    and public.current_user_can_manage_department(programme.department_id))) with check (exists (
  select 1 from public.programmes programme where programme.id = cohorts.programme_id
    and public.current_user_can_manage_department(programme.department_id)));

create policy unit_offerings_read on public.unit_offerings for select to authenticated using (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = unit_offerings.cohort_id
    and public.current_user_can_access_department(programme.department_id)));
create policy unit_offerings_insert on public.unit_offerings for insert to authenticated with check (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = unit_offerings.cohort_id
    and public.current_user_can_manage_department(programme.department_id)));
create policy unit_offerings_update on public.unit_offerings for update to authenticated using (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = unit_offerings.cohort_id
    and public.current_user_can_manage_department(programme.department_id))) with check (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = unit_offerings.cohort_id
    and public.current_user_can_manage_department(programme.department_id)));

create policy teaching_allocations_read on public.teaching_allocations for select to authenticated using (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = teaching_allocations.cohort_id
    and public.current_user_can_access_department(programme.department_id)));
create policy teaching_allocations_insert on public.teaching_allocations for insert to authenticated with check (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = teaching_allocations.cohort_id
    and public.current_user_can_manage_department(programme.department_id)));
create policy teaching_allocations_update on public.teaching_allocations for update to authenticated using (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = teaching_allocations.cohort_id
    and public.current_user_can_manage_department(programme.department_id))) with check (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = teaching_allocations.cohort_id
    and public.current_user_can_manage_department(programme.department_id)));

create policy scheduled_sessions_read on public.scheduled_sessions for select to authenticated using (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = scheduled_sessions.cohort_id
    and public.current_user_can_access_department(programme.department_id)));
create policy scheduled_sessions_insert on public.scheduled_sessions for insert to authenticated with check (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = scheduled_sessions.cohort_id
    and public.current_user_can_manage_department(programme.department_id)));
create policy scheduled_sessions_update on public.scheduled_sessions for update to authenticated using (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = scheduled_sessions.cohort_id
    and public.current_user_can_manage_department(programme.department_id))) with check (exists (
  select 1 from public.cohorts cohort join public.programmes programme on programme.id = cohort.programme_id
  where cohort.id = scheduled_sessions.cohort_id
    and public.current_user_can_manage_department(programme.department_id)));

create policy teaching_offerings_read on public.teaching_offerings for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy teaching_offerings_insert on public.teaching_offerings for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy teaching_offerings_update on public.teaching_offerings for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

create policy teaching_offering_participants_read on public.teaching_offering_participants
  for select to authenticated using (exists (
    select 1 from public.teaching_offerings offering
    where offering.id = teaching_offering_participants.teaching_offering_id
      and public.current_user_can_access_department(offering.department_id)));
create policy teaching_offering_participants_insert on public.teaching_offering_participants
  for insert to authenticated with check (exists (
    select 1 from public.teaching_offerings offering
    where offering.id = teaching_offering_participants.teaching_offering_id
      and public.current_user_can_manage_department(offering.department_id)));
create policy teaching_offering_participants_update on public.teaching_offering_participants
  for update to authenticated using (exists (
    select 1 from public.teaching_offerings offering
    where offering.id = teaching_offering_participants.teaching_offering_id
      and public.current_user_can_manage_department(offering.department_id))) with check (exists (
    select 1 from public.teaching_offerings offering
    where offering.id = teaching_offering_participants.teaching_offering_id
      and public.current_user_can_manage_department(offering.department_id)));

-- Null department identifies an institution-wide shared room.
create policy rooms_read on public.rooms for select to authenticated
  using (public.current_user_has_role(array['hod', 'system_admin']::public.app_role[]));
create policy rooms_insert on public.rooms for insert to authenticated with check (
  case when department_id is null
    then public.current_user_has_role(array['system_admin']::public.app_role[])
    else public.current_user_can_manage_department(department_id) end);
create policy rooms_update on public.rooms for update to authenticated using (
  case when department_id is null
    then public.current_user_has_role(array['system_admin']::public.app_role[])
    else public.current_user_can_manage_department(department_id) end) with check (
  case when department_id is null
    then public.current_user_has_role(array['system_admin']::public.app_role[])
    else public.current_user_can_manage_department(department_id) end);

-- Conflict validation must see institution-wide trainer and room occupancy
-- even though timetable details remain department-scoped.
alter function public.validate_scheduled_session_conflicts()
  security definer;

comment on table public.department_memberships is
  'Authorizes a user for one or more departments independently of the institution-level profile role.';
comment on column public.rooms.department_id is
  'Owning department. Null identifies an institution-wide shared room.';
comment on column public.teaching_offerings.department_id is
  'Department responsible for the offering and all participating cohorts.';

-- Department-own the remaining generation, review and publication records.
alter table public.scheduling_constraints add column department_id uuid
  references public.departments(id) on delete restrict;
alter table public.timetable_generation_runs add column department_id uuid
  references public.departments(id) on delete restrict;
alter table public.timetable_conflict_reviews add column department_id uuid
  references public.departments(id) on delete restrict;
alter table public.timetable_versions add column department_id uuid
  references public.departments(id) on delete restrict;

do $$
declare initial_department_id uuid;
begin
  select department.id into initial_department_id
  from public.departments department
  where lower(trim(department.code)) = 'hnd'
  order by department.created_at
  limit 1;

  update public.scheduling_constraints
    set department_id = initial_department_id where department_id is null;
  update public.timetable_generation_runs
    set department_id = initial_department_id where department_id is null;
  update public.timetable_conflict_reviews
    set department_id = initial_department_id where department_id is null;
  update public.timetable_versions
    set department_id = initial_department_id where department_id is null;
end
$$;

alter table public.scheduling_constraints alter column department_id set not null;
alter table public.timetable_generation_runs alter column department_id set not null;
alter table public.timetable_conflict_reviews alter column department_id set not null;
alter table public.timetable_versions alter column department_id set not null;
alter table public.scheduling_constraints alter column department_id
  set default public.current_user_primary_department_id();
alter table public.timetable_generation_runs alter column department_id
  set default public.current_user_primary_department_id();
alter table public.timetable_conflict_reviews alter column department_id
  set default public.current_user_primary_department_id();
alter table public.timetable_versions alter column department_id
  set default public.current_user_primary_department_id();

grant select on public.timetable_generation_runs to authenticated;
grant select on public.timetable_versions to authenticated;
grant select on public.timetable_publication_events to authenticated;

alter table public.timetable_conflict_reviews
  drop constraint if exists timetable_conflict_reviews_academic_period_id_conflict_key_key;
create unique index timetable_conflict_reviews_department_period_key_unique_idx
  on public.timetable_conflict_reviews (
    department_id, academic_period_id, conflict_key
  );

alter table public.timetable_versions
  drop constraint if exists timetable_versions_period_version_unique;
drop index if exists public.timetable_versions_one_published_per_period_idx;
create unique index timetable_versions_department_period_number_unique_idx
  on public.timetable_versions (
    department_id, academic_period_id, version_number
  );
create unique index timetable_versions_one_published_per_department_period_idx
  on public.timetable_versions (department_id, academic_period_id)
  where status = 'published';

do $$
declare policy_record record;
begin
  for policy_record in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename = any (array[
      'scheduling_constraints', 'timetable_generation_runs',
      'timetable_conflict_reviews', 'timetable_versions',
      'timetable_publication_events'
    ])
  loop
    execute format('drop policy %I on public.%I',
      policy_record.policyname, policy_record.tablename);
  end loop;
end
$$;

create policy scheduling_constraints_read on public.scheduling_constraints
  for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy scheduling_constraints_insert on public.scheduling_constraints
  for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy scheduling_constraints_update on public.scheduling_constraints
  for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));
create policy scheduling_constraints_delete on public.scheduling_constraints
  for delete to authenticated
  using (public.current_user_can_manage_department(department_id));

create policy timetable_generation_runs_read on public.timetable_generation_runs
  for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy timetable_generation_runs_insert on public.timetable_generation_runs
  for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));

create policy timetable_conflict_reviews_read on public.timetable_conflict_reviews
  for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy timetable_conflict_reviews_insert on public.timetable_conflict_reviews
  for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy timetable_conflict_reviews_update on public.timetable_conflict_reviews
  for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));
create policy timetable_conflict_reviews_delete on public.timetable_conflict_reviews
  for delete to authenticated
  using (public.current_user_can_manage_department(department_id));

create policy timetable_versions_read on public.timetable_versions
  for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy timetable_versions_insert on public.timetable_versions
  for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy timetable_versions_update on public.timetable_versions
  for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

create policy timetable_publication_events_read on public.timetable_publication_events
  for select to authenticated using (exists (
    select 1 from public.timetable_versions timetable_version
    where timetable_version.id = timetable_publication_events.timetable_version_id
      and public.current_user_can_access_department(
        timetable_version.department_id
      )
  ));

comment on column public.timetable_versions.department_id is
  'Department owning this independently versioned and published timetable.';

-- Return the working department's sessions plus protected occupancy records
-- from other departments. External sessions are marked locked so the planner
-- cannot overwrite a shared trainer or room booking.
create or replace function public.get_institutional_resource_bookings(
  target_academic_period_id uuid
)
returns table (
  id uuid,
  academic_period_id uuid,
  teaching_allocation_id uuid,
  cohort_id uuid,
  unit_id uuid,
  trainer_id uuid,
  working_day_id uuid,
  start_time_slot_id uuid,
  end_time_slot_id uuid,
  room_id uuid,
  session_number smallint,
  delivery_mode public.teaching_delivery_mode,
  status public.scheduled_session_status,
  source public.scheduled_session_source,
  conflict_state public.scheduled_session_conflict_state,
  is_locked boolean,
  participant_cohort_ids uuid[],
  combined_cohort_size integer,
  notes text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable security definer set search_path = '' as $$
  select
    session.id,
    session.academic_period_id,
    session.teaching_allocation_id,
    session.cohort_id,
    session.unit_id,
    session.trainer_id,
    session.working_day_id,
    session.start_time_slot_id,
    session.end_time_slot_id,
    session.room_id,
    session.session_number,
    session.delivery_mode,
    session.status,
    session.source,
    session.conflict_state,
    (
      session.is_locked
      or programme.department_id
        <> public.current_user_primary_department_id()
    ) as is_locked,
    session.participant_cohort_ids,
    session.combined_cohort_size,
    session.notes,
    session.created_at,
    session.updated_at
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and session.status in ('draft', 'confirmed', 'locked')
    and public.current_user_has_role(
      array['hod', 'system_admin']::public.app_role[]
    );
$$;
revoke all on function public.get_institutional_resource_bookings(uuid) from public;
grant execute on function public.get_institutional_resource_bookings(uuid)
  to authenticated;

create or replace function public.save_generated_timetable_draft(
  target_academic_period_id uuid,
  generated_sessions jsonb,
  generation_summary jsonb default '{}'::jsonb
)
returns table (
  generation_run_id uuid,
  saved_session_count integer,
  locked_session_count integer,
  unscheduled_session_count integer
)
language plpgsql security definer set search_path = '' as $$
declare
  session_item jsonb;
  run_id uuid;
  active_department uuid := public.current_user_primary_department_id();
  saved_total integer := 0;
  locked_total integer := 0;
  unscheduled_total integer :=
    coalesce((generation_summary ->> 'unscheduledSessionCount')::integer, 0);
  requested_total integer :=
    coalesce((generation_summary ->> 'requestedSessionCount')::integer, 0);
  conflict_total integer :=
    coalesce((generation_summary ->> 'conflictCount')::integer, 0);
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before generating.';
  end if;
  if jsonb_typeof(generated_sessions) <> 'array' then
    raise exception using errcode = '22023',
      message = 'Generated sessions must be supplied as a JSON array.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-generation:' || active_department::text || ':'
      || target_academic_period_id::text, 0
  ));

  select count(*) into locked_total
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and (session.is_locked or session.status = 'locked');

  delete from public.scheduled_sessions session
  using public.cohorts cohort, public.programmes programme
  where session.cohort_id = cohort.id
    and cohort.programme_id = programme.id
    and session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.is_locked = false
    and session.status in ('draft', 'confirmed');

  for session_item in select value from jsonb_array_elements(generated_sessions)
  loop
    if coalesce((session_item ->> 'isLocked')::boolean, false) then
      continue;
    end if;

    if not exists (
      select 1
      from public.teaching_allocations allocation
      join public.cohorts cohort on cohort.id = allocation.cohort_id
      join public.programmes programme on programme.id = cohort.programme_id
      where allocation.id =
          (session_item ->> 'teachingAllocationId')::uuid
        and allocation.academic_period_id = target_academic_period_id
        and programme.department_id = active_department
    ) then
      raise exception using errcode = '42501',
        message = 'A generated session belongs to another department.';
    end if;

    insert into public.scheduled_sessions (
      academic_period_id, teaching_allocation_id, cohort_id, unit_id,
      trainer_id, working_day_id, start_time_slot_id, end_time_slot_id,
      room_id, session_number, delivery_mode, status, source,
      conflict_state, is_locked, notes, created_by, updated_by
    ) values (
      target_academic_period_id,
      (session_item ->> 'teachingAllocationId')::uuid,
      (session_item ->> 'cohortId')::uuid,
      (session_item ->> 'unitId')::uuid,
      (session_item ->> 'trainerId')::uuid,
      (session_item ->> 'workingDayId')::uuid,
      (session_item ->> 'startTimeSlotId')::uuid,
      (session_item ->> 'endTimeSlotId')::uuid,
      (session_item ->> 'roomId')::uuid,
      (session_item ->> 'sessionNumber')::smallint,
      (session_item ->> 'deliveryMode')::public.teaching_delivery_mode,
      'draft'::public.scheduled_session_status,
      'generator'::public.scheduled_session_source,
      'clear'::public.scheduled_session_conflict_state,
      false,
      'Generated by the institutional timetabler.',
      auth.uid(),
      auth.uid()
    );
    saved_total := saved_total + 1;
  end loop;

  insert into public.timetable_generation_runs (
    department_id, academic_period_id, status, generation_strategy,
    overwrite_existing, requested_session_count, scheduled_session_count,
    unscheduled_session_count, conflict_count, locked_session_count,
    summary, created_by
  ) values (
    active_department,
    target_academic_period_id,
    case when unscheduled_total > 0 or conflict_total > 0
      then 'completed_with_issues' else 'completed' end,
    'balanced', true, requested_total, saved_total + locked_total,
    unscheduled_total, conflict_total, locked_total, generation_summary,
    auth.uid()
  ) returning id into run_id;

  return query select run_id, saved_total, locked_total, unscheduled_total;
end;
$$;

create or replace function public.create_timetable_version(
  target_academic_period_id uuid,
  version_title text,
  version_change_summary text default null
)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  next_version integer;
  version_id uuid;
  sessions_total integer;
  blocked_total integer;
  version_snapshot jsonb;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before publishing.';
  end if;
  if nullif(trim(version_title), '') is null then
    raise exception using errcode = '22023',
      message = 'A timetable version title is required.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'timetable-version:' || active_department::text || ':'
      || target_academic_period_id::text, 0
  ));

  select count(*), count(*) filter (where session.conflict_state = 'blocked')
  into sessions_total, blocked_total
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.status in ('draft', 'confirmed', 'locked');

  if sessions_total = 0 then
    raise exception using errcode = 'P0001',
      message = 'No draft timetable sessions are available to version.';
  end if;
  if blocked_total > 0 then
    raise exception using errcode = 'P0001',
      message = 'Resolve all blocking timetable conflicts before creating a version.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', session.id,
    'cohortId', session.cohort_id,
    'cohortName', cohort.name,
    'unitId', session.unit_id,
    'unitCode', unit_record.code,
    'unitName', unit_record.name,
    'trainerId', session.trainer_id,
    'trainerName', trainer.full_name,
    'roomId', session.room_id,
    'roomCode', room.code,
    'roomName', room.name,
    'workingDayId', session.working_day_id,
    'day', working_day.day_of_week,
    'daySequence', working_day.sequence_number,
    'startTimeSlotId', session.start_time_slot_id,
    'startTime', start_slot.starts_at,
    'endTimeSlotId', session.end_time_slot_id,
    'endTime', end_slot.ends_at,
    'sessionNumber', session.session_number,
    'deliveryMode', session.delivery_mode,
    'isLocked', session.is_locked,
    'notes', session.notes
  ) order by working_day.sequence_number, start_slot.sequence_number,
    cohort.name, unit_record.code), '[]'::jsonb)
  into version_snapshot
  from public.scheduled_sessions session
  join public.cohorts cohort on cohort.id = session.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  join public.units unit_record on unit_record.id = session.unit_id
  join public.trainers trainer on trainer.id = session.trainer_id
  join public.rooms room on room.id = session.room_id
  join public.working_days working_day on working_day.id = session.working_day_id
  join public.time_slots start_slot on start_slot.id = session.start_time_slot_id
  join public.time_slots end_slot on end_slot.id = session.end_time_slot_id
  where session.academic_period_id = target_academic_period_id
    and programme.department_id = active_department
    and session.status in ('draft', 'confirmed', 'locked');

  select coalesce(max(version_number), 0) + 1 into next_version
  from public.timetable_versions
  where department_id = active_department
    and academic_period_id = target_academic_period_id;

  insert into public.timetable_versions (
    department_id, academic_period_id, version_number, status, title,
    change_summary, session_count, conflict_count, snapshot, created_by
  ) values (
    active_department, target_academic_period_id, next_version, 'draft',
    trim(version_title), nullif(trim(version_change_summary), ''),
    sessions_total, blocked_total, version_snapshot, auth.uid()
  ) returning id into version_id;

  insert into public.timetable_publication_events (
    timetable_version_id, event_type, from_status, to_status, note, performed_by
  ) values (
    version_id, 'created', null, 'draft',
    nullif(trim(version_change_summary), ''), auth.uid()
  );

  return version_id;
end;
$$;

create or replace function public.transition_timetable_version(
  target_version_id uuid,
  target_status text,
  transition_note text default null
)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  selected_version public.timetable_versions%rowtype;
  allowed boolean := false;
  event_name text;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501',
      message = 'Authentication is required.';
  end if;

  select * into selected_version
  from public.timetable_versions
  where id = target_version_id
  for update;

  if selected_version.id is null then
    raise exception using errcode = 'P0002',
      message = 'The timetable version was not found.';
  end if;
  if not public.current_user_can_manage_department(
    selected_version.department_id
  ) then
    raise exception using errcode = '42501',
      message = 'You cannot publish another department timetable.';
  end if;

  allowed :=
    (selected_version.status = 'draft' and target_status = 'under_review')
    or (selected_version.status = 'under_review'
      and target_status in ('approved', 'draft'))
    or (selected_version.status = 'approved'
      and target_status in ('published', 'under_review'))
    or (selected_version.status = 'published' and target_status = 'archived');

  if not allowed then
    raise exception using errcode = '22023',
      message = format(
        'Unsupported timetable transition from %s to %s.',
        selected_version.status, target_status
      );
  end if;

  if target_status = 'published' then
    update public.timetable_versions
    set status = 'archived', archived_by = auth.uid(),
      archived_at = now(), updated_at = now()
    where department_id = selected_version.department_id
      and academic_period_id = selected_version.academic_period_id
      and status = 'published'
      and id <> selected_version.id;
  end if;

  event_name := case target_status
    when 'under_review' then
      case when selected_version.status = 'approved'
        then 'reopened' else 'submitted' end
    when 'approved' then 'approved'
    when 'published' then 'published'
    when 'archived' then 'archived'
    when 'draft' then 'reopened'
  end;

  update public.timetable_versions
  set
    status = target_status,
    submitted_by = case
      when target_status = 'under_review' and selected_version.status = 'draft'
        then auth.uid() else submitted_by end,
    submitted_at = case
      when target_status = 'under_review' and selected_version.status = 'draft'
        then now() else submitted_at end,
    approved_by = case when target_status = 'approved'
      then auth.uid() else approved_by end,
    approved_at = case when target_status = 'approved'
      then now() else approved_at end,
    published_by = case when target_status = 'published'
      then auth.uid() else published_by end,
    published_at = case when target_status = 'published'
      then now() else published_at end,
    archived_by = case when target_status = 'archived'
      then auth.uid() else archived_by end,
    archived_at = case when target_status = 'archived'
      then now() else archived_at end,
    updated_at = now()
  where id = target_version_id;

  insert into public.timetable_publication_events (
    timetable_version_id, event_type, from_status, to_status, note, performed_by
  ) values (
    target_version_id, event_name, selected_version.status, target_status,
    nullif(trim(transition_note), ''), auth.uid()
  );
end;
$$;

-- Import audit history follows the working department as well.
alter table public.import_batches add column department_id uuid
  references public.departments(id) on delete restrict;
do $$
declare initial_department_id uuid;
begin
  select department.id into initial_department_id
  from public.departments department
  where lower(trim(department.code)) = 'hnd'
  order by department.created_at
  limit 1;
  update public.import_batches
  set department_id = initial_department_id
  where department_id is null;
end
$$;
alter table public.import_batches alter column department_id set not null;
alter table public.import_batches alter column department_id
  set default public.current_user_primary_department_id();

do $$
declare policy_record record;
begin
  for policy_record in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename = any (array['import_batches', 'import_rows'])
  loop
    execute format('drop policy %I on public.%I',
      policy_record.policyname, policy_record.tablename);
  end loop;
end
$$;

create policy import_batches_read on public.import_batches
  for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy import_batches_insert on public.import_batches
  for insert to authenticated
  with check (
    public.current_user_can_manage_department(department_id)
    and created_by = auth.uid()
  );
create policy import_batches_update on public.import_batches
  for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

create policy import_rows_read on public.import_rows
  for select to authenticated using (exists (
    select 1 from public.import_batches batch
    where batch.id = import_rows.import_batch_id
      and public.current_user_can_access_department(batch.department_id)
  ));
create policy import_rows_insert on public.import_rows
  for insert to authenticated with check (exists (
    select 1 from public.import_batches batch
    where batch.id = import_rows.import_batch_id
      and public.current_user_can_manage_department(batch.department_id)
  ));
create policy import_rows_update on public.import_rows
  for update to authenticated using (exists (
    select 1 from public.import_batches batch
    where batch.id = import_rows.import_batch_id
      and public.current_user_can_manage_department(batch.department_id)
  )) with check (exists (
    select 1 from public.import_batches batch
    where batch.id = import_rows.import_batch_id
      and public.current_user_can_manage_department(batch.department_id)
  ));
create policy import_rows_delete on public.import_rows
  for delete to authenticated using (exists (
    select 1 from public.import_batches batch
    where batch.id = import_rows.import_batch_id
      and public.current_user_can_manage_department(batch.department_id)
  ));

-- Workload is institutional: an external trainer's hours in every department
-- count toward the same weekly maximum.
create or replace function public.assign_unit_offering(
  p_offering_id uuid,
  p_trainer_id uuid
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  offering public.unit_offerings%rowtype;
  trainer public.trainers%rowtype;
  shared_offering public.teaching_offerings%rowtype;
  used_hours numeric;
  added_hours numeric;
  projected_hours numeric;
  allocation_id uuid;
  fixed_required boolean := false;
  fixed_day uuid;
  fixed_slot uuid;
  incomplete_fixed_count integer := 0;
  fixed_pattern_count integer := 0;
begin
  if auth.uid() is null or active_department is null
    or not public.current_user_can_manage_department(active_department) then
    raise exception using errcode = '42501',
      message = 'Select an authorized working department before allocating.';
  end if;

  select unit_offering.* into offering
  from public.unit_offerings unit_offering
  join public.cohorts cohort on cohort.id = unit_offering.cohort_id
  join public.programmes programme on programme.id = cohort.programme_id
  where unit_offering.id = p_offering_id
    and programme.department_id = active_department
  for update of unit_offering;

  if offering.id is null then
    raise exception 'Unit on offer was not found in the working department';
  end if;
  if offering.allocation_status = 'allocated' then
    raise exception 'This unit on offer is already allocated';
  end if;

  select * into trainer from public.trainers where id = p_trainer_id;
  if trainer.id is null or not trainer.is_active
    or not trainer.is_timetable_available then
    raise exception 'The selected trainer is not available';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'trainer-workload:' || trainer.id::text || ':'
      || offering.academic_period_id::text, 0
  ));

  if offering.confirmed_shared_offering_id is not null then
    select * into shared_offering
    from public.teaching_offerings
    where id = offering.confirmed_shared_offering_id
      and department_id = active_department;
    if shared_offering.id is null then
      raise exception 'The confirmed shared class is not available';
    end if;

    if exists (
      select 1
      from public.teaching_offering_participants participant
      where participant.teaching_offering_id = shared_offering.id
        and exists (
          select 1 from public.trainer_unit_eligibility eligibility
          where eligibility.unit_id = participant.unit_id
        )
        and not exists (
          select 1 from public.trainer_unit_eligibility eligibility
          where eligibility.unit_id = participant.unit_id
            and eligibility.trainer_id = trainer.id
        )
    ) then
      raise exception 'The trainer is not approved for every unit in this shared class';
    end if;

    select
      coalesce(bool_or(member.fixed_schedule_required), false),
      min(member.fixed_working_day_id),
      min(member.fixed_time_slot_id),
      count(*) filter (
        where not member.fixed_schedule_required
          or member.fixed_working_day_id is null
          or member.fixed_time_slot_id is null
      ),
      count(distinct concat(
        member.fixed_working_day_id, ':', member.fixed_time_slot_id
      )) filter (where member.fixed_schedule_required)
    into
      fixed_required, fixed_day, fixed_slot,
      incomplete_fixed_count, fixed_pattern_count
    from public.teaching_offering_participants participant
    join public.unit_offerings member
      on member.id = participant.unit_offering_id
    where participant.teaching_offering_id = shared_offering.id;

    if fixed_required
      and (incomplete_fixed_count > 0 or fixed_pattern_count <> 1) then
      raise exception 'Every unit in the shared class must use the same fixed day and session';
    end if;

    added_hours :=
      shared_offering.weekly_sessions
      * shared_offering.session_duration_minutes / 60.0;
  else
    if exists (
      select 1 from public.trainer_unit_eligibility eligibility
      where eligibility.unit_id = offering.unit_id
    ) and not exists (
      select 1 from public.trainer_unit_eligibility eligibility
      where eligibility.unit_id = offering.unit_id
        and eligibility.trainer_id = trainer.id
    ) then
      raise exception 'The trainer is not approved to teach this unit';
    end if;

    fixed_required := offering.fixed_schedule_required;
    fixed_day := offering.fixed_working_day_id;
    fixed_slot := offering.fixed_time_slot_id;
    if fixed_required and (fixed_day is null or fixed_slot is null) then
      raise exception 'Set the fixed day and session before allocating this unit';
    end if;

    added_hours :=
      coalesce(offering.weekly_sessions, 1)
      * coalesce(offering.session_duration_minutes, 120) / 60.0;
  end if;

  if trainer.availability_mode = 'selected_slots_only'
    and not exists (
      select 1 from public.trainer_availability availability
      where availability.trainer_id = trainer.id
        and availability.academic_period_id = offering.academic_period_id
        and (
          not fixed_required
          or (
            availability.working_day_id = fixed_day
            and availability.time_slot_id = fixed_slot
          )
        )
    ) then
    raise exception 'Add an available teaching time for this trainer first';
  end if;

  select coalesce(sum(
    allocation.weekly_sessions * allocation.session_duration_minutes
  ) / 60.0, 0)
  into used_hours
  from public.teaching_allocations allocation
  where allocation.trainer_id = trainer.id
    and allocation.academic_period_id = offering.academic_period_id
    and allocation.status in ('draft', 'active');

  projected_hours := used_hours + added_hours;
  if projected_hours > trainer.maximum_weekly_hours then
    raise exception
      'Maximum workload exceeded: %h projected, %h maximum',
      projected_hours, trainer.maximum_weekly_hours;
  end if;

  insert into public.teaching_allocations (
    academic_period_id, cohort_id, unit_id, trainer_id, delivery_mode,
    weekly_sessions, session_duration_minutes, status,
    is_timetable_enabled, teaching_offering_id, participant_cohort_ids,
    combined_cohort_size, notes
  ) values (
    offering.academic_period_id,
    offering.cohort_id,
    offering.unit_id,
    trainer.id,
    case when offering.offering_type = 'practical'
      then 'practical'::public.teaching_delivery_mode
      else 'theory'::public.teaching_delivery_mode end,
    case when shared_offering.id is null
      then coalesce(offering.weekly_sessions, 1)
      else shared_offering.weekly_sessions end,
    case when shared_offering.id is null
      then coalesce(offering.session_duration_minutes, 120)
      else shared_offering.session_duration_minutes end,
    'active',
    true,
    shared_offering.id,
    case when shared_offering.id is null
      then array[offering.cohort_id]
      else (
        select array_agg(distinct participant.cohort_id)
        from public.teaching_offering_participants participant
        where participant.teaching_offering_id = shared_offering.id
      ) end,
    case when shared_offering.id is null
      then (select actual_size from public.cohorts where id = offering.cohort_id)
      else (
        select coalesce(sum(cohort.actual_size), 0)
        from public.teaching_offering_participants participant
        join public.cohorts cohort on cohort.id = participant.cohort_id
        where participant.teaching_offering_id = shared_offering.id
      ) end,
    case when shared_offering.id is null
      then null else 'Shared class: workload counted once' end
  ) returning id into allocation_id;

  if shared_offering.id is not null then
    update public.teaching_offerings
    set trainer_id = trainer.id, status = 'active'
    where id = shared_offering.id;
    update public.unit_offerings
    set allocation_status = 'allocated', status = 'active', updated_at = now()
    where confirmed_shared_offering_id = shared_offering.id;
  else
    update public.unit_offerings
    set allocation_status = 'allocated', status = 'active', updated_at = now()
    where id = offering.id;
  end if;

  return jsonb_build_object(
    'allocationId', allocation_id,
    'allocatedHours', projected_hours,
    'normalHours', trainer.normal_weekly_hours,
    'maximumHours', trainer.maximum_weekly_hours,
    'isExtraLoad', projected_hours > trainer.normal_weekly_hours,
    'shared', shared_offering.id is not null
  );
end;
$$;
