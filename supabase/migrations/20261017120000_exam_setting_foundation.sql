begin;

-- ============================================================================
-- Exam Bank Foundation (Phase 1)
--
-- Source documents (past papers, trainer notes) -> question bank ->
-- blueprint-driven papers (main + supplementary). Exam papers only: trainers
-- write their own marking schemes, so none are stored or generated here.
--
-- Rules encoded here:
--   * Past questions are never reused verbatim: every generated question keeps
--     lineage (derivation_mode + seed_question_id) and an originality score.
--   * Unapproved questions/papers are visible only to their author and HOD.
--   * Papers are confidential: trainers do not read papers at all in Phase 1.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: is the current user a trainer allocated to this unit?
-- ----------------------------------------------------------------------------
create or replace function public.current_trainer_teaches_unit(requested_unit uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.teaching_allocations as allocation
    where allocation.unit_id = requested_unit
      and allocation.trainer_id = public.current_trainer_id()
  );
$$;

revoke all on function public.current_trainer_teaches_unit(uuid) from public;
grant execute on function public.current_trainer_teaches_unit(uuid) to authenticated;

-- ----------------------------------------------------------------------------
-- 1. Source files: past papers and trainer notes
-- ----------------------------------------------------------------------------
create table if not exists public.exam_source_files (
  id uuid primary key default gen_random_uuid(),

  unit_id uuid not null
    references public.units(id) on delete restrict,

  source_type text not null
    check (source_type in ('past_paper', 'notes', 'format_guide')),

  -- Past papers / schemes: the sitting they belong to.
  exam_year smallint
    check (exam_year is null or exam_year between 2000 and 2100),
  paper_kind text
    check (paper_kind is null or paper_kind in ('main', 'supplementary')),

  -- Read from folder names and the paper cover by the importer.
  series text check (series is null or series in ('JAN-APR', 'MAY-AUG', 'SEP-DEC')),
  trainer_name text,
  unit_code text,                          -- as printed on the paper; mapped to unit_id by HOD
  parse_notes jsonb not null default '[]'::jsonb,  -- trainer errors (marks off-standard), never blocking

  storage_path text not null check (length(trim(storage_path)) > 0),
  original_filename text not null,
  mime_type text,
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),

  -- Parsing is recorded, never silent: failures stay visible and the file is
  -- never deleted because parsing failed.
  parse_status text not null default 'pending'
    check (parse_status in ('pending', 'processing', 'parsed', 'needs_review', 'failed')),
  parse_error text,
  extracted_text text,
  parsed_at timestamptz,

  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exam_source_files_unit_hash_unique unique (unit_id, sha256)
);

create index if not exists exam_source_files_unit_idx
  on public.exam_source_files (unit_id, source_type, exam_year);

-- ----------------------------------------------------------------------------
-- 2. Blueprints: the college-prescribed paper format
-- ----------------------------------------------------------------------------
create table if not exists public.exam_blueprints (
  id uuid primary key default gen_random_uuid(),

  name text not null check (length(trim(name)) > 0),
  programme_id uuid references public.programmes(id) on delete restrict,
  version_number integer not null check (version_number >= 1),

  status text not null default 'draft'
    check (status in ('draft', 'active', 'retired')),

  -- College standard: Section A = 40 marks, Section B = 60 marks (any three of four).
  total_marks smallint not null check (total_marks > 0),
  duration_minutes smallint not null check (duration_minutes > 0),

  -- Cover page text, instructions, and section layout:
  -- { "instructions": [...],
  --   "sections": [ { "label": "A", "title": "...", "question_type": "mcq",
  --                   "question_count": 10, "marks_each": 1,
  --                   "choice": { "answer": 3, "of": 5 } } ] }
  layout jsonb not null default '{}'::jsonb,

  -- Topic-coverage and difficulty targets, filled from outline + history.
  coverage_rules jsonb not null default '{}'::jsonb,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exam_blueprints_name_version_unique unique (name, version_number)
);

