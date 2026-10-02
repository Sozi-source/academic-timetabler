-- ============================================================================
-- Migration: Create Storage Bucket for Lecture Notes Materials
-- ============================================================================

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'lecture-notes',
  'lecture-notes',
  false,
  52428800, -- 50MB
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ]::text[]
)
on conflict (id)
do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- RLS policies for authenticated trainers/admins to upload and read lecture materials
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'lecture_notes_authenticated_select'
  ) then
    create policy lecture_notes_authenticated_select
      on storage.objects for select
      to authenticated
      using (bucket_id = 'lecture-notes');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'lecture_notes_authenticated_insert'
  ) then
    create policy lecture_notes_authenticated_insert
      on storage.objects for insert
      to authenticated
      with check (bucket_id = 'lecture-notes');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'lecture_notes_authenticated_delete'
  ) then
    create policy lecture_notes_authenticated_delete
      on storage.objects for delete
      to authenticated
      using (bucket_id = 'lecture-notes');
  end if;
end;
$$;
