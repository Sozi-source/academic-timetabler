-- ============================================================
-- Academic Management System: Student lifecycle foundation
-- ============================================================
-- Establishes one authoritative student identity plus historical cohort,
-- period-enrolment and lifecycle-event records. Later attendance,
-- assessment, unit-registration and clinical modules must consume this
-- shared student truth instead of maintaining independent student lists.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.student_lifecycle_status as enum (
    'admitted',
    'active',
    'deferred',
    'on_leave',
    'completed',
    'withdrawn',
    'discontinued',
    'graduated'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.student_period_enrolment_status as enum (
    'planned',
    'registered',
    'in_session',
    'deferred',
    'completed',
    'withdrawn'
  );
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type public.student_lifecycle_event_type as enum (
    'admission',
    'cohort_assignment',
    'cohort_change',
    'deferral',
    'resumption',
    'leave_started',
    'leave_ended',
    'withdrawal',
    'discontinuation',
    'programme_completion',
    'graduation',
    'administrative_correction'
  );
exception when duplicate_object then null;
end
$$;

create table public.students (
  id uuid primary key default gen_random_uuid(),

  department_id uuid not null
    references public.departments(id) on delete restrict
    default public.current_user_primary_department_id(),

  programme_id uuid not null
    references public.programmes(id) on delete restrict,

  admission_cohort_id uuid not null
    references public.cohorts(id) on delete restrict,

  current_cohort_id uuid
    references public.cohorts(id) on delete restrict,

  admission_number text not null,
  full_name text not null,

  lifecycle_status public.student_lifecycle_status
    not null default 'admitted',

  admission_date date,
  projected_completion_date date,

  admission_number_inference jsonb not null default '{}'::jsonb,
  notes text,

  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint students_admission_number_length_check
    check (char_length(trim(admission_number)) between 3 and 80),
  constraint students_full_name_length_check
    check (char_length(trim(full_name)) between 2 and 180),
  constraint students_notes_length_check
    check (notes is null or char_length(notes) <= 2000)
);

create unique index students_department_admission_number_unique_idx
  on public.students (department_id, lower(trim(admission_number)));
create index students_department_status_idx
  on public.students (department_id, lifecycle_status);
create index students_programme_idx on public.students (programme_id);
create index students_admission_cohort_idx on public.students (admission_cohort_id);
create index students_current_cohort_idx on public.students (current_cohort_id);
create index students_name_search_idx on public.students (lower(full_name));

create table public.student_cohort_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  effective_from date not null,
  effective_to date,
  is_admission_cohort boolean not null default false,
  assignment_reason text not null default 'Standard progression',
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),

  constraint student_cohort_assignment_dates_check
    check (effective_to is null or effective_to >= effective_from),
  constraint student_cohort_assignment_reason_check
    check (char_length(trim(assignment_reason)) between 2 and 240)
);

create unique index student_cohort_assignments_one_open_idx
  on public.student_cohort_assignments (student_id)
  where effective_to is null;
create index student_cohort_assignments_student_history_idx
  on public.student_cohort_assignments (student_id, effective_from desc);

create table public.student_academic_period_enrolments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  academic_period_number smallint not null,
  enrolment_status public.student_period_enrolment_status not null default 'planned',
  enrolled_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  updated_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint student_period_number_check
    check (academic_period_number between 1 and 60),
  unique (student_id, academic_period_id)
);

create index student_period_enrolments_period_idx
  on public.student_academic_period_enrolments (academic_period_id, enrolment_status);
create index student_period_enrolments_cohort_idx
  on public.student_academic_period_enrolments (cohort_id, academic_period_id);

create table public.student_lifecycle_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  event_type public.student_lifecycle_event_type not null,
  effective_date date not null,
  academic_period_id uuid references public.academic_periods(id) on delete restrict,
  from_cohort_id uuid references public.cohorts(id) on delete restrict,
  to_cohort_id uuid references public.cohorts(id) on delete restrict,
  expected_resume_date date,
  reason text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),

  constraint student_lifecycle_reason_length_check
    check (reason is null or char_length(trim(reason)) <= 500),
  constraint student_lifecycle_notes_length_check
    check (notes is null or char_length(notes) <= 2000),
  constraint student_lifecycle_resume_date_check
    check (expected_resume_date is null or expected_resume_date >= effective_date)
);

create index student_lifecycle_events_timeline_idx
  on public.student_lifecycle_events (student_id, effective_date desc, created_at desc);
create index student_lifecycle_events_type_idx
  on public.student_lifecycle_events (event_type, effective_date desc);

-- -------------------------------------------------------------------------
-- Cross-table integrity. A student cannot silently point at another
-- department's programme/cohort. Admission identity stays permanent while
-- current cohort may change over time.
-- -------------------------------------------------------------------------
create or replace function public.validate_student_academic_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  programme_department uuid;
  admission_programme uuid;
  current_programme uuid;
