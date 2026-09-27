begin;

-- Retire corrupted and cross-mapped legacy scheme_of_work versions that were mapped to the wrong units
-- (e.g. DHN 2304 Biochemistry II mapped to Nutrition in the Lifespan)
update public.curriculum_document_versions
set
  status = 'superseded',
  superseded_at = now(),
  updated_at = now()
where document_type = 'scheme_of_work'
  and status = 'active'
  and (
    -- Biochemistry II with Nutrition in the Lifespan
    (
      payload->'unit'->>'contentFamilyKey' = 'NUTRITION_IN_THE_LIFESPAN'
      and (payload->'unit'->>'unitName' ilike '%biochem%' or payload->'unit'->>'unitCode' ilike '%2304%')
    )
    -- Nutrition Anthropology with Nutrition Education
    or (
      payload->'unit'->>'contentFamilyKey' = 'NUTRITION_EDUCATION_AND_COUNSELLING'
      and payload->'unit'->>'unitName' ilike '%anthropology%'
    )
    -- Maternal and Child Nutrition with Nutrition Care Process
    or (
      payload->'unit'->>'contentFamilyKey' = 'INTRODUCTION_TO_NUTRITION_CARE_PROCESS'
      and payload->'unit'->>'unitName' ilike '%maternal%'
    )
    -- Food Production with Primary Health Care
    or (
      payload->'unit'->>'contentFamilyKey' = 'INTRODUCTION_TO_PRIMARY_HEALTH_CARE'
      and payload->'unit'->>'unitName' ilike '%food production%'
    )
    -- Trade Project with Diet Therapy
    or (
      payload->'unit'->>'contentFamilyKey' = 'DIET_THERAPY_II'
      and payload->'unit'->>'unitName' ilike '%project%'
    )
    -- Nutrition in the Lifecycle with Nutrition Assessment
    or (
      payload->'unit'->>'contentFamilyKey' = 'INTRODUCTION_TO_NUTRITION_ASSESSMENT_AND_SURVEILLANCE'
      and payload->'unit'->>'unitName' ilike '%lifecycle%'
    )
  );

commit;
