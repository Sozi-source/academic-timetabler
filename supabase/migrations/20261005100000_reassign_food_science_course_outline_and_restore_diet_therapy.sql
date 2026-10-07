-- Reassign erroneously uploaded Food Science course outline from CHN 1301 to CHN 1202 and CND 2106,
-- and restore authentic Diet Therapy Theory course outline (version 1) on CHN 1301.

-- 1. Update version f21099c8 to target CHN 1202 (Food Science)
update public.curriculum_document_versions
set 
  unit_id = '4cd70f07-428c-4ee7-8e48-3fcb1494f1e4',
  status = 'active',
  version_number = 1,
  payload = jsonb_set(
    jsonb_set(
      payload,
      '{unit,unitCode}',
      '"CHN 1202"'::jsonb
    ),
    '{unit,unitName}',
    '"Food Science"'::jsonb
  )
where id = 'f21099c8-1c46-4b28-a6ab-82411d8fcf61';

-- 2. Insert active course outline for shared Diploma Food Science unit (CND 2106)
insert into public.curriculum_document_versions (
  department_id,
  unit_id,
  document_type,
  version_number,
  status,
  source_type,
  source_file_name,
  created_by,
  payload
)
select 
  department_id,
  '092bac80-c7ae-4765-b8ad-2eb8de5796a7'::uuid,
  'course_outline',
  1,
  'active',
  source_type,
  source_file_name,
  created_by,
  jsonb_set(
    jsonb_set(
      payload,
      '{unit,unitCode}',
      '"CND 2106"'::jsonb
    ),
    '{unit,unitName}',
    '"Food Science"'::jsonb
  )
from public.curriculum_document_versions
where id = 'f21099c8-1c46-4b28-a6ab-82411d8fcf61'
on conflict do nothing;

-- 3. Retire erroneous duplicate Food Science version under CHN 1301
update public.curriculum_document_versions
set 
  status = 'superseded',
  retired_at = now()
where id = '9f334f46-28f7-49c8-aebc-1f170ecee70f';

-- 4. Restore genuine Diet Therapy Theory course outline on CHN 1301 to active
update public.curriculum_document_versions
set 
  status = 'active',
  superseded_at = null
where id = '1ad31166-bffe-49dc-a23a-364f5a5cf369';
