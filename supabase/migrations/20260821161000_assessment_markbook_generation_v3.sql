begin;

-- ============================================================================
-- Assessment Markbook Generation V3
--
-- One unit workbook may contain multiple cohort sheets.
-- The roster is locked on first workbook generation and subsequent downloads
-- reproduce that same snapshot. Excel entry now and online entry later use the
-- same assessment result pipeline.
-- ============================================================================

create table if not exists public.assessment_markbook_generations (
  id uuid primary key,

  root_assessment_id uuid not null
    references public.assessment_events(id)
    on delete restrict,

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  assessment_type text not null,

  template_version text not null,

  filename text not null,

  sha256 text not null,

  cohort_count integer not null,
  student_count integer not null,
  absent_count integer not null,

  generated_by uuid
    references auth.users(id)
    on delete set null
    default auth.uid(),

  generated_at timestamptz
    not null
    default now(),

  constraint assessment_markbook_generations_type_check
    check (
      assessment_type in (
        'cat',
        'exam'
      )
    ),

  constraint assessment_markbook_generations_template_length_check
    check (
      char_length(trim(template_version))
      between 1 and 50
    ),

  constraint assessment_markbook_generations_filename_length_check
    check (
      char_length(trim(filename))
      between 1 and 255
    ),

  constraint assessment_markbook_generations_sha256_check
    check (
      sha256 ~ '^[0-9a-f]{64}$'
    ),

  constraint assessment_markbook_generations_counts_check
    check (
      cohort_count >= 1
      and student_count >= 1
      and absent_count >= 0
      and absent_count <= student_count
    )
);

create index if not exists assessment_markbook_generations_root_idx
  on public.assessment_markbook_generations (
    root_assessment_id,
    generated_at desc
  );

create index if not exists assessment_markbook_generations_period_unit_idx
  on public.assessment_markbook_generations (
    academic_period_id,
    unit_id,
    assessment_type
  );

alter table public.assessment_markbook_generations
  enable row level security;

comment on table public.assessment_markbook_generations is
  'Immutable audit log for generated CAT/EXAM Excel markbooks. The workbook itself is reproducible from the locked assessment roster.';

-- ----------------------------------------------------------------------------
-- Set CAT / Exam operational type before locking the roster.
-- ----------------------------------------------------------------------------

create or replace function public.set_operational_assessment_type(
  target_assessment_id uuid,
  target_assessment_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_locked_at timestamptz;
  target_status text;
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
      'Only an authorized HOD or system administrator may set the assessment type at this stage.'
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

  select
    population_locked_at,
    operational_workflow_status
  into
    target_locked_at,
    target_status
  from public.assessment_events
  where id = target_assessment_id
  for update;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_locked_at is not null
     or target_status in (
       'submitted',
       'finalised',
       'archived'
     )
  then
    raise exception
      'Assessment type cannot be changed after the markbook roster is locked.'
      using errcode = '23514';
  end if;

  update public.assessment_events
  set
    operational_assessment_type =
      target_assessment_type,
    operational_workflow_status =
      coalesce(
        operational_workflow_status,
        'draft'
      )
  where id = target_assessment_id;

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'assessmentType',
    target_assessment_type
  );
end;
$$;

revoke all
on function public.set_operational_assessment_type(uuid, text)
from public;

grant execute
on function public.set_operational_assessment_type(uuid, text)
to authenticated;

-- ----------------------------------------------------------------------------
-- Lock the unit/type markbook bundle.
--
-- All assessment events for the same Academic Period + unit + CAT/Exam type
-- that already have roster rows are locked together. This supports one unit
-- workbook containing several cohort sheets.
-- ----------------------------------------------------------------------------

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

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may generate a markbook at this stage.'
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

revoke all
on function public.lock_assessment_markbook_bundle(uuid)
from public;

grant execute
on function public.lock_assessment_markbook_bundle(uuid)
to authenticated;

-- ----------------------------------------------------------------------------
-- Record the generated workbook after the application computes its SHA-256.
-- ----------------------------------------------------------------------------

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

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may record markbook generation at this stage.'
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

revoke all
on function public.record_assessment_markbook_generation(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer
)
from public;

grant execute
on function public.record_assessment_markbook_generation(
  uuid,
  uuid,
  text,
  text,
  text,
  integer,
  integer,
  integer
)
to authenticated;

commit;
