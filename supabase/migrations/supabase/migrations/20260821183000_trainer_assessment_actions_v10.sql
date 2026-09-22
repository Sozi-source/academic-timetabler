begin;

-- ============================================================================
-- Trainer Allocation-Guarded Assessment Actions V10
--
-- HOD/system-admin behavior is preserved.
-- Trainers may manage only assessments resolved through their own active or
-- completed Teaching Allocations.
-- ============================================================================

create or replace function public.assessment_actor_can_manage_assessment(
  target_assessment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    or public.trainer_can_access_assessment(
      target_assessment_id
    );
$$;

revoke all
on function public.assessment_actor_can_manage_assessment(uuid)
from public;

grant execute
on function public.assessment_actor_can_manage_assessment(uuid)
to authenticated;

comment on function public.assessment_actor_can_manage_assessment(uuid) is
  'True for HOD/system-admin, or for a trainer whose Teaching Allocation matches the assessment.';

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

  if not public.assessment_actor_can_manage_assessment(
    target_assessment_id
  ) then
    raise exception
      'You are not authorized to manage this assessment.'
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

  if not public.assessment_actor_can_manage_assessment(
    target_assessment_id
  ) then
    raise exception
      'You are not authorized to manage this assessment.'
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

create or replace function public.lock_assessment_markbook_bundle(
  target_assessment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_unit_id uuid;
  target_type text;
  target_status text;
  target_locked_at timestamptz;

  bundle_event_ids uuid[];
  bundle_count integer := 0;
  bundle_student_count integer := 0;
  bundle_absent_count integer := 0;
  locked_timestamp timestamptz;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.assessment_actor_can_manage_assessment(
    target_assessment_id
  ) then
    raise exception
      'You are not authorized to manage this assessment.'
      using errcode = '42501';
  end if;

  select
    workspace.academic_period_id,
    workspace.unit_id,
    workspace.assessment_type,
    workspace.workflow_status,
    workspace.population_locked_at
  into
    target_period_id,
    target_unit_id,
    target_type,
    target_status,
    target_locked_at
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_type is null then
    raise exception
      'Set the assessment type to CAT or Exam before downloading the markbook.'
      using errcode = '23514';
  end if;

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment can no longer generate an editable markbook.'
      using errcode = '23514';
  end if;

  select
    array_agg(
      event.id
      order by event.id
    ),
    count(*)::integer
  into
    bundle_event_ids,
    bundle_count
  from public.assessment_event_workspace
    as event
  where event.academic_period_id =
      target_period_id
    and event.unit_id =
      target_unit_id
    and event.assessment_type =
      target_type
    and exists (
      select 1
      from public.assessment_roster
        as roster
      where roster.assessment_id =
        event.id
    )
    and public.assessment_actor_can_manage_assessment(
      event.id
    );

  if bundle_count = 0
     or bundle_event_ids is null
     or not (
       target_assessment_id =
       any(bundle_event_ids)
     )
  then
    raise exception
      'Generate the assessment population before downloading the markbook.'
      using errcode = 'P0002';
  end if;

  select
    count(*)::integer,
    count(*) filter (
      where roster.pre_assessment_status =
        'absent'
    )::integer
  into
    bundle_student_count,
    bundle_absent_count
  from public.assessment_roster
    as roster
  where roster.assessment_id =
    any(bundle_event_ids);

  if bundle_student_count = 0 then
    raise exception
      'The markbook bundle has no registered students.'
      using errcode = 'P0002';
  end if;

  locked_timestamp :=
    coalesce(
      target_locked_at,
      now()
    );

  update public.assessment_events
  set
    population_locked_at =
      coalesce(
        population_locked_at,
        locked_timestamp
      ),
    operational_workflow_status =
      case
        when operational_workflow_status
          is null
          or operational_workflow_status
            in (
              'draft',
              'generated'
            )
        then 'open'
        else operational_workflow_status
      end,
    template_version =
      coalesce(
        template_version,
        '1.0'
      )
  where id =
    any(bundle_event_ids);

  return jsonb_build_object(
    'rootAssessmentId',
    target_assessment_id,
    'assessmentType',
    target_type,
    'eventIds',
    bundle_event_ids,
    'eventCount',
    bundle_count,
    'studentCount',
    bundle_student_count,
    'absentCount',
    bundle_absent_count,
    'lockedAt',
    locked_timestamp
  );
end;
$$;

create or replace function public.record_assessment_markbook_generation(
  target_generation_id uuid,
  target_assessment_id uuid,
  target_template_version text,
  target_filename text,
  target_sha256 text,
  target_cohort_count integer,
  target_student_count integer,
  target_absent_count integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_period_id uuid;
  target_unit_id uuid;
  target_type text;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.assessment_actor_can_manage_assessment(
    target_assessment_id
  ) then
    raise exception
      'You are not authorized to manage this assessment.'
      using errcode = '42501';
  end if;

  select
    workspace.academic_period_id,
    workspace.unit_id,
    workspace.assessment_type
  into
    target_period_id,
    target_unit_id,
    target_type
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_type is null then
    raise exception
      'Assessment type is missing.'
      using errcode = '23514';
  end if;

  insert into public.assessment_markbook_generations (
    id,
    root_assessment_id,
    academic_period_id,
    unit_id,
    assessment_type,
    template_version,
    filename,
    sha256,
    cohort_count,
    student_count,
    absent_count,
    generated_by
  )
  values (
    target_generation_id,
    target_assessment_id,
    target_period_id,
    target_unit_id,
    target_type,
    target_template_version,
    target_filename,
    lower(target_sha256),
    target_cohort_count,
    target_student_count,
    target_absent_count,
    auth.uid()
  );

  return target_generation_id;
end;
$$;

create or replace function public.stage_assessment_markbook_import(
  target_batch_id uuid,
  target_root_assessment_id uuid,
  target_generation_id uuid,
  target_template_version text,
  target_filename text,
  target_sha256 text,
  target_assessment_type text,
  target_academic_period_id uuid,
  target_unit_id uuid,
  target_validation_summary jsonb,
  target_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  existing_batch_id uuid;

  generation_root_assessment_id uuid;
  generation_period_id uuid;
  generation_unit_id uuid;
  generation_type text;
  generation_template_version text;

  target_locked_at timestamptz;
  target_workflow_status text;

  stage_row jsonb;
  stage_assessment_id uuid;
  stage_cohort_id uuid;
  stage_student_id uuid;
  stage_attendance_status text;
  stage_result_status text;
  stage_mark numeric;

  expected_row_count integer;
  inserted_row_count integer := 0;
  numeric_count integer := 0;
  absent_count integer := 0;
  missing_count integer := 0;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not public.assessment_actor_can_manage_assessment(
    target_root_assessment_id
  ) then
    raise exception
      'You are not authorized to manage this assessment.'
      using errcode = '42501';
  end if;

  if target_assessment_type not in (
    'cat',
    'exam'
  ) then
    raise exception
      'Assessment type must be CAT or Exam.'
      using errcode = '23514';
  end if;

  if target_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception
      'Workbook fingerprint is invalid.'
      using errcode = '23514';
  end if;

  if jsonb_typeof(target_rows) <> 'array'
     or jsonb_array_length(target_rows) = 0
  then
    raise exception
      'The validated workbook contains no staged rows.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(
      target_rows
    ) as item
    where nullif(
      item ->> 'assessmentId',
      ''
    ) is null
       or not public.assessment_actor_can_manage_assessment(
         (
           item ->> 'assessmentId'
         )::uuid
       )
  ) then
    raise exception
      'The workbook contains an assessment outside your Teaching Allocations.'
      using errcode = '42501';
  end if;


  select
    markbook.root_assessment_id,
    markbook.academic_period_id,
    markbook.unit_id,
    markbook.assessment_type,
    markbook.template_version
  into
    generation_root_assessment_id,
    generation_period_id,
    generation_unit_id,
    generation_type,
    generation_template_version
  from public.assessment_markbook_generations
    as markbook
  where markbook.id =
    target_generation_id;

  if not found then
    raise exception
      'The workbook generation record was not found.'
      using errcode = 'P0002';
  end if;

  if generation_root_assessment_id <>
       target_root_assessment_id
     or generation_period_id <>
       target_academic_period_id
     or generation_unit_id <>
       target_unit_id
     or generation_type <>
       target_assessment_type
     or generation_template_version <>
       target_template_version
  then
    raise exception
      'Workbook metadata does not match its generation record.'
      using errcode = '23514';
  end if;

  select
    event.population_locked_at,
    event.operational_workflow_status
  into
    target_locked_at,
    target_workflow_status
  from public.assessment_events
    as event
  where event.id =
    target_root_assessment_id
  for update;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_locked_at is null then
    raise exception
      'The assessment roster must be locked before marks can be staged.'
      using errcode = '23514';
  end if;

  if target_workflow_status in (
    'finalised',
    'archived'
  ) then
    raise exception
      'Finalised or archived assessments cannot accept a new staged workbook.'
      using errcode = '23514';
  end if;

  select batch.id
  into existing_batch_id
  from public.assessment_markbook_import_batches
    as batch
  where batch.root_assessment_id =
      target_root_assessment_id
    and batch.source_sha256 =
      target_sha256
  limit 1;

  if existing_batch_id is not null then
    return existing_batch_id;
  end if;

  expected_row_count :=
    jsonb_array_length(
      target_rows
    );

  insert into public.assessment_markbook_import_batches (
    id,
    root_assessment_id,
    generation_id,
    academic_period_id,
    unit_id,
    assessment_type,
    template_version,
    source_filename,
    source_sha256,
    status,
    total_rows,
    numeric_marks,
    absences,
    missing_marks,
    validation_summary,
    uploaded_by
  )
  values (
    target_batch_id,
    target_root_assessment_id,
    target_generation_id,
    target_academic_period_id,
    target_unit_id,
    target_assessment_type,
    target_template_version,
    target_filename,
    target_sha256,
    'ready',
    expected_row_count,
    0,
    0,
    0,
    coalesce(
      target_validation_summary,
      '{}'::jsonb
    ),
    auth.uid()
  );

  for stage_row in
    select value
    from jsonb_array_elements(
      target_rows
    )
  loop
    stage_assessment_id :=
      nullif(
        stage_row ->> 'assessmentId',
        ''
      )::uuid;

    stage_cohort_id :=
      nullif(
        stage_row ->> 'cohortId',
        ''
      )::uuid;

    stage_student_id :=
      nullif(
        stage_row ->> 'studentId',
        ''
      )::uuid;

    stage_attendance_status :=
      stage_row ->> 'attendanceStatus';

    stage_result_status :=
      stage_row ->> 'resultStatus';

    stage_mark :=
      case
        when stage_result_status = 'sat'
        then (
          stage_row ->> 'mark'
        )::numeric
        else null
      end;

    if stage_assessment_id is null
       or stage_student_id is null
    then
      raise exception
        'A staged workbook row is missing its assessment or student identifier.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.assessment_event_workspace
        as workspace
      where workspace.id =
          stage_assessment_id
        and workspace.academic_period_id =
          target_academic_period_id
        and workspace.unit_id =
          target_unit_id
        and workspace.assessment_type =
          target_assessment_type
    ) then
      raise exception
        'A staged row belongs to a different assessment bundle.'
        using errcode = '23514';
    end if;

    if not exists (
      select 1
      from public.assessment_roster
        as roster
      where roster.assessment_id =
          stage_assessment_id
        and roster.student_id =
          stage_student_id
        and (
          stage_cohort_id is null
          or roster.cohort_id =
            stage_cohort_id
        )
        and roster.pre_assessment_status =
          stage_attendance_status
    ) then
      raise exception
        'A staged row no longer matches the locked assessment roster.'
        using errcode = '23514';
    end if;

    if stage_result_status = 'sat' then
      if stage_attendance_status <> 'expected'
         or stage_mark is null
         or stage_mark < 0
      then
        raise exception
          'A numeric mark is inconsistent with the locked attendance state.'
          using errcode = '23514';
      end if;

      numeric_count :=
        numeric_count + 1;

    elsif stage_result_status = 'absent' then
      if stage_attendance_status <> 'absent' then
        raise exception
          'An absent result is inconsistent with the locked attendance state.'
          using errcode = '23514';
      end if;

      absent_count :=
        absent_count + 1;

    elsif stage_result_status = 'missing_mark' then
      if stage_attendance_status <> 'expected' then
        raise exception
          'A missing mark cannot replace an explicit absence.'
          using errcode = '23514';
      end if;

      missing_count :=
        missing_count + 1;

    else
      raise exception
        'Unsupported staged result status.'
        using errcode = '23514';
    end if;

    insert into public.assessment_markbook_import_stage_rows (
      batch_id,
      assessment_id,
      cohort_id,
      student_id,
      sheet_name,
      workbook_row,
      admission_number,
      attendance_status,
      mark,
      result_status
    )
    values (
      target_batch_id,
      stage_assessment_id,
      stage_cohort_id,
      stage_student_id,
      stage_row ->> 'sheetName',
      (
        stage_row ->> 'workbookRow'
      )::integer,
      stage_row ->> 'admissionNumber',
      stage_attendance_status,
      stage_mark,
      stage_result_status
    );

    inserted_row_count :=
      inserted_row_count + 1;
  end loop;

  if inserted_row_count <>
       expected_row_count
  then
    raise exception
      'Not all validated workbook rows were staged.'
      using errcode = '23514';
  end if;

  update public.assessment_markbook_import_batches
  set
    numeric_marks =
      numeric_count,
    absences =
      absent_count,
    missing_marks =
      missing_count,
    updated_at =
      now()
  where id =
    target_batch_id;

  return target_batch_id;
end;
$$;

create or replace function public.commit_assessment_markbook_import(
  target_batch_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  batch record;
  inserted_count integer := 0;
  assessment_count integer := 0;
begin
  if auth.uid() is null then
    raise exception
      'Authentication is required.'
      using errcode = '42501';
  end if;

  if not (
    public.current_user_has_role(
      array[
        'hod',
        'system_admin'
      ]::public.app_role[]
    )
    or public.current_trainer_id() is not null
  ) then
    raise exception
      'You are not authorized to commit assessment results.'
      using errcode = '42501';
  end if;

  select *
  into batch
  from public.assessment_markbook_import_batches
  where id = target_batch_id
  for update;

  if not found then
    raise exception
      'Staged markbook was not found.'
      using errcode = 'P0002';
  end if;

  if not public.assessment_actor_can_manage_assessment(
    batch.root_assessment_id
  ) then
    raise exception
      'This staged markbook is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.assessment_markbook_import_stage_rows
      as access_row
    where access_row.batch_id =
        target_batch_id
      and not public.assessment_actor_can_manage_assessment(
        access_row.assessment_id
      )
  ) then
    raise exception
      'This staged markbook contains assessment rows outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  if batch.status = 'committed' then
    return jsonb_build_object(
      'batchId',
      target_batch_id,
      'status',
      'committed',
      'alreadyCommitted',
      true,
      'resultCount',
      (
        select count(*)::integer
        from public.assessment_results
        where source_markbook_batch_id =
          target_batch_id
      )
    );
  end if;

  if batch.status <> 'ready' then
    raise exception
      'Only a ready staged markbook can be committed.'
      using errcode = '23514';
  end if;

  if batch.missing_marks > 0 then
    raise exception
      'Missing marks remain in this workbook. Correct and restage the workbook before committing results.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.assessment_markbook_import_stage_rows
    where batch_id =
      target_batch_id
  ) then
    raise exception
      'The staged markbook has no result rows.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.assessment_markbook_import_stage_rows as stage
    where stage.batch_id =
        target_batch_id
      and (
        stage.result_status not in (
          'sat',
          'absent'
        )
        or (
          stage.result_status = 'sat'
          and stage.mark is null
        )
        or (
          stage.result_status = 'absent'
          and stage.mark is not null
        )
      )
  ) then
    raise exception
      'The staged rows are not ready for result commit.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessment_markbook_import_stage_rows as stage
    join public.assessment_results as existing
      on existing."assessment_event_id" =
         stage.assessment_id
     and existing."student_id" =
         stage.student_id
    where stage.batch_id =
      target_batch_id
  ) then
    raise exception
      'One or more students already have committed results for this assessment. Existing academic results were not overwritten.'
      using errcode = '23505';
  end if;

  insert into public.assessment_results (
      "assessment_event_id",
      "student_id",
      "cohort_id",
      "operational_mark",
      "operational_result_status",
      "import_source",
      "imported_at",
      "source_markbook_batch_id",
      "source_workbook_row"
  )
  select
      stage.assessment_id,
      stage.student_id,
      stage.cohort_id,
      case
    when stage.result_status = 'sat'
      then stage.mark
    else null
  end,
      stage.result_status,
      'excel',
      now(),
      batch.id,
      stage.workbook_row
  from public.assessment_markbook_import_stage_rows as stage
  join public.assessment_markbook_import_batches as batch
    on batch.id =
       stage.batch_id
  where stage.batch_id =
    target_batch_id
  order by
    stage.sheet_name,
    stage.workbook_row;

  get diagnostics inserted_count =
    row_count;

  if inserted_count <>
       batch.total_rows
  then
    raise exception
      'Result commit count did not match the validated workbook population.'
      using errcode = '23514';
  end if;

  with affected_assessments as (
    select distinct
      stage.assessment_id
    from public.assessment_markbook_import_stage_rows as stage
    where stage.batch_id =
      target_batch_id
  )
  update public.assessment_events as event
  set
    operational_workflow_status =
      'submitted',
    marks_submitted_at =
      coalesce(
        event.marks_submitted_at,
        now()
      )
  where event.id in (
    select assessment_id
    from affected_assessments
  );

  get diagnostics assessment_count =
    row_count;

  update public.assessment_markbook_import_batches
  set
    status =
      'committed',
    committed_at =
      now(),
    updated_at =
      now(),
    validation_summary =
      coalesce(
        validation_summary,
        '{}'::jsonb
      ) ||
      jsonb_build_object(
        'committed_at',
        now(),
        'committed_by',
        auth.uid(),
        'result_count',
        inserted_count,
        'assessment_count',
        assessment_count
      )
  where id =
    target_batch_id;

  return jsonb_build_object(
    'batchId',
    target_batch_id,
    'status',
    'committed',
    'alreadyCommitted',
    false,
    'resultCount',
    inserted_count,
    'assessmentCount',
    assessment_count
  );
end;
$$;

commit;
