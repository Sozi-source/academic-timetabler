begin;

-- ============================================================================
-- Assessment Core Foundation V1 - schema compatibility revision
--
-- IMPORTANT:
-- Existing assessment tables already contain institution-specific enum columns.
-- This migration deliberately leaves them untouched and introduces namespaced
-- operational fields for the new CAT / EXAM workflow.
-- ============================================================================

alter table public.assessment_events
  add column if not exists operational_assessment_type text,
  add column if not exists operational_workflow_status text,
  add column if not exists population_generated_at timestamptz,
  add column if not exists population_locked_at timestamptz,
  add column if not exists marks_submitted_at timestamptz,
  add column if not exists finalised_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists template_version text,
  add column if not exists external_reference text;

alter table public.assessment_events
  drop constraint if exists assessment_events_operational_assessment_type_check;

alter table public.assessment_events
  add constraint assessment_events_operational_assessment_type_check
  check (
    operational_assessment_type is null
    or operational_assessment_type in ('cat', 'exam')
  );

alter table public.assessment_events
  drop constraint if exists assessment_events_operational_workflow_status_check;

alter table public.assessment_events
  add constraint assessment_events_operational_workflow_status_check
  check (
    operational_workflow_status is null
    or operational_workflow_status in (
      'draft',
      'generated',
      'open',
      'submitted',
      'finalised',
      'archived'
    )
  );

alter table public.assessment_events
  drop constraint if exists assessment_events_template_version_length_check;

alter table public.assessment_events
  add constraint assessment_events_template_version_length_check
  check (
    template_version is null
    or char_length(trim(template_version)) between 1 and 50
  );

create index if not exists assessment_events_operational_type_period_idx
  on public.assessment_events (
    operational_assessment_type,
    academic_period_id
  )
  where operational_assessment_type is not null;

create index if not exists assessment_events_operational_workflow_idx
  on public.assessment_events (
    operational_workflow_status
  )
  where operational_workflow_status is not null;

comment on column public.assessment_events.operational_assessment_type is
  'CAT/EXAM type used by the Academic Planner operational assessment workflow. Existing institutional assessment-type fields remain untouched.';

comment on column public.assessment_events.operational_workflow_status is
  'Academic Planner workflow lifecycle: draft, generated, open, submitted, finalised, archived.';

comment on column public.assessment_events.population_generated_at is
  'Timestamp when the registered-student assessment roster snapshot was generated.';

comment on column public.assessment_events.population_locked_at is
  'Timestamp after which the assessment roster must not silently change.';

comment on column public.assessment_events.marks_submitted_at is
  'Timestamp when the trainer submitted the markbook/results.';

comment on column public.assessment_events.finalised_at is
  'Timestamp when departmental review accepted the results.';

comment on column public.assessment_events.published_at is
  'Timestamp when finalised results were released for downstream/student visibility.';

comment on column public.assessment_events.template_version is
  'Institutional CAT/EXAM workbook template version.';

comment on column public.assessment_events.external_reference is
  'Optional future ERP or other external-system reference.';

-- ----------------------------------------------------------------------------
-- Dedicated assessment roster
--
-- The existing assessment_population table has its own enum-based attendance
-- semantics. It is preserved unchanged. The new roster owns the pre-markbook
-- Expected / Absent snapshot required for CAT and EXAM workbook generation.
-- ----------------------------------------------------------------------------

create table if not exists public.assessment_roster (
  id uuid primary key default gen_random_uuid(),

  assessment_id uuid not null
    references public.assessment_events(id)
    on delete cascade,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  cohort_id uuid
    references public.cohorts(id)
    on delete restrict,

  academic_period_id uuid not null
    references public.academic_periods(id)
    on delete restrict,

  unit_id uuid not null
    references public.units(id)
    on delete restrict,

  snapshot_registration_status text,

  pre_assessment_status text
    not null
    default 'expected',

  pre_assessment_marked_at timestamptz,

  pre_assessment_marked_by uuid
    references auth.users(id)
    on delete set null,

  snapshot_created_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint assessment_roster_pre_assessment_status_check
    check (
      pre_assessment_status in (
        'expected',
        'absent'
      )
    ),

  constraint assessment_roster_assessment_student_unique
    unique (
      assessment_id,
      student_id
    )
);

create index if not exists assessment_roster_assessment_idx
  on public.assessment_roster (
    assessment_id
  );

create index if not exists assessment_roster_student_idx
  on public.assessment_roster (
    student_id
  );

create index if not exists assessment_roster_period_unit_idx
  on public.assessment_roster (
    academic_period_id,
    unit_id
  );

create index if not exists assessment_roster_pre_status_idx
  on public.assessment_roster (
    pre_assessment_status
  );

comment on table public.assessment_roster is
  'Immutable-ready CAT/EXAM population snapshot generated from registered students before markbook and signing-sheet generation.';

comment on column public.assessment_roster.pre_assessment_status is
  'Everyone is expected by default. Only confirmed assessment absences are explicitly marked absent.';

-- ----------------------------------------------------------------------------
-- Results extension
--
-- Existing result-status enums are intentionally not repurposed.
-- ----------------------------------------------------------------------------

alter table public.assessment_results
  add column if not exists operational_result_status text,
  add column if not exists imported_at timestamptz,
  add column if not exists import_source text;

alter table public.assessment_results
  drop constraint if exists assessment_results_operational_result_status_check;

alter table public.assessment_results
  add constraint assessment_results_operational_result_status_check
  check (
    operational_result_status is null
    or operational_result_status in (
      'pending',
      'sat',
      'absent',
      'missing_mark'
    )
  );

alter table public.assessment_results
  drop constraint if exists assessment_results_import_source_check;

alter table public.assessment_results
  add constraint assessment_results_import_source_check
  check (
    import_source is null
    or import_source in (
      'excel',
      'online'
    )
  );

create index if not exists assessment_results_operational_status_idx
  on public.assessment_results (
    operational_result_status
  )
  where operational_result_status is not null;

comment on column public.assessment_results.operational_result_status is
  'Academic Planner result state. Numeric score normally uses sat; absent and missing_mark remain explicit and separate.';

comment on column public.assessment_results.import_source is
  'Shared result pipeline source: excel now, online later.';

commit;