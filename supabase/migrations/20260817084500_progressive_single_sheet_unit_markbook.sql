-- ============================================================
-- Progressive single-sheet unit markbook
-- One workbook = one unit = one visible worksheet.
-- CAT marks are committed first; the same markbook is completed after
-- examination attendance and uploaded again for final exam results.
-- ============================================================

alter table public.assessment_events
  add column if not exists cat_marks_finalized_at timestamptz,
  add column if not exists cat_marks_finalized_by uuid references auth.users(id) on delete set null,
  add column if not exists exam_marks_finalized_at timestamptz,
  add column if not exists exam_marks_finalized_by uuid references auth.users(id) on delete set null;

alter table public.assessment_population
  add column if not exists cat_absence_reason text,
  add column if not exists cat_absence_recommendation text,
  add column if not exists exam_absence_reason text,
  add column if not exists exam_absence_recommendation text;

alter table public.assessment_mark_import_batches
  add column if not exists import_phase text not null default 'exam';

alter table public.assessment_mark_import_batches
  drop constraint if exists assessment_mark_import_batches_import_phase_check;

alter table public.assessment_mark_import_batches
  add constraint assessment_mark_import_batches_import_phase_check
  check (import_phase in ('cat', 'exam'));

create or replace function public.commit_assessment_mark_import_batch(target_batch_id uuid)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_batch public.assessment_mark_import_batches%rowtype;
  selected_event public.assessment_events%rowtype;
  inserted_count integer := 0;
begin
  select * into selected_batch
  from public.assessment_mark_import_batches
  where id = target_batch_id
  for update;

  if selected_batch.id is null then
    raise exception using errcode = 'P0002', message = 'Mark import batch not found';
  end if;

  select * into selected_event
  from public.assessment_events
  where id = selected_batch.assessment_event_id
  for update;

  if not public.current_user_can_manage_department(selected_batch.department_id) then
    raise exception using errcode = '42501', message = 'Not permitted to import these marks';
  end if;

  if selected_batch.status = 'completed' then
    return selected_batch.valid_rows;
  end if;

  if selected_batch.invalid_rows > 0 then
    raise exception using errcode = '23514', message = 'Resolve invalid workbook rows before committing marks';
  end if;

  if selected_batch.import_phase = 'exam' and selected_event.attendance_finalized_at is null then
    raise exception using errcode = '23514', message = 'Record examination attendance before importing final exam marks';
  end if;

  insert into public.assessment_results (
    assessment_event_id,
    student_id,
    cohort_id,
    component_marks,
    total_mark,
    grade,
    comment,
    source_batch_id,
    imported_by,
    imported_at,
    updated_at
  )
  select
    selected_event.id,
    r.student_id,
    r.cohort_id,
    r.component_marks,
    case when selected_batch.import_phase = 'cat' then null else r.total_mark end,
    case when selected_batch.import_phase = 'cat' then null else r.grade end,
    case when selected_batch.import_phase = 'cat' then null else r.comment end,
    selected_batch.id,
    auth.uid(),
    now(),
    now()
  from public.assessment_mark_import_rows r
  where r.batch_id = selected_batch.id
    and r.row_status = 'ready'
    and r.student_id is not null
    and r.cohort_id is not null
  on conflict (assessment_event_id, student_id)
  do update set
    cohort_id = excluded.cohort_id,
    component_marks = case
      when selected_batch.import_phase = 'cat'
        then coalesce(assessment_results.component_marks, '{}'::jsonb) || excluded.component_marks
      else excluded.component_marks
    end,
    total_mark = case when selected_batch.import_phase = 'cat' then assessment_results.total_mark else excluded.total_mark end,
    grade = case when selected_batch.import_phase = 'cat' then assessment_results.grade else excluded.grade end,
    comment = case when selected_batch.import_phase = 'cat' then assessment_results.comment else excluded.comment end,
    source_batch_id = excluded.source_batch_id,
    imported_by = excluded.imported_by,
    imported_at = excluded.imported_at,
    updated_at = now();

  get diagnostics inserted_count = row_count;

  update public.assessment_mark_import_batches
  set status = 'completed', completed_at = now()
  where id = selected_batch.id;

  if selected_batch.import_phase = 'cat' then
    update public.assessment_events
    set cat_marks_finalized_at = now(),
        cat_marks_finalized_by = auth.uid(),
        status = case when status = 'draft' then 'open'::public.assessment_event_status else status end
    where id = selected_event.id;
  else
    update public.assessment_events
    set exam_marks_finalized_at = now(),
        exam_marks_finalized_by = auth.uid(),
        status = 'closed'
    where id = selected_event.id;
  end if;

  return inserted_count;
end;
$$;

grant execute on function public.commit_assessment_mark_import_batch(uuid) to authenticated;

comment on column public.assessment_mark_import_batches.import_phase is
  'cat = interim CAT upload from the unit markbook; exam = final upload after physical examination attendance.';
