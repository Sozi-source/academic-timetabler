begin;

-- ============================================================================
-- Academic Planner V23 — Release Defects + Go-Live Sign-off
--
-- Adds industry-style release controls on top of the V21/V22 UAT engine:
-- 1. Department-scoped UAT defect register with immutable status events.
-- 2. Go-live approval gate requiring clean automated readiness, a complete
--    current-suite passed UAT run, no unresolved Critical/High defects, and a
--    local release-verification reference.
-- 3. Immutable sign-off history with controlled revocation.
-- ============================================================================

create table if not exists public.release_test_defects (
  id uuid primary key default gen_random_uuid(),
  defect_number bigint generated always as identity unique,
  department_id uuid not null references public.departments(id) on delete restrict,
  run_id uuid references public.release_test_runs(id) on delete set null,
  case_id uuid references public.release_test_run_cases(id) on delete set null,
  severity text not null check (severity in ('critical','high','medium','low')),
  status text not null default 'open' check (
    status in ('open','in_progress','fixed','retest','closed','deferred')
  ),
  title text not null,
  description text not null,
  resolution_note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  closed_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  constraint release_test_defects_title_check
    check (char_length(trim(title)) between 3 and 180),
  constraint release_test_defects_description_check
    check (char_length(trim(description)) between 3 and 4000),
  constraint release_test_defects_resolution_note_check
    check (resolution_note is null or char_length(resolution_note) <= 4000),
  constraint release_test_defects_close_check
    check (
      (status='closed' and closed_at is not null)
      or (status<>'closed' and closed_at is null)
    )
);

create index if not exists release_test_defects_department_status_idx
on public.release_test_defects (department_id, status, severity, updated_at desc);

create index if not exists release_test_defects_run_idx
on public.release_test_defects (run_id, updated_at desc)
where run_id is not null;

create table if not exists public.release_test_defect_events (
  id uuid primary key default gen_random_uuid(),
  defect_id uuid not null references public.release_test_defects(id) on delete cascade,
  from_status text,
  to_status text not null,
  note text,
  actor_id uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now(),
  constraint release_test_defect_events_note_check
    check (note is null or char_length(note) <= 4000)
);

create index if not exists release_test_defect_events_defect_idx
on public.release_test_defect_events (defect_id, occurred_at desc);

create table if not exists public.release_signoffs (
  id uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id) on delete restrict,
  suite_version text not null,
  release_test_run_id uuid not null references public.release_test_runs(id) on delete restrict,
  verification_ref text not null,
  readiness_snapshot jsonb not null,
  defect_snapshot jsonb not null,
  active_catalog_case_count integer not null check (active_catalog_case_count > 0),
  run_case_count integer not null check (run_case_count > 0),
  status text not null default 'approved' check (status in ('approved','revoked')),
  note text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  revoked_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoke_reason text,
  constraint release_signoffs_verification_ref_check
    check (char_length(trim(verification_ref)) between 8 and 200),
  constraint release_signoffs_note_check
    check (note is null or char_length(note) <= 2000),
  constraint release_signoffs_revoke_reason_check
    check (revoke_reason is null or char_length(revoke_reason) <= 2000),
  constraint release_signoffs_lifecycle_check
    check (
      (status='approved' and revoked_at is null and revoke_reason is null)
      or
      (status='revoked' and revoked_at is not null and revoke_reason is not null and char_length(trim(revoke_reason)) > 0)
    )
);

create unique index if not exists release_signoffs_department_active_unique_idx
on public.release_signoffs (department_id)
where status='approved';

create index if not exists release_signoffs_department_history_idx
on public.release_signoffs (department_id, approved_at desc);

alter table public.release_test_defects enable row level security;
alter table public.release_test_defect_events enable row level security;
alter table public.release_signoffs enable row level security;

revoke all on table
  public.release_test_defects,
  public.release_test_defect_events,
  public.release_signoffs
from anon;

revoke insert, update, delete on table
  public.release_test_defects,
  public.release_test_defect_events,
  public.release_signoffs
