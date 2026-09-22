begin;

-- ============================================================
-- Student Unit Registration: administrative undo
-- ============================================================

create or replace function
  public.undo_student_unit_registration(
    target_student_id uuid,
    target_academic_period_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed_registrations integer := 0;
  removed_submissions integer := 0;
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
      'Only an authorized HOD or system administrator may undo unit registration.'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.students
    where id = target_student_id
  ) then
    raise exception 'Student was not found.'
      using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.academic_periods
    where id = target_academic_period_id
  ) then
    raise exception 'Academic Period was not found.'
      using errcode = 'P0002';
  end if;

  delete from public.student_unit_registration_submissions
  where student_id = target_student_id
    and academic_period_id = target_academic_period_id;

  get diagnostics removed_submissions = row_count;

  delete from public.student_unit_registrations
  where student_id = target_student_id
    and academic_period_id = target_academic_period_id;

  get diagnostics removed_registrations = row_count;

  return jsonb_build_object(
    'studentId',
    target_student_id,
    'academicPeriodId',
    target_academic_period_id,
    'removedRegistrations',
    removed_registrations,
    'removedSubmissions',
    removed_submissions
  );
end;
$$;

revoke all
on function public.undo_student_unit_registration(uuid, uuid)
from public;

grant execute
on function public.undo_student_unit_registration(uuid, uuid)
to authenticated;

comment on function
  public.undo_student_unit_registration(uuid, uuid) is
  'Administrative correction that removes one student unit-registration transaction for one Academic Period without changing the student cohort or programme stage.';

-- ============================================================
-- Generated markbooks: guarded delete
-- ============================================================

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

  if to_regclass('public.assessment_events') is null then
    raise exception 'Assessment events table is unavailable.'
      using errcode = '42P01';
  end if;

  if not exists (
    select 1
    from public.assessment_events
    where id = target_assessment_id
  ) then
    raise exception 'Markbook was not found.'
      using errcode = 'P0002';
  end if;

  -- Resolve the foreign-key column from assessment_results to
  -- assessment_events instead of assuming a particular name.
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

    if result_reference_column is null then
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'assessment_results'
          and column_name = 'assessment_id'
      ) then
        result_reference_column := 'assessment_id';
      elsif exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'assessment_results'
          and column_name = 'assessment_event_id'
      ) then
        result_reference_column := 'assessment_event_id';
      end if;
    end if;

    if result_reference_column is not null then
      execute format(
        'select count(*) from public.assessment_results where %I = $1',
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

  -- Confirmed/imported mark history also blocks deletion.
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
        'select count(*) from public.assessment_mark_import_rows where %I = $1',
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

  -- Population rows are generated from the registration snapshot
  -- and may be safely removed when no mark history exists.
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

    if population_reference_column is null then
      if exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'assessment_population'
          and column_name = 'assessment_id'
      ) then
        population_reference_column := 'assessment_id';
      elsif exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'assessment_population'
          and column_name = 'assessment_event_id'
      ) then
        population_reference_column := 'assessment_event_id';
      end if;
    end if;

    if population_reference_column is not null then
      execute format(
        'delete from public.assessment_population where %I = $1',
        population_reference_column
      )
      using target_assessment_id;

      get diagnostics population_count = row_count;
    end if;
  end if;

  -- Refuse to destroy any other dependent academic history.
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
        'assessment_results',
        'assessment_mark_import_rows'
      )
  loop
    execute format(
      'select count(*) from public.%I where %I = $1',
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

comment on function
  public.delete_generated_markbook(uuid) is
  'Deletes an unmarked generated assessment/markbook and its generated population. Existing marks, import history or other dependent academic history block deletion.';

commit;
