begin;

-- ============================================================================
-- Assessment Result Commit V6
--
-- Generated against the linked assessment_results schema.
--
-- Resolved live mappings:
--   assessment column : assessment_event_id
--   student column    : student_id
--   cohort column     : cohort_id
--   period column     : none
--   unit column       : none
--   legacy mark column: none
--
-- V6 writes validated staged rows transactionally. Existing academic results
-- are never overwritten. Missing marks block commit. Absence remains explicit.
-- ============================================================================

alter table public.assessment_results
  add column if not exists operational_mark numeric,
  add column if not exists source_markbook_batch_id uuid
    references public.assessment_markbook_import_batches(id)
    on delete restrict,
  add column if not exists source_workbook_row integer;


alter table public.assessment_results
  drop constraint if exists assessment_results_operational_mark_check;

alter table public.assessment_results
  add constraint assessment_results_operational_mark_check
  check (
    operational_mark is null
    or operational_mark >= 0
  );

alter table public.assessment_results
  drop constraint if exists assessment_results_source_workbook_row_check;

alter table public.assessment_results
  add constraint assessment_results_source_workbook_row_check
  check (
    source_workbook_row is null
    or source_workbook_row >= 1
  );

create unique index if not exists
  assessment_results_source_batch_student_unique_idx
on public.assessment_results (
  source_markbook_batch_id,
  "student_id"
)
where source_markbook_batch_id is not null;

create index if not exists
  assessment_results_operational_status_batch_idx
on public.assessment_results (
  operational_result_status,
  source_markbook_batch_id
)
where source_markbook_batch_id is not null;

comment on column public.assessment_results.operational_mark is
  'Canonical numeric mark imported from a validated Academic Planner markbook. Null for explicit absence or unresolved missing mark.';

comment on column public.assessment_results.source_markbook_batch_id is
  'Validated markbook staging batch that produced this result row.';

comment on column public.assessment_results.source_workbook_row is
  'Original visible Excel row for audit traceability.';

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

  if not public.current_user_has_role(
    array[
      'hod',
      'system_admin'
    ]::public.app_role[]
  ) then
    raise exception
      'Only an authorized HOD or system administrator may commit assessment results at this stage.'
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

revoke all
on function public.commit_assessment_markbook_import(uuid)
from public;

grant execute
on function public.commit_assessment_markbook_import(uuid)
to authenticated;

comment on function public.commit_assessment_markbook_import(uuid) is
  'Atomically commits a validated staged CAT/EXAM workbook into assessment_results without overwriting existing academic results.';

commit;
