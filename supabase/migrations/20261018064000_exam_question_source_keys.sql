begin;

-- Stable identity for each question extracted from a source paper. This lets
-- HOD tagging safely update a question without duplicating historical records.
alter table public.exam_questions
  add column if not exists source_question_key text;

alter table public.exam_questions
  drop constraint if exists exam_questions_source_question_key_length_check;
alter table public.exam_questions
  add constraint exam_questions_source_question_key_length_check
  check (source_question_key is null or length(trim(source_question_key)) between 1 and 120);

do $$
begin
  if exists (
    select 1
    from public.exam_questions
    where source_file_id is not null and source_question_key is not null
    group by source_file_id, source_question_key
    having count(*) > 1
  ) then
    raise exception 'Cannot add exam source-question uniqueness: duplicate source keys already exist';
  end if;
end;
$$;

create unique index if not exists exam_questions_source_question_unique
  on public.exam_questions (source_file_id, source_question_key);

commit;
