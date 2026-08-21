begin;

-- ============================================================================
-- Assessment Population V2 - schema compatibility revision
--
-- Uses public.assessment_roster rather than repurposing the existing
-- enum-backed public.assessment_population table.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Canonical assessment event projection.
-- ----------------------------------------------------------------------------

drop view if exists public.assessment_event_workspace;

do $$
declare
  unit_expression text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assessment_events'
      and column_name = 'unit_id'
  ) then
    unit_expression := 'event.unit_id';

  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assessment_events'
      and column_name = 'unit_offering_id'
  ) then
    unit_expression :=
      '(select offering.unit_id
          from public.unit_offerings as offering
         where offering.id = event.unit_offering_id)';

  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assessment_events'
      and column_name = 'teaching_allocation_id'
  ) then
    unit_expression :=
      '(select allocation.unit_id
          from public.teaching_allocations as allocation
         where allocation.id = event.teaching_allocation_id)';

  else
    raise exception
      'assessment_events has no supported unit reference.'
      using errcode = '42703';
  end if;

  execute format(
    'create view public.assessment_event_workspace
       with (security_invoker = true)
     as
     select
       event.id,
       event.academic_period_id,
       event.cohort_id,
       %s as unit_id,
       event.operational_assessment_type as assessment_type,
       event.operational_workflow_status as workflow_status,
       event.population_generated_at,
       event.population_locked_at,
       event.template_version
     from public.assessment_events as event',
    unit_expression
  );
end;
$$;

comment on view public.assessment_event_workspace is
  'Canonical assessment-event projection used by CAT/EXAM roster, workbook and signing-sheet workflows.';

-- ----------------------------------------------------------------------------
-- Roster projection expected by the application workspace.
-- ----------------------------------------------------------------------------

create or replace view public.assessment_population_workspace_rows
with (security_invoker = true)
as
select
  roster.id,
  roster.assessment_id,
  roster.student_id,
  roster.cohort_id,
  roster.pre_assessment_status as attendance_status,
  roster.pre_assessment_marked_at as attendance_marked_at,
  roster.snapshot_registration_status,
  roster.snapshot_created_at
from public.assessment_roster as roster;

comment on view public.assessment_population_workspace_rows is
  'Application-facing CAT/EXAM roster projection. Expected and Absent are deliberately separate from existing institutional attendance enums.';

create or replace view public.assessment_population_summary
with (security_invoker = true)
as
select
  roster.assessment_id,
  count(*)::integer as registered_population,
  count(*) filter (
    where roster.pre_assessment_status = 'absent'
  )::integer as marked_absent,
  count(*) filter (
    where roster.pre_assessment_status = 'expected'
  )::integer as expected_to_sit
from public.assessment_roster as roster
group by roster.assessment_id;

-- ----------------------------------------------------------------------------
-- Registration candidates.
-- ----------------------------------------------------------------------------

drop view if exists public.assessment_registration_candidates;

do $$
declare
  cohort_expression text;
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'student_unit_registrations'
      and column_name = 'cohort_id'
  ) then
    cohort_expression :=
      'coalesce(registration.cohort_id, student.current_cohort_id)';
  else
    cohort_expression :=
      'student.current_cohort_id';
  end if;

  execute format(
    'create view public.assessment_registration_candidates
       with (security_invoker = true)
     as
     select
       registration.student_id,
       registration.academic_period_id,
       registration.unit_id,
       %s as cohort_id,
       registration.registration_status::text as registration_status
     from public.student_unit_registrations as registration
     join public.students as student
       on student.id = registration.student_id',
    cohort_expression
  );
end;
$$;

comment on view public.assessment_registration_candidates is
  'Registered student/unit records eligible to become a CAT/EXAM assessment roster snapshot.';

-- ----------------------------------------------------------------------------
-- Generate / refresh roster from registered students.
-- ----------------------------------------------------------------------------

