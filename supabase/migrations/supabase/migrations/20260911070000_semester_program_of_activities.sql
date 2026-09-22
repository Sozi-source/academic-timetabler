begin;

-- ============================================================================
-- Semester Program of Activities
--
-- Official semester activities (Orientation, CAT 1, CAT 2, Revision,
-- End of Term Final Examination) anchored to Academic Periods with
-- institutional TVET defaults.
-- ============================================================================

create table if not exists public.semester_program_activities (
  id uuid primary key default gen_random_uuid(),

  academic_period_id uuid
    references public.academic_periods(id)
    on delete cascade,

  week_number smallint not null
    check (week_number between 1 and 20),

  activity_type text not null
    check (
      activity_type in (
        'instruction',
        'cat',
        'exam',
        'revision',
        'orientation',
        'remedial',
        'other'
      )
    ),

  title text not null
    check (length(trim(title)) > 0),

  description text,

  is_teaching_week boolean not null default false,

  learning_outcomes text,

  learning_activities text,

  assessment_remarks text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique index per period (or institutional default when academic_period_id is null) per week and activity_type
create unique index if not exists semester_program_activities_period_week_type_idx
  on public.semester_program_activities (
    coalesce(academic_period_id, '00000000-0000-0000-0000-000000000000'::uuid),
    week_number,
    activity_type
  );

create index if not exists semester_program_activities_period_idx
  on public.semester_program_activities (
    academic_period_id,
    week_number asc
  );

comment on table public.semester_program_activities is
  'Official semester schedule of activities (CAT weeks, Revision, Exams) integrated into Course Outlines, Schemes of Work, and Records of Work.';

-- Enable RLS
alter table public.semester_program_activities enable row level security;

-- Read policy: authenticated users can read all semester program activities
drop policy if exists semester_program_activities_read on public.semester_program_activities;
create policy semester_program_activities_read
  on public.semester_program_activities
  for select
  to authenticated
  using (true);

-- Manage policy: HODs, Admins, and Academic Managers can insert/update/delete
drop policy if exists semester_program_activities_manage on public.semester_program_activities;
create policy semester_program_activities_manage
  on public.semester_program_activities
  for all
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role::text in ('system_admin', 'admin', 'hod', 'dean', 'principal')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role::text in ('system_admin', 'admin', 'hod', 'dean', 'principal')
    )
  );

-- Seed institutional default activities (academic_period_id is null)
insert into public.semester_program_activities (
  academic_period_id,
  week_number,
  activity_type,
  title,
  description,
  is_teaching_week,
  learning_outcomes,
  learning_activities,
  assessment_remarks
) values
  (
    null,
    1,
    'orientation',
    'Term Commencement & Course Introduction',
    'Trainee orientation, course outline distribution, learning contract, diagnostic assessment.',
    true,
    'Understand course expectations, syllabus structure, assessment criteria, and foundational concepts.',
    'Interactive lecture · Syllabus review · Diagnostic brainstorm · Question & Answer',
    'Formative Diagnostic Assessment'
  ),
  (
    null,
    5,
    'cat',
    'Continuous Assessment Test 1 (RAT 1)',
    'Continuous Assessment Test 1 (Readiness / Progressive Evaluation) - 15 Marks.',
    false,
    'Evaluate trainee mastery and comprehension of competencies covered in Weeks 1 to 4.',
    'Administration of Continuous Assessment Test 1 · Supervised individual testing · Script collection',
    'Continuous Assessment Test 1 (15 Marks)'
  ),
  (
    null,
    8,
    'cat',
    'Mid-Term Continuous Assessment Test (CAT 2)',
    'Mid-Term Examination / Continuous Assessment Test 2 - 15 Marks.',
    false,
    'Assess comprehensive theoretical and practical competencies covered across Weeks 1 to 7.',
    'Administration of Mid-Term CAT · Supervised examination · Plenary review',
    'Mid-Term CAT (15 Marks)'
  ),
  (
    null,
    13,
    'revision',
    'Comprehensive Syllabus Revision & Tutorial Clinic',
    'Intensive course review, past examination paper analysis, remedial tutorials.',
    true,
    'Synthesize course principles, resolve complex competency areas, prepare for final summative evaluation.',
    'Comprehensive syllabus recap · Revision tutorials · Group problem-solving · Past paper drills',
    'Remedial Consultations & Formative Revision'
  ),
  (
    null,
    14,
    'exam',
    'End of Term Examinations / Summative Evaluation',
    'Institutional End of Term Examinations & TVET CDACC Competency Assessments - 70 Marks.',
    false,
    'Demonstrate overall theoretical and practical competence as per TVET national curriculum standards.',
    'Supervised End of Term Summative Examinations · Practical assessments · Script marking',
    'Final Summative Examination (70 Marks)'
  )
on conflict do nothing;

commit;