-- ----------------------------------------------------------------------------
-- 3. Question bank
-- ----------------------------------------------------------------------------
create table if not exists public.exam_questions (
  id uuid primary key default gen_random_uuid(),

  unit_id uuid not null
    references public.units(id) on delete restrict,

  -- Outline link (topic text is kept even if the outline is revised).
  topic text not null check (length(trim(topic)) > 0),
  learning_outcome text,

  question_type text not null
    check (question_type in ('mcq', 'short_answer', 'structured', 'essay', 'case_study', 'practical')),
  marks smallint not null check (marks > 0),
  difficulty text not null default 'medium'
    check (difficulty in ('easy', 'medium', 'hard')),
  cognitive_level text
    check (cognitive_level is null
      or cognitive_level in ('recall', 'comprehension', 'application', 'analysis')),

  -- Structured body: stem, parts, options, figures.
  body jsonb not null,
  body_text text not null,                 -- flattened text for similarity checks

  -- Lineage. Nothing is reused as-is: 'historical' rows are reference only.
  origin text not null
    check (origin in ('historical', 'generated')),
  derivation_mode text
    check (derivation_mode is null
      or derivation_mode in ('reword', 'rescenario', 'new_from_notes')),
  seed_question_id uuid references public.exam_questions(id) on delete set null,
  source_file_id uuid references public.exam_source_files(id) on delete set null,
  source_passage text,                     -- notes passage used (new_from_notes)
  historical_year smallint,
  historical_paper_kind text
    check (historical_paper_kind is null or historical_paper_kind in ('main', 'supplementary')),

  -- Originality vs every historical question (0 = unrelated, 1 = identical).
  max_similarity numeric(4, 3)
    check (max_similarity is null or max_similarity between 0 and 1),

  status text not null default 'draft'
    check (status in ('draft', 'approved', 'rejected', 'retired')),
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A generated question must say how it was derived.
  constraint exam_questions_generated_lineage_check
    check (origin <> 'generated' or derivation_mode is not null),
  -- A historical question is reference material and can never be 'approved'
  -- for use in a new paper.
  constraint exam_questions_historical_not_usable_check
    check (origin <> 'historical' or status <> 'approved')
);

create index if not exists exam_questions_unit_idx
  on public.exam_questions (unit_id, origin, status, topic);

-- ----------------------------------------------------------------------------
-- 4. Papers (main + supplementary per unit per sitting)
-- ----------------------------------------------------------------------------
create table if not exists public.exam_papers (
  id uuid primary key default gen_random_uuid(),

  unit_id uuid not null references public.units(id) on delete restrict,
  academic_period_id uuid not null references public.academic_periods(id) on delete restrict,
  blueprint_id uuid not null references public.exam_blueprints(id) on delete restrict,

  paper_kind text not null check (paper_kind in ('main', 'supplementary')),

  status text not null default 'draft'
    check (status in ('draft', 'moderated', 'approved', 'locked')),

  total_marks smallint,
  generated_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  locked_at timestamptz,

  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint exam_papers_unit_period_kind_unique
    unique (unit_id, academic_period_id, paper_kind)
);

create table if not exists public.exam_paper_items (
  id uuid primary key default gen_random_uuid(),

  paper_id uuid not null references public.exam_papers(id) on delete cascade,
  question_id uuid references public.exam_questions(id) on delete restrict,

  section_label text not null,
  item_number smallint not null check (item_number > 0),

  -- The planned slot, kept so a single slot can be regenerated.
  slot_spec jsonb not null,
  slot_status text not null default 'planned'
    check (slot_status in ('planned', 'generated', 'needs_review', 'approved')),

  marks smallint check (marks is null or marks > 0),

  constraint exam_paper_items_position_unique
    unique (paper_id, section_label, item_number)
);

-- The same question can never sit in both papers of a sitting; enforced in the
-- engine and backed here per paper.
create unique index if not exists exam_paper_items_question_once_per_paper
  on public.exam_paper_items (paper_id, question_id)
  where question_id is not null;

