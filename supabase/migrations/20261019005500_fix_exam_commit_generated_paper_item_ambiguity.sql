begin;

-- Fix PL/pgSQL variable / table-column ambiguity on "item" in exam_commit_generated_paper
-- (PostgreSQL error 42702: column reference "item" is ambiguous).
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
  v_item jsonb;
  v_question jsonb;
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
    select 1 from jsonb_array_elements(requested_items) as slot(item)
    where coalesce(slot.item->>'section_label', '') = ''
       or coalesce((slot.item->>'item_number')::integer, 0) < 1
       or coalesce((slot.item->>'marks')::integer, 0) < 1
       or jsonb_typeof(slot.item->'question') is distinct from 'object'
       or slot.item->'question'->>'question_type' = 'mcq'
  ) then
    raise exception 'Generated paper items must be complete written questions';
  end if;
  if exists (
    select 1 from jsonb_array_elements(requested_items) as slot(item)
    group by slot.item->>'section_label', slot.item->>'item_number' having count(*) > 1
  ) then
    raise exception 'Generated paper contains duplicate question positions';
  end if;
  if exists (
    select 1 from public.exam_blueprints b,
      jsonb_array_elements(b.layout->'sections') as sec(section)
    where b.id = requested_blueprint
      and (select count(*) from jsonb_array_elements(requested_items) as slot(item)
        where slot.item->>'section_label' = sec.section->>'label') <> (sec.section->>'question_count')::integer
  ) or exists (
    select 1 from jsonb_array_elements(requested_items) as slot(item)
    where not exists (
      select 1 from public.exam_blueprints b,
        jsonb_array_elements(b.layout->'sections') as sec(section)
      where b.id = requested_blueprint and sec.section->>'label' = slot.item->>'section_label'
        and (sec.section->>'marks_each')::integer = (slot.item->>'marks')::integer
        and sec.section->>'question_type' = slot.item->'question'->>'question_type'
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

  for v_item in select slot.item from jsonb_array_elements(requested_items) as slot(item) loop
    v_question := v_item->'question';
    if not exists (
      select 1 from public.exam_questions seed
      where seed.id = (v_question->>'seed_question_id')::uuid
        and seed.unit_id = requested_unit
        and seed.department_id = active_department
        and seed.origin = 'historical'
        and seed.source_file_id is not null
    ) then
      raise exception 'Every generated question must reference a historical question from this unit';
    end if;
    if nullif(v_question->>'max_similarity', '') is null
      or (v_question->>'max_similarity')::numeric > 1 or (v_question->>'max_similarity')::numeric < 0 then
      raise exception 'Question similarity score is invalid';
    end if;
    if jsonb_typeof(v_question->'body') is distinct from 'object'
      or coalesce(length(trim(v_question->>'body_text')), 0) < 20
      or v_question->>'derivation_mode' not in ('reword', 'rescenario', 'new_from_notes') then
      raise exception 'Generated question content is incomplete';
    end if;

    insert into public.exam_questions (
      department_id, unit_id, topic, learning_outcome, question_type, marks,
      difficulty, cognitive_level, body, body_text, origin, derivation_mode,
      seed_question_id, source_file_id, historical_year, historical_paper_kind,
      max_similarity, status, created_by
    )
    select active_department, requested_unit,
      coalesce(nullif(trim(v_question->>'topic'), ''), 'Historical question variation'),
      nullif(trim(v_question->>'learning_outcome'), ''), v_question->>'question_type',
      (v_item->>'marks')::smallint, coalesce(v_question->>'difficulty', 'medium'),
      nullif(v_question->>'cognitive_level', ''), v_question->'body', v_question->>'body_text',
      'generated', v_question->>'derivation_mode', seed.id, seed.source_file_id,
      seed.historical_year, seed.historical_paper_kind,
      (v_question->>'max_similarity')::numeric, 'draft', auth.uid()
    from public.exam_questions seed
    where seed.id = (v_question->>'seed_question_id')::uuid
    returning id into new_question;

    insert into public.exam_paper_items (
      department_id, paper_id, question_id, section_label, item_number,
      slot_spec, slot_status, marks
    ) values (
      active_department, new_paper, new_question, v_item->>'section_label',
      (v_item->>'item_number')::smallint,
      coalesce(v_item->'slot_spec', '{}'::jsonb),
      case when (v_question->>'max_similarity')::numeric > 0.25 then 'needs_review' else 'generated' end,
      (v_item->>'marks')::smallint
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
