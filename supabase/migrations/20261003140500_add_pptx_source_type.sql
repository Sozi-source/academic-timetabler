-- ============================================================
-- Lecture Notes — Add pptx to source_type check constraint
-- ============================================================

alter table lecture_materials
  drop constraint if exists lecture_materials_source_type_check;

alter table lecture_materials
  add constraint lecture_materials_source_type_check
  check (source_type in ('pdf', 'docx', 'pptx', 'zip', 'text', 'url'));