-- ----------------------------------------------------------------------------
-- 5. Generation jobs (works for an in-app runner or an external worker)
-- ----------------------------------------------------------------------------
create table if not exists public.exam_generation_jobs (
  id uuid primary key default gen_random_uuid(),

  job_type text not null
    check (job_type in ('parse_source', 'tag_questions', 'plan_paper', 'generate_slot', 'export_paper')),

  unit_id uuid references public.units(id) on delete cascade,
  source_file_id uuid references public.exam_source_files(id) on delete cascade,
  paper_id uuid references public.exam_papers(id) on delete cascade,
  paper_item_id uuid references public.exam_paper_items(id) on delete cascade,

  status text not null default 'queued'
    check (status in ('queued', 'running', 'succeeded', 'failed')),
  attempts smallint not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,

  requested_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists exam_generation_jobs_queue_idx
  on public.exam_generation_jobs (status, created_at)
  where status in ('queued', 'running');

-- ----------------------------------------------------------------------------
-- 6. Audit trail (confidentiality: who viewed/exported what)
-- ----------------------------------------------------------------------------
create table if not exists public.exam_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  paper_id uuid references public.exam_papers(id) on delete set null,
  question_id uuid references public.exam_questions(id) on delete set null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Every exam record belongs to one department. Backfill through its owning
-- unit, paper, source or question before enforcing the tenant boundary.
alter table public.exam_source_files add column if not exists department_id uuid
  references public.departments(id) on delete restrict
  default public.current_user_primary_department_id();
alter table public.exam_blueprints add column if not exists department_id uuid
  references public.departments(id) on delete restrict
  default public.current_user_primary_department_id();
alter table public.exam_questions add column if not exists department_id uuid
  references public.departments(id) on delete restrict
  default public.current_user_primary_department_id();
alter table public.exam_papers add column if not exists department_id uuid
  references public.departments(id) on delete restrict
  default public.current_user_primary_department_id();
alter table public.exam_paper_items add column if not exists department_id uuid
  references public.departments(id) on delete restrict
  default public.current_user_primary_department_id();
alter table public.exam_generation_jobs add column if not exists department_id uuid
  references public.departments(id) on delete restrict
  default public.current_user_primary_department_id();
alter table public.exam_audit_log add column if not exists department_id uuid
  references public.departments(id) on delete restrict
  default public.current_user_primary_department_id();

update public.exam_source_files record set department_id = unit.department_id
from public.units unit where unit.id = record.unit_id;
update public.exam_questions record set department_id = unit.department_id
from public.units unit where unit.id = record.unit_id;
update public.exam_papers record set department_id = unit.department_id
from public.units unit where unit.id = record.unit_id;
update public.exam_blueprints record set department_id = programme.department_id
from public.programmes programme
where programme.id = record.programme_id and record.programme_id is not null;
update public.exam_paper_items record set department_id = paper.department_id
from public.exam_papers paper where paper.id = record.paper_id;
update public.exam_generation_jobs job set department_id = coalesce(
  (select unit.department_id from public.units unit where unit.id = job.unit_id),
  (select paper.department_id from public.exam_papers paper where paper.id = job.paper_id),
  (select source.department_id from public.exam_source_files source where source.id = job.source_file_id),
  (select item.department_id from public.exam_paper_items item where item.id = job.paper_item_id),
  job.department_id
);
update public.exam_audit_log record set department_id = coalesce(
  (select paper.department_id from public.exam_papers paper where paper.id = record.paper_id),
  (select question.department_id from public.exam_questions question where question.id = record.question_id),
  record.department_id
);

alter table public.exam_source_files alter column department_id set not null;
alter table public.exam_blueprints alter column department_id set not null;
alter table public.exam_questions alter column department_id set not null;
alter table public.exam_papers alter column department_id set not null;
alter table public.exam_paper_items alter column department_id set not null;
alter table public.exam_generation_jobs alter column department_id set not null;
alter table public.exam_audit_log alter column department_id set not null;

create index if not exists exam_source_files_department_idx
  on public.exam_source_files (department_id, unit_id, source_type, exam_year);
create index if not exists exam_blueprints_department_idx
  on public.exam_blueprints (department_id, status, programme_id);
create index if not exists exam_questions_department_idx
  on public.exam_questions (department_id, unit_id, origin, status, topic);
create index if not exists exam_papers_department_idx
  on public.exam_papers (department_id, unit_id, academic_period_id, status);
create index if not exists exam_generation_jobs_department_idx
  on public.exam_generation_jobs (department_id, status, created_at);
-- ----------------------------------------------------------------------------
-- updated_at maintenance (reuses the project's existing trigger function if
-- present; otherwise defines a local one)
-- ----------------------------------------------------------------------------
create or replace function public.exam_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'exam_source_files', 'exam_blueprints', 'exam_questions', 'exam_papers'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I', t || '_touch', t
    );
    execute format(
      'create trigger %I before update on public.%I
         for each row execute function public.exam_touch_updated_at()',
      t || '_touch', t
    );
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Row level security
-- ----------------------------------------------------------------------------
alter table public.exam_source_files enable row level security;
alter table public.exam_blueprints enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_papers enable row level security;
alter table public.exam_paper_items enable row level security;
alter table public.exam_generation_jobs enable row level security;
alter table public.exam_audit_log enable row level security;