create or replace function
  public.generate_assessment_population_from_registrations(
    target_assessment_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_cohort_id uuid;
  target_unit_id uuid;
  target_status text;
  target_population_locked_at timestamptz;

  result_reference_column text;
  import_reference_column text;

  result_count bigint := 0;
  import_count bigint := 0;
  inserted_count integer := 0;
  absent_count integer := 0;
  expected_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may generate assessment population at this stage.'
      using errcode = '42501';
  end if;

  perform 1
  from public.assessment_events
  where id = target_assessment_id
  for update;

  if not found then
    raise exception 'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  select
    workspace.academic_period_id,
    workspace.cohort_id,
    workspace.unit_id,
    workspace.workflow_status,
    workspace.population_locked_at
  into
    target_period_id,
    target_cohort_id,
    target_unit_id,
    target_status,
    target_population_locked_at
  from public.assessment_event_workspace as workspace
  where workspace.id = target_assessment_id;

  if target_period_id is null then
    raise exception
      'Assessment does not have an Academic Period.'
      using errcode = '23514';
  end if;

  if target_unit_id is null then
    raise exception
      'Assessment does not resolve to a unit.'
      using errcode = '23514';
  end if;

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'Assessment population is locked after submission.'
      using errcode = '23514';
  end if;

  if target_population_locked_at is not null then
    raise exception
      'Assessment population has already been locked for markbook generation.'
      using errcode = '23514';
  end if;

  if to_regclass('public.assessment_results') is not null then
    select child_attribute.attname
    into result_reference_column
    from pg_constraint constraint_row
    join lateral unnest(constraint_row.conkey)
      with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey)
      with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_attribute
      on child_attribute.attrelid = constraint_row.conrelid
     and child_attribute.attnum = child_key.attnum
    join pg_attribute parent_attribute
      on parent_attribute.attrelid = constraint_row.confrelid
     and parent_attribute.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.conrelid =
        'public.assessment_results'::regclass
      and constraint_row.confrelid =
        'public.assessment_events'::regclass
      and parent_attribute.attname = 'id'
    limit 1;

    if result_reference_column is not null then
      execute format(
        'select count(*)
           from public.assessment_results
          where %I = $1',
        result_reference_column
      )
      into result_count
      using target_assessment_id;
    end if;
  end if;

  if result_count > 0 then
    raise exception
      'Assessment results already exist. Population cannot be refreshed.'
      using errcode = '23503';
  end if;

  if to_regclass('public.assessment_mark_import_rows') is not null then
    select child_attribute.attname
    into import_reference_column
    from pg_constraint constraint_row
    join lateral unnest(constraint_row.conkey)
      with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey)
      with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_attribute
      on child_attribute.attrelid = constraint_row.conrelid
     and child_attribute.attnum = child_key.attnum
    join pg_attribute parent_attribute
      on parent_attribute.attrelid = constraint_row.confrelid
     and parent_attribute.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.conrelid =
        'public.assessment_mark_import_rows'::regclass
      and constraint_row.confrelid =
        'public.assessment_events'::regclass
      and parent_attribute.attname = 'id'
    limit 1;

    if import_reference_column is not null then
      execute format(
        'select count(*)
           from public.assessment_mark_import_rows
          where %I = $1',
        import_reference_column
      )
      into import_count
      using target_assessment_id;
    end if;
  end if;

  if import_count > 0 then
    raise exception
      'Assessment import history exists. Population cannot be refreshed.'
      using errcode = '23503';
  end if;

  create temporary table
    if not exists pg_temp.assessment_absence_snapshot (
      student_id uuid primary key
    )
  on commit drop;

  truncate table pg_temp.assessment_absence_snapshot;

  insert into pg_temp.assessment_absence_snapshot(student_id)
  select roster.student_id
  from public.assessment_roster as roster
  where roster.assessment_id = target_assessment_id
    and roster.pre_assessment_status = 'absent'
  on conflict (student_id) do nothing;

  delete from public.assessment_roster
  where assessment_id = target_assessment_id;

  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    snapshot_registration_status,
    pre_assessment_status,
    snapshot_created_at,
    updated_at
  )
  select
    target_assessment_id,
    candidate.student_id,
    candidate.cohort_id,
    target_period_id,
    target_unit_id,
    candidate.registration_status,
    case
      when absence.student_id is not null
        then 'absent'
      else 'expected'
    end,
    now(),
    now()
  from (
    select distinct on (
      registration.student_id
    )
      registration.student_id,
      registration.cohort_id,
      registration.registration_status
    from public.assessment_registration_candidates
      as registration
    where registration.academic_period_id =
      target_period_id
      and registration.unit_id =
        target_unit_id
      and registration.registration_status =
        'registered'
      and (
        target_cohort_id is null
        or registration.cohort_id =
          target_cohort_id
      )
    order by registration.student_id
  ) as candidate
  left join pg_temp.assessment_absence_snapshot
    as absence
    on absence.student_id =
       candidate.student_id;

  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    raise exception
      'No registered students were found for this assessment unit and cohort.'
      using errcode = 'P0002';
  end if;

  select
    count(*) filter (
      where pre_assessment_status = 'absent'
    ),
    count(*) filter (
      where pre_assessment_status = 'expected'
    )
  into
    absent_count,
    expected_count
  from public.assessment_roster
  where assessment_id = target_assessment_id;

  update public.assessment_events
  set
    operational_workflow_status =
      case
        when operational_workflow_status is null
          or operational_workflow_status in (
            'draft',
            'generated'
          )
        then 'generated'
        else operational_workflow_status
      end,
    population_generated_at = now()
  where id = target_assessment_id;

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'registeredPopulation',
    inserted_count,
    'expectedToSit',
    expected_count,
    'markedAbsent',
    absent_count
  );
