-- ============================================================
-- Lecture Notes — Add processing_error to lecture_materials
-- Prevents silent material deletion on processing failure and
-- surfaces actionable diagnostics to the user interface.
-- ============================================================

alter table lecture_materials
  add column if not exists processing_error text;
