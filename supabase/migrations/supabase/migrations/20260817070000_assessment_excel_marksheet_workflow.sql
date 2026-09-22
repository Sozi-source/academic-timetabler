-- ============================================================
-- Assessment Excel marksheet workflow
-- One workbook = one unit; cohort populations are separate sheets.
-- Exam absence comes from the physical signing sheet and is recorded
-- in the system before the marks workbook is generated.
-- ============================================================

create type public.assessment_attendance_status as enum ('pending', 'present', 'absent');
create type public.assessment_mark_import_status as enum ('staged', 'completed', 'failed');
create type public.assessment_mark_import_row_status as enum ('ready', 'invalid');

alter table public.assessment_events
  add column attendance_finalized_at timestamptz,
  add column attendance_finalized_by uuid references auth.users(id) on delete set null;

alter table public.assessment_population
  add column attendance_status public.assessment_attendance_status not null default 'pending',
  add column attendance_updated_at timestamptz,
  add column attendance_updated_by uuid references auth.users(id) on delete set null;

create table public.assessment_mark_import_batches (
  id uuid primary key default gen_random_uuid(),
  assessment_event_id uuid not null references public.assessment_events(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete restrict,
  original_file_name text not null,
  status public.assessment_mark_import_status not null default 'staged',
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  sheet_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint assessment_mark_import_batches_file_check check (char_length(trim(original_file_name)) between 1 and 255),
  constraint assessment_mark_import_batches_counts_check check (total_rows >= 0 and valid_rows >= 0 and invalid_rows >= 0 and sheet_count >= 0)
);

create table public.assessment_mark_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.assessment_mark_import_batches(id) on delete cascade,
  sheet_name text not null,
  row_number integer not null,
  student_id uuid references public.students(id) on delete cascade,
  cohort_id uuid references public.cohorts(id) on delete restrict,
  admission_number text not null,
  row_status public.assessment_mark_import_row_status not null,
  errors jsonb not null default '[]'::jsonb,
  component_marks jsonb not null default '{}'::jsonb,
  total_mark numeric(7,2),
  grade text,
  comment text,
  created_at timestamptz not null default now(),
  unique (batch_id, sheet_name, row_number),
  constraint assessment_mark_import_rows_row_check check (row_number > 0),
  constraint assessment_mark_import_rows_admission_check check (char_length(trim(admission_number)) between 2 and 80)
);

create table public.assessment_results (
  id uuid primary key default gen_random_uuid(),
  assessment_event_id uuid not null references public.assessment_events(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  cohort_id uuid not null references public.cohorts(id) on delete restrict,
  component_marks jsonb not null default '{}'::jsonb,
  total_mark numeric(7,2),
  grade text,
  comment text,
  source_batch_id uuid references public.assessment_mark_import_batches(id) on delete set null,
  imported_by uuid references auth.users(id) on delete set null default auth.uid(),
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assessment_event_id, student_id),
  constraint assessment_results_total_check check (total_mark is null or total_mark >= 0)
);

create index assessment_mark_import_batches_event_idx
  on public.assessment_mark_import_batches (assessment_event_id, created_at desc);
create index assessment_mark_import_rows_batch_idx
  on public.assessment_mark_import_rows (batch_id, row_status, sheet_name, row_number);
create index assessment_results_event_idx
  on public.assessment_results (assessment_event_id, cohort_id, student_id);

