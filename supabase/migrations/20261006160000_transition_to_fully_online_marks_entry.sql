begin;

-- ============================================================================
-- Transition to Fully Online Marks Entry & Export V1
--
-- 1. Clears legacy Excel import data & staging tables (e.g. stale null results)
-- 2. Initializes all assessment events into operational exam workflow
-- 3. Configures 100-mark assessment rules and candidate rosters
-- 4. Updates online marks RPCs so trainers can save, submit, and export marks
--    without manual roster locking or roadblock exceptions.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Data Cleanup: Clear stale/empty legacy results & old Excel staging
-- ----------------------------------------------------------------------------

-- Remove obsolete / incomplete results from old Excel imports (including Guyo Halkano Diqa)
delete from public.assessment_results
where total_mark is null
   or import_source is null
   or import_source = 'excel'
   or source_batch_id is not null
   or source_markbook_batch_id is not null;

-- Clean up old Excel staging rows and batches if tables exist
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'assessment_mark_import_rows' and table_schema = 'public') then
    truncate table public.assessment_mark_import_rows cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'assessment_mark_import_batches' and table_schema = 'public') then
    truncate table public.assessment_mark_import_batches cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'assessment_markbook_staged_rows' and table_schema = 'public') then
    truncate table public.assessment_markbook_staged_rows cascade;
  end if;
  if exists (select 1 from information_schema.tables where table_name = 'assessment_markbook_import_batches' and table_schema = 'public') then
    truncate table public.assessment_markbook_import_batches cascade;
  end if;
end $$;

-- Drop obsolete RPCs from old Excel upload/staging workflow
drop function if exists public.stage_assessment_markbook(uuid, text, text, jsonb, jsonb);
drop function if exists public.validate_assessment_markbook(uuid, text, text, jsonb);
drop function if exists public.commit_assessment_markbook_import(uuid);
drop function if exists public.commit_assessment_mark_import(uuid);
drop function if exists public.commit_assessment_mark_import_batch(uuid);
drop function if exists public.stage_assessment_marks_import(uuid, text, jsonb);

-- ----------------------------------------------------------------------------
-- 2. Normalize Assessment Events for Online Marks Workflow
-- ----------------------------------------------------------------------------

-- Upgrade validate_assessment_event so it does not block migrations or superuser updates (auth.uid() is null)
create or replace function public.validate_assessment_event()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_unit public.units%rowtype;
  selected_programme public.programmes%rowtype;
  selected_cohort public.cohorts%rowtype;
begin
  select * into selected_unit from public.units where id = new.unit_id;
  if selected_unit.id is null then
    raise exception using errcode = 'P0002', message = 'Assessment unit not found';
  end if;

  select * into selected_programme from public.programmes where id = selected_unit.programme_id;
  if selected_programme.id is null or selected_programme.department_id <> new.department_id then
    raise exception using errcode = '23514', message = 'Assessment unit must belong to the selected department';
  end if;

  if new.cohort_id is not null then
    select * into selected_cohort from public.cohorts where id = new.cohort_id;
    if selected_cohort.id is null or selected_cohort.programme_id <> selected_unit.programme_id then
      raise exception using errcode = '23514', message = 'Assessment cohort must belong to the unit programme';
    end if;
  end if;

  -- Enforce department authorization only when an interactive authenticated user is present
  if auth.uid() is not null and not (
    public.current_user_can_manage_department(new.department_id)
    or public.assessment_actor_can_manage_assessment(new.id)
  ) then
    raise exception using errcode = '42501', message = 'Not permitted to manage this assessment';
  end if;

  new.title = trim(coalesce(new.title, 'Unit Markbook'));
  new.notes = nullif(trim(coalesce(new.notes, '')), '');
  new.updated_at = now();
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

alter table public.assessment_events disable trigger assessment_events_validate;

update public.assessment_events
set
  operational_assessment_type = 'exam',
  operational_workflow_status = case
    when operational_workflow_status in ('submitted', 'finalised', 'archived') then operational_workflow_status
    else 'open'
  end,
  population_locked_at = coalesce(population_locked_at, now()),
  max_mark = 100,
  pass_mark = 40,
  title = coalesce(title, 'Unit Markbook')
