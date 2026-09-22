begin;

-- ============================================================================
-- Academic Planner V21 — Release Candidate Testing & UAT
-- ============================================================================

create table if not exists public.release_test_catalog (
  id uuid primary key default gen_random_uuid(),
  suite_version text not null,
  case_key text not null,
  area text not null,
  title text not null,
  expected_result text not null,
  requirement_level text not null check (requirement_level in ('critical','required','advisory')),
  sequence_number integer not null check (sequence_number > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint release_test_catalog_suite_case_unique unique (suite_version, case_key)
);

create index if not exists release_test_catalog_suite_sequence_idx
on public.release_test_catalog (suite_version, sequence_number);

create table if not exists public.release_test_runs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  department_name_snapshot text not null,
  academic_period_id uuid references public.academic_periods(id) on delete set null,
  academic_period_name_snapshot text,
  suite_version text not null,
  status text not null default 'in_progress' check (status in ('in_progress','completed','cancelled')),
  outcome text not null default 'pending' check (outcome in ('pending','passed','failed','cancelled')),
  start_readiness_snapshot jsonb not null,
  completion_readiness_snapshot jsonb,
  notes text,
  started_by uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_by uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_test_runs_notes_check check (notes is null or char_length(notes) <= 2000),
  constraint release_test_runs_lifecycle_check check (
    (status='in_progress' and outcome='pending' and completed_at is null and cancelled_at is null)
    or (status='completed' and outcome in ('passed','failed') and completed_at is not null and cancelled_at is null)
    or (status='cancelled' and outcome='cancelled' and cancelled_at is not null and completed_at is null)
  )
);

create unique index if not exists release_test_runs_department_active_unique_idx
on public.release_test_runs (department_id) where status='in_progress';

create index if not exists release_test_runs_department_started_idx
on public.release_test_runs (department_id, started_at desc);

create table if not exists public.release_test_run_cases (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.release_test_runs(id) on delete cascade,
  case_key text not null,
  area text not null,
  title text not null,
  expected_result text not null,
  requirement_level text not null check (requirement_level in ('critical','required','advisory')),
  sequence_number integer not null check (sequence_number > 0),
  result text not null default 'pending' check (result in ('pending','pass','fail','blocked')),
  note text,
  tested_by uuid references auth.users(id) on delete set null,
  tested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint release_test_run_cases_run_case_unique unique (run_id, case_key),
  constraint release_test_run_cases_note_check check (note is null or char_length(note) <= 2000),
  constraint release_test_run_cases_failure_note_check check (
    result not in ('fail','blocked')
    or (note is not null and char_length(trim(note)) > 0)
  )
);

create index if not exists release_test_run_cases_run_sequence_idx
on public.release_test_run_cases (run_id, sequence_number);

create index if not exists release_test_run_cases_run_result_idx
on public.release_test_run_cases (run_id, result);

create table if not exists public.release_test_case_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.release_test_runs(id) on delete cascade,
  case_key text not null,
  from_result text,
  to_result text not null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  constraint release_test_case_events_from_result_check check (
    from_result is null or from_result in ('pending','pass','fail','blocked')
  ),
  constraint release_test_case_events_to_result_check check (
    to_result in ('pending','pass','fail','blocked')
  ),
  constraint release_test_case_events_note_check check (
    note is null or char_length(note) <= 2000
  )
);

create index if not exists release_test_case_events_run_idx
on public.release_test_case_events (run_id, occurred_at desc);

alter table public.release_test_catalog enable row level security;
alter table public.release_test_runs enable row level security;
alter table public.release_test_run_cases enable row level security;
alter table public.release_test_case_events enable row level security;

revoke all on table public.release_test_catalog, public.release_test_runs, public.release_test_run_cases, public.release_test_case_events from anon;
revoke insert, update, delete on table public.release_test_catalog, public.release_test_runs, public.release_test_run_cases, public.release_test_case_events from authenticated;
grant select on table public.release_test_catalog, public.release_test_runs, public.release_test_run_cases, public.release_test_case_events to authenticated;

drop policy if exists release_test_catalog_hod_read on public.release_test_catalog;
create policy release_test_catalog_hod_read on public.release_test_catalog for select to authenticated
using (public.current_user_has_role(array['hod','system_admin']::public.app_role[]));

drop policy if exists release_test_runs_department_read on public.release_test_runs;
create policy release_test_runs_department_read on public.release_test_runs for select to authenticated
using (public.current_user_can_manage_department(department_id));

