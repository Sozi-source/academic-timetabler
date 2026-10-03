-- ============================================================
-- Unit-agnostic Python Notes Consolidation Engine + ZIP sources
-- 2026-10-03
-- ============================================================

alter table lecture_materials
  drop constraint if exists lecture_materials_source_type_check;

alter table lecture_materials
  add constraint lecture_materials_source_type_check
  check (source_type in ('pdf', 'docx', 'zip', 'text', 'url'));

alter table lecture_note_jobs
  add column if not exists generation_engine text not null default 'ai'
    check (generation_engine in ('ai', 'python'));

alter table lecture_note_jobs
  add column if not exists result_json jsonb;

alter table lecture_note_jobs
  add column if not exists attempt_count integer not null default 0;

alter table lecture_note_jobs
  add column if not exists engine_worker_id text;

alter table lecture_note_jobs
  add column if not exists started_at timestamp with time zone;

create index if not exists lecture_note_jobs_python_queue_idx
  on lecture_note_jobs (generation_engine, status, created_at)
  where generation_engine = 'python';

create or replace function claim_next_python_lecture_note_job(p_worker_id text)
returns setof lecture_note_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed lecture_note_jobs;
begin
  select * into claimed
  from lecture_note_jobs
  where generation_engine = 'python'
    and (
      status = 'pending'
      or (
        status = 'processing'
        and started_at is not null
        and started_at < now() - interval '2 hours'
      )
    )
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update lecture_note_jobs
  set status = 'processing',
      engine_worker_id = p_worker_id,
      started_at = now(),
      attempt_count = attempt_count + 1,
      error_message = null
  where id = claimed.id
  returning * into claimed;

  return next claimed;
end;
$$;

grant execute on function claim_next_python_lecture_note_job(text) to service_role;
