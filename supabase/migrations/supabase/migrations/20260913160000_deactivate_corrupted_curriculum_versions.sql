-- Migration: 20260913160000_deactivate_corrupted_curriculum_versions.sql
-- Description: Supersedes and deactivates contaminated test import records in
-- curriculum_document_versions (e.g. Biochemistry erroneously mapped to Nutrition Epidemiology).

update public.curriculum_document_versions
set status = 'superseded'
where id in (
  '7d1e41bb-b2bc-4cce-84f2-3176856bb58b', -- Mismatched Biochemistry payload attached to DNDT 1303 Nutrition Epidemiology
  '253edeaf-5785-4f01-88d4-5c12df7a160e'  -- Corrupted topic sequence '12' in DHN 2304 Biochemistry II
)
and status = 'active';
