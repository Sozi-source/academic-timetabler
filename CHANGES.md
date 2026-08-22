# Teaching-documents fix — files changed

Extract this zip at your project root and let it overwrite. It only touches
files under src/features/teaching-documents/ — nothing else in your repo
is included, so it's safe to merge directly.

## Files replaced
- src/features/teaching-documents/zip-ingestion.ts
- src/features/teaching-documents/curriculum-registry.ts
- src/features/teaching-documents/zip-ingestion-actions.ts
- src/features/teaching-documents/tvet-standards.ts
- src/features/teaching-documents/record-of-work-actions.ts

## What changed
- ZIP ingestion now detects document type (scheme_of_work vs course_outline)
  per file instead of merging/overwriting content across types for the same
  unit code.
- persistUnitCurriculumToDatabase no longer hardcodes document_type:
  'course_outline' — it saves whatever type was actually detected, under a
  composite template id (tpl-tvet-<code>-<type>) instead of one shared id
  per unit.
- generateTVETCourseOutline / generateTVETSchemeOfWork now each pull their
  own document-typed curriculum instead of sharing one registry slot.
- Record of Work preload now specifically loads the scheme_of_work variant.
- Commit action now refuses to save anything without a confirmed document
  type, and the preview action returns unresolvedFiles for anything it
  couldn't classify.

## Manual follow-up still required (not code)
1. Run your typecheck/test suite after merging.
2. Write a migration to handle legacy rows saved under the old id format
   (tpl-tvet-<code>, no type suffix) — decide per row whether it was
   actually scheme_of_work or course_outline and re-save under the new id.
3. Update curriculum-zip-upload-dialog.tsx to display unresolvedFiles from
   the preview response and let the HOD assign a type manually — the
   commit action will now reject anything untagged, so this UI change is
   required for the ZIP upload flow to keep working.
4. Fix the source data issue found in Course_outlines.zip: the file under
   Milkah Wambui's "course outlines" folder is actually a Learning Plan
   (scheme of work) — move it to the correct folder before re-ingesting.