end;
$$;

revoke all
on function public.generate_assessment_population_from_registrations(uuid)
from public;

grant execute
on function public.generate_assessment_population_from_registrations(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Explicit absence marking.
-- ----------------------------------------------------------------------------

create or replace function public.set_assessment_population_absence(
  target_assessment_id uuid,
  target_student_id uuid,
  target_absent boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status text;
  target_population_locked_at timestamptz;
  changed_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may update assessment attendance at this stage.'
      using errcode = '42501';
  end if;

  select
    operational_workflow_status,
    population_locked_at
  into
    target_status,
    target_population_locked_at
  from public.assessment_events
  where id = target_assessment_id
  for update;

  if not found then
    raise exception 'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'Assessment attendance is locked after results are submitted.'
      using errcode = '23514';
  end if;

  if target_population_locked_at is not null then
    raise exception
      'Assessment attendance is locked after markbook generation.'
      using errcode = '23514';
  end if;

  update public.assessment_roster
  set
    pre_assessment_status =
      case
        when target_absent then 'absent'
        else 'expected'
      end,
    pre_assessment_marked_at = now(),
    pre_assessment_marked_by = auth.uid(),
    updated_at = now()
  where assessment_id = target_assessment_id
    and student_id = target_student_id;

  get diagnostics changed_count = row_count;

  if changed_count <> 1 then
    raise exception
      'Student is not part of this assessment population.'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'studentId',
    target_student_id,
    'attendanceStatus',
    case
      when target_absent then 'absent'
      else 'expected'
    end
  );
end;
$$;

revoke all
on function public.set_assessment_population_absence(uuid, uuid, boolean)
from public;

grant execute
on function public.set_assessment_population_absence(uuid, uuid, boolean)
to authenticated;

-- ----------------------------------------------------------------------------
-- Keep the previously-added guarded delete compatible with assessment_roster.
-- ----------------------------------------------------------------------------

create or replace function
  public.delete_generated_markbook(
    target_assessment_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  result_reference_column text;
  import_reference_column text;
  population_reference_column text;
  dependent_reference record;
  dependent_count bigint;
  result_count bigint := 0;
  import_count bigint := 0;
  population_count bigint := 0;
  roster_count bigint := 0;
  deleted_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may delete a generated markbook.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.assessment_events
    where id = target_assessment_id
  ) then
    raise exception 'Markbook was not found.'
      using errcode = 'P0002';
  end if;

  if to_regclass('public.assessment_results') is not null then
    select child_attribute.attname
    into result_reference_column
    from pg_constraint constraint_row
    join lateral unnest(constraint_row.conkey)
      with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey)
      with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_attribute
      on child_attribute.attrelid = constraint_row.conrelid
     and child_attribute.attnum = child_key.attnum
    join pg_attribute parent_attribute
      on parent_attribute.attrelid = constraint_row.confrelid
     and parent_attribute.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.conrelid =
        'public.assessment_results'::regclass
      and constraint_row.confrelid =
        'public.assessment_events'::regclass
      and parent_attribute.attname = 'id'
    limit 1;

    if result_reference_column is not null then
      execute format(
        'select count(*)
           from public.assessment_results
          where %I = $1',
        result_reference_column
      )
      into result_count
      using target_assessment_id;
    end if;
  end if;

  if result_count > 0 then
    raise exception
      'Marks already exist. This markbook cannot be deleted.'
      using errcode = '23503';
  end if;

  if to_regclass('public.assessment_mark_import_rows') is not null then
    select child_attribute.attname
    into import_reference_column
    from pg_constraint constraint_row
    join lateral unnest(constraint_row.conkey)
      with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey)
      with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_attribute
      on child_attribute.attrelid = constraint_row.conrelid
     and child_attribute.attnum = child_key.attnum
    join pg_attribute parent_attribute
      on parent_attribute.attrelid = constraint_row.confrelid
     and parent_attribute.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.conrelid =
        'public.assessment_mark_import_rows'::regclass
      and constraint_row.confrelid =
        'public.assessment_events'::regclass
      and parent_attribute.attname = 'id'
    limit 1;

    if import_reference_column is not null then
      execute format(
        'select count(*)
           from public.assessment_mark_import_rows
          where %I = $1',
        import_reference_column
      )
      into import_count
      using target_assessment_id;
    end if;
  end if;

  if import_count > 0 then
    raise exception
      'Imported mark history exists. This markbook cannot be deleted.'
      using errcode = '23503';
  end if;

  delete from public.assessment_roster
  where assessment_id = target_assessment_id;

  get diagnostics roster_count = row_count;

  if to_regclass('public.assessment_population') is not null then
    select child_attribute.attname
    into population_reference_column
    from pg_constraint constraint_row
    join lateral unnest(constraint_row.conkey)
      with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey)
      with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_attribute
      on child_attribute.attrelid = constraint_row.conrelid
     and child_attribute.attnum = child_key.attnum
    join pg_attribute parent_attribute
      on parent_attribute.attrelid = constraint_row.confrelid
     and parent_attribute.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.conrelid =
        'public.assessment_population'::regclass
      and constraint_row.confrelid =
        'public.assessment_events'::regclass
      and parent_attribute.attname = 'id'
    limit 1;

    if population_reference_column is not null then
      execute format(
        'delete from public.assessment_population
          where %I = $1',
        population_reference_column
      )
      using target_assessment_id;

      get diagnostics population_count = row_count;
    end if;
  end if;

  for dependent_reference in
    select
      child_table.relname as table_name,
      child_attribute.attname as column_name
    from pg_constraint constraint_row
    join pg_class child_table
      on child_table.oid = constraint_row.conrelid
    join pg_namespace child_namespace
      on child_namespace.oid = child_table.relnamespace
    join lateral unnest(constraint_row.conkey)
      with ordinality child_key(attnum, position)
      on true
    join lateral unnest(constraint_row.confkey)
      with ordinality parent_key(attnum, position)
      on parent_key.position = child_key.position
    join pg_attribute child_attribute
      on child_attribute.attrelid = constraint_row.conrelid
     and child_attribute.attnum = child_key.attnum
    join pg_attribute parent_attribute
      on parent_attribute.attrelid = constraint_row.confrelid
     and parent_attribute.attnum = parent_key.attnum
    where constraint_row.contype = 'f'
      and constraint_row.confrelid =
        'public.assessment_events'::regclass
      and child_namespace.nspname = 'public'
      and parent_attribute.attname = 'id'
      and child_table.relname not in (
        'assessment_population',
        'assessment_roster',
        'assessment_results',
        'assessment_mark_import_rows'
      )
  loop
    execute format(
      'select count(*)
         from public.%I
        where %I = $1',
      dependent_reference.table_name,
      dependent_reference.column_name
    )
    into dependent_count
    using target_assessment_id;

    if dependent_count > 0 then
      raise exception
        'This markbook has dependent history in %. Delete is blocked.',
        dependent_reference.table_name
        using errcode = '23503';
    end if;
  end loop;

  delete from public.assessment_events
  where id = target_assessment_id;

  get diagnostics deleted_count = row_count;

  if deleted_count <> 1 then
    raise exception
      'Markbook could not be deleted.'
      using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'deleted',
    true,
    'removedRosterRows',
    roster_count,
    'removedPopulationRows',
    population_count
  );
end;
$$;

revoke all
on function public.delete_generated_markbook(uuid)
from public;

grant execute
on function public.delete_generated_markbook(uuid)
to authenticated;

commit;