-- ============================================================
-- Student Lifecycle Phase 5: unit registration foundation
-- ============================================================
-- Creates the authoritative student/unit roster used later by
-- attendance, CAT/exam analysis and registration-form generation.

create type public.student_unit_registration_status as enum (
  'registered',
  'dropped',
  'exempted',
  'completed'
);

create table public.student_unit_registrations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  unit_id uuid not null references public.units(id) on delete restrict,
  unit_offering_id uuid references public.unit_offerings(id) on delete set null,
  registration_status public.student_unit_registration_status not null default 'registered',
  source text not null default 'current_cohort_offering',
  registered_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (student_id, academic_period_id, unit_id),
  constraint student_unit_registrations_source_check
    check (char_length(trim(source)) between 2 and 80),
  constraint student_unit_registrations_notes_check
    check (notes is null or char_length(notes) <= 1000)
);

create index student_unit_registrations_period_idx
  on public.student_unit_registrations (academic_period_id, registration_status);
create index student_unit_registrations_student_idx
  on public.student_unit_registrations (student_id, academic_period_id);
create index student_unit_registrations_cohort_idx
  on public.student_unit_registrations (cohort_id, academic_period_id);
create index student_unit_registrations_unit_idx
  on public.student_unit_registrations (unit_id, academic_period_id);

create or replace function public.validate_student_unit_registration()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  selected_cohort public.cohorts%rowtype;
  selected_unit public.units%rowtype;
begin
  select * into selected_student from public.students where id = new.student_id;
  select * into selected_cohort from public.cohorts where id = new.cohort_id;
  select * into selected_unit from public.units where id = new.unit_id;

  if selected_student.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  if selected_cohort.id is null or selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Academic registration reference not found';
  end if;

  if selected_student.programme_id <> selected_cohort.programme_id
     or selected_student.programme_id <> selected_unit.programme_id then
    raise exception using errcode = '23514',
      message = 'Student, cohort and unit must belong to the same programme';
  end if;

  new.updated_at = now();
  new.updated_by = auth.uid();
  new.notes = nullif(trim(new.notes), '');
  return new;
end;
$$;

create trigger student_unit_registrations_validate
before insert or update on public.student_unit_registrations
for each row execute function public.validate_student_unit_registration();

create or replace function public.register_student_current_units(
  target_student_id uuid,
  target_academic_period_id uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_student public.students%rowtype;
  selected_period_id uuid;
  inserted_count integer := 0;
begin
  select * into selected_student
  from public.students
  where id = target_student_id;

  if selected_student.id is null then
    raise exception using errcode = 'P0002', message = 'Student not found';
  end if;

  if not public.current_user_can_manage_department(selected_student.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to register this student';
  end if;

  if selected_student.lifecycle_status not in ('admitted', 'active') then
    raise exception using errcode = 'P0001', message = 'Only active students can register units';
  end if;

  if selected_student.current_cohort_id is null then
    raise exception using errcode = 'P0001', message = 'Student has no current study cohort';
  end if;

  if target_academic_period_id is null then
    select id into selected_period_id
    from public.academic_periods
    where status = 'active'
    limit 1;
  else
    select id into selected_period_id
    from public.academic_periods
    where id = target_academic_period_id;
  end if;

  if selected_period_id is null then
    raise exception using errcode = 'P0001', message = 'No active academic period is available';
  end if;

  insert into public.student_unit_registrations (
    student_id,
    academic_period_id,
    cohort_id,
    unit_id,
    unit_offering_id,
    registration_status,
    source
  )
  select
    selected_student.id,
    selected_period_id,
    selected_student.current_cohort_id,
    offering.unit_id,
    offering.id,
    'registered'::public.student_unit_registration_status,
    'current_cohort_offering'
  from public.unit_offerings offering
  where offering.academic_period_id = selected_period_id
    and offering.cohort_id = selected_student.current_cohort_id
    and offering.selection_state = 'included'
    and offering.status <> 'cancelled'
  on conflict (student_id, academic_period_id, unit_id) do nothing;

  get diagnostics inserted_count = row_count;
  return inserted_count;
end;
$$;

grant execute on function public.register_student_current_units(uuid, uuid) to authenticated;

alter table public.student_unit_registrations enable row level security;
revoke all on table public.student_unit_registrations from anon;
revoke all on table public.student_unit_registrations from authenticated;
grant select, insert, update on table public.student_unit_registrations to authenticated;

create policy student_unit_registrations_read
on public.student_unit_registrations for select to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_access_department(s.department_id)
  )
);

create policy student_unit_registrations_insert
on public.student_unit_registrations for insert to authenticated
with check (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_manage_department(s.department_id)
  )
);

create policy student_unit_registrations_update
on public.student_unit_registrations for update to authenticated
using (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_manage_department(s.department_id)
  )
)
with check (
  exists (
    select 1 from public.students s
    where s.id = student_id
      and public.current_user_can_manage_department(s.department_id)
  )
);

comment on table public.student_unit_registrations is
  'Authoritative per-student unit roster for an academic period. Attendance and assessment modules should use this table as their expected-student population.';
