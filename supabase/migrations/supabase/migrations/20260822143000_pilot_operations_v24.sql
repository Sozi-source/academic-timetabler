begin;

-- ============================================================================
-- Academic Planner V24 — Pilot & Production Operations
--
-- Adds the final operational control layer around the existing release/UAT
-- architecture:
-- 1. Immutable deployment history for Pilot and Production.
-- 2. Controlled rollback with reason.
-- 3. Production incident register distinct from pre-release UAT defects.
-- 4. Deployment and incident audit events.
--
-- Pilot deployment:
--   requires a currently eligible release OR a valid active sign-off.
--
-- Production deployment:
--   requires a valid active sign-off and no unresolved Critical/High incident.
-- ============================================================================

create table if not exists public.release_deployments (
  id uuid primary key
    default gen_random_uuid(),

  department_id uuid not null
    references public.departments(id)
    on delete restrict,

  environment text not null
    check (
      environment in (
        'pilot',
        'production'
      )
    ),

  version_label text not null,

  release_signoff_id uuid
    references public.release_signoffs(id)
    on delete restrict,

  release_test_run_id uuid not null
    references public.release_test_runs(id)
    on delete restrict,

  suite_version text not null,

  verification_ref text,

  status text not null
    default 'deployed'
    check (
      status in (
        'deployed',
        'superseded',
        'rolled_back'
      )
    ),

  note text,

  deployed_by uuid
    references auth.users(id)
    on delete set null,

  deployed_at timestamptz not null
    default now(),

  rolled_back_by uuid
    references auth.users(id)
    on delete set null,

  rolled_back_at timestamptz,

  rollback_reason text,

  created_at timestamptz not null
    default now(),

  constraint release_deployments_version_label_check
    check (
      char_length(
        trim(
          version_label
        )
      ) between 3 and 80
    ),

  constraint release_deployments_note_check
    check (
      note is null
      or char_length(
        note
      ) <= 2000
    ),

  constraint release_deployments_verification_ref_check
    check (
      verification_ref is null
      or char_length(
        trim(
          verification_ref
        )
      ) between 8 and 200
    ),

  constraint release_deployments_rollback_reason_check
    check (
      rollback_reason is null
      or char_length(
        rollback_reason
      ) <= 2000
    ),

  constraint release_deployments_rollback_lifecycle_check
    check (
      (
        status <>
          'rolled_back'
        and rolled_back_at is null
        and rollback_reason is null
      )
      or (
        status =
          'rolled_back'
        and rolled_back_at is not null
        and rollback_reason is not null
        and char_length(
          trim(
            rollback_reason
          )
        ) > 0
      )
    )
);

create unique index if not exists
  release_deployments_one_active_environment_idx
on public.release_deployments (
  department_id,
  environment
)
where status =
  'deployed';

create index if not exists
  release_deployments_department_history_idx
on public.release_deployments (
  department_id,
  deployed_at desc
);

create table if not exists public.release_deployment_events (
  id uuid primary key
    default gen_random_uuid(),

  deployment_id uuid not null
    references public.release_deployments(id)
    on delete restrict,

  event_type text not null
    check (
      event_type in (
        'deployed',
        'superseded',
        'rolled_back'
      )
    ),

  from_status text,
  to_status text not null,

  note text,

  actor_id uuid
    references auth.users(id)
    on delete set null,

  occurred_at timestamptz not null
    default now(),

  constraint release_deployment_events_note_check
    check (
      note is null
      or char_length(
        note
      ) <= 2000
    )
);

create index if not exists
  release_deployment_events_deployment_idx
on public.release_deployment_events (
  deployment_id,
  occurred_at desc
);

