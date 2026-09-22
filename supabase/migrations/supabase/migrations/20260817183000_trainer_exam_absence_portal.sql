-- ============================================================
-- v12.7 — Trainer Exam Absence Portal
-- ============================================================

alter type public.app_role add value if not exists 'trainer';

create or replace function public.trainer_record_exam_absentees(
  target_assessment_event_id uuid,
  absent_student_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_row public.assessment_events%rowtype;
  trainer_id_value uuid;
  normalized_absent_ids uuid[];
  expected_count integer;
begin
  select *
  into event_row
  from public.assessment_events
  where id = target_assessment_event_id
  for update;

  if event_row.id is null then
    raise exception using errcode = 'P0002', message = 'Unit Markbook not found';
  end if;

  if event_row.assessment_type <> 'unit_markbook' then
    raise exception using errcode = '23514', message = 'Exam attendance is only recorded against Unit Markbooks';
  end if;

  if event_row.exam_marks_finalized_at is not null then
    raise exception using errcode = 'P0001', message = 'Final examination marks are already locked';
  end if;

  if event_row.cat_marks_finalized_at is null then
    raise exception using errcode = 'P0001', message = 'Coursework/CAT marks must be committed before exam attendance';
  end if;

  select t.id
  into trainer_id_value
  from public.trainers t
  where t.profile_id = auth.uid()
    and t.is_active = true
  limit 1;

  if trainer_id_value is null then
    raise exception using errcode = '42501', message = 'Your account is not linked to an active trainer record';
  end if;

  if not exists (
    select 1
    from public.teaching_allocations ta
    where ta.trainer_id = trainer_id_value
      and ta.academic_period_id = event_row.academic_period_id
      and ta.unit_id = event_row.unit_id
      and ta.status in ('draft', 'active')
  ) then
    raise exception using errcode = '42501', message = 'You are not allocated to this unit';
  end if;

  select coalesce(array_agg(distinct x order by x), '{}'::uuid[])
  into normalized_absent_ids
  from unnest(coalesce(absent_student_ids, '{}'::uuid[])) x;

  select count(*)
  into expected_count
  from public.assessment_population ap
  where ap.assessment_event_id = target_assessment_event_id
    and ap.population_status = 'expected';

  if expected_count = 0 then
    raise exception using errcode = 'P0001', message = 'Unit examination population is empty';
  end if;

  if exists (
    select 1
    from unnest(normalized_absent_ids) supplied(student_id)
    where not exists (
      select 1
      from public.assessment_population ap
      where ap.assessment_event_id = target_assessment_event_id
        and ap.population_status = 'expected'
        and ap.student_id = supplied.student_id
    )
  ) then
    raise exception using errcode = '23514',
      message = 'One or more selected students are not in this examination population';
  end if;

  -- Efficient exception model:
  -- all expected students become present, then only supplied exceptions become absent.
  update public.assessment_population
  set attendance_status = 'present',
      updated_at = now()
  where assessment_event_id = target_assessment_event_id
    and population_status = 'expected';

  if cardinality(normalized_absent_ids) > 0 then
    update public.assessment_population
    set attendance_status = 'absent',
        updated_at = now()
    where assessment_event_id = target_assessment_event_id
      and population_status = 'expected'
      and student_id = any(normalized_absent_ids);
  end if;

  update public.assessment_events
  set attendance_finalized_at = now(),
      updated_at = now()
  where id = target_assessment_event_id;

  return cardinality(normalized_absent_ids);
end;
$$;

revoke all on function public.trainer_record_exam_absentees(uuid, uuid[]) from public, anon;
grant execute on function public.trainer_record_exam_absentees(uuid, uuid[]) to authenticated;

comment on function public.trainer_record_exam_absentees(uuid, uuid[]) is
  'Trainer-facing exam attendance operation. All expected students are treated as present and only physical-sheet exceptions are stored as absent.';
