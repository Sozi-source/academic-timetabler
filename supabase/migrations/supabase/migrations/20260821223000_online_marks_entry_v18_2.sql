begin;

-- ============================================================================
-- Online Marks Entry V18.2
--
-- Browser entry mirrors the existing institutional Excel final mark sheet:
--
--   Assignment /5
--   Presentation / Practical /10
--   RAT /15
--   CAT /15
--   End Term Exam /70
--
-- RAT + CAT are averaged into one /15 coursework contribution.
-- Final total = Assignment + Presentation + AVG(RAT, CAT) + Exam = /100.
--
-- The existing Excel workbook is NOT altered by this migration.
-- ============================================================================

create table if not exists public.assessment_online_mark_drafts (
  id uuid primary key
    default gen_random_uuid(),

  assessment_id uuid not null
    references public.assessment_events(id)
    on delete cascade,

  student_id uuid not null
    references public.students(id)
    on delete restrict,

  cohort_id uuid
    references public.cohorts(id)
    on delete restrict,

  assignment_mark numeric,
  presentation_mark numeric,
  rat_mark numeric,
  cat_mark numeric,
  exam_mark numeric,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint assessment_online_mark_drafts_assignment_check
    check (
      assignment_mark is null
      or (
        assignment_mark >= 0
        and assignment_mark <= 5
      )
    ),

  constraint assessment_online_mark_drafts_presentation_check
    check (
      presentation_mark is null
      or (
        presentation_mark >= 0
        and presentation_mark <= 10
      )
    ),

  constraint assessment_online_mark_drafts_rat_check
    check (
      rat_mark is null
      or (
        rat_mark >= 0
        and rat_mark <= 15
      )
    ),

  constraint assessment_online_mark_drafts_cat_check
    check (
      cat_mark is null
      or (
        cat_mark >= 0
        and cat_mark <= 15
      )
    ),

  constraint assessment_online_mark_drafts_exam_check
    check (
      exam_mark is null
      or (
        exam_mark >= 0
        and exam_mark <= 70
      )
    ),

  constraint assessment_online_mark_drafts_assessment_student_unique
    unique (
      assessment_id,
      student_id
    )
);

create index if not exists
  assessment_online_mark_drafts_assessment_idx
on public.assessment_online_mark_drafts (
  assessment_id,
  updated_at desc
);

create table if not exists public.assessment_online_mark_submissions (
  id uuid primary key
    default gen_random_uuid(),

  assessment_id uuid not null
    references public.assessment_events(id)
    on delete restrict,

  submitted_by uuid
    references auth.users(id)
    on delete set null,

  submitted_at timestamptz not null
    default now(),

  result_count integer not null
    check (
      result_count >= 0
    ),

  absent_count integer not null
    check (
      absent_count >= 0
    ),

  constraint assessment_online_mark_submissions_assessment_unique
    unique (
      assessment_id
    )
);

alter table public.assessment_online_mark_drafts
  enable row level security;

alter table public.assessment_online_mark_submissions
  enable row level security;

drop policy if exists
  assessment_online_mark_drafts_hod_read
on public.assessment_online_mark_drafts;

create policy assessment_online_mark_drafts_hod_read
on public.assessment_online_mark_drafts
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
  assessment_online_mark_drafts_trainer_read
on public.assessment_online_mark_drafts;

create policy assessment_online_mark_drafts_trainer_read
on public.assessment_online_mark_drafts
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    assessment_id
  )
);

drop policy if exists
  assessment_online_mark_submissions_hod_read
on public.assessment_online_mark_submissions;

create policy assessment_online_mark_submissions_hod_read
on public.assessment_online_mark_submissions
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
  assessment_online_mark_submissions_trainer_read
on public.assessment_online_mark_submissions;

create policy assessment_online_mark_submissions_trainer_read
on public.assessment_online_mark_submissions
for select
to authenticated
using (
  public.trainer_can_access_assessment(
    assessment_id
  )
);

grant select
on public.assessment_online_mark_drafts,
   public.assessment_online_mark_submissions
to authenticated;