drop policy if exists release_test_run_cases_department_read on public.release_test_run_cases;
create policy release_test_run_cases_department_read on public.release_test_run_cases for select to authenticated
using (exists (
  select 1 from public.release_test_runs as run
  where run.id = release_test_run_cases.run_id
    and public.current_user_can_manage_department(run.department_id)
));

drop policy if exists release_test_case_events_department_read on public.release_test_case_events;
create policy release_test_case_events_department_read on public.release_test_case_events for select to authenticated
using (exists (
  select 1 from public.release_test_runs as run
  where run.id = release_test_case_events.run_id
    and public.current_user_can_manage_department(run.department_id)
));

insert into public.release_test_catalog (
  suite_version, case_key, area, title, expected_result, requirement_level, sequence_number, is_active
)
values
('2026.1','AUTH-01','Authentication','HOD authentication and department isolation','HOD signs in successfully and cannot access or mutate another department operational data.','critical',10,true),
('2026.1','AUTH-02','Authentication','Trainer allocation isolation','Trainer can access only allocated units, timetable, assessments, teaching documents and attendance.','critical',20,true),
('2026.1','AUTH-03','Authentication','Student PIN lifecycle','Student PIN login, temporary lock, PIN reset, disable and session revocation behave as designed.','critical',30,true),
('2026.1','STU-01','Students','Student Excel onboarding','A valid XLSX import previews, validates and commits students without duplicate or cross-department leakage.','required',40,true),
('2026.1','STU-02','Students','Unit registration','Expected units are derived from curriculum and registration is controlled without student self-selection.','required',50,true),
('2026.1','STU-03','Students','Lifecycle progression','Deferral, return, completion and graduation preserve cohort and lifecycle history correctly.','required',60,true),
('2026.1','TT-01','Timetable','Teaching allocation','A unit is allocated to a trainer using the active period, correct participants and role-based workload targets.','required',70,true),
('2026.1','TT-02','Timetable','Generate and publish timetable','Generation resolves hard conflicts and the approved timetable publishes to department, trainer and student views.','critical',80,true),
('2026.1','TT-03','Timetable','Institution-wide trainer conflict prevention','A shared trainer cannot be double-booked across departments at overlapping times.','critical',90,true),
('2026.1','PORT-01','Student portal','Student academic workspace','Student sees only own units, published timetable, published results and approved student-visible documents.','critical',100,true),
('2026.1','ASM-01','Assessment','Excel markbook workflow','Locked roster, absence state, generated workbook, staged validation and commit complete without overwriting existing results.','required',110,true),
('2026.1','ASM-02','Assessment','Online final marks workflow','Assignment /5, Presentation /10, RAT /15, CAT /15 and Exam /70 calculate the same final /100 result as Excel.','required',120,true),
('2026.1','ASM-03','Assessment','Finalise and publish results','Only complete assessment results finalise and published results become visible to the correct students.','critical',130,true),
('2026.1','DOC-01','Teaching documents','Official template versioning','HOD uploads an official template, activates one version and prior active versions retire without changing stored originals.','required',140,true),
('2026.1','DOC-02','Teaching documents','Trainer document review','Trainer working copy, immutable revisions, submission, return and approval preserve exact revision history.','required',150,true),
('2026.1','DOC-03','Teaching documents','Student document publication','Only explicitly student-visible approved revisions can be downloaded and each download is audited.','critical',160,true),
('2026.1','ATT-01','Class attendance','Trainer Present / Absent attendance','Attendance opens only from a published class, snapshots registered students and completes only when every student is Present or Absent.','required',170,true),
('2026.1','ATT-02','Class attendance','HOD attendance oversight and correction','HOD sees department-scoped attendance and can reopen a completed session without losing audit history.','required',180,true),
('2026.1','OPS-01','Operations & QA','Readiness, audit and operational export','Operations dashboard identifies blockers, audit history is department-scoped and management export downloads successfully.','advisory',190,true)
on conflict (suite_version, case_key)
do update set
  area=excluded.area,
  title=excluded.title,
  expected_result=excluded.expected_result,
  requirement_level=excluded.requirement_level,
  sequence_number=excluded.sequence_number,
  is_active=excluded.is_active;