-- HOD / system admin: full control of everything.
do $$
declare
  t text;
begin
  foreach t in array array[
    'exam_source_files', 'exam_blueprints', 'exam_questions', 'exam_papers',
    'exam_paper_items', 'exam_generation_jobs', 'exam_audit_log'
  ]
  loop
    execute format(
      'drop policy if exists %I on public.%I', t || '_hod_all', t
    );
    execute format(
        'create policy %I on public.%I for all to authenticated
         using (public.current_user_can_manage_department(department_id))
         with check (public.current_user_can_manage_department(department_id))',
      t || '_hod_all', t
    );
  end loop;
end;
$$;

-- Trainers: upload notes / past papers and see source files for their units.
drop policy if exists exam_source_files_trainer_read on public.exam_source_files;
create policy exam_source_files_trainer_read
on public.exam_source_files
for select
to authenticated
using (
  public.current_trainer_teaches_unit(unit_id)
  and public.current_user_can_access_department(department_id)
);

drop policy if exists exam_source_files_trainer_insert on public.exam_source_files;
create policy exam_source_files_trainer_insert
on public.exam_source_files
for insert
to authenticated
with check (
  public.current_trainer_teaches_unit(unit_id)
  and public.current_user_can_access_department(department_id)
  and uploaded_by = (select auth.uid())
);

-- Trainers: contribute draft questions for their units and read their own.
drop policy if exists exam_questions_trainer_read_own on public.exam_questions;
create policy exam_questions_trainer_read_own
on public.exam_questions
for select
to authenticated
using (
  public.current_trainer_teaches_unit(unit_id)
  and public.current_user_can_access_department(department_id)
  and created_by = (select auth.uid())
);

drop policy if exists exam_questions_trainer_insert on public.exam_questions;
create policy exam_questions_trainer_insert
on public.exam_questions
for insert
to authenticated
with check (
  public.current_trainer_teaches_unit(unit_id)
  and public.current_user_can_access_department(department_id)
  and created_by = (select auth.uid())
  and origin = 'generated'
  and status = 'draft'
);

-- Blueprints are readable by any signed-in staff so papers render consistently.
drop policy if exists exam_blueprints_active_read on public.exam_blueprints;
create policy exam_blueprints_active_read
on public.exam_blueprints
for select
to authenticated
using (
  status = 'active'
  and public.current_user_can_access_department(department_id)
);

-- Papers, paper items, jobs and the audit log: HOD / admin only (policy above).

commit;
