-- ============================================================
-- Lecture Notes — ZIP source archives
-- 2026-10-03
-- Allows a ZIP archive to be stored as one lecture source container.
-- The application expands and reads every supported member (PDF/DOCX/TXT/MD)
-- before marking the material Ready.
-- ============================================================

alter table lecture_materials
  drop constraint if exists lecture_materials_source_type_check;

alter table lecture_materials
  add constraint lecture_materials_source_type_check
  check (source_type in ('pdf', 'docx', 'zip', 'text', 'url'));
