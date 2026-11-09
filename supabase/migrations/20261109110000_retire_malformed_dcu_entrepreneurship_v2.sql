begin;

-- The imported DCU 1102 outline from Clean_Batch_39_Units_Corrected_Codes.xlsx has
-- squashed topic/subtopic prose across rows, missing weeks (8, 13, 14), and 0 hours.
-- Retire that malformed active upload so the curriculum viewer falls back to the
-- curated 14-week Entrepreneurship schedule.
update public.curriculum_document_versions as version
set
  status = 'superseded',
  superseded_at = now(),
  updated_at = now()
from public.units as unit
where version.unit_id = unit.id
  and upper(regexp_replace(unit.code, '[^a-zA-Z0-9]', '', 'g')) = 'DCU1102'
  and version.status = 'active'
  and version.source_file_name = 'Clean_Batch_39_Units_Corrected_Codes.xlsx';

commit;
