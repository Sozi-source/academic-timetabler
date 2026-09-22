-- ============================================================
-- Single unit markbook consolidation
-- One academic period + one unit = one progressive Unit Markbook.
-- Legacy CAT / exam assessment events for the same unit are folded into
-- one canonical event so the UI never produces separate CAT and Exam
-- workbooks for a unit.
-- ============================================================

alter table public.assessment_events disable trigger assessment_events_validate;

do $$
declare
  scope_row record;
  canonical_id uuid;
  old_event record;
  merged_attendance_at timestamptz;
  merged_cat_at timestamptz;
  merged_exam_at timestamptz;
  merged_exam_date date;
begin
  for scope_row in
    select department_id, academic_period_id, unit_id
    from public.assessment_events
    group by department_id, academic_period_id, unit_id
  loop
    select e.id into canonical_id
    from public.assessment_events e
    where e.department_id = scope_row.department_id
      and e.academic_period_id = scope_row.academic_period_id
      and e.unit_id = scope_row.unit_id
      and lower(trim(e.title)) = 'unit markbook'
    order by e.created_at desc
    limit 1;

    if canonical_id is null then
      select e.id into canonical_id
      from public.assessment_events e
      where e.department_id = scope_row.department_id
        and e.academic_period_id = scope_row.academic_period_id
        and e.unit_id = scope_row.unit_id
      order by
        case when e.assessment_type = 'exam' then 0 else 1 end,
        e.created_at desc
      limit 1;
    end if;

    if canonical_id is null then
      continue;
    end if;

    select
      max(e.attendance_finalized_at),
      max(e.cat_marks_finalized_at),
      max(e.exam_marks_finalized_at),
      max(e.assessment_date) filter (where e.assessment_type = 'exam')
    into merged_attendance_at, merged_cat_at, merged_exam_at, merged_exam_date
    from public.assessment_events e
    where e.department_id = scope_row.department_id
      and e.academic_period_id = scope_row.academic_period_id
      and e.unit_id = scope_row.unit_id;

    -- Merge each legacy event into the canonical unit markbook.
    for old_event in
      select e.*
      from public.assessment_events e
      where e.department_id = scope_row.department_id
        and e.academic_period_id = scope_row.academic_period_id
        and e.unit_id = scope_row.unit_id
        and e.id <> canonical_id
      order by case when e.assessment_type = 'cat' then 0 else 1 end, e.created_at
    loop
      insert into public.assessment_population (
        assessment_event_id,
        student_id,
        student_unit_registration_id,
        cohort_id,
        population_status,
        source,
        included_at,
        created_at,
        attendance_status,
        attendance_updated_at,
        attendance_updated_by,
        cat_absence_reason,
        cat_absence_recommendation,
        exam_absence_reason,
        exam_absence_recommendation
      )
      select
        canonical_id,
        p.student_id,
        p.student_unit_registration_id,
        p.cohort_id,
        p.population_status,
        p.source,
        p.included_at,
        p.created_at,
        p.attendance_status,
        p.attendance_updated_at,
        p.attendance_updated_by,
        p.cat_absence_reason,
        p.cat_absence_recommendation,
        p.exam_absence_reason,
        p.exam_absence_recommendation
      from public.assessment_population p
      where p.assessment_event_id = old_event.id
      on conflict (assessment_event_id, student_id)
      do update set
        student_unit_registration_id = coalesce(
          assessment_population.student_unit_registration_id,
          excluded.student_unit_registration_id
        ),
        cohort_id = excluded.cohort_id,
        population_status = case
          when assessment_population.population_status = 'expected'
            or excluded.population_status = 'expected'
          then 'expected'::public.assessment_population_status
          else assessment_population.population_status
        end,
        attendance_status = case
          when excluded.attendance_status = 'absent' then excluded.attendance_status
          when assessment_population.attendance_status = 'pending' then excluded.attendance_status
          else assessment_population.attendance_status
        end,
        attendance_updated_at = greatest(
          assessment_population.attendance_updated_at,
          excluded.attendance_updated_at
        ),
        attendance_updated_by = coalesce(excluded.attendance_updated_by, assessment_population.attendance_updated_by),
        cat_absence_reason = coalesce(excluded.cat_absence_reason, assessment_population.cat_absence_reason),
        cat_absence_recommendation = coalesce(excluded.cat_absence_recommendation, assessment_population.cat_absence_recommendation),
        exam_absence_reason = coalesce(excluded.exam_absence_reason, assessment_population.exam_absence_reason),
        exam_absence_recommendation = coalesce(excluded.exam_absence_recommendation, assessment_population.exam_absence_recommendation);

      -- Move import batches first so copied result rows keep valid source references.
      update public.assessment_mark_import_batches
      set assessment_event_id = canonical_id
      where assessment_event_id = old_event.id;

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
        canonical_id,
        r.student_id,
        r.cohort_id,
        r.component_marks,
        r.total_mark,
        r.grade,
        r.comment,
        r.source_batch_id,
        r.imported_by,
        r.imported_at,
        r.updated_at
      from public.assessment_results r
      where r.assessment_event_id = old_event.id
      on conflict (assessment_event_id, student_id)
      do update set
        cohort_id = excluded.cohort_id,
        component_marks = coalesce(assessment_results.component_marks, '{}'::jsonb) || coalesce(excluded.component_marks, '{}'::jsonb),
        total_mark = coalesce(excluded.total_mark, assessment_results.total_mark),
        grade = coalesce(excluded.grade, assessment_results.grade),
        comment = coalesce(excluded.comment, assessment_results.comment),
        source_batch_id = coalesce(excluded.source_batch_id, assessment_results.source_batch_id),
        imported_by = coalesce(excluded.imported_by, assessment_results.imported_by),
        imported_at = greatest(assessment_results.imported_at, excluded.imported_at),
        updated_at = greatest(assessment_results.updated_at, excluded.updated_at);

      delete from public.assessment_events where id = old_event.id;
    end loop;

    update public.assessment_events
    set title = 'Unit Markbook',
        assessment_type = 'exam'::public.assessment_event_type,
        cohort_id = null,
        max_mark = 100,
        pass_mark = 40,
        assessment_date = coalesce(merged_exam_date, assessment_date),
        attendance_finalized_at = coalesce(merged_attendance_at, attendance_finalized_at),
        cat_marks_finalized_at = coalesce(merged_cat_at, cat_marks_finalized_at),
        exam_marks_finalized_at = coalesce(merged_exam_at, exam_marks_finalized_at),
        status = case
          when merged_exam_at is not null then 'closed'::public.assessment_event_status
          when merged_cat_at is not null or merged_attendance_at is not null then 'open'::public.assessment_event_status
          else 'draft'::public.assessment_event_status
        end,
        updated_at = now()
    where id = canonical_id;
  end loop;
end
$$;

alter table public.assessment_events enable trigger assessment_events_validate;

-- A second Unit Markbook for the same department/period/unit is impossible,
-- regardless of assessment_type or cohort metadata.
create unique index if not exists assessment_events_single_unit_markbook_idx
  on public.assessment_events (department_id, academic_period_id, unit_id)
  where lower(trim(title)) = 'unit markbook';

comment on index public.assessment_events_single_unit_markbook_idx is
  'Enforces one progressive Unit Markbook per department, academic period and unit.';
