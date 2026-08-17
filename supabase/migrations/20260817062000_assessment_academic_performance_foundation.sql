-- ============================================================
-- Assessment & Academic Performance: foundation
-- ============================================================
-- Assessment populations are snapshots generated from verified student
-- unit registrations. Draft assessments may refresh their population;
-- once opened, the population is intentionally stable.

create type public.assessment_event_type as enum ('cat', 'exam');
create type public.assessment_event_status as enum ('draft', 'open', 'closed');
create type public.assessment_population_status as enum ('expected', 'excluded');

create table public.assessment_events (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  cohort_id uuid references public.cohorts(id) on delete restrict,
  assessment_type public.assessment_event_type not null,
  title text not null,
  assessment_date date,
  max_mark numeric(6,2) not null default 100,
  pass_mark numeric(6,2) not null default 50,
  status public.assessment_event_status not null default 'draft',
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint assessment_events_title_check check (char_length(trim(title)) between 2 and 120),
  constraint assessment_events_marks_check check (max_mark > 0 and pass_mark >= 0 and pass_mark <= max_mark),
  constraint assessment_events_notes_check check (notes is null or char_length(notes) <= 1000)
);

create unique index assessment_events_scope_title_unique_idx
  on public.assessment_events (
    department_id,
    academic_period_id,
    unit_id,
    coalesce(cohort_id, '00000000-0000-0000-0000-000000000000'::uuid),
    assessment_type,
    lower(trim(title))
  );

create index assessment_events_department_period_idx
  on public.assessment_events (department_id, academic_period_id, assessment_type, status);
create index assessment_events_unit_idx on public.assessment_events (unit_id, academic_period_id);

create table public.assessment_population (
  id uuid primary key default gen_random_uuid(),
  assessment_event_id uuid not null references public.assessment_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  student_unit_registration_id uuid references public.student_unit_registrations(id) on delete set null,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  population_status public.assessment_population_status not null default 'expected',
  source text not null default 'verified_unit_registration',
  included_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (assessment_event_id, student_id),
  constraint assessment_population_source_check check (char_length(trim(source)) between 2 and 80)
);

create index assessment_population_event_idx
  on public.assessment_population (assessment_event_id, population_status);
create index assessment_population_student_idx
  on public.assessment_population (student_id, assessment_event_id);

create or replace function public.validate_assessment_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_unit public.units%rowtype;
  selected_programme public.programmes%rowtype;
  selected_cohort public.cohorts%rowtype;
begin
  select * into selected_unit from public.units where id = new.unit_id;
  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Assessment unit not found';
  end if;

  select * into selected_programme from public.programmes where id = selected_unit.programme_id;
  if selected_programme.id is null or selected_programme.department_id <> new.department_id then
    raise exception using errcode = '23514', message = 'Assessment unit must belong to the selected department';
  end if;

  if new.cohort_id is not null then
    select * into selected_cohort from public.cohorts where id = new.cohort_id;
    if selected_cohort.id is null or selected_cohort.programme_id <> selected_unit.programme_id then
      raise exception using errcode = '23514', message = 'Assessment cohort must belong to the unit programme';
    end if;
  end if;

  if not public.current_user_can_manage_department(new.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this assessment';
  end if;

  new.title = trim(new.title);
  new.notes = nullif(trim(new.notes), '');
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger assessment_events_validate
before insert or update on public.assessment_events
for each row execute function public.validate_assessment_event();

create or replace function public.refresh_assessment_population(target_assessment_event_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_event public.assessment_events%rowtype;
  inserted_count integer := 0;
begin
  select * into selected_event
  from public.assessment_events
  where id = target_assessment_event_id
  for update;

  if selected_event.id is null then
    raise exception using errcode = 'P0002', message = 'Assessment not found';
  end if;

  if not public.current_user_can_manage_department(selected_event.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this assessment';
  end if;

  if selected_event.status <> 'draft' then
    raise exception using errcode = 'P0001', message = 'Only draft assessment populations can be refreshed';
  end if;

  delete from public.assessment_population
  where assessment_event_id = selected_event.id;

  insert into public.assessment_population (
    assessment_event_id,
    student_id,
    student_unit_registration_id,
    cohort_id,
    population_status,
    source
  )
  select distinct on (r.student_id)
    selected_event.id,
    r.student_id,
    r.id,
    r.cohort_id,
    'expected'::public.assessment_population_status,
    'verified_unit_registration'
  from public.verified_student_unit_registrations r
  join public.students s on s.id = r.student_id
  where r.academic_period_id = selected_event.academic_period_id
    and r.unit_id = selected_event.unit_id
    and (selected_event.cohort_id is null or r.cohort_id = selected_event.cohort_id)
    and s.department_id = selected_event.department_id
    and s.lifecycle_status in ('admitted', 'active')
  order by r.student_id, r.registered_at desc;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.refresh_assessment_population(uuid) to authenticated;

alter table public.assessment_events enable row level security;
alter table public.assessment_population enable row level security;
revoke all on table public.assessment_events from anon;
revoke all on table public.assessment_population from anon;
revoke all on table public.assessment_events from authenticated;
revoke all on table public.assessment_population from authenticated;
grant select, insert, update, delete on table public.assessment_events to authenticated;
grant select, insert, update, delete on table public.assessment_population to authenticated;

create policy assessment_events_read
on public.assessment_events for select to authenticated
using (public.current_user_can_access_department(department_id));

create policy assessment_events_manage
on public.assessment_events for all to authenticated
using (public.current_user_can_manage_department(department_id))
with check (public.current_user_can_manage_department(department_id));

create policy assessment_population_read
on public.assessment_population for select to authenticated
using (
  exists (
    select 1 from public.assessment_events e
    where e.id = assessment_event_id
      and public.current_user_can_access_department(e.department_id)
  )
);

create policy assessment_population_manage
on public.assessment_population for all to authenticated
using (
  exists (
    select 1 from public.assessment_events e
    where e.id = assessment_event_id
      and public.current_user_can_manage_department(e.department_id)
  )
)
with check (
  exists (
    select 1 from public.assessment_events e
    where e.id = assessment_event_id
      and public.current_user_can_manage_department(e.department_id)
  )
);

comment on table public.assessment_events is
  'Department CAT and examination definitions. Population is sourced from verified student unit registrations.';
comment on table public.assessment_population is
  'Stable expected-student snapshot for an assessment event. Draft events may refresh this snapshot.';
