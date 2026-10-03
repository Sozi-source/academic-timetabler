-- ============================================================
-- Migration: Remove Lecture Notes Feature and All Associated Data
-- 2026-10-03: Completely root out lecture_materials, chunks, jobs, and storage
-- ============================================================

-- 1. Drop trigger on lecture_materials
drop trigger if exists lecture_materials_updated_at on lecture_materials;
drop function if exists update_lecture_materials_updated_at();

-- 2. Drop helper and search functions
drop function if exists match_lecture_chunks(vector, uuid, uuid, int, float);
drop function if exists claim_next_python_lecture_note_job(text);

-- 3. Drop tables (cascades RLS policies, foreign keys, and indexes)
drop table if exists lecture_material_chunks cascade;
drop table if exists lecture_note_jobs cascade;
drop table if exists lecture_materials cascade;

-- 4. Clean up storage policies
drop policy if exists lecture_notes_authenticated_select on storage.objects;
drop policy if exists lecture_notes_authenticated_insert on storage.objects;
drop policy if exists lecture_notes_authenticated_delete on storage.objects;