create table if not exists public.production_incidents (
  id uuid primary key
    default gen_random_uuid(),

  incident_number bigint
    generated always as identity
    unique,

  department_id uuid not null
    references public.departments(id)
    on delete restrict,

  deployment_id uuid
    references public.release_deployments(id)
    on delete set null,

  environment text not null
    check (
      environment in (
        'pilot',
        'production'
      )
    ),

  severity text not null
    check (
      severity in (
        'critical',
        'high',
        'medium',
        'low'
      )
    ),

  status text not null
    default 'open'
    check (
      status in (
        'open',
        'investigating',
        'resolved',
        'closed'
      )
    ),

  title text not null,
  description text not null,
  resolution_note text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_by uuid
    references auth.users(id)
    on delete set null,

  updated_at timestamptz not null
    default now(),

  closed_by uuid
    references auth.users(id)
    on delete set null,

  closed_at timestamptz,

  constraint production_incidents_title_check
    check (
      char_length(
        trim(
          title
        )
      ) between 3 and 180
    ),

  constraint production_incidents_description_check
    check (
      char_length(
        trim(
          description
        )
      ) between 3 and 4000
    ),

  constraint production_incidents_resolution_note_check
    check (
      resolution_note is null
      or char_length(
        resolution_note
      ) <= 4000
    ),

  constraint production_incidents_close_check
    check (
      (
        status =
          'closed'
        and closed_at is not null
      )
      or (
        status <>
          'closed'
        and closed_at is null
      )
    )
);

create index if not exists
  production_incidents_department_status_idx
on public.production_incidents (
  department_id,
  status,
  severity,
  updated_at desc
);

create index if not exists
  production_incidents_deployment_idx
on public.production_incidents (
  deployment_id,
  updated_at desc
)
where deployment_id is not null;

create table if not exists public.production_incident_events (
  id uuid primary key
    default gen_random_uuid(),

  incident_id uuid not null
    references public.production_incidents(id)
    on delete restrict,

  from_status text,
  to_status text not null,

  note text,

  actor_id uuid
    references auth.users(id)
    on delete set null,

  occurred_at timestamptz not null
    default now(),

  constraint production_incident_events_note_check
    check (
      note is null
      or char_length(
        note
      ) <= 4000
    )
);

create index if not exists
  production_incident_events_incident_idx
on public.production_incident_events (
  incident_id,
  occurred_at desc
);

alter table public.release_deployments
  enable row level security;

alter table public.release_deployment_events
  enable row level security;

alter table public.production_incidents
  enable row level security;

alter table public.production_incident_events
  enable row level security;

revoke all
on table
  public.release_deployments,
  public.release_deployment_events,
  public.production_incidents,
  public.production_incident_events
from anon;

revoke insert, update, delete
on table
  public.release_deployments,
  public.release_deployment_events,
  public.production_incidents,
  public.production_incident_events
from authenticated;

grant select
on table
  public.release_deployments,
  public.release_deployment_events,
  public.production_incidents,
  public.production_incident_events
to authenticated;

drop policy if exists
  release_deployments_department_read
on public.release_deployments;

create policy release_deployments_department_read
on public.release_deployments
for select
to authenticated
using (
  public.current_user_can_manage_department(
    department_id
  )
);

drop policy if exists
  release_deployment_events_department_read
on public.release_deployment_events;

create policy release_deployment_events_department_read
on public.release_deployment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.release_deployments
      as deployment
    where deployment.id =
        release_deployment_events.deployment_id
      and public.current_user_can_manage_department(
        deployment.department_id
      )
  )
);

drop policy if exists
  production_incidents_department_read
on public.production_incidents;

create policy production_incidents_department_read
on public.production_incidents
for select
to authenticated
using (
  public.current_user_can_manage_department(
    department_id
  )
);

drop policy if exists
  production_incident_events_department_read
on public.production_incident_events;

create policy production_incident_events_department_read
on public.production_incident_events
for select
to authenticated
using (
  exists (
    select 1
    from public.production_incidents
      as incident
    where incident.id =
        production_incident_events.incident_id
      and public.current_user_can_manage_department(
        incident.department_id
      )
  )
);

-- ----------------------------------------------------------------------------
-- Deployment record.
--
-- This records the controlled operational deployment decision. It does not
-- perform application hosting/deployment itself.
-- ----------------------------------------------------------------------------

