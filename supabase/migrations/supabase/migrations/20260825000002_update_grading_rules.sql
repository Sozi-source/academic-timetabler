-- Migration: Update online marks submission to use 'F' for fail grades (< 40)
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
      else 'F'
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