create or replace function public.record_assessment_attendance(
  target_assessment_event_id uuid,
  absent_student_ids uuid[] default '{}'::uuid[]
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_event public.assessment_events%rowtype;
  expected_count integer := 0;
  valid_absent_count integer := 0;
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

  select count(*) into expected_count
  from public.assessment_population
  where assessment_event_id = selected_event.id
    and population_status = 'expected';

  if expected_count = 0 then
    raise exception using errcode = 'P0001', message = 'Assessment population is empty';
  end if;

  if cardinality(absent_student_ids) > 0 then
    select count(*) into valid_absent_count
    from public.assessment_population
    where assessment_event_id = selected_event.id
      and population_status = 'expected'
      and student_id = any(absent_student_ids);

    if valid_absent_count <> cardinality(absent_student_ids) then
      raise exception using errcode = '23514', message = 'One or more absent students are outside the assessment population';
    end if;
  end if;

  update public.assessment_population
  set attendance_status = 'present',
      attendance_updated_at = now(),
      attendance_updated_by = auth.uid()
  where assessment_event_id = selected_event.id
    and population_status = 'expected';

  if cardinality(absent_student_ids) > 0 then
    update public.assessment_population
    set attendance_status = 'absent',
        attendance_updated_at = now(),
        attendance_updated_by = auth.uid()
    where assessment_event_id = selected_event.id
      and student_id = any(absent_student_ids);
  end if;

  update public.assessment_events
  set attendance_finalized_at = now(),
      attendance_finalized_by = auth.uid(),
      status = case when status = 'draft' then 'open'::public.assessment_event_status else status end
  where id = selected_event.id;

  return valid_absent_count;
end;
$$;

grant execute on function public.record_assessment_attendance(uuid, uuid[]) to authenticated;

create or replace function public.commit_assessment_mark_import_batch(target_batch_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_batch public.assessment_mark_import_batches%rowtype;
  selected_event public.assessment_events%rowtype;
  inserted_count integer := 0;
begin
  select * into selected_batch
  from public.assessment_mark_import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception using errcode = 'P0002', message = 'Mark import batch not found';
  end if;

  select * into selected_event
  from public.assessment_events
  where id = selected_batch.assessment_event_id
  for update;

  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to import these marks';
  end if;

  if selected_batch.status = 'completed' then
    return selected_batch.valid_rows;
  end if;

  if selected_batch.invalid_rows > 0 then
    raise exception using errcode = '23514', message = 'Resolve invalid workbook rows before committing marks';
  end if;

  if selected_event.attendance_finalized_at is null then
    raise exception using errcode = '23514', message = 'Record examination attendance before importing marks';
  end if;

  insert into public.assessment_results (
    assessment_event_id,
    student_id,
    cohort_id,
    component_marks,
    total_mark,
    grade,
    comment,
    source_batch_id,
    imported_by,
    imported_at,
    updated_at
  )
  select
    selected_event.id,
    r.student_id,
    r.cohort_id,
    r.component_marks,
    r.total_mark,
    r.grade,
    r.comment,
    selected_batch.id,
    auth.uid(),
    now(),
    now()
  from public.assessment_mark_import_rows r
  where r.batch_id = selected_batch.id
    and r.row_status = 'ready'
    and r.student_id is not null
    and r.cohort_id is not null
  on conflict (assessment_event_id, student_id)
  do update set
    cohort_id = excluded.cohort_id,
    component_marks = excluded.component_marks,
    total_mark = excluded.total_mark,
    grade = excluded.grade,
    comment = excluded.comment,
    source_batch_id = excluded.source_batch_id,
    imported_by = excluded.imported_by,
    imported_at = excluded.imported_at,
    updated_at = now();

  get diagnostics inserted_count = row_count;

  update public.assessment_mark_import_batches
  set status = 'completed', completed_at = now()
  where id = selected_batch.id;

  update public.assessment_events
  set status = 'closed'
  where id = selected_event.id;

  return inserted_count;
end;
$$;

grant execute on function public.commit_assessment_mark_import_batch(uuid) to authenticated;

alter table public.assessment_mark_import_batches enable row level security;
alter table public.assessment_mark_import_rows enable row level security;
alter table public.assessment_results enable row level security;

revoke all on table public.assessment_mark_import_batches from anon;
revoke all on table public.assessment_mark_import_rows from anon;
revoke all on table public.assessment_results from anon;
grant select, insert, update, delete on table public.assessment_mark_import_batches to authenticated;
grant select, insert, update, delete on table public.assessment_mark_import_rows to authenticated;
grant select, insert, update, delete on table public.assessment_results to authenticated;

create policy assessment_mark_import_batches_manage
on public.assessment_mark_import_batches for all to authenticated
using (public.current_user_can_manage_department(department_id))
with check (public.current_user_can_manage_department(department_id));

create policy assessment_mark_import_rows_manage
on public.assessment_mark_import_rows for all to authenticated
using (
  exists (
    select 1 from public.assessment_mark_import_batches b
    where b.id = batch_id and public.current_user_can_manage_department(b.department_id)
  )
)
with check (
  exists (
    select 1 from public.assessment_mark_import_batches b
    where b.id = batch_id and public.current_user_can_manage_department(b.department_id)
  )
);

create policy assessment_results_read
on public.assessment_results for select to authenticated
using (
  exists (
    select 1 from public.assessment_events e
    where e.id = assessment_event_id and public.current_user_can_access_department(e.department_id)
  )
);

create policy assessment_results_manage
on public.assessment_results for all to authenticated
using (
  exists (
    select 1 from public.assessment_events e
    where e.id = assessment_event_id and public.current_user_can_manage_department(e.department_id)
  )
)
with check (
  exists (
    select 1 from public.assessment_events e
    where e.id = assessment_event_id and public.current_user_can_manage_department(e.department_id)
  )
);

comment on table public.assessment_results is
  'Verified assessment marks imported from the system-generated unit workbook. Attendance is sourced separately from the physical signing sheet workflow.';