where operational_assessment_type is null
   or operational_workflow_status is null
   or population_locked_at is null;

alter table public.assessment_events enable trigger assessment_events_validate;

-- ----------------------------------------------------------------------------
-- 3. Ensure Assessment Rules exist for every Unit (Maximum 100, Pass 40)
-- ----------------------------------------------------------------------------

insert into public.assessment_rules (
  academic_period_id,
  unit_id,
  assessment_type,
  maximum_mark,
  pass_mark
)
select distinct
  ae.academic_period_id,
  ae.unit_id,
  'exam',
  100,
  40
from public.assessment_events ae
where ae.academic_period_id is not null
  and ae.unit_id is not null
on conflict (academic_period_id, unit_id, assessment_type)
do update set
  maximum_mark = 100,
  pass_mark = 40;

-- Also ensure rules exist for all units with active teaching allocations
insert into public.assessment_rules (
  academic_period_id,
  unit_id,
  assessment_type,
  maximum_mark,
  pass_mark
)
select distinct
  ta.academic_period_id,
  ta.unit_id,
  'exam',
  100,
  40
from public.teaching_allocations ta
where ta.academic_period_id is not null
  and ta.unit_id is not null
on conflict (academic_period_id, unit_id, assessment_type)
do update set
  maximum_mark = 100,
  pass_mark = 40;

-- ----------------------------------------------------------------------------
-- 4. Ensure Candidates in Assessment Roster
-- ----------------------------------------------------------------------------

insert into public.assessment_roster (
  assessment_id,
  student_id,
  cohort_id,
  academic_period_id,
  unit_id,
  snapshot_registration_status,
  pre_assessment_status
)
select distinct
  ae.id as assessment_id,
  sur.student_id,
  coalesce(sur.cohort_id, s.current_cohort_id) as cohort_id,
  ae.academic_period_id,
  ae.unit_id,
  sur.registration_status,
  'expected' as pre_assessment_status
from public.assessment_events ae
join public.student_unit_registrations sur
  on sur.academic_period_id = ae.academic_period_id
 and sur.unit_id = ae.unit_id
join public.students s
  on s.id = sur.student_id
where sur.registration_status = 'registered'
on conflict (assessment_id, student_id) do nothing;

insert into public.assessment_roster (
  assessment_id,
  student_id,
  cohort_id,
  academic_period_id,
  unit_id,
  snapshot_registration_status,
  pre_assessment_status
)
select distinct
  ae.id as assessment_id,
  s.id as student_id,
  ta.cohort_id,
  ae.academic_period_id,
  ae.unit_id,
  'registered',
  'expected' as pre_assessment_status
from public.assessment_events ae
join public.teaching_allocations ta
  on ta.academic_period_id = ae.academic_period_id
 and ta.unit_id = ae.unit_id
join public.students s
  on s.current_cohort_id = ta.cohort_id
where s.lifecycle_status in ('admitted', 'active')
on conflict (assessment_id, student_id) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Auto-Provisioning Function Update
-- ----------------------------------------------------------------------------

