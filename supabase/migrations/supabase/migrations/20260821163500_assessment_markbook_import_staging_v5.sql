begin;

-- ============================================================================
-- Assessment Markbook Import Staging V5
--
-- Validated Excel markbooks are staged before any result row is committed.
-- This creates an auditable boundary between workbook validation and academic
-- result persistence.
-- ============================================================================

create table if not exists public.assessment_markbook_import_batches (
  id uuid primary key,

  root_assessment_id uuid not null
    references public.assessment_events(id)
    on delete restrict,

  generation_id uuid not null
    references public.assessment_markbook_generations(id)
    on delete restrict,

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  assessment_type text not null,

  template_version text not null,

  source_filename text not null,

  source_sha256 text not null,

  status text not null
    default 'ready',

  total_rows integer not null,
  numeric_marks integer not null,
  absences integer not null,
  missing_marks integer not null,

  validation_summary jsonb not null
    default '{}'::jsonb,

  uploaded_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  committed_at timestamptz,

  constraint assessment_markbook_import_batches_type_check
    check (
      assessment_type in (
        'cat',
        'exam'
      )
    ),

  constraint assessment_markbook_import_batches_status_check
    check (
      status in (
        'ready',
        'committed',
        'cancelled',
        'failed'
      )
    ),

  constraint assessment_markbook_import_batches_counts_check
    check (
      total_rows >= 1
      and numeric_marks >= 0
      and absences >= 0
      and missing_marks >= 0
      and numeric_marks + absences + missing_marks =
        total_rows
    ),

  constraint assessment_markbook_import_batches_sha_check
    check (
      source_sha256 ~ '^[0-9a-f]{64}$'
    )
);

create unique index if not exists
  assessment_markbook_import_batches_source_unique
on public.assessment_markbook_import_batches (
  root_assessment_id,
  source_sha256
);

create index if not exists
  assessment_markbook_import_batches_assessment_idx
on public.assessment_markbook_import_batches (
  root_assessment_id,
  created_at desc
);

create table if not exists public.assessment_markbook_import_stage_rows (
  id uuid primary key
    default gen_random_uuid(),

  batch_id uuid not null
    references public.assessment_markbook_import_batches(id)
    on delete cascade,

  assessment_id uuid not null
    references public.assessment_events(id)
    on delete restrict,

  cohort_id uuid
    references public.cohorts(id)
    on delete restrict,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  sheet_name text not null,

  workbook_row integer not null,

  admission_number text not null,

  attendance_status text not null,

  mark numeric,

  result_status text not null,

  created_at timestamptz not null
    default now(),

  constraint assessment_markbook_stage_rows_attendance_check
    check (
      attendance_status in (
        'expected',
        'absent'
      )
    ),

  constraint assessment_markbook_stage_rows_result_check
    check (
      result_status in (
        'sat',
        'absent',
        'missing_mark'
      )
    ),

  constraint assessment_markbook_stage_rows_mark_check
    check (
      (
        result_status = 'sat'
        and mark is not null
        and mark >= 0
      )
      or
      (
        result_status in (
          'absent',
          'missing_mark'
        )
        and mark is null
      )
    ),

  constraint assessment_markbook_stage_rows_row_check
    check (
      workbook_row >= 1
    ),

  constraint assessment_markbook_stage_rows_batch_student_unique
    unique (
      batch_id,
      student_id
    )
);

create index if not exists
  assessment_markbook_stage_rows_batch_idx
on public.assessment_markbook_import_stage_rows (
  batch_id,
  sheet_name,
  workbook_row
);

alter table public.assessment_markbook_import_batches
  enable row level security;

alter table public.assessment_markbook_import_stage_rows
  enable row level security;

drop policy if exists
  assessment_markbook_import_batches_hod_read
on public.assessment_markbook_import_batches;

create policy assessment_markbook_import_batches_hod_read
on public.assessment_markbook_import_batches
for select
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

drop policy if exists
  assessment_markbook_import_stage_rows_hod_read
on public.assessment_markbook_import_stage_rows;

create policy assessment_markbook_import_stage_rows_hod_read
on public.assessment_markbook_import_stage_rows
for select
to authenticated
using (
  public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  )
);

comment on table public.assessment_markbook_import_batches is
  'Validated CAT/EXAM workbook imports staged before any academic result is committed.';

comment on table public.assessment_markbook_import_stage_rows is
  'Validated per-student workbook rows awaiting controlled result import.';

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

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may stage assessment markbooks at this stage.'
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

revoke all
on function public.stage_assessment_markbook_import(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  jsonb,
  jsonb
)
from public;

grant execute
on function public.stage_assessment_markbook_import(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  jsonb,
  jsonb
)
to authenticated;

comment on function public.stage_assessment_markbook_import(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  uuid,
  uuid,
  jsonb,
  jsonb
) is
  'Stages a validated CAT/EXAM markbook against its locked roster and generation audit without writing final assessment results.';

commit;