begin
  select department_id into programme_department
  from public.programmes where id = new.programme_id;

  if programme_department is null or programme_department <> new.department_id then
    raise exception using errcode = 'P0001',
      message = 'Student programme must belong to the selected department';
  end if;

  select programme_id into admission_programme
  from public.cohorts where id = new.admission_cohort_id;

  if admission_programme is null or admission_programme <> new.programme_id then
    raise exception using errcode = 'P0001',
      message = 'Admission cohort must belong to the student programme';
  end if;

  if new.current_cohort_id is not null then
    select programme_id into current_programme
    from public.cohorts where id = new.current_cohort_id;

    if current_programme is null or current_programme <> new.programme_id then
      raise exception using errcode = 'P0001',
        message = 'Current study cohort must belong to the student programme';
    end if;
  end if;

  new.admission_number = upper(trim(new.admission_number));
  new.full_name = trim(new.full_name);
  new.notes = nullif(trim(new.notes), '');
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger students_validate_academic_identity
before insert or update on public.students
for each row execute function public.validate_student_academic_identity();

create or replace function public.validate_student_cohort_assignment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  student_programme uuid;
  cohort_programme uuid;
begin
  select programme_id into student_programme from public.students where id = new.student_id;
  select programme_id into cohort_programme from public.cohorts where id = new.cohort_id;
  if student_programme is null or cohort_programme is null or student_programme <> cohort_programme then
    raise exception using errcode = 'P0001', message = 'Cohort assignment must remain inside the student programme';
  end if;
  return new;
end;
$$;

create trigger student_cohort_assignments_validate
before insert or update on public.student_cohort_assignments
for each row execute function public.validate_student_cohort_assignment();

create or replace function public.validate_student_period_enrolment()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  student_programme uuid;
  cohort_programme uuid;
begin
  select programme_id into student_programme from public.students where id = new.student_id;
  select programme_id into cohort_programme from public.cohorts where id = new.cohort_id;
  if student_programme is null or cohort_programme is null or student_programme <> cohort_programme then
    raise exception using errcode = 'P0001', message = 'Period enrolment cohort must remain inside the student programme';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger student_period_enrolments_validate
before insert or update on public.student_academic_period_enrolments
for each row execute function public.validate_student_period_enrolment();

-- -------------------------------------------------------------------------
-- Row-level security. Student records are department-owned. Child history
-- tables inherit access through the parent student record.
-- -------------------------------------------------------------------------
alter table public.students enable row level security;
alter table public.student_cohort_assignments enable row level security;
alter table public.student_academic_period_enrolments enable row level security;
alter table public.student_lifecycle_events enable row level security;

revoke all on table public.students from anon;
revoke all on table public.student_cohort_assignments from anon;
revoke all on table public.student_academic_period_enrolments from anon;
revoke all on table public.student_lifecycle_events from anon;

revoke all on table public.students from authenticated;
revoke all on table public.student_cohort_assignments from authenticated;
revoke all on table public.student_academic_period_enrolments from authenticated;
revoke all on table public.student_lifecycle_events from authenticated;

grant select, insert, update on table public.students to authenticated;
grant select, insert, update on table public.student_cohort_assignments to authenticated;
grant select, insert, update on table public.student_academic_period_enrolments to authenticated;
grant select, insert on table public.student_lifecycle_events to authenticated;

create policy students_read on public.students for select to authenticated
  using (public.current_user_can_access_department(department_id));
create policy students_insert on public.students for insert to authenticated
  with check (public.current_user_can_manage_department(department_id));
create policy students_update on public.students for update to authenticated
  using (public.current_user_can_manage_department(department_id))
  with check (public.current_user_can_manage_department(department_id));

create policy student_cohort_assignments_read on public.student_cohort_assignments for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_access_department(s.department_id)));
create policy student_cohort_assignments_insert on public.student_cohort_assignments for insert to authenticated
  with check (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_manage_department(s.department_id)));
create policy student_cohort_assignments_update on public.student_cohort_assignments for update to authenticated
  using (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_manage_department(s.department_id)))
  with check (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_manage_department(s.department_id)));

create policy student_period_enrolments_read on public.student_academic_period_enrolments for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_access_department(s.department_id)));
create policy student_period_enrolments_insert on public.student_academic_period_enrolments for insert to authenticated
  with check (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_manage_department(s.department_id)));
create policy student_period_enrolments_update on public.student_academic_period_enrolments for update to authenticated
  using (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_manage_department(s.department_id)))
  with check (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_manage_department(s.department_id)));

create policy student_lifecycle_events_read on public.student_lifecycle_events for select to authenticated
  using (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_access_department(s.department_id)));
create policy student_lifecycle_events_insert on public.student_lifecycle_events for insert to authenticated
  with check (exists (select 1 from public.students s where s.id = student_id
    and public.current_user_can_manage_department(s.department_id)));
comment on table public.students is
  'Authoritative student identity. Admission cohort is permanent; current cohort is the present study group and may change through lifecycle history.';
comment on table public.student_cohort_assignments is
  'Effective-dated cohort history used to track deferral, resumption and cohort movement without overwriting admission identity.';
comment on table public.student_academic_period_enrolments is
  'Authoritative period population for attendance, CAT, examination and progression denominators.';
comment on table public.student_lifecycle_events is
  'Auditable academic lifecycle timeline including deferrals, resumptions, completion and withdrawal events.';
comment on column public.students.admission_number_inference is
  'Stores parser evidence/suggestions from admission-number onboarding; inferred values never replace explicit programme/cohort assignments.';
