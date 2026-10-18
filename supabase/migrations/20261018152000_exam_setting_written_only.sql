begin;

-- Move existing MCQ blueprint sections to the supplied college written-paper
-- format: ten 4-mark short-answer questions in Section A.
update public.exam_blueprints b
set layout = jsonb_set(
  jsonb_set(
    b.layout,
    '{instructions}',
    coalesce(b.layout->'instructions', '[]'::jsonb) || '"Answer all questions in Section A. Each question carries 4 marks."'::jsonb
  ),
  '{sections}',
  (
    select jsonb_agg(
      case when section->>'label' = 'A' and section->>'question_type' = 'mcq' then
        (section - 'choice') || jsonb_build_object(
          'title', 'Short Answer Questions',
          'question_type', 'short_answer',
          'question_count', 10,
          'marks_each', 4
        )
      else section end
      order by ordinality
    )
    from jsonb_array_elements(b.layout->'sections') with ordinality as sections(section, ordinality)
  )
)
where jsonb_typeof(b.layout->'sections') = 'array'
  and exists (
    select 1 from jsonb_array_elements(b.layout->'sections') section
    where section->>'label' = 'A' and section->>'question_type' = 'mcq'
  );

alter table public.exam_questions
  add constraint exam_questions_generated_written_only_check
  check (origin <> 'generated' or question_type <> 'mcq') not valid;

alter table public.exam_questions
  validate constraint exam_questions_generated_written_only_check;

create or replace function public.exam_commit_generated_paper(
  requested_unit uuid,
  requested_period uuid,
  requested_blueprint uuid,
  requested_kind text,
  requested_items jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  active_department uuid := public.current_user_primary_department_id();
  new_paper uuid;
  item jsonb;
  question jsonb;
  new_question uuid;
begin
  if active_department is null or not public.current_user_can_manage_department(active_department) then
    raise exception 'Department management access is required';
  end if;
  if requested_kind is null or requested_kind not in ('main', 'supplementary') then
    raise exception 'Paper kind is invalid';
  end if;
  if jsonb_typeof(requested_items) is distinct from 'array'
    or jsonb_array_length(requested_items) < 1 or jsonb_array_length(requested_items) > 100 then
    raise exception 'Generated paper items are invalid';
  end if;
  if not exists (select 1 from public.units u where u.id = requested_unit and u.department_id = active_department and u.is_active) then
    raise exception 'Unit is not available in the active department';
  end if;
  if not exists (
    select 1 from public.exam_blueprints b
    join public.units u on u.id = requested_unit
    where b.id = requested_blueprint and b.department_id = active_department and b.status = 'active'
      and (b.programme_id is null or b.programme_id = u.programme_id)
  ) then
    raise exception 'An active department blueprint is required';
  end if;
  if not exists (select 1 from public.academic_periods p where p.id = requested_period and p.status in ('active', 'planned')) then
    raise exception 'Academic period is not available';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_items) item
    where coalesce(item->>'section_label', '') = ''
       or coalesce((item->>'item_number')::integer, 0) < 1
       or coalesce((item->>'marks')::integer, 0) < 1
       or jsonb_typeof(item->'question') is distinct from 'object'
       or item->'question'->>'question_type' = 'mcq'
  ) then
    raise exception 'Generated paper items must be complete written questions';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_items) item
    group by item->>'section_label', item->>'item_number' having count(*) > 1
  ) then
    raise exception 'Generated paper contains duplicate question positions';
  end if;
  if exists (
    select 1 from public.exam_blueprints b,
      jsonb_array_elements(b.layout->'sections') section
    where b.id = requested_blueprint
      and (select count(*) from jsonb_array_elements(requested_items) item
        where item->>'section_label' = section->>'label') <> (section->>'question_count')::integer
  ) or exists (
    select 1 from jsonb_array_elements(requested_items) item
    where not exists (
      select 1 from public.exam_blueprints b,
        jsonb_array_elements(b.layout->'sections') section
      where b.id = requested_blueprint and section->>'label' = item->>'section_label'
        and (section->>'marks_each')::integer = (item->>'marks')::integer
        and section->>'question_type' = item->'question'->>'question_type'
    )
  ) then
    raise exception 'Generated questions do not match the active blueprint layout';
  end if;

  insert into public.exam_papers (
    department_id, unit_id, academic_period_id, blueprint_id, paper_kind,
    status, total_marks, generated_at, created_by
  )
  select active_department, requested_unit, requested_period, b.id, requested_kind,
    'draft', b.total_marks, now(), auth.uid()
  from public.exam_blueprints b
  where b.id = requested_blueprint
  returning id into new_paper;

  for item in select value from jsonb_array_elements(requested_items) loop
    question := item->'question';
    if not exists (
      select 1 from public.exam_questions seed
      where seed.id = (question->>'seed_question_id')::uuid
        and seed.unit_id = requested_unit
        and seed.department_id = active_department
        and seed.origin = 'historical'
        and seed.source_file_id is not null
    ) then
      raise exception 'Every generated question must reference a historical question from this unit';
    end if;
    if nullif(question->>'max_similarity', '') is null
      or (question->>'max_similarity')::numeric > 1 or (question->>'max_similarity')::numeric < 0 then
      raise exception 'Question similarity score is invalid';
    end if;
    if jsonb_typeof(question->'body') is distinct from 'object'
      or coalesce(length(trim(question->>'body_text')), 0) < 20
      or question->>'derivation_mode' not in ('reword', 'rescenario', 'new_from_notes') then
      raise exception 'Generated question content is incomplete';
    end if;

    insert into public.exam_questions (
      department_id, unit_id, topic, learning_outcome, question_type, marks,
      difficulty, cognitive_level, body, body_text, origin, derivation_mode,
      seed_question_id, source_file_id, historical_year, historical_paper_kind,
      max_similarity, status, created_by
    )
    select active_department, requested_unit,
      coalesce(nullif(trim(question->>'topic'), ''), 'Historical question variation'),
      nullif(trim(question->>'learning_outcome'), ''), question->>'question_type',
      (item->>'marks')::smallint, coalesce(question->>'difficulty', 'medium'),
      nullif(question->>'cognitive_level', ''), question->'body', question->>'body_text',
      'generated', question->>'derivation_mode', seed.id, seed.source_file_id,
      seed.historical_year, seed.historical_paper_kind,
      (question->>'max_similarity')::numeric, 'draft', auth.uid()
    from public.exam_questions seed
    where seed.id = (question->>'seed_question_id')::uuid
    returning id into new_question;

    insert into public.exam_paper_items (
      department_id, paper_id, question_id, section_label, item_number,
      slot_spec, slot_status, marks
    ) values (
      active_department, new_paper, new_question, item->>'section_label',
      (item->>'item_number')::smallint,
      coalesce(item->'slot_spec', '{}'::jsonb),
      case when (question->>'max_similarity')::numeric > 0.25 then 'needs_review' else 'generated' end,
      (item->>'marks')::smallint
    );
  end loop;

  insert into public.exam_audit_log (department_id, actor_id, action, paper_id, detail)
  values (active_department, auth.uid(), 'paper_generated', new_paper,
    jsonb_build_object('items', jsonb_array_length(requested_items), 'unit_id', requested_unit,
      'blueprint_id', requested_blueprint, 'paper_kind', requested_kind));
  return new_paper;
end;
$$;

revoke all on function public.exam_commit_generated_paper(uuid, uuid, uuid, text, jsonb) from public;
grant execute on function public.exam_commit_generated_paper(uuid, uuid, uuid, text, jsonb) to authenticated;

commit;