-- ----------------------------------------------------------------------------
-- Save browser drafts.
--
-- JSON entry shape:
-- {
--   "student_id": "<uuid>",
--   "assignment": 5,
--   "presentation": 10,
--   "rat": 12,
--   "cat": 14,
--   "exam": 60
-- }
--
-- Every mark may be null while the trainer is still drafting.
-- Exam must remain null for a student already marked absent in the locked roster.
-- ----------------------------------------------------------------------------

create or replace function public.save_assessment_online_marks(
  target_assessment_id uuid,
  target_entries jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status text;
  target_type text;
  target_locked_at timestamptz;
  target_period_id uuid;
  target_unit_id uuid;
  configured_maximum numeric;
  entry_count integer := 0;
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
      'This assessment is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  if target_entries is null
     or jsonb_typeof(
       target_entries
     ) <> 'array'
  then
    raise exception
      'Online marks payload must be an array.'
      using errcode = '22023';
  end if;

  select
    workspace.workflow_status,
    workspace.assessment_type,
    workspace.population_locked_at,
    workspace.academic_period_id,
    workspace.unit_id
  into
    target_status,
    target_type,
    target_locked_at,
    target_period_id,
    target_unit_id
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_type <> 'exam' then
    raise exception
      'The five-field online mark sheet is available for the final Exam assessment.'
      using errcode = '23514';
  end if;

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment no longer accepts editable marks.'
      using errcode = '23514';
  end if;

  if target_locked_at is null then
    raise exception
      'Lock the assessment roster before entering marks online.'
      using errcode = '23514';
  end if;

  select
    rule.maximum_mark
  into
    configured_maximum
  from public.assessment_rules
    as rule
  where rule.academic_period_id =
      target_period_id
    and rule.unit_id =
      target_unit_id
    and rule.assessment_type =
      'exam';

  if not found then
    raise exception
      'Configure the final assessment rule before entering marks.'
      using errcode = '23514';
  end if;

  if configured_maximum <> 100 then
    raise exception
      'The final Exam assessment maximum must be configured as 100 because coursework and exam components total 100.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessment_results
      as result
    where result.assessment_event_id =
      target_assessment_id
  ) then
    raise exception
      'Committed results already exist for this assessment. Online drafts were not changed.'
      using errcode = '23505';
  end if;

  with parsed as (
    select
      item.student_id,
      item.assignment,
      item.presentation,
      item.rat,
      item.cat,
      item.exam
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
  )
  select count(*)::integer
  into entry_count
  from parsed;

  if (
    select count(*)::integer
    from (
      select distinct
        item.student_id
      from jsonb_to_recordset(
        target_entries
      ) as item(
        student_id uuid,
        assignment numeric,
        presentation numeric,
        rat numeric,
        cat numeric,
        exam numeric
      )
    ) as distinct_students
  ) <> entry_count
  then
    raise exception
      'Duplicate students were found in the online marks payload.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
    where item.student_id is null
      or item.assignment < 0
      or item.assignment > 5
      or item.presentation < 0
      or item.presentation > 10
      or item.rat < 0
      or item.rat > 15
      or item.cat < 0
      or item.cat > 15
      or item.exam < 0
      or item.exam > 70
  ) then
    raise exception
      'One or more online marks are outside the institutional component limits.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
    where not exists (
      select 1
      from public.assessment_roster
        as roster
      where roster.assessment_id =
          target_assessment_id
        and roster.student_id =
          item.student_id
    )
  ) then
    raise exception
      'Online marks may only reference students in the locked assessment roster.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(
      target_entries
    ) as item(
      student_id uuid,
      assignment numeric,
      presentation numeric,
      rat numeric,
      cat numeric,
      exam numeric
    )
    join public.assessment_roster
      as roster
      on roster.assessment_id =
         target_assessment_id
     and roster.student_id =
         item.student_id
    where roster.pre_assessment_status =
        'absent'
      and item.exam is not null
  ) then
    raise exception
      'A student marked absent must retain AB for the Exam component.'
      using errcode = '23514';
  end if;

  insert into public.assessment_online_mark_drafts (
    assessment_id,
    student_id,
    cohort_id,
    assignment_mark,
    presentation_mark,
    rat_mark,
    cat_mark,
    exam_mark,
    updated_by,
    updated_at
  )
  select
    target_assessment_id,
    item.student_id,
    roster.cohort_id,
    item.assignment,
    item.presentation,
    item.rat,
    item.cat,
    case
      when roster.pre_assessment_status =
        'absent'
      then null
      else item.exam
    end,
    auth.uid(),
    now()
  from jsonb_to_recordset(
    target_entries
  ) as item(
    student_id uuid,
    assignment numeric,
    presentation numeric,
    rat numeric,
    cat numeric,
    exam numeric
  )
  join public.assessment_roster
    as roster
    on roster.assessment_id =
       target_assessment_id
   and roster.student_id =
       item.student_id
  on conflict (
    assessment_id,
    student_id
  )
  do update set
    cohort_id =
      excluded.cohort_id,
    assignment_mark =
      excluded.assignment_mark,
    presentation_mark =
      excluded.presentation_mark,
    rat_mark =
      excluded.rat_mark,
    cat_mark =
      excluded.cat_mark,
    exam_mark =
      excluded.exam_mark,
    updated_by =
      auth.uid(),
    updated_at =
      now();

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'status',
    'draft',
    'savedCount',
    entry_count
  );
