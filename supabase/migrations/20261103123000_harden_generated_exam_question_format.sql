begin;

-- Keep generated question structure aligned with the college paper format even
-- when a paper is inserted outside the TypeScript generation action.
create or replace function public.exam_validate_generated_question_format()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  parts jsonb;
  part jsonb;
  part_count integer;
  total_part_marks integer := 0;
  part_marks integer;
  part_label text;
  labels text[] := array[]::text[];
begin
  if new.origin <> 'generated' then
    return new;
  end if;

  if jsonb_typeof(new.body) is distinct from 'object' then
    raise exception 'Generated question body must be a JSON object';
  end if;

  parts := new.body->'parts';
  if jsonb_typeof(parts) is distinct from 'array' then
    raise exception 'Generated question body must include a parts array';
  end if;

  part_count := jsonb_array_length(parts);
  for part in select value from jsonb_array_elements(parts) loop
    if jsonb_typeof(part) is distinct from 'object'
      or jsonb_typeof(part->'label') is distinct from 'string'
      or btrim(coalesce(part->>'label', '')) = ''
      or jsonb_typeof(part->'text') is distinct from 'string'
      or btrim(coalesce(part->>'text', '')) = ''
      or jsonb_typeof(part->'own_marks') is distinct from 'number'
      or coalesce(part->>'own_marks', '') !~ '^[0-9]+$' then
      raise exception 'Generated question parts must have text, labels, and whole-number own_marks';
    end if;

    part_label := lower(btrim(part->>'label'));
    part_label := replace(replace(replace(replace(replace(part_label, '(', ''), ')', ''), '[', ''), ']', ''), '.', '');
    if part_label = '' then
      raise exception 'Generated question part labels must contain a usable label';
    end if;
    if part_label = any(labels) then
      raise exception 'Generated question part labels must be distinct';
    end if;
    labels := array_append(labels, part_label);

    part_marks := (part->>'own_marks')::integer;
    if part_marks < 1 then
      raise exception 'Generated question part marks must be positive';
    end if;
    total_part_marks := total_part_marks + part_marks;
  end loop;

  if new.question_type = 'short_answer' and part_count <> 0 then
    raise exception 'Short-answer questions cannot contain subquestions';
  end if;

  if new.question_type = 'structured' then
    if part_count < 2 or part_count > 3 then
      raise exception 'Structured questions must contain 2 or 3 subquestions';
    end if;
    if total_part_marks <> new.marks then
      raise exception 'Structured subquestion marks must add to the question mark value';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists exam_validate_generated_question_format on public.exam_questions;
create trigger exam_validate_generated_question_format
before insert or update of body, marks, question_type, origin
on public.exam_questions
for each row
execute function public.exam_validate_generated_question_format();

commit;