create or replace function public.get_release_readiness_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  snapshot jsonb;
  active_period_id text;
  eligible_students integer := 0;
  portal_active integer := 0;
  registered_students integer := 0;
  unregistered_students integer := 0;
  active_allocations integer := 0;
  published_sessions integer := 0;
  assessment_total integer := 0;
  active_templates integer := 0;
  submitted_documents integer := 0;
  returned_documents integer := 0;
  attendance_completed integer := 0;
  checks jsonb;
  blocker_count integer := 0;
  warning_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception 'Release readiness is limited to HOD and system administrator roles.' using errcode='42501';
  end if;

  snapshot := public.get_department_operations_snapshot();
  active_period_id := nullif(snapshot ->> 'activePeriodId','');
  eligible_students := coalesce((snapshot #>> '{students,eligible}')::integer,0);
  portal_active := coalesce((snapshot #>> '{students,portalActive}')::integer,0);
  registered_students := coalesce((snapshot #>> '{students,registered}')::integer,0);
  unregistered_students := coalesce((snapshot #>> '{students,unregistered}')::integer,0);
  active_allocations := coalesce((snapshot #>> '{timetable,activeAllocations}')::integer,0);
  published_sessions := coalesce((snapshot #>> '{timetable,publishedSessions}')::integer,0);
  assessment_total := coalesce((snapshot #>> '{assessment,total}')::integer,0);
  active_templates := coalesce((snapshot #>> '{documents,activeTemplates}')::integer,0);
  submitted_documents := coalesce((snapshot #>> '{documents,submitted}')::integer,0);
  returned_documents := coalesce((snapshot #>> '{documents,returned}')::integer,0);
  attendance_completed := coalesce((snapshot #>> '{attendance,completed}')::integer,0);

  checks := jsonb_build_array(
    jsonb_build_object('checkKey','active-period','area','Calendar','status',case when active_period_id is null then 'blocker' else 'pass' end,'title','Active academic period','detail',case when active_period_id is null then 'No active academic period is configured.' else 'An active academic period is available.' end,'href','/timetable/academic-periods'),
    jsonb_build_object('checkKey','student-data','area','Students','status',case when eligible_students=0 then 'warning' else 'pass' end,'title','Student test population','detail',case when eligible_students=0 then 'No eligible students are available for end-to-end testing.' else eligible_students::text || ' eligible student(s) are available.' end,'href','/students/registry'),
    jsonb_build_object('checkKey','student-portal','area','Students','status',case when eligible_students>0 and portal_active<eligible_students then 'blocker' else 'pass' end,'title','Student portal access coverage','detail',portal_active::text || ' of ' || eligible_students::text || ' eligible students have active portal access.','href','/students/access'),
    jsonb_build_object('checkKey','unit-registration','area','Students','status',case when unregistered_students>0 then 'blocker' when eligible_students=0 then 'warning' else 'pass' end,'title','Current unit registration','detail',registered_students::text || ' registered · ' || unregistered_students::text || ' unresolved.','href','/students/unit-registration'),
    jsonb_build_object('checkKey','teaching-allocations','area','Timetable','status',case when active_allocations=0 then 'blocker' else 'pass' end,'title','Active teaching allocations','detail',active_allocations::text || ' active allocation(s).','href','/timetable/teaching-allocations'),
    jsonb_build_object('checkKey','published-timetable','area','Timetable','status',case when active_allocations>0 and published_sessions=0 then 'blocker' when active_allocations=0 then 'warning' else 'pass' end,'title','Published timetable','detail',published_sessions::text || ' published session(s).','href','/timetable/published'),
    jsonb_build_object('checkKey','teaching-templates','area','Teaching documents','status',case when active_templates<4 then 'blocker' else 'pass' end,'title','Official teaching templates','detail',active_templates::text || ' of 4 required teaching document templates are active.','href','/teaching-documents'),
    jsonb_build_object('checkKey','document-backlog','area','Teaching documents','status',case when submitted_documents+returned_documents>0 then 'warning' else 'pass' end,'title','Teaching document backlog','detail',submitted_documents::text || ' awaiting review · ' || returned_documents::text || ' returned.','href','/teaching-documents/review'),
    jsonb_build_object('checkKey','assessment-data','area','Assessment','status',case when assessment_total=0 then 'warning' else 'pass' end,'title','Assessment test data','detail',assessment_total::text || ' assessment(s) available in the active period.','href','/assessment/assessments'),
    jsonb_build_object('checkKey','attendance-data','area','Class attendance','status',case when attendance_completed=0 then 'warning' else 'pass' end,'title','Completed class attendance sample','detail',attendance_completed::text || ' completed attendance session(s) are available.','href','/attendance-clinical/class-attendance')
  );

  select
    count(*) filter (where item ->> 'status' = 'blocker')::integer,
    count(*) filter (where item ->> 'status' = 'warning')::integer
  into blocker_count, warning_count
  from jsonb_array_elements(checks) as item;

  return jsonb_build_object(
    'generatedAt',now(),
    'ready',blocker_count=0,
    'blockerCount',blocker_count,
    'warningCount',warning_count,
    'checks',checks,
    'operationsSnapshot',snapshot
  );
end;
$$;

revoke all on function public.get_release_readiness_snapshot() from public;
grant execute on function public.get_release_readiness_snapshot() to authenticated;

create or replace function public.start_release_test_run(target_notes text default null)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
  department_name text;
  readiness jsonb;
  period_uuid uuid;
  period_name text;
  active_run_id uuid;
  new_run_id uuid;
  suite text := '2026.1';
  case_count integer := 0;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then raise exception 'Release testing is limited to HOD and system administrator roles.' using errcode='42501'; end if;
  if target_notes is not null and char_length(target_notes)>2000 then raise exception 'Run notes must be 2000 characters or fewer.' using errcode='22023'; end if;

  department_uuid := public.current_user_primary_department_id();
  if department_uuid is null or not public.current_user_can_manage_department(department_uuid) then raise exception 'No manageable active department is available.' using errcode='42501'; end if;

  select department.name into department_name from public.departments as department where department.id=department_uuid;
  if department_name is null then raise exception 'Department was not found.' using errcode='P0002'; end if;

  select run.id into active_run_id from public.release_test_runs as run
  where run.department_id=department_uuid and run.status='in_progress'
  order by run.started_at desc limit 1;
  if active_run_id is not null then raise exception 'An active release test run already exists for this department.' using errcode='23505'; end if;

  readiness := public.get_release_readiness_snapshot();
  if nullif(readiness #>> '{operationsSnapshot,activePeriodId}','') is not null then
    period_uuid := (readiness #>> '{operationsSnapshot,activePeriodId}')::uuid;
    period_name := nullif(readiness #>> '{operationsSnapshot,activePeriodName}','');
  end if;

  insert into public.release_test_runs (
    department_id, department_name_snapshot, academic_period_id, academic_period_name_snapshot,
    suite_version, status, outcome, start_readiness_snapshot, notes, started_by
  ) values (
    department_uuid, department_name, period_uuid, period_name,
    suite, 'in_progress', 'pending', readiness, nullif(trim(target_notes),''), auth.uid()
  ) returning id into new_run_id;

  insert into public.release_test_run_cases (
    run_id, case_key, area, title, expected_result, requirement_level, sequence_number
  )
  select new_run_id, catalog.case_key, catalog.area, catalog.title, catalog.expected_result, catalog.requirement_level, catalog.sequence_number
  from public.release_test_catalog as catalog
  where catalog.suite_version=suite and catalog.is_active
  order by catalog.sequence_number;

  get diagnostics case_count=row_count;
  if case_count=0 then raise exception 'The active release test catalogue is empty.' using errcode='P0002'; end if;
  return new_run_id;
end;
$$;

revoke all on function public.start_release_test_run(text) from public;
grant execute on function public.start_release_test_run(text) to authenticated;

create or replace function public.update_release_test_case(
  target_run_id uuid,
  target_case_key text,
  target_result text,
  target_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_row record;
  old_result text;
  normalized_note text;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;
  if target_result not in ('pending','pass','fail','blocked') then raise exception 'Choose Pending, Pass, Fail or Blocked.' using errcode='22023'; end if;

  normalized_note := nullif(trim(target_note),'');
  if normalized_note is not null and char_length(normalized_note)>2000 then raise exception 'Test evidence notes must be 2000 characters or fewer.' using errcode='22023'; end if;
  if target_result in ('fail','blocked') and normalized_note is null then raise exception 'A note is required when a test fails or is blocked.' using errcode='22023'; end if;

  select run.id, run.department_id, run.status into run_row
  from public.release_test_runs as run where run.id=target_run_id for update;
  if not found then raise exception 'Release test run was not found.' using errcode='P0002'; end if;
  if not public.current_user_can_manage_department(run_row.department_id) then raise exception 'This test run is outside your active department.' using errcode='42501'; end if;
  if run_row.status<>'in_progress' then raise exception 'Completed or cancelled test runs are read only.' using errcode='23514'; end if;

  select test_case.result into old_result
  from public.release_test_run_cases as test_case
  where test_case.run_id=target_run_id and test_case.case_key=target_case_key
  for update;
  if not found then raise exception 'Release test case was not found.' using errcode='P0002'; end if;

  update public.release_test_run_cases
  set result=target_result,
      note=normalized_note,
      tested_by=case when target_result='pending' then null else auth.uid() end,
      tested_at=case when target_result='pending' then null else now() end,
      updated_at=now()
  where run_id=target_run_id and case_key=target_case_key;

  if old_result is distinct from target_result or normalized_note is not null then
    insert into public.release_test_case_events (run_id,case_key,from_result,to_result,note,actor_id)
    values (target_run_id,target_case_key,old_result,target_result,normalized_note,auth.uid());
  end if;

  update public.release_test_runs set updated_at=now() where id=target_run_id;
end;
$$;

revoke all on function public.update_release_test_case(uuid,text,text,text) from public;
grant execute on function public.update_release_test_case(uuid,text,text,text) to authenticated;

create or replace function public.complete_release_test_run(target_run_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_row record;
  pending_count integer := 0;
  failing_required_count integer := 0;
  readiness jsonb;
  blocker_count integer := 0;
  final_outcome text;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;

  select run.id,run.department_id,run.status into run_row
  from public.release_test_runs as run where run.id=target_run_id for update;
  if not found then raise exception 'Release test run was not found.' using errcode='P0002'; end if;
  if not public.current_user_can_manage_department(run_row.department_id) then raise exception 'This test run is outside your active department.' using errcode='42501'; end if;
  if run_row.status<>'in_progress' then raise exception 'Only an active test run can be completed.' using errcode='23514'; end if;

  select
    count(*) filter (where test_case.result='pending')::integer,
    count(*) filter (where test_case.requirement_level in ('critical','required') and test_case.result in ('fail','blocked'))::integer
  into pending_count,failing_required_count
  from public.release_test_run_cases as test_case
  where test_case.run_id=target_run_id;

  if pending_count>0 then raise exception 'Resolve every release test case before completing the run.' using errcode='23514'; end if;

  readiness := public.get_release_readiness_snapshot();
  blocker_count := coalesce((readiness ->> 'blockerCount')::integer,0);
  final_outcome := case when failing_required_count>0 or blocker_count>0 then 'failed' else 'passed' end;

  update public.release_test_runs
  set status='completed',outcome=final_outcome,completion_readiness_snapshot=readiness,
      completed_by=auth.uid(),completed_at=now(),updated_at=now()
  where id=target_run_id;

  return jsonb_build_object(
    'runId',target_run_id,
    'status','completed',
    'outcome',final_outcome,
    'requiredFailures',failing_required_count,
    'automatedBlockers',blocker_count
  );
end;
$$;

revoke all on function public.complete_release_test_run(uuid) from public;
grant execute on function public.complete_release_test_run(uuid) to authenticated;

create or replace function public.cancel_release_test_run(target_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  run_row record;
begin
  if auth.uid() is null then raise exception 'Authentication is required.' using errcode='42501'; end if;

  select run.id,run.department_id,run.status into run_row
  from public.release_test_runs as run where run.id=target_run_id for update;
  if not found then raise exception 'Release test run was not found.' using errcode='P0002'; end if;
  if not public.current_user_can_manage_department(run_row.department_id) then raise exception 'This test run is outside your active department.' using errcode='42501'; end if;
  if run_row.status<>'in_progress' then raise exception 'Only an active test run can be cancelled.' using errcode='23514'; end if;

  update public.release_test_runs
  set status='cancelled',outcome='cancelled',cancelled_by=auth.uid(),cancelled_at=now(),updated_at=now()
  where id=target_run_id;
end;
$$;

revoke all on function public.cancel_release_test_run(uuid) from public;
grant execute on function public.cancel_release_test_run(uuid) to authenticated;

comment on table public.release_test_catalog is 'Versioned release/UAT catalogue. Completed run definitions are snapshotted and remain reproducible.';
comment on table public.release_test_runs is 'Department-scoped release test runs with automated readiness snapshots at start and completion.';
comment on table public.release_test_run_cases is 'Snapshotted UAT case definitions with result/evidence mutable only while the run is active.';
comment on table public.release_test_case_events is 'Immutable audit history for UAT case changes.';
comment on function public.get_release_readiness_snapshot() is 'Department-scoped automated release readiness gate over current operational data.';

commit;
