begin;

-- The imported DCU 1102 outline repeats combined topic/subtopic prose across
-- its weekly rows. Retire only that known malformed active upload so the
-- curriculum viewer falls back to the curated Entrepreneurship schedule.
update public.curriculum_document_versions as version
set
  status = 'superseded',
  superseded_at = now(),
  updated_at = now()
from public.units as unit
where version.unit_id = unit.id
  and upper(regexp_replace(unit.code, '[^a-zA-Z0-9]', '', 'g')) = 'DCU1102'
  and version.document_type = 'course_outline'
  and version.status = 'active'
  and version.source_file_name = 'Academic_Planner_Course_Outlines_EXACT_System_Upload.xlsx'
  and case
    when jsonb_typeof(version.payload->'content') = 'array'
      then jsonb_array_length(version.payload->'content') >= 10
    else false
  end;

commit;