create or replace function public.ensure_unit_markbook_ready(
  p_academic_period_id uuid,
  p_unit_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_event_id uuid;
  v_department_id uuid;
begin
  -- 1. Check if an active markbook already exists
  select id into v_event_id
  from public.assessment_events
  where academic_period_id = p_academic_period_id
    and unit_id = p_unit_id
    and (operational_assessment_type in ('exam', 'unit_markbook') or assessment_type in ('exam', 'unit_markbook'))
  order by created_at desc
  limit 1;

  if v_event_id is not null then
    -- Ensure event operational fields are active
    update public.assessment_events
    set
      operational_assessment_type = 'exam',
      operational_workflow_status = coalesce(operational_workflow_status, 'open'),
      population_locked_at = coalesce(population_locked_at, now()),
      max_mark = 100,
      pass_mark = 40
    where id = v_event_id;

    -- Ensure candidate roster is synchronized with cohort registrations
    insert into public.assessment_roster (
      assessment_id,
      student_id,
      cohort_id,
      academic_period_id,
      unit_id,
      snapshot_registration_status,
      pre_assessment_status
    )
    select distinct
      v_event_id,
      sur.student_id,
      coalesce(sur.cohort_id, s.current_cohort_id),
      p_academic_period_id,
      p_unit_id,
      sur.registration_status,
      'expected'
    from public.student_unit_registrations sur
    join public.students s on s.id = sur.student_id
    where sur.unit_id = p_unit_id
      and sur.academic_period_id = p_academic_period_id
      and sur.registration_status = 'registered'
    on conflict (assessment_id, student_id) do nothing;

    insert into public.assessment_roster (
      assessment_id,
      student_id,
      cohort_id,
      academic_period_id,
      unit_id,
      snapshot_registration_status,
      pre_assessment_status
    )
    select distinct
      v_event_id,
      s.id,
      ta.cohort_id,
      p_academic_period_id,
      p_unit_id,
      'registered',
      'expected'
    from public.teaching_allocations ta
    join public.students s on s.current_cohort_id = ta.cohort_id
    where ta.unit_id = p_unit_id
      and ta.academic_period_id = p_academic_period_id
      and s.lifecycle_status in ('admitted', 'active')
    on conflict (assessment_id, student_id) do nothing;

    return v_event_id;
  end if;

  -- 2. Determine department for the unit
  select p.department_id into v_department_id
  from public.units u
  left join public.programmes p on p.id = u.programme_id
  where u.id = p_unit_id;

  if v_department_id is null then
    select department_id into v_department_id
    from public.teaching_allocations
    where unit_id = p_unit_id
      and academic_period_id = p_academic_period_id
    limit 1;
  end if;

  if v_department_id is null then
    select id into v_department_id from public.departments limit 1;
  end if;

  -- 3. Create the Unit Markbook assessment event with full operational defaults
  insert into public.assessment_events (
    department_id,
    academic_period_id,
    unit_id,
    cohort_id,
    assessment_type,
    operational_assessment_type,
    operational_workflow_status,
    title,
    max_mark,
    pass_mark,
    status,
    population_locked_at
  ) values (
    v_department_id,
    p_academic_period_id,
    p_unit_id,
    null,
    'exam',
    'exam',
    'open',
    'Unit Markbook',
    100,
    40,
    'draft',
    now()
  )
  returning id into v_event_id;

  -- 4. Ensure assessment rule exists
  insert into public.assessment_rules (
    academic_period_id,
    unit_id,
    assessment_type,
    maximum_mark,
    pass_mark
  ) values (
    p_academic_period_id,
    p_unit_id,
    'exam',
    100,
    40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set
    maximum_mark = 100,
    pass_mark = 40;

  -- 5. Synchronize registered students into the candidate roster
  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    snapshot_registration_status,
    pre_assessment_status
  )
  select distinct
    v_event_id,
    sur.student_id,
    coalesce(sur.cohort_id, s.current_cohort_id),
    p_academic_period_id,
    p_unit_id,
    sur.registration_status,
    'expected'
  from public.student_unit_registrations sur
  join public.students s on s.id = sur.student_id
  where sur.unit_id = p_unit_id
    and sur.academic_period_id = p_academic_period_id
    and sur.registration_status = 'registered'
  on conflict (assessment_id, student_id) do nothing;

  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    snapshot_registration_status,
    pre_assessment_status
  )
  select distinct
    v_event_id,
    s.id,
    ta.cohort_id,
    p_academic_period_id,
    p_unit_id,
    'registered',
    'expected'
  from public.teaching_allocations ta
  join public.students s on s.current_cohort_id = ta.cohort_id
  where ta.unit_id = p_unit_id
    and ta.academic_period_id = p_academic_period_id
    and s.lifecycle_status in ('admitted', 'active')
  on conflict (assessment_id, student_id) do nothing;

  return v_event_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Modernize save_assessment_online_marks: Auto-lock & Zero Friction
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
    coalesce(workspace.workflow_status, 'open'),
    coalesce(workspace.assessment_type, 'exam'),
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

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment no longer accepts editable marks.'
      using errcode = '23514';
  end if;

  -- Seamless auto-lock if not locked yet
  if target_locked_at is null then
    update public.assessment_events
    set population_locked_at = now()
    where id = target_assessment_id;
  end if;

  -- Ensure rule exists with 100 max
  insert into public.assessment_rules (
    academic_period_id,
    unit_id,
    assessment_type,
    maximum_mark,
    pass_mark
  ) values (
    target_period_id,
    target_unit_id,
    'exam',
    100,
    40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set maximum_mark = 100, pass_mark = 40;

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

  -- Ensure any missing students in payload exist in roster
  insert into public.assessment_roster (
    assessment_id,
    student_id,
    cohort_id,
    academic_period_id,
    unit_id,
    pre_assessment_status
  )
  select distinct
    target_assessment_id,
    item.student_id,
    s.current_cohort_id,
    target_period_id,
    target_unit_id,
    'expected'
  from jsonb_to_recordset(target_entries) as item(student_id uuid)
  join public.students s on s.id = item.student_id
  where not exists (
    select 1 from public.assessment_roster r
    where r.assessment_id = target_assessment_id
      and r.student_id = item.student_id
  )
  on conflict (assessment_id, student_id) do nothing;

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
      when roster.pre_assessment_status = 'absent' then null
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
  join public.assessment_roster as roster
    on roster.assessment_id = target_assessment_id
   and roster.student_id = item.student_id
  on conflict (
    assessment_id,
    student_id
  )
  do update set
    cohort_id = excluded.cohort_id,
    assignment_mark = excluded.assignment_mark,
    presentation_mark = excluded.presentation_mark,
    rat_mark = excluded.rat_mark,
    cat_mark = excluded.cat_mark,
    exam_mark = excluded.exam_mark,
    updated_by = auth.uid(),
    updated_at = now();

  return jsonb_build_object(
    'assessmentId', target_assessment_id,
    'status', 'draft',
    'savedCount', entry_count
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. Modernize submit_assessment_online_marks: Auto-lock & Clean Submission
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
    coalesce(workspace.workflow_status, 'open'),
    coalesce(workspace.assessment_type, 'exam'),
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

  if target_status in (
    'submitted',
    'finalised',
    'archived'
  ) then
    raise exception
      'This assessment has already left editable marks entry.'
      using errcode = '23514';
  end if;

  -- Seamless auto-lock if not locked yet
  if target_locked_at is null then
    update public.assessment_events
    set population_locked_at = now()
    where id = target_assessment_id;
  end if;

  -- Ensure rule exists
  insert into public.assessment_rules (
    academic_period_id,
    unit_id,
    assessment_type,
    maximum_mark,
    pass_mark
  ) values (
    target_period_id,
    target_unit_id,
    'exam',
    100,
    40
  )
  on conflict (academic_period_id, unit_id, assessment_type)
  do update set maximum_mark = 100, pass_mark = 40;

  select
    count(*) filter (where roster.pre_assessment_status = 'expected')::integer,
    count(*) filter (where roster.pre_assessment_status = 'absent')::integer
  into
    expected_count,
    absent_count
  from public.assessment_roster as roster
  where roster.assessment_id = target_assessment_id;

  if (expected_count + absent_count) = 0 then
    raise exception
      'The assessment roster is empty. No students found for this unit.'
      using errcode = 'P0002';
  end if;

  -- Verify all students have draft marks
  if exists (
    select 1
    from public.assessment_roster as roster
    left join public.assessment_online_mark_drafts as draft
      on draft.assessment_id = roster.assessment_id
     and draft.student_id = roster.student_id
    where roster.assessment_id = target_assessment_id
      and (
        draft.student_id is null
        or draft.assignment_mark is null
        or draft.presentation_mark is null
        or draft.rat_mark is null
        or draft.cat_mark is null
        or (roster.pre_assessment_status = 'expected' and draft.exam_mark is null)
        or (roster.pre_assessment_status = 'absent'   and draft.exam_mark is not null)
      )
  ) then
    raise exception
      'Missing marks remain. Assignment, Presentation, RAT and CAT are required for every student; Exam is required for students expected to sit.'
      using errcode = '23514';
  end if;

  -- Remove any previous results for this assessment before committing fresh online submission
  delete from public.assessment_results
  where assessment_event_id = target_assessment_id;

  -- Insert official results
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
    imported_at
  )
  select
    roster.assessment_id,
    roster.student_id,
    roster.cohort_id,
    jsonb_build_object(
      'assignment', draft.assignment_mark,
      'presentation', draft.presentation_mark,
      'rat', draft.rat_mark,
      'cat1', draft.cat_mark,
      'ratCatAverage', (draft.rat_mark + draft.cat_mark) / 2.0,
      'coursework', draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0),
      'exam', case when roster.pre_assessment_status = 'absent' then null else draft.exam_mark end,
      'total', case
        when roster.pre_assessment_status = 'absent' then null
        else draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark
      end
    ),
    case
      when roster.pre_assessment_status = 'absent' then null
      else round((draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark)::numeric, 2)
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'ABSENT'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 75 then 'DISTINCTION'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 65 then 'CREDIT'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 40 then 'PASS'
      else 'REFER'
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'Exam Absent'
      when (draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark) >= 40 then 'Pass'
      else 'Refer'
    end,
    case
      when roster.pre_assessment_status = 'absent' then null
      else round((draft.assignment_mark + draft.presentation_mark + ((draft.rat_mark + draft.cat_mark) / 2.0) + draft.exam_mark)::numeric, 2)
    end,
    case
      when roster.pre_assessment_status = 'absent' then 'absent'
      else 'sat'
    end,
    'online',
    now()
  from public.assessment_roster as roster
  join public.assessment_online_mark_drafts as draft
    on draft.assessment_id = roster.assessment_id
   and draft.student_id = roster.student_id
  where roster.assessment_id = target_assessment_id;

  get diagnostics result_count = row_count;

  -- Record submission record
  insert into public.assessment_online_mark_submissions (
    assessment_id,
    submitted_by,
    submitted_at,
    result_count,
    absent_count
  ) values (
    target_assessment_id,
    auth.uid(),
    now(),
    result_count,
    absent_count
  )
  on conflict (assessment_id)
  do update set
    submitted_by = auth.uid(),
    submitted_at = now(),
    result_count = excluded.result_count,
    absent_count = excluded.absent_count
  returning id into submission_id;

  -- Update event state to submitted
  update public.assessment_events
  set
    operational_workflow_status = 'submitted',
    marks_submitted_at = now()
  where id = target_assessment_id;

  return jsonb_build_object(
    'submissionId', submission_id,
    'assessmentId', target_assessment_id,
    'status', 'submitted',
    'resultCount', result_count,
    'absentCount', absent_count
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Allow Excel Export Anytime: Do not block downloads when submitted/finalised
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
    coalesce(workspace.assessment_type, 'exam'),
    coalesce(workspace.workflow_status, 'open'),
    workspace.population_locked_at
  into
    target_period_id,
    target_unit_id,
    target_type,
    target_status,
    target_locked_at
  from public.assessment_event_workspace as workspace
  where workspace.id = target_assessment_id;

  if not found then
    raise exception
      'Assessment was not found.'
      using errcode = 'P0002';
  end if;

  -- Lock population if not already locked
  if target_locked_at is null then
    locked_timestamp := now();
    update public.assessment_events
    set population_locked_at = locked_timestamp
    where id = target_assessment_id;
  else
    locked_timestamp := target_locked_at;
  end if;

  select
    coalesce(count(*), 0)::integer,
    coalesce(count(*) filter (where roster.pre_assessment_status = 'absent'), 0)::integer
  into
    bundle_student_count,
    bundle_absent_count
  from public.assessment_roster as roster
  where roster.assessment_id = target_assessment_id;

  return jsonb_build_object(
    'assessmentId', target_assessment_id,
    'status', target_status,
    'lockedAt', locked_timestamp,
    'totalStudents', bundle_student_count,
    'absentCount', bundle_absent_count
  );
end;
$$;

commit;