create or replace function public.record_release_deployment(
  target_environment text,
  target_version_label text,
  target_signoff_id uuid default null,
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
  active_signoff_id uuid;
  signoff_valid boolean;
  release_eligible boolean;
  passed_run_id uuid;
  source_run_id uuid;
  source_suite_version text;
  source_verification_ref text;
  existing_id uuid;
  deployment_id uuid;
  blocker_incidents integer := 0;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Deployment records are limited to HOD and system administrator roles.'
      using errcode = '42501';
  end if;

  if target_environment not in (
    'pilot',
    'production'
  ) then
    raise exception
      'Choose Pilot or Production environment.'
      using errcode = '22023';
  end if;

  if target_version_label is null
     or char_length(
       trim(
         target_version_label
       )
     ) not between 3 and 80
  then
    raise exception
      'Version label must contain 3 to 80 characters.'
      using errcode = '22023';
  end if;

  if target_note is not null
     and char_length(
       target_note
     ) > 2000
  then
    raise exception
      'Deployment note must be 2000 characters or fewer.'
      using errcode = '22023';
  end if;

  department_uuid =
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  go_live =
    public.get_release_go_live_status();

  signoff_valid =
    coalesce(
      (
        go_live ->>
        'signoffValid'
      )::boolean,
      false
    );

  release_eligible =
    coalesce(
      (
        go_live ->>
        'eligible'
      )::boolean,
      false
    );

  active_signoff_id =
    nullif(
      go_live #>>
        array[
          'activeSignoff',
          'id'
        ],
      ''
    )::uuid;

  passed_run_id =
    nullif(
      go_live #>>
        array[
          'latestPassedRun',
          'id'
        ],
      ''
    )::uuid;

  if target_environment =
    'production'
  then
    if not signoff_valid
       or active_signoff_id is null
    then
      raise exception
        'Production deployment requires a valid active go-live sign-off.'
        using errcode = '23514';
    end if;

    if target_signoff_id is not null
       and target_signoff_id <>
         active_signoff_id
    then
      raise exception
        'The selected sign-off is not the current valid go-live approval.'
        using errcode = '23514';
    end if;

    select
      signoff.release_test_run_id,
      signoff.suite_version,
      signoff.verification_ref
    into
      source_run_id,
      source_suite_version,
      source_verification_ref
    from public.release_signoffs
      as signoff
    where signoff.id =
        active_signoff_id
      and signoff.department_id =
        department_uuid
      and signoff.status =
        'approved';

    if source_run_id is null then
      raise exception
        'The active release sign-off could not be resolved.'
        using errcode = 'P0002';
    end if;

    select count(*)::integer
    into blocker_incidents
    from public.production_incidents
      as incident
    where incident.department_id =
        department_uuid
      and incident.severity in (
        'critical',
        'high'
      )
      and incident.status in (
        'open',
        'investigating'
      );

    if blocker_incidents > 0 then
      raise exception
        'Resolve Critical/High operational incidents before recording a Production deployment.'
        using errcode = '23514';
    end if;

    target_signoff_id =
      active_signoff_id;
  else
    if not (
      release_eligible
      or signoff_valid
    )
    then
      raise exception
        'Pilot deployment requires a release candidate that is currently eligible for sign-off.'
        using errcode = '23514';
    end if;

    if passed_run_id is null then
      raise exception
        'Pilot deployment requires a completed Passed UAT run.'
        using errcode = '23514';
    end if;

    source_run_id =
      passed_run_id;

    select
      run.suite_version
    into
      source_suite_version
    from public.release_test_runs
      as run
    where run.id =
      source_run_id
      and run.department_id =
        department_uuid;

    if source_suite_version is null then
      raise exception
        'The latest Passed UAT run could not be resolved.'
        using errcode = 'P0002';
    end if;

    if signoff_valid
       and active_signoff_id is not null
    then
      target_signoff_id =
        active_signoff_id;

      select
        signoff.verification_ref
      into
        source_verification_ref
      from public.release_signoffs
        as signoff
      where signoff.id =
        active_signoff_id;
    else
      target_signoff_id =
        null;

      source_verification_ref =
        null;
    end if;
  end if;

  select
    deployment.id
  into existing_id
  from public.release_deployments
    as deployment
  where deployment.department_id =
      department_uuid
    and deployment.environment =
      target_environment
    and deployment.status =
      'deployed'
    and deployment.version_label =
      trim(
        target_version_label
      )
    and deployment.release_test_run_id =
      source_run_id
    and deployment.release_signoff_id is not distinct from
      target_signoff_id
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  for existing_id in
    select
      deployment.id
    from public.release_deployments
      as deployment
    where deployment.department_id =
        department_uuid
      and deployment.environment =
        target_environment
      and deployment.status =
        'deployed'
    for update
  loop
    update public.release_deployments
    set
      status =
        'superseded'
    where id =
      existing_id;

    insert into public.release_deployment_events (
      deployment_id,
      event_type,
      from_status,
      to_status,
      note,
      actor_id
    )
    values (
      existing_id,
      'superseded',
      'deployed',
      'superseded',
      'Superseded by a newer deployment record',
      auth.uid()
    );
  end loop;

  insert into public.release_deployments (
    department_id,
    environment,
    version_label,
    release_signoff_id,
    release_test_run_id,
    suite_version,
    verification_ref,
    status,
    note,
    deployed_by
  )
  values (
    department_uuid,
    target_environment,
    trim(
      target_version_label
    ),
    target_signoff_id,
    source_run_id,
    source_suite_version,
    source_verification_ref,
    'deployed',
    nullif(
      trim(
        target_note
      ),
      ''
    ),
    auth.uid()
  )
  returning id
  into deployment_id;

  insert into public.release_deployment_events (
    deployment_id,
    event_type,
    from_status,
    to_status,
    note,
    actor_id
  )
  values (
    deployment_id,
    'deployed',
    null,
    'deployed',
    nullif(
      trim(
        target_note
      ),
      ''
    ),
    auth.uid()
  );

  return deployment_id;
end;
$$;

revoke all
on function public.record_release_deployment(
  text,
  text,
  uuid,
  text
)
from public;

grant execute
on function public.record_release_deployment(
  text,
  text,
  uuid,
  text
)
to authenticated;

create or replace function public.rollback_release_deployment(
  target_deployment_id uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  deployment_row record;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Deployment rollback is limited to HOD and system administrator roles.'
      using errcode = '42501';
  end if;

  if target_reason is null
     or char_length(
       trim(
         target_reason
       )
     ) = 0
     or char_length(
       target_reason
     ) > 2000
  then
    raise exception
      'Rollback reason is required and must be 2000 characters or fewer.'
      using errcode = '22023';
  end if;

  select
    deployment.*
  into deployment_row
  from public.release_deployments
    as deployment
  where deployment.id =
    target_deployment_id
  for update;

  if not found then
    raise exception
      'Deployment record was not found.'
      using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_department(
    deployment_row.department_id
  ) then
    raise exception
      'This deployment is outside your active department.'
      using errcode = '42501';
  end if;

  if deployment_row.status <>
    'deployed'
  then
    raise exception
      'Only the current deployed release can be rolled back.'
      using errcode = '23514';
  end if;

  update public.release_deployments
  set
    status =
      'rolled_back',
    rolled_back_by =
      auth.uid(),
    rolled_back_at =
      now(),
    rollback_reason =
      trim(
        target_reason
      )
  where id =
    target_deployment_id;

  insert into public.release_deployment_events (
    deployment_id,
    event_type,
    from_status,
    to_status,
    note,
    actor_id
  )
  values (
    target_deployment_id,
    'rolled_back',
    'deployed',
    'rolled_back',
    trim(
      target_reason
    ),
    auth.uid()
  );
end;
$$;

revoke all
on function public.rollback_release_deployment(
  uuid,
  text
)
from public;

grant execute
on function public.rollback_release_deployment(
  uuid,
  text
)
to authenticated;

create or replace function public.create_production_incident(
  target_environment text,
  target_title text,
  target_description text,
  target_severity text,
  target_deployment_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
  incident_id uuid;
  deployment_environment text;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Operational incidents are limited to HOD and system administrator roles.'
      using errcode = '42501';
  end if;

  department_uuid =
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  if target_environment not in (
    'pilot',
    'production'
  ) then
    raise exception
      'Choose Pilot or Production environment.'
      using errcode = '22023';
  end if;

  if target_severity not in (
    'critical',
    'high',
    'medium',
    'low'
  ) then
    raise exception
      'Choose Critical, High, Medium or Low severity.'
      using errcode = '22023';
  end if;

  if target_title is null
     or char_length(
       trim(
         target_title
       )
     ) not between 3 and 180
  then
    raise exception
      'Incident title must contain 3 to 180 characters.'
      using errcode = '22023';
  end if;

  if target_description is null
     or char_length(
       trim(
         target_description
       )
     ) not between 3 and 4000
  then
    raise exception
      'Incident description must contain 3 to 4000 characters.'
      using errcode = '22023';
  end if;

  if target_deployment_id is not null then
    select
      deployment.environment
    into deployment_environment
    from public.release_deployments
      as deployment
    where deployment.id =
        target_deployment_id
      and deployment.department_id =
        department_uuid;

    if deployment_environment is null then
      raise exception
        'The selected deployment is outside your active department.'
        using errcode = '42501';
    end if;

    if deployment_environment <>
      target_environment
    then
      raise exception
        'Incident environment must match the linked deployment.'
        using errcode = '23514';
    end if;
  end if;

  insert into public.production_incidents (
    department_id,
    deployment_id,
    environment,
    severity,
    status,
    title,
    description,
    created_by,
    updated_by
  )
  values (
    department_uuid,
    target_deployment_id,
    target_environment,
    target_severity,
    'open',
    trim(
      target_title
    ),
    trim(
      target_description
    ),
    auth.uid(),
    auth.uid()
  )
  returning id
  into incident_id;

  insert into public.production_incident_events (
    incident_id,
    from_status,
    to_status,
    note,
    actor_id
  )
  values (
    incident_id,
    null,
    'open',
    'Incident logged',
    auth.uid()
  );

  return incident_id;
end;
$$;

revoke all
on function public.create_production_incident(
  text,
  text,
  text,
  text,
  uuid
)
from public;

grant execute
on function public.create_production_incident(
  text,
  text,
  text,
  text,
  uuid
)
to authenticated;

create or replace function public.update_production_incident_status(
  target_incident_id uuid,
  target_status text,
  target_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  incident_row record;
  valid_transition boolean :=
    false;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Operational incidents are limited to HOD and system administrator roles.'
      using errcode = '42501';
  end if;

  select
    incident.*
  into incident_row
  from public.production_incidents
    as incident
  where incident.id =
    target_incident_id
  for update;

  if not found then
    raise exception
      'Operational incident was not found.'
      using errcode = 'P0002';
  end if;

  if not public.current_user_can_manage_department(
    incident_row.department_id
  ) then
    raise exception
      'This incident is outside your active department.'
      using errcode = '42501';
  end if;

  if target_status not in (
    'open',
    'investigating',
    'resolved',
    'closed'
  ) then
    raise exception
      'Invalid operational incident status.'
      using errcode = '22023';
  end if;

  valid_transition =
    (
      incident_row.status =
        'open'
      and target_status in (
        'investigating',
        'resolved'
      )
    )
    or (
      incident_row.status =
        'investigating'
      and target_status in (
        'open',
        'resolved'
      )
    )
    or (
      incident_row.status =
        'resolved'
      and target_status in (
        'open',
        'closed'
      )
    )
    or (
      incident_row.status =
        'closed'
      and target_status =
        'open'
    )
    or incident_row.status =
      target_status;

  if not valid_transition then
    raise exception
      'That operational incident status transition is not allowed.'
      using errcode = '23514';
  end if;

  if target_resolution_note is not null
     and char_length(
       target_resolution_note
     ) > 4000
  then
    raise exception
      'Resolution note must be 4000 characters or fewer.'
      using errcode = '22023';
  end if;

  if target_status in (
    'resolved',
    'closed'
  )
     and (
       target_resolution_note is null
       or char_length(
         trim(
           target_resolution_note
         )
       ) = 0
     )
  then
    raise exception
      'A resolution note is required for Resolved or Closed status.'
      using errcode = '22023';
  end if;

  update public.production_incidents
  set
    status =
      target_status,
    resolution_note =
      nullif(
        trim(
          target_resolution_note
        ),
        ''
      ),
    updated_by =
      auth.uid(),
    updated_at =
      now(),
    closed_by =
      case
        when target_status =
          'closed'
        then auth.uid()
        else null
      end,
    closed_at =
      case
        when target_status =
          'closed'
        then now()
        else null
      end
  where id =
    target_incident_id;

  if incident_row.status is distinct from
       target_status
     or incident_row.resolution_note is distinct from
       nullif(
         trim(
           target_resolution_note
         ),
         ''
       )
  then
    insert into public.production_incident_events (
      incident_id,
      from_status,
      to_status,
      note,
      actor_id
    )
    values (
      target_incident_id,
      incident_row.status,
      target_status,
      nullif(
        trim(
          target_resolution_note
        ),
        ''
      ),
      auth.uid()
    );
  end if;
end;
$$;

revoke all
on function public.update_production_incident_status(
  uuid,
  text,
  text
)
from public;

grant execute
on function public.update_production_incident_status(
  uuid,
  text,
  text
)
to authenticated;

create or replace function public.get_release_deployments(
  target_limit integer default 50
)
returns table (
  id uuid,
  environment text,
  version_label text,
  release_signoff_id uuid,
  release_test_run_id uuid,
  suite_version text,
  verification_ref text,
  status text,
  note text,
  deployed_at timestamptz,
  deployed_by_name text,
  rolled_back_at timestamptz,
  rollback_reason text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
begin
  department_uuid =
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  return query
  select
    deployment.id,
    deployment.environment,
    deployment.version_label,
    deployment.release_signoff_id,
    deployment.release_test_run_id,
    deployment.suite_version,
    deployment.verification_ref,
    deployment.status,
    deployment.note,
    deployment.deployed_at,
    actor.full_name,
    deployment.rolled_back_at,
    deployment.rollback_reason
  from public.release_deployments
    as deployment
  left join public.profiles
    as actor
    on actor.id =
      deployment.deployed_by
  where deployment.department_id =
    department_uuid
  order by
    deployment.deployed_at desc
  limit greatest(
    1,
    least(
      coalesce(
        target_limit,
        50
      ),
      200
    )
  );
end;
$$;

revoke all
on function public.get_release_deployments(integer)
from public;

grant execute
on function public.get_release_deployments(integer)
to authenticated;

create or replace function public.get_production_incidents(
  target_limit integer default 200
)
returns table (
  id uuid,
  incident_number bigint,
  deployment_id uuid,
  deployment_version_label text,
  environment text,
  severity text,
  status text,
  title text,
  description text,
  resolution_note text,
  created_at timestamptz,
  updated_at timestamptz,
  created_by_name text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  department_uuid uuid;
begin
  department_uuid =
    public.current_user_primary_department_id();

  if department_uuid is null
     or not public.current_user_can_manage_department(
       department_uuid
     )
  then
    raise exception
      'No manageable active department is available.'
      using errcode = '42501';
  end if;

  return query
  select
    incident.id,
    incident.incident_number,
    incident.deployment_id,
    deployment.version_label,
    incident.environment,
    incident.severity,
    incident.status,
    incident.title,
    incident.description,
    incident.resolution_note,
    incident.created_at,
    incident.updated_at,
    actor.full_name
  from public.production_incidents
    as incident
  left join public.release_deployments
    as deployment
    on deployment.id =
      incident.deployment_id
  left join public.profiles
    as actor
    on actor.id =
      incident.created_by
  where incident.department_id =
    department_uuid
  order by
    case incident.severity
      when 'critical'
        then 1
      when 'high'
        then 2
      when 'medium'
        then 3
      else 4
    end,
    case incident.status
      when 'open'
        then 1
      when 'investigating'
        then 2
      when 'resolved'
        then 3
      else 4
    end,
    incident.updated_at desc
  limit greatest(
    1,
    least(
      coalesce(
        target_limit,
        200
      ),
      500
    )
  );
end;
$$;

revoke all
on function public.get_production_incidents(integer)
from public;

grant execute
on function public.get_production_incidents(integer)
to authenticated;

comment on table public.release_deployments is
  'Immutable department release deployment history. Recording a newer deployment supersedes the previous active deployment in the same environment.';

comment on table public.production_incidents is
  'Pilot/Production operational incident register, intentionally separate from pre-release UAT defects.';

commit;
