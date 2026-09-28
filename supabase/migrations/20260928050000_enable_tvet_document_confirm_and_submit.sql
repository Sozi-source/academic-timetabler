-- ----------------------------------------------------------------------------
-- 20260928050000_enable_tvet_document_confirm_and_submit.sql
-- Enables TVET Course Outline and Scheme of Work trainer confirmation & submission.
-- Ensures active TVET standard templates exist and relaxes legacy constraints.
-- ----------------------------------------------------------------------------

-- 1. Ensure TVET standard active templates exist in teaching_document_templates
insert into public.teaching_document_templates (
  id,
  document_type,
  name,
  version_number,
  status,
  storage_bucket,
  storage_path,
  original_filename,
  mime_type,
  file_size_bytes,
  notes
)
values
(
  '34664748-4a24-4c24-93f2-69e0827a5c76',
  'course_outline',
  'Standard TVET Course Outline Template v1.0',
  1,
  'active',
  'teaching-documents-private',
  'templates/tvet-standard-course_outline.docx',
  'TVET_Standard_course_outline.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  1024,
  'TVET Standard Template'
)
on conflict (id) do update set
  status = 'active',
  name = 'Standard TVET Course Outline Template v1.0',
  updated_at = now();

insert into public.teaching_document_templates (
  id,
  document_type,
  name,
  version_number,
  status,
  storage_bucket,
  storage_path,
  original_filename,
  mime_type,
  file_size_bytes,
  notes
)
values
(
  '205136bb-96e3-4a9e-8c9b-86f173726892',
  'scheme_of_work',
  'Standard TVET Scheme of Work Template v1.0',
  1,
  'active',
  'teaching-documents-private',
  'templates/tvet-standard-scheme_of_work.docx',
  'TVET_Standard_scheme_of_work.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  1024,
  'TVET Standard Template'
)
on conflict (id) do update set
  status = 'active',
  name = 'Standard TVET Scheme of Work Template v1.0',
  updated_at = now();

insert into public.teaching_document_templates (
  id,
  document_type,
  name,
  version_number,
  status,
  storage_bucket,
  storage_path,
  original_filename,
  mime_type,
  file_size_bytes,
  notes
)
values
(
  'f80297f6-9740-4a32-8ba3-0c0f16161989',
  'record_of_work',
  'Standard TVET Record of Work Template v1.0',
  1,
  'active',
  'teaching-documents-private',
  'templates/tvet-standard-record_of_work.docx',
  'TVET_Standard_record_of_work.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  1024,
  'TVET Standard Template'
)
on conflict (id) do update set
  status = 'active',
  name = 'Standard TVET Record of Work Template v1.0',
  updated_at = now();

-- 2. Relax template_id constraint so dynamic TVET documents can operate smoothly
alter table public.teaching_documents
  alter column template_id drop not null;
