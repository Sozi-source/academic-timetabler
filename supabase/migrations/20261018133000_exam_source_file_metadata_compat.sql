begin;

-- Older installations may already have exam_source_files, causing the
-- foundation migration's CREATE TABLE IF NOT EXISTS to skip newer metadata.
-- Add the columns consumed by past-paper imports without changing existing
-- source records.
alter table public.exam_source_files
  add column if not exists series text,
  add column if not exists trainer_name text,
  add column if not exists unit_code text,
  add column if not exists parse_notes jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.exam_source_files'::regclass
      and conname = 'exam_source_files_series_check'
  ) then
    alter table public.exam_source_files
      add constraint exam_source_files_series_check
      check (series is null or series in ('JAN-APR', 'MAY-AUG', 'SEP-DEC'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.exam_source_files'::regclass
      and conname = 'exam_source_files_parse_notes_array_check'
  ) then
    alter table public.exam_source_files
      add constraint exam_source_files_parse_notes_array_check
      check (jsonb_typeof(parse_notes) = 'array');
  end if;
end $$;

commit;