end;
$$;

revoke all
on function public.save_assessment_online_marks(
  uuid,
  jsonb
)
from public;

grant execute
on function public.save_assessment_online_marks(
  uuid,
  jsonb
)
to authenticated;

-- ----------------------------------------------------------------------------
-- Submit browser marks to the canonical assessment_results table.
--
-- Coursework is required for every roster student.
-- Exam is required only for expected students; absent students remain AB.
-- Existing results are never overwritten.
-- ----------------------------------------------------------------------------

create or replace function public.submit_assessment_online_marks(
  target_assessment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_status text;
  target_type text;
  target_locked_at timestamptz;
  target_period_id uuid;
  target_unit_id uuid;
  configured_maximum numeric;
  expected_count integer := 0;
  absent_count integer := 0;
  result_count integer := 0;
  submission_id uuid;
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
      'This assessment is outside your Teaching Allocations.'
      using errcode = '42501';
  end if;

  select
    workspace.workflow_status,
    workspace.assessment_type,
    workspace.population_locked_at,
    workspace.academic_period_id,
    workspace.unit_id
  into
    target_status,
    target_type,
    target_locked_at,
    target_period_id,
    target_unit_id
  from public.assessment_event_workspace
    as workspace
  where workspace.id =
    target_assessment_id
  for update;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  if target_type <> 'exam' then
    raise exception
      'The five-field online mark sheet is available for the final Exam assessment.'
      using errcode = '23514';
  end if;

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment has already left editable marks entry.'
      using errcode = '23514';
  end if;

  if target_locked_at is null then
    raise exception
      'Lock the assessment roster before submitting marks.'
      using errcode = '23514';
  end if;

  select
    rule.maximum_mark
  into
    configured_maximum
  from public.assessment_rules
    as rule
  where rule.academic_period_id =
      target_period_id
    and rule.unit_id =
      target_unit_id
    and rule.assessment_type =
      'exam';

  if not found
     or configured_maximum <> 100
  then
    raise exception
      'The final Exam assessment maximum must be configured as 100 before submission.'
      using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.assessment_results
      as result
    where result.assessment_event_id =
      target_assessment_id
  ) then
    raise exception
      'Committed results already exist for this assessment. Existing academic results were not overwritten.'
      using errcode = '23505';
  end if;

  select
    count(*) filter (
      where roster.pre_assessment_status =
        'expected'
    )::integer,
    count(*) filter (
      where roster.pre_assessment_status =
        'absent'
    )::integer
  into
    expected_count,
    absent_count
  from public.assessment_roster
    as roster
  where roster.assessment_id =
    target_assessment_id;

  if (
    expected_count +
    absent_count
  ) = 0
  then
    raise exception
      'The assessment roster is empty.'
      using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.assessment_roster
      as roster
    left join public.assessment_online_mark_drafts
      as draft
      on draft.assessment_id =
         roster.assessment_id
     and draft.student_id =
         roster.student_id
    where roster.assessment_id =
        target_assessment_id
      and (
        draft.student_id is null
        or draft.assignment_mark is null
        or draft.presentation_mark is null
        or draft.rat_mark is null
        or draft.cat_mark is null
        or (
          roster.pre_assessment_status =
            'expected'
          and draft.exam_mark is null
        )
        or (
          roster.pre_assessment_status =
            'absent'
          and draft.exam_mark is not null
        )
      )
  ) then
    raise exception
      'Missing marks remain. Assignment, Presentation, RAT and CAT are required for every student; Exam is required for students expected to sit.'
      using errcode = '23514';
  end if;

  insert into public.assessment_results (
    assessment_event_id,
    student_id,
    cohort_id,
    component_marks,
    total_mark,
    grade,
    comment,
    operational_mark,
    operational_result_status,
    import_source,
    imported_at,
    source_markbook_batch_id,
    source_workbook_row
  )
  select
    roster.assessment_id,
    roster.student_id,
    roster.cohort_id,
    jsonb_build_object(
      'assignment',
      draft.assignment_mark,
      'presentation',
      draft.presentation_mark,
      'rat',
      draft.rat_mark,
      'cat1',
      draft.cat_mark,
      'ratCatAverage',
      (
        draft.rat_mark +
        draft.cat_mark
      ) / 2,
      'coursework',
      draft.assignment_mark +
      draft.presentation_mark +
      (
        (
          draft.rat_mark +
          draft.cat_mark
        ) / 2
      ),
      'exam',
      draft.exam_mark
    ),
    case
      when roster.pre_assessment_status =
        'absent'
      then null
      else
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
    end,
    case
      when roster.pre_assessment_status =
        'absent'
      then null
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 75
      then 'A'
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 65
      then 'B'
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 50
      then 'C'
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 40
      then 'D'
      else 'E'
    end,
    case
      when roster.pre_assessment_status =
        'absent'
      then 'ABSENT'
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 75
      then 'DISTINCTION'
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 65
      then 'CREDIT'
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 50
      then 'SATISFACTORY'
      when (
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
      ) >= 40
      then 'PASS'
      else 'FAIL'
    end,
    case
      when roster.pre_assessment_status =
        'absent'
      then null
      else
        draft.assignment_mark +
        draft.presentation_mark +
        (
          (
            draft.rat_mark +
            draft.cat_mark
          ) / 2
        ) +
        draft.exam_mark
    end,
    case
      when roster.pre_assessment_status =
        'absent'
      then 'absent'
      else 'sat'
    end,
    'online',
    now(),
    null,
    null
  from public.assessment_roster
    as roster
  join public.assessment_online_mark_drafts
    as draft
    on draft.assessment_id =
       roster.assessment_id
   and draft.student_id =
       roster.student_id
  where roster.assessment_id =
    target_assessment_id
  order by
    roster.student_id;

  get diagnostics result_count =
    row_count;

  if result_count <>
       (
         expected_count +
         absent_count
       )
  then
    raise exception
      'Online result count did not match the locked assessment roster.'
      using errcode = '23514';
  end if;

  update public.assessment_events
  set
    operational_workflow_status =
      'submitted',
    marks_submitted_at =
      coalesce(
        marks_submitted_at,
        now()
      )
  where id =
    target_assessment_id;

  insert into public.assessment_online_mark_submissions (
    assessment_id,
    submitted_by,
    result_count,
    absent_count
  )
  values (
    target_assessment_id,
    auth.uid(),
    result_count,
    absent_count
  )
  returning id
  into submission_id;

  return jsonb_build_object(
    'assessmentId',
    target_assessment_id,
    'submissionId',
    submission_id,
    'status',
    'submitted',
    'resultCount',
    result_count,
    'expectedCount',
    expected_count,
    'absentCount',
    absent_count
  );
end;
$$;

revoke all
on function public.submit_assessment_online_marks(uuid)
from public;

grant execute
on function public.submit_assessment_online_marks(uuid)
to authenticated;

comment on table public.assessment_online_mark_drafts is
  'Trainer browser drafts mirroring the institutional final Excel mark sheet: Assignment /5, Presentation /10, RAT /15, CAT /15 and Exam /70.';

comment on function public.save_assessment_online_marks(uuid, jsonb) is
  'Saves validated five-field browser mark drafts without altering the existing Excel mark sheet or committed assessment results.';

comment on function public.submit_assessment_online_marks(uuid) is
  'Commits complete five-field online marks using Assignment + Presentation + AVG(RAT,CAT) + Exam = /100 with import_source online.';

commit;