from authenticated;

grant select on table
  public.release_test_defects,
  public.release_test_defect_events,
  public.release_signoffs
to authenticated;

drop policy if exists release_test_defects_department_read on public.release_test_defects;
create policy release_test_defects_department_read
on public.release_test_defects
for select to authenticated
using (public.current_user_can_manage_department(department_id));

drop policy if exists release_test_defect_events_department_read on public.release_test_defect_events;
create policy release_test_defect_events_department_read
on public.release_test_defect_events
for select to authenticated
using (
  exists (
    select 1
    from public.release_test_defects as defect
    where defect.id=release_test_defect_events.defect_id
      and public.current_user_can_manage_department(defect.department_id)
  )
);

drop policy if exists release_signoffs_department_read on public.release_signoffs;
create policy release_signoffs_department_read
on public.release_signoffs
for select to authenticated
using (public.current_user_can_manage_department(department_id));

-- ----------------------------------------------------------------------------
-- Create a release defect. Linking to a UAT case is optional but, when used,
-- both the run and case must belong to the caller's managed department.
-- ----------------------------------------------------------------------------

create or replace function public.create_release_test_defect(
  target_title text,
  target_description text,
  target_severity text,
  target_run_id uuid default null,
  target_case_key text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
  linked_case_id uuid;
  defect_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception 'Release defects are limited to HOD and system administrator roles.' using errcode='42501';
  end if;

  department_uuid := public.current_user_primary_department_id();

  if department_uuid is null or not public.current_user_can_manage_department(department_uuid) then
    raise exception 'No manageable active department is available.' using errcode='42501';
  end if;

  if target_severity not in ('critical','high','medium','low') then
    raise exception 'Choose Critical, High, Medium or Low severity.' using errcode='22023';
  end if;

  if target_title is null or char_length(trim(target_title)) not between 3 and 180 then
    raise exception 'Defect title must contain 3 to 180 characters.' using errcode='22023';
  end if;

  if target_description is null or char_length(trim(target_description)) not between 3 and 4000 then
    raise exception 'Defect description must contain 3 to 4000 characters.' using errcode='22023';
  end if;

  if target_case_key is not null and target_run_id is null then
    raise exception 'A linked test case requires a UAT run.' using errcode='22023';
  end if;

  if target_run_id is not null then
    if not exists (
      select 1
      from public.release_test_runs as run
      where run.id=target_run_id
        and run.department_id=department_uuid
    ) then
      raise exception 'The selected UAT run is outside your active department.' using errcode='42501';
    end if;
  end if;

  if target_case_key is not null then
    select test_case.id
    into linked_case_id
    from public.release_test_run_cases as test_case
    where test_case.run_id=target_run_id
      and test_case.case_key=target_case_key;

    if linked_case_id is null then
      raise exception 'The linked UAT case was not found in the selected run.' using errcode='P0002';
    end if;
  end if;

  insert into public.release_test_defects (
    department_id,
    run_id,
    case_id,
    severity,
    status,
    title,
    description,
    created_by,
    updated_by
  )
  values (
    department_uuid,
    target_run_id,
    linked_case_id,
    target_severity,
    'open',
    trim(target_title),
    trim(target_description),
    auth.uid(),
    auth.uid()
  )
  returning id into defect_id;

  insert into public.release_test_defect_events (
    defect_id,
    from_status,
    to_status,
    note,
    actor_id
  )
  values (
    defect_id,
    null,
    'open',
    'Defect logged',
    auth.uid()
  );

  return defect_id;
end;
$$;

revoke all on function public.create_release_test_defect(text,text,text,uuid,text) from public;
grant execute on function public.create_release_test_defect(text,text,text,uuid,text) to authenticated;

-- ----------------------------------------------------------------------------
-- Controlled defect lifecycle. Titles/descriptions remain immutable evidence.
-- ----------------------------------------------------------------------------

create or replace function public.update_release_test_defect_status(
  target_defect_id uuid,
  target_status text,
  target_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  defect_row record;
  valid_transition boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception 'Release defects are limited to HOD and system administrator roles.' using errcode='42501';
  end if;

  select defect.*
  into defect_row
  from public.release_test_defects as defect
  where defect.id=target_defect_id
  for update;

  if not found then
    raise exception 'Release defect was not found.' using errcode='P0002';
  end if;

  if not public.current_user_can_manage_department(defect_row.department_id) then
    raise exception 'This release defect is outside your active department.' using errcode='42501';
  end if;

  if target_status not in ('open','in_progress','fixed','retest','closed','deferred') then
    raise exception 'Invalid release defect status.' using errcode='22023';
  end if;

  valid_transition :=
    (defect_row.status='open' and target_status in ('in_progress','deferred'))
    or (defect_row.status='in_progress' and target_status in ('fixed','deferred','open'))
    or (defect_row.status='fixed' and target_status in ('retest','open'))
    or (defect_row.status='retest' and target_status in ('closed','open'))
    or (defect_row.status='deferred' and target_status='open')
    or (defect_row.status='closed' and target_status='open')
    or defect_row.status=target_status;

  if not valid_transition then
    raise exception 'That release defect status transition is not allowed.' using errcode='23514';
  end if;

  if target_resolution_note is not null and char_length(target_resolution_note)>4000 then
    raise exception 'Resolution note must be 4000 characters or fewer.' using errcode='22023';
  end if;

  if target_status in ('fixed','closed','deferred')
     and (target_resolution_note is null or char_length(trim(target_resolution_note))=0)
  then
    raise exception 'A resolution note is required for Fixed, Closed or Deferred status.' using errcode='22023';
  end if;

  update public.release_test_defects
  set
    status=target_status,
    resolution_note=nullif(trim(target_resolution_note),''),
    updated_by=auth.uid(),
    updated_at=now(),
    closed_by=case when target_status='closed' then auth.uid() else null end,
    closed_at=case when target_status='closed' then now() else null end
  where id=target_defect_id;

  if defect_row.status is distinct from target_status then
    insert into public.release_test_defect_events (
      defect_id,
      from_status,
      to_status,
      note,
      actor_id
    )
    values (
      target_defect_id,
      defect_row.status,
      target_status,
      nullif(trim(target_resolution_note),''),
      auth.uid()
    );
  end if;
end;
$$;

revoke all on function public.update_release_test_defect_status(uuid,text,text) from public;
grant execute on function public.update_release_test_defect_status(uuid,text,text) to authenticated;

-- ----------------------------------------------------------------------------
-- Defect register projection. No unrestricted table mutation is exposed.
-- ----------------------------------------------------------------------------

create or replace function public.get_release_test_defects(target_limit integer default 200)
returns table (
  id uuid,
  defect_number bigint,
  run_id uuid,
  case_key text,
  suite_version text,
  severity text,
  status text,
  title text,
  description text,
  resolution_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
begin
  department_uuid := public.current_user_primary_department_id();

  if department_uuid is null or not public.current_user_can_manage_department(department_uuid) then
    raise exception 'No manageable active department is available.' using errcode='42501';
  end if;

  return query
  select
    defect.id,
    defect.defect_number,
    defect.run_id,
    test_case.case_key,
    run.suite_version,
    defect.severity,
    defect.status,
    defect.title,
    defect.description,
    defect.resolution_note,
    defect.created_at,
    defect.updated_at
  from public.release_test_defects as defect
  left join public.release_test_runs as run
    on run.id=defect.run_id
  left join public.release_test_run_cases as test_case
    on test_case.id=defect.case_id
  where defect.department_id=department_uuid
  order by
    case defect.severity
      when 'critical' then 1
      when 'high' then 2
      when 'medium' then 3
      else 4
    end,
    case defect.status
      when 'open' then 1
      when 'in_progress' then 2
      when 'fixed' then 3
      when 'retest' then 4
      when 'deferred' then 5
      else 6
    end,
    defect.updated_at desc
  limit greatest(1,least(coalesce(target_limit,200),500));
end;
$$;

revoke all on function public.get_release_test_defects(integer) from public;
grant execute on function public.get_release_test_defects(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- Current go-live status. This is display/readiness state; approval repeats all
-- checks transactionally to prevent time-of-check/time-of-use drift.
-- ----------------------------------------------------------------------------

create or replace function public.get_release_go_live_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
  readiness jsonb;
  passed_run record;
  active_signoff record;
  blocker_defects integer := 0;
  warning_defects integer := 0;
  active_catalog_count integer := 0;
  run_case_count integer := 0;
  nonpassing_required integer := 0;
  reasons jsonb := '[]'::jsonb;
  eligible boolean := false;
  signoff_valid boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;

  department_uuid := public.current_user_primary_department_id();
  if department_uuid is null or not public.current_user_can_manage_department(department_uuid) then
    raise exception 'No manageable active department is available.' using errcode='42501';
  end if;

  readiness := public.get_release_readiness_snapshot();

  select run.*
  into passed_run
  from public.release_test_runs as run
  where run.department_id=department_uuid
    and run.status='completed'
    and run.outcome='passed'
  order by run.completed_at desc
  limit 1;

  if passed_run.id is not null then
    select count(*)::integer
    into active_catalog_count
    from public.release_test_catalog as catalog
    where catalog.suite_version=passed_run.suite_version
      and catalog.is_active;

    select
      count(*)::integer,
      count(*) filter (
        where test_case.requirement_level in ('critical','required')
          and test_case.result<>'pass'
      )::integer
    into
      run_case_count,
      nonpassing_required
    from public.release_test_run_cases as test_case
    where test_case.run_id=passed_run.id;
  end if;

  select count(*)::integer
  into blocker_defects
  from public.release_test_defects as defect
  where defect.department_id=department_uuid
    and defect.severity in ('critical','high')
    and defect.status<>'closed';

  select count(*)::integer
  into warning_defects
  from public.release_test_defects as defect
  where defect.department_id=department_uuid
    and defect.severity in ('medium','low')
    and defect.status<>'closed';

  select signoff.*
  into active_signoff
  from public.release_signoffs as signoff
  where signoff.department_id=department_uuid
    and signoff.status='approved'
  order by signoff.approved_at desc
  limit 1;

  if coalesce((readiness->>'ready')::boolean,false)=false then
    reasons := reasons || jsonb_build_array('Automated release readiness still has blockers.');
  end if;

  if passed_run.id is null then
    reasons := reasons || jsonb_build_array('No completed passed UAT run is available.');
  elsif active_catalog_count=0 or run_case_count<>active_catalog_count then
    reasons := reasons || jsonb_build_array('The latest passed UAT run does not contain the complete active test catalogue. Start a fresh UAT run.');
  elsif nonpassing_required>0 then
    reasons := reasons || jsonb_build_array('Required or critical UAT cases are not all passing.');
  end if;

  if blocker_defects>0 then
    reasons := reasons || jsonb_build_array('Critical or High release defects remain unresolved.');
  end if;

  eligible :=
    coalesce((readiness->>'ready')::boolean,false)
    and passed_run.id is not null
    and active_catalog_count>0
    and run_case_count=active_catalog_count
    and nonpassing_required=0
    and blocker_defects=0;

  signoff_valid :=
    active_signoff.id is not null
    and eligible
    and active_signoff.release_test_run_id=passed_run.id
    and active_signoff.active_catalog_case_count=active_catalog_count
    and active_signoff.run_case_count=run_case_count;

  if active_signoff.id is not null and not signoff_valid then
    reasons := reasons || jsonb_build_array('The existing go-live sign-off is stale and must be revoked before a new approval.');
  end if;

  return jsonb_build_object(
    'eligible', eligible,
    'signoffValid', signoff_valid,
    'readiness', readiness,
    'blockerDefects', blocker_defects,
    'warningDefects', warning_defects,
    'activeCatalogCaseCount', active_catalog_count,
    'passedRunCaseCount', run_case_count,
    'reasons', reasons,
    'latestPassedRun', case
      when passed_run.id is null then null
      else jsonb_build_object(
        'id', passed_run.id,
        'suiteVersion', passed_run.suite_version,
        'completedAt', passed_run.completed_at
      )
    end,
    'activeSignoff', case
      when active_signoff.id is null then null
      else jsonb_build_object(
        'id', active_signoff.id,
        'verificationRef', active_signoff.verification_ref,
        'approvedAt', active_signoff.approved_at
      )
    end
  );
end;
$$;

revoke all on function public.get_release_go_live_status() from public;
grant execute on function public.get_release_go_live_status() to authenticated;

-- ----------------------------------------------------------------------------
-- Approve release. Every gate is re-evaluated in this transaction.
-- ----------------------------------------------------------------------------

create or replace function public.approve_release_signoff(
  target_verification_ref text,
  target_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
  go_live jsonb;
  passed_run_id uuid;
  suite text;
  readiness jsonb;
  blocker_defects integer;
  warning_defects integer;
  catalog_count integer;
  case_count integer;
  signoff_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception 'Release sign-off is limited to HOD and system administrator roles.' using errcode='42501';
  end if;

  if target_verification_ref is null or char_length(trim(target_verification_ref)) not between 8 and 200 then
    raise exception 'Enter the verification ID produced by the local release verification script.' using errcode='22023';
  end if;

  if target_note is not null and char_length(target_note)>2000 then
    raise exception 'Sign-off note must be 2000 characters or fewer.' using errcode='22023';
  end if;

  department_uuid := public.current_user_primary_department_id();
  if department_uuid is null or not public.current_user_can_manage_department(department_uuid) then
    raise exception 'No manageable active department is available.' using errcode='42501';
  end if;

  if exists (
    select 1
    from public.release_signoffs as active
    where active.department_id=department_uuid
      and active.status='approved'
  ) then
    raise exception 'An active go-live sign-off already exists. Revoke it before approving another release.' using errcode='23505';
  end if;

  go_live := public.get_release_go_live_status();
  if not coalesce((go_live->>'eligible')::boolean,false) then
    raise exception 'Go-live approval is blocked. Resolve release readiness, UAT or defect blockers first.' using errcode='23514';
  end if;

  passed_run_id := (go_live #>> '{latestPassedRun,id}')::uuid;
  suite := go_live #>> '{latestPassedRun,suiteVersion}';
  readiness := go_live->'readiness';
  blocker_defects := coalesce((go_live->>'blockerDefects')::integer,0);
  warning_defects := coalesce((go_live->>'warningDefects')::integer,0);
  catalog_count := coalesce((go_live->>'activeCatalogCaseCount')::integer,0);
  case_count := coalesce((go_live->>'passedRunCaseCount')::integer,0);

  insert into public.release_signoffs (
    department_id,
    suite_version,
    release_test_run_id,
    verification_ref,
    readiness_snapshot,
    defect_snapshot,
    active_catalog_case_count,
    run_case_count,
    status,
    note,
    approved_by
  )
  values (
    department_uuid,
    suite,
    passed_run_id,
    trim(target_verification_ref),
    readiness,
    jsonb_build_object(
      'blocking', blocker_defects,
      'warnings', warning_defects
    ),
    catalog_count,
    case_count,
    'approved',
    nullif(trim(target_note),''),
    auth.uid()
  )
  returning id into signoff_id;

  return signoff_id;
end;
$$;

revoke all on function public.approve_release_signoff(text,text) from public;
grant execute on function public.approve_release_signoff(text,text) to authenticated;

create or replace function public.revoke_release_signoff(
  target_signoff_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  signoff_row record;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.' using errcode='42501';
  end if;

  if not public.current_user_has_role(array['hod','system_admin']::public.app_role[]) then
    raise exception 'Release sign-off changes are limited to HOD and system administrator roles.' using errcode='42501';
  end if;

  if target_reason is null or char_length(trim(target_reason)) not between 3 and 2000 then
    raise exception 'A revocation reason is required.' using errcode='22023';
  end if;

  select signoff.*
  into signoff_row
  from public.release_signoffs as signoff
  where signoff.id=target_signoff_id
  for update;

  if not found then
    raise exception 'Release sign-off was not found.' using errcode='P0002';
  end if;

  if not public.current_user_can_manage_department(signoff_row.department_id) then
    raise exception 'This release sign-off is outside your active department.' using errcode='42501';
  end if;

  if signoff_row.status<>'approved' then
    raise exception 'Only an active sign-off can be revoked.' using errcode='23514';
  end if;

  update public.release_signoffs
  set
    status='revoked',
    revoked_by=auth.uid(),
    revoked_at=now(),
    revoke_reason=trim(target_reason)
  where id=target_signoff_id;
end;
$$;

revoke all on function public.revoke_release_signoff(uuid,text) from public;
grant execute on function public.revoke_release_signoff(uuid,text) to authenticated;

-- ----------------------------------------------------------------------------
-- Sign-off history projection.
-- ----------------------------------------------------------------------------

create or replace function public.get_release_signoffs(target_limit integer default 30)
returns table (
  id uuid,
  suite_version text,
  release_test_run_id uuid,
  verification_ref text,
  status text,
  note text,
  approved_at timestamptz,
  revoked_at timestamptz,
  revoke_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
begin
  department_uuid := public.current_user_primary_department_id();
  if department_uuid is null or not public.current_user_can_manage_department(department_uuid) then
    raise exception 'No manageable active department is available.' using errcode='42501';
  end if;

  return query
  select
    signoff.id,
    signoff.suite_version,
    signoff.release_test_run_id,
    signoff.verification_ref,
    signoff.status,
    signoff.note,
    signoff.approved_at,
    signoff.revoked_at,
    signoff.revoke_reason
  from public.release_signoffs as signoff
  where signoff.department_id=department_uuid
  order by signoff.approved_at desc
  limit greatest(1,least(coalesce(target_limit,30),100));
end;
$$;

revoke all on function public.get_release_signoffs(integer) from public;
grant execute on function public.get_release_signoffs(integer) to authenticated;

-- ----------------------------------------------------------------------------
-- Extend current UAT catalogue with the release-control workflows. Existing
-- in-progress/completed runs are immutable; a fresh run snapshots these cases.
-- ----------------------------------------------------------------------------

insert into public.release_test_catalog (
  suite_version,
  case_key,
  area,
  title,
  expected_result,
  requirement_level,
  sequence_number,
  is_active
)
values
  (
    '2026.1',
    'QA-DEFECT-01',
    'Operations & QA',
    'Release defect lifecycle',
    'Failed or blocked UAT work can be logged as a department-scoped defect, moved through controlled states and remains auditable.',
    'required',
    200,
    true
  ),
  (
    '2026.1',
    'QA-SIGNOFF-01',
    'Operations & QA',
    'Go-live sign-off gate',
    'Go-live approval is blocked until automated readiness is clean, the current catalogue has a passed UAT run, Critical/High defects are closed and a local verification ID is supplied.',
    'critical',
    210,
    true
  )
on conflict (suite_version,case_key)
do update set
  area=excluded.area,
  title=excluded.title,
  expected_result=excluded.expected_result,
  requirement_level=excluded.requirement_level,
  sequence_number=excluded.sequence_number,
  is_active=excluded.is_active;

comment on table public.release_test_defects is
  'Department-scoped UAT/release defects. Critical and High defects block go-live until closed.';

comment on table public.release_test_defect_events is
  'Immutable release defect lifecycle events.';

comment on table public.release_signoffs is
  'Immutable department go-live approvals tied to a passed UAT run, readiness snapshot and local verification reference.';

commit;
